// マップ（記録するを兼ねる）：上に地図、下に検索。下で絞り込んだ神社だけを地図にピンで出す（地図は動かさない）
// 開くと現在地のまわりを出す。ピンを押すと吹き出しに「参拝を記録する」「詳しく見る」「☆」
// 検索していないときは、下に地図の中の神社を現在地から近い順に出し、押すと記録画面へ
// 地図と検索の間のバーを上下に動かして、それぞれの広さを変えられる
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import Supercluster from 'supercluster'
import 'leaflet/dist/leaflet.css'
import ShrineRow from '../components/ShrineRow'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyShrineIds } from '../lib/records'
import { useWishes } from '../hooks/useWishes'
import { useLivePosition } from '../hooks/useLivePosition'
import { distanceM, formatDistance, inBounds, nearbyHalfM, squareBounds } from '../lib/geo'
import { getItem, nearbyIndex, searchPositions } from '../lib/indexCore'
import { serverSearch } from '../lib/shrineIndex'
import { SEARCH_TAGS, hasSizeColumn, hasTagColumns, largeShrineTags, tagFilter, tagsFromParams } from '../lib/searchTags'
import { PREFECTURES } from '../lib/constants'

const MODES = [
  { key: 'all', label: 'すべて' },
  { key: 'mine', label: '自分の参拝' },
  { key: 'notmine', label: '未参拝' },
  { key: 'nobody', label: 'まだ誰も' },
  { key: 'wish', label: '☆', aria: '☆を付けた神社' },
]

const JAPAN = { center: [36.5, 138.0], zoom: 5 }
// マップにない神社の申請：この拡大より手前では場所が粗すぎるので申請させない
const PLACE_MIN_ZOOM = 15
const LIST_LIMIT = 100
// 開いたとき・「現在地」を押したときの拡大
const HERE_ZOOM = 15
// 近い順の一覧は、この拡大より手前では出さない（広すぎると何千社にもなるので）
const NEARBY_MIN_ZOOM = 13
const NEARBY_LIST_MAX = 50
// 大きな神社から集めたご祭神・ご利益のタグは、閉じているときはこの数だけ出す
const MORE_FOLDED = 8

// 地図の高さの割合（地図＋検索の高さに対して）。端末に覚えておく
const SPLIT_KEY = 'noboru.mapSplit'
const SPLIT_MIN = 0.15
const SPLIT_MAX = 0.85
const clampSplit = (v) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v))
function loadSplit() {
  try {
    const v = Number(localStorage.getItem(SPLIT_KEY))
    return v ? clampSplit(v) : 0.55
  } catch { return 0.55 }
}
function saveSplit(v) {
  try { localStorage.setItem(SPLIT_KEY, String(v)) } catch { /* 保存できなくても動く */ }
}

const clusterIcon = (count, mode) => {
  const size = count < 10 ? 30 : count < 100 ? 36 : count < 1000 ? 42 : 48
  return L.divIcon({
    html: `<div class="cluster cluster-${mode}" style="width:${size}px;height:${size}px">${count >= 1000 ? `${Math.round(count / 100) / 10}k` : count}</div>`,
    className: '', iconSize: [size, size],
  })
}

// ☆を付けた神社は、ピンに小さな★を重ねる
const pinIcon = (kind, wish) => L.divIcon({
  html: `<div class="pin pin-${kind}">${wish ? '<span class="pin-star">★</span>' : ''}</div>`, className: '', iconSize: [16, 16],
})

const hereIcon = L.divIcon({ html: '<div class="here-dot"></div>', className: '', iconSize: [14, 14] })

// 地図と検索の間のバー。指で上下に動かす
function SplitHandle({ containerRef, onChange, onEnd }) {
  const dragging = useRef(false)
  const move = (e) => {
    if (!dragging.current) return
    const rect = containerRef.current.getBoundingClientRect()
    onChange(clampSplit((e.clientY - rect.top) / rect.height))
  }
  const end = (e) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    onEnd()
  }
  return (
    <div className="split-handle" role="separator" aria-orientation="horizontal" aria-label="地図と検索の広さを変える"
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId) }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <span className="split-grip" />
    </div>
  )
}

export default function MapPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { index, revision, status, refreshVisited } = useShrineIndex()
  const { pending, syncRevision } = usePendingRecords()
  // 検索の条件。神社詳細のタグから来たとき（/map?deity=… など）はそのタグを選んでおく
  const [mode, setMode] = useState('all')
  const [query, setQuery] = useState('')
  const [prefecture, setPrefecture] = useState('')
  const [tags, setTags] = useState(() => tagsFromParams(params))
  const [unfolded, setUnfolded] = useState({}) // 大きな神社から集めたタグを全部出している項目
  const [serverResults, setServerResults] = useState(null)
  const [serverIds, setServerIds] = useState([])
  const [split, setSplit] = useState(loadSplit)
  const splitRef = useRef(split)
  const splitEl = useRef(null)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  // マップにない神社の申請：地図を動かして、真ん中の印を神社に合わせる
  const [placing, setPlacing] = useState(false)
  const [zoom, setZoom] = useState(JAPAN.zoom)
  // いま地図に映っている範囲 [[南, 西], [北, 東]]
  const [view, setView] = useState(null)
  // 現在地（見張り続ける）。最初に取れたら、地図を動かしていなければ現在地へ
  const { position } = useLivePosition()
  const movedRef = useRef(false)
  const centeredRef = useRef(false)
  const hereRef = useRef(null)

  useEffect(() => { refreshVisited() }, [refreshVisited])

  useEffect(() => {
    if (!user) { setServerIds([]); return }
    fetchMyShrineIds(user.id).then(setServerIds).catch(() => {})
  }, [user, syncRevision])

  // ☆（行きたい神社）。ピンの描き直しでは最新のものを読む（☆を押すたびに描き直すと吹き出しが閉じるので）
  const wishes = useWishes()
  // ☆で絞り込んでいるときだけ、☆の変化で絞り込みをやり直す
  const wishIds = mode === 'wish' ? wishes.ids : null
  const wishRef = useRef(wishes)
  wishRef.current = wishes

  const myIds = useMemo(() => new Set([...serverIds, ...pending.map((p) => p.shrine_id)].map(Number)), [serverIds, pending])

  // 地図の初期化
  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView(JAPAN.center, JAPAN.zoom)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    map.on('zoomend', () => setZoom(map.getZoom()))
    const reportView = () => {
      const b = map.getBounds()
      setView([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]])
    }
    map.on('moveend', reportView)
    reportView()
    // 人が動かしたら、現在地が届いても地図を飛ばさない
    const markMoved = () => { movedRef.current = true }
    map.on('dragstart', markMoved)
    map.on('dblclick', markMoved)
    map.getContainer().addEventListener('wheel', markMoved, { passive: true })
    map.getContainer().addEventListener('touchstart', (e) => { if (e.touches.length > 1) markMoved() }, { passive: true })
    // 地図の広さが変わったら（バーを動かした・画面の向き）、表示を合わせる
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(mapEl.current)
    return () => {
      ro.disconnect(); map.remove(); mapRef.current = null
      // 消した地図の印を使い回さない
      hereRef.current = null; centeredRef.current = false; movedRef.current = false
    }
  }, [])

  // 現在地の点と誤差の円。最初に取れたときだけ、動かしていなければ現在地へ
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    const at = [position.lat, position.lng]
    if (hereRef.current) {
      hereRef.current.dot.setLatLng(at)
      hereRef.current.circle.setLatLng(at).setRadius(position.accuracy || 0)
    } else {
      hereRef.current = {
        circle: L.circle(at, { radius: position.accuracy || 0, interactive: false, color: '#2b7bd9', weight: 1, opacity: 0.5, fillColor: '#2b7bd9', fillOpacity: 0.1 }).addTo(map),
        dot: L.marker(at, { icon: hereIcon, interactive: false, keyboard: false, zIndexOffset: -100 }).addTo(map),
      }
    }
    if (!centeredRef.current && !movedRef.current) map.setView(at, HERE_ZOOM, { animate: false })
    centeredRef.current = true
  }, [position])

  const goHere = () => {
    if (!position) return
    mapRef.current.setView([position.lat, position.lng], Math.max(HERE_ZOOM, mapRef.current.getZoom()))
  }

  // 検索の条件
  const tagCount = Object.values(tags).reduce((n, t) => n + t.length, 0)
  const include = useMemo(() => {
    if (!index) return null
    const ids = index.raw.id
    const mineTest = mode === 'mine' ? (i) => myIds.has(ids[i])
      : mode === 'notmine' ? (i) => !myIds.has(ids[i])
        : wishIds ? (i) => wishIds.has(ids[i]) : null
    const tagTest = tagFilter(index, tags)
    if (mineTest && tagTest) return (i) => mineTest(i) && tagTest(i)
    return mineTest || tagTest
  }, [index, mode, myIds, wishIds, tags])
  const active = Boolean(query.trim() || prefecture || mode !== 'all' || tagCount)

  // 条件に合う神社の一覧の位置（全件。地図に出す）
  const positions = useMemo(
    () => (index ? searchPositions(index, query, { prefecture: prefecture || null, unvisitedOnly: mode === 'nobody', include, limit: Infinity }) : null),
    [index, revision, query, prefecture, mode, include],
  )

  const toggleTag = (group, tag) => setTags((prev) => {
    const list = prev[group] || []
    const next = list.some((t) => t.key === tag.key) ? list.filter((t) => t.key !== tag.key) : [...list, tag]
    return { ...prev, [group]: next }
  })
  // ご祭神・ご利益は、決まったタグのあとに大きな神社から集めたものを多い順に並べる（閉じているときは途中まで）
  // 神社詳細から来たご祭神・ご利益・社格など、どちらにもないものも選べるように並べる
  const largeTags = useMemo(() => (index ? largeShrineTags(index) : {}), [index])
  const tagGroups = SEARCH_TAGS.map((g) => {
    const more = largeTags[g.key] || []
    const selected = tags[g.key] || []
    const shown = unfolded[g.key] ? more : more.filter((t, i) => i < MORE_FOLDED || selected.some((x) => x.key === t.key))
    const extra = selected.filter((t) => !g.tags.some((x) => x.key === t.key) && !more.some((x) => x.key === t.key))
    return { ...g, tags: [...g.tags, ...shown, ...extra], hidden: more.length - shown.length }
  })

  const results = useMemo(
    () => (index ? (active ? positions.slice(0, LIST_LIMIT).map((i) => getItem(index, i)) : null) : serverResults),
    [index, positions, active, serverResults],
  )

  // 神社一覧がまだ端末にないときはサーバーで探す（地図には出せない。タグは使えない）
  const serverActive = Boolean(query.trim() || prefecture || mode === 'nobody')
  useEffect(() => {
    if (index || !serverActive) { setServerResults(null); return }
    let alive = true
    const t = setTimeout(() => {
      serverSearch(query, { prefecture: prefecture || null, unvisitedOnly: mode === 'nobody', limit: 30 })
        .then((r) => alive && setServerResults(r)).catch(() => alive && setServerResults([]))
    }, 400)
    return () => { alive = false; clearTimeout(t) }
  }, [index, serverActive, query, prefecture, mode])

  const cluster = useMemo(() => {
    if (!index || !positions) return null
    const r = index.raw
    const sc = new Supercluster({ radius: 60, maxZoom: 15 })
    sc.load(positions.map((i) => ({
      type: 'Feature',
      properties: { i, mine: myIds.has(r.id[i]) },
      geometry: { type: 'Point', coordinates: [r.lng[i] / 1e5, r.lat[i] / 1e5] },
    })))
    return sc
  }, [index, positions, myIds])

  // 表示範囲が変わるたびにピンを描き直す（条件を変えても地図は動かさない）
  useEffect(() => {
    const map = mapRef.current
    if (!map || !cluster || !index) return
    const render = () => {
      const b = map.getBounds()
      const zoom = Math.round(map.getZoom())
      const layer = layerRef.current
      layer.clearLayers()
      for (const f of cluster.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom)) {
        const [lng, lat] = f.geometry.coordinates
        if (f.properties.cluster) {
          L.marker([lat, lng], { icon: clusterIcon(f.properties.point_count, mode) })
            .on('click', () => map.setView([lat, lng], Math.min(cluster.getClusterExpansionZoom(f.properties.cluster_id), 18)))
            .addTo(layer)
        } else {
          const { i, mine } = f.properties
          const r = index.raw
          const pin = mine ? 'mine' : r.vis[i] ? 'visited' : 'nobody'
          const popup = document.createElement('div')
          popup.className = 'map-popup'
          const title = document.createElement('div')
          title.className = 'map-popup-name'
          title.textContent = r.name[i]
          const sub = document.createElement('div')
          sub.className = 'map-popup-sub'
          sub.textContent = mine ? '参拝済み' : r.vis[i] ? '誰かが参拝済み' : 'まだ誰も参拝していません'
          const btn = document.createElement('button')
          btn.className = 'map-popup-btn'
          btn.textContent = '詳しく見る'
          btn.onclick = () => navigate(`/shrine/${r.id[i]}`)
          const rec = document.createElement('button')
          rec.className = 'map-popup-record'
          rec.textContent = '参拝を記録する'
          rec.onclick = () => navigate(`/record/${r.id[i]}`)
          // ☆：吹き出しから付け外しする。押したらボタンとピンの★をその場で変える
          const shrineId = r.id[i]
          const star = document.createElement('button')
          const wishOn = () => wishRef.current.ids.has(Number(shrineId))
          const paint = (on) => {
            star.className = `wish-star map-popup-star ${on ? 'on' : ''}`
            star.textContent = on ? '★' : '☆'
            star.setAttribute('aria-label', on ? '☆を外す' : '☆を付ける')
          }
          paint(wishOn())
          const actions = document.createElement('div')
          actions.className = 'map-popup-actions'
          actions.append(btn, star)
          popup.append(title, sub, rec, actions)
          const marker = L.marker([lat, lng], { icon: pinIcon(pin, wishOn()) }).bindPopup(popup).addTo(layer)
          star.onclick = async () => {
            const was = wishOn()
            await wishRef.current.toggle(shrineId)
            const now = wishOn()
            if (now !== was) { paint(now); marker.setIcon(pinIcon(pin, now)) }
          }
        }
      }
    }
    // 吹き出しを開いている間は描き直さない（吹き出しが入るように地図が少し動くと、描き直しで閉じてしまうので）
    let popupOpen = false
    const onOpen = () => { popupOpen = true }
    // 閉じたら描き直す（別のピンを押して開き直したときは描き直さない）
    const onClose = () => { popupOpen = false; setTimeout(() => { if (!popupOpen && mapRef.current === map) render() }, 0) }
    const onMove = () => { if (!popupOpen) render() }
    render()
    map.on('moveend', onMove)
    map.on('popupopen', onOpen)
    map.on('popupclose', onClose)
    return () => { map.off('moveend', onMove); map.off('popupopen', onOpen); map.off('popupclose', onClose) }
  }, [cluster, index, mode, navigate, wishes.ready])

  const changeSplit = (v) => { splitRef.current = v; setSplit(v) }

  // 現在地のまわり（記録画面の「現地で記録」と同じ範囲）で申請したときだけ、現地からの申請にする
  // 遠くの場所での申請は、承認しても参拝記録を作らない
  const request = () => {
    const c = mapRef.current.getCenter()
    const near = position && inBounds(squareBounds(position.lat, position.lng, nearbyHalfM(position.accuracy)), c.lat, c.lng)
    navigate(`/request?lat=${c.lat.toFixed(6)}&lng=${c.lng.toFixed(6)}${near ? '' : '&from=map'}`)
  }

  // 検索していないとき：地図の中の神社を現在地から近い順に
  const nearby = useMemo(() => {
    if (active || !index || !position || !view || zoom < NEARBY_MIN_ZOOM) return null
    const [[s, w], [n, e]] = view
    const cLat = (s + n) / 2
    const cLng = (w + e) / 2
    return nearbyIndex(index, cLat, cLng, { radiusM: distanceM(cLat, cLng, n, e), limit: Infinity })
      .filter((x) => inBounds(view, x.lat, x.lng))
      .map((x) => ({ ...x, distance: distanceM(position.lat, position.lng, x.lat, x.lng) }))
      .sort((a, b) => a.distance - b.distance)
  }, [active, index, revision, position, view, zoom])

  return (
    <div className="app-shell map-shell">
      <div ref={splitEl} className="map-split">
        <div className="map-pane" style={{ height: `${split * 100}%` }}>
          <div ref={mapEl} className="map" />
          {!placing && !index && (
            <div className="map-overlay">
              {status === 'unavailable' ? '神社一覧を取得できませんでした' : '神社一覧を準備中…'}
            </div>
          )}
          {placing ? (<>
            <div className="map-center-pin"><div className="new-pin" /></div>
            <div className="map-overlay">{zoom < PLACE_MIN_ZOOM ? '神社のあたりまで拡大してください' : '地図を動かして、印を神社に合わせる'}</div>
            <div className="map-place-actions">
              <button type="button" className="btn-primary" onClick={request} disabled={zoom < PLACE_MIN_ZOOM}>この場所で申請する</button>
              <button type="button" className="btn-secondary" onClick={() => setPlacing(false)}>やめる</button>
            </div>
          </>) : (
            <button type="button" className="map-request-btn" onClick={() => setPlacing(true)}>マップにない神社を申請</button>
          )}
          {position && !placing && (
            <button type="button" className="map-here-btn" onClick={goHere} aria-label="現在地に戻る">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /></svg>
            </button>
          )}
          {!placing && index && mode === 'mine' && myIds.size === 0 && (
            <div className="map-overlay">{user ? 'まだ参拝の記録がありません' : 'ログインすると自分の参拝が表示されます'}</div>
          )}
          {!placing && index && mode === 'wish' && wishes.ids.size === 0 && (
            <div className="map-overlay">{user ? '神社の吹き出し・一覧・神社詳細の☆で付けられます' : 'ログインすると☆を付けた神社が表示されます'}</div>
          )}
        </div>
        <SplitHandle containerRef={splitEl} onChange={changeSplit} onEnd={() => saveSplit(splitRef.current)} />
        <div className="map-search">
          <div className="chip-row map-modes">
            {MODES.map((m) => (
              <button key={m.key} className={`chip ${mode === m.key ? 'active' : ''}`} aria-label={m.aria} onClick={() => setMode(m.key)}>{m.label}</button>
            ))}
            <span className="muted small map-count">{positions ? `${positions.length.toLocaleString()}社` : ''}</span>
          </div>
          <input className="field-input" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
            placeholder="神社名・よみがな（例：八幡 世田谷）" aria-label="神社名で探す" />
          <div className="filter-row">
            <select className="select" value={prefecture} onChange={(e) => setPrefecture(e.target.value)} aria-label="都道府県">
              <option value="">全国</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {tagCount > 0 && <button className="text-btn map-clear" onClick={() => setTags({})}>タグをすべて外す</button>}
          </div>
          {!active && index && position && (
            <div className="mt8 map-nearby">
              <div className="section-mini">地図の中の神社（現在地から近い順）</div>
              {!nearby && <p className="muted small">地図を拡大すると、近くの神社が一覧で出ます</p>}
              {nearby?.length === 0 && <p className="muted small">地図の中に登録された神社はありません（地図を縮小すると探せます）</p>}
              {nearby?.slice(0, NEARBY_LIST_MAX).map((s) => (
                <ShrineRow key={s.id} item={s} onClick={() => navigate(`/record/${s.id}`)} right={formatDistance(s.distance)} />
              ))}
              {nearby?.length > NEARBY_LIST_MAX && <p className="muted small center mt8">近い{NEARBY_LIST_MAX}社まで出しています（ほかは地図のピンから）</p>}
            </div>
          )}
          {tagGroups.map((g) => (
            <div key={g.key} className="tag-group">
              <span className="tag-group-label">{g.label}</span>
              <div className="tag-group-chips">
                {g.tags.map((t) => {
                  const on = (tags[g.key] || []).some((x) => x.key === t.key)
                  return <button key={t.key} className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => toggleTag(g.key, t)}>{t.label}</button>
                })}
                {(g.hidden > 0 || unfolded[g.key]) && (
                  <button className="text-btn tag-more" onClick={() => setUnfolded((u) => ({ ...u, [g.key]: !u[g.key] }))}>
                    {unfolded[g.key] ? '閉じる' : `もっと見る（ほか${g.hidden}）`}
                  </button>
                )}
                {g.note && <p className="muted small tag-note">{g.note}</p>}
              </div>
            </div>
          ))}
          {index && !hasTagColumns(index) && tagCount > 0 && (
            <p className="muted small mt8">神社一覧が古いため、御朱印・ご利益・社格・駐車場のタグでは絞り込めません（管理者が神社一覧を更新すると使えます）</p>
          )}
          {index && hasTagColumns(index) && !hasSizeColumn(index) && tags.size?.length > 0 && (
            <p className="muted small mt8">神社一覧が古いため、大きさのタグでは絞り込めません（管理者が神社一覧を更新すると使えます）</p>
          )}
          {status === 'downloading' && <p className="muted small">神社一覧を準備中…（サーバーで検索しています。タグは準備ができてから使えます）</p>}

          {results && (
            <div className="mt8">
              {results.length === 0 && <p className="muted small center">見つかりませんでした</p>}
              {results.map((r) => <ShrineRow key={r.id} item={r} onClick={() => navigate(`/shrine/${r.id}`)} right="›" />)}
              {index && positions.length > LIST_LIMIT && (
                <p className="muted small center">一覧は{LIST_LIMIT}件まで表示しています。ほかは地図で見られます</p>
              )}
            </div>
          )}
          {!results && !index && serverActive && <div className="spinner" />}
        </div>
      </div>
    </div>
  )
}
