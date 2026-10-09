// マップ：上に地図、下に検索。下で絞り込んだ神社だけを地図にピンで出す（地図は動かさない）
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
import { getCurrentPosition } from '../lib/geo'
import { getItem, searchPositions } from '../lib/indexCore'
import { serverSearch } from '../lib/shrineIndex'
import { SEARCH_TAGS, hasTagColumns, tagFilter, tagsFromParams } from '../lib/searchTags'
import { PREFECTURES } from '../lib/constants'

const MODES = [
  { key: 'all', label: 'すべて' },
  { key: 'mine', label: '自分の参拝' },
  { key: 'notmine', label: '未参拝' },
  { key: 'nobody', label: 'まだ誰も' },
]

const JAPAN = { center: [36.5, 138.0], zoom: 5 }
const LIST_LIMIT = 100

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

const pinIcon = (kind) => L.divIcon({ html: `<div class="pin pin-${kind}"></div>`, className: '', iconSize: [16, 16] })

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
  const [serverResults, setServerResults] = useState(null)
  const [serverIds, setServerIds] = useState([])
  const [split, setSplit] = useState(loadSplit)
  const splitRef = useRef(split)
  const splitEl = useRef(null)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

  useEffect(() => { refreshVisited() }, [refreshVisited])

  useEffect(() => {
    if (!user) { setServerIds([]); return }
    fetchMyShrineIds(user.id).then(setServerIds).catch(() => {})
  }, [user, syncRevision])

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
    let moved = false
    map.once('movestart', () => { moved = true })
    getCurrentPosition({ timeout: 10000 }).then((p) => {
      // 先にユーザーが地図を動かしていたら、現在地へは飛ばない
      if (p && mapRef.current && !moved) map.setView([p.lat, p.lng], 13)
    })
    // 地図の広さが変わったら（バーを動かした・画面の向き）、表示を合わせる
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(mapEl.current)
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
  }, [])

  // 検索の条件
  const tagCount = Object.values(tags).reduce((n, t) => n + t.length, 0)
  const include = useMemo(() => {
    if (!index) return null
    const ids = index.raw.id
    const mineTest = mode === 'mine' ? (i) => myIds.has(ids[i]) : mode === 'notmine' ? (i) => !myIds.has(ids[i]) : null
    const tagTest = tagFilter(index, tags)
    if (mineTest && tagTest) return (i) => mineTest(i) && tagTest(i)
    return mineTest || tagTest
  }, [index, mode, myIds, tags])
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
  // 神社詳細から来たご祭神・ご利益・社格など、決まったタグにないものも選べるように並べる
  const tagGroups = SEARCH_TAGS.map((g) => {
    const extra = (tags[g.key] || []).filter((t) => !g.tags.some((x) => x.key === t.key))
    return { ...g, tags: [...g.tags, ...extra] }
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
          popup.append(title, sub, btn)
          L.marker([lat, lng], { icon: pinIcon(pin) }).bindPopup(popup).addTo(layer)
        }
      }
    }
    render()
    map.on('moveend', render)
    return () => { map.off('moveend', render) }
  }, [cluster, index, mode, navigate])

  const changeSplit = (v) => { splitRef.current = v; setSplit(v) }

  return (
    <div className="app-shell map-shell">
      <div ref={splitEl} className="map-split">
        <div className="map-pane" style={{ height: `${split * 100}%` }}>
          <div ref={mapEl} className="map" />
          {!index && (
            <div className="map-overlay">
              {status === 'unavailable' ? '神社一覧を取得できませんでした' : '神社一覧を準備中…'}
            </div>
          )}
          {index && mode === 'mine' && myIds.size === 0 && (
            <div className="map-overlay">{user ? 'まだ参拝の記録がありません' : 'ログインすると自分の参拝が表示されます'}</div>
          )}
        </div>
        <SplitHandle containerRef={splitEl} onChange={changeSplit} onEnd={() => saveSplit(splitRef.current)} />
        <div className="map-search">
          <div className="chip-row map-modes">
            {MODES.map((m) => (
              <button key={m.key} className={`chip ${mode === m.key ? 'active' : ''}`} onClick={() => setMode(m.key)}>{m.label}</button>
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
          {tagGroups.map((g) => (
            <div key={g.key} className="tag-group">
              <span className="tag-group-label">{g.label}</span>
              <div className="tag-group-chips">
                {g.tags.map((t) => {
                  const on = (tags[g.key] || []).some((x) => x.key === t.key)
                  return <button key={t.key} className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => toggleTag(g.key, t)}>{t.label}</button>
                })}
              </div>
            </div>
          ))}
          {index && !hasTagColumns(index) && tagCount > 0 && (
            <p className="muted small mt8">神社一覧が古いため、御朱印・ご利益・社格・駐車場のタグでは絞り込めません（管理者が神社一覧を更新すると使えます）</p>
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
