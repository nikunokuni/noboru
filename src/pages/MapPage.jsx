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
import { serverSearch, serverSearchByDeity } from '../lib/shrineIndex'
import { matchDeityNames, deityAliases } from '../lib/deities'
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

// ご祭神で探すとき、どの神様として探しているかを見せる（「スサノオ」→ 素戔嗚尊）
function DeityHint({ query }) {
  const names = query.trim() ? matchDeityNames(query).slice(0, 3) : []
  if (!names.length) return null
  return (
    <p className="muted small mt8">
      {names.map((n) => {
        const aliases = deityAliases(n).slice(0, 3)
        return <span key={n} className="block">「{n}」{aliases.length > 0 && `（${aliases.join('・')} など）`}として探しています</span>
      })}
    </p>
  )
}

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
  // 検索の条件。神社詳細のご祭神から来たときはご祭神で探す
  const [mode, setMode] = useState('all')
  const [kind, setKind] = useState(params.get('deity') ? 'deity' : 'name')
  const [query, setQuery] = useState(params.get('deity') || '')
  const [prefecture, setPrefecture] = useState('')
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
  const searchQuery = kind === 'deity' ? '' : query
  const deity = kind === 'deity' ? query : null
  const include = useMemo(() => {
    if (!index || mode === 'all' || mode === 'nobody') return null
    const ids = index.raw.id
    return mode === 'mine' ? (i) => myIds.has(ids[i]) : (i) => !myIds.has(ids[i])
  }, [index, mode, myIds])
  const opts = { prefecture: prefecture || null, unvisitedOnly: mode === 'nobody', deity, include }
  const active = Boolean(query.trim() || prefecture || mode !== 'all')

  // 条件に合う神社の一覧の位置（全件。地図に出す）
  const positions = useMemo(
    () => (index ? searchPositions(index, searchQuery, { ...opts, limit: Infinity }) : null),
    [index, revision, searchQuery, deity, prefecture, mode, include], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const results = useMemo(
    () => (index ? (active ? positions.slice(0, LIST_LIMIT).map((i) => getItem(index, i)) : null) : serverResults),
    [index, positions, active, serverResults],
  )

  // 神社一覧がまだ端末にないときはサーバーで探す（地図には出せない）
  useEffect(() => {
    const serverActive = query.trim() || prefecture || mode === 'nobody'
    if (index || !serverActive) { setServerResults(null); return }
    let alive = true
    const t = setTimeout(() => {
      const search = kind === 'deity' && query.trim() ? serverSearchByDeity : serverSearch
      search(query, { prefecture: prefecture || null, unvisitedOnly: mode === 'nobody', limit: 30 })
        .then((r) => alive && setServerResults(r)).catch(() => alive && setServerResults([]))
    }, 400)
    return () => { alive = false; clearTimeout(t) }
  }, [index, kind, query, prefecture, mode])

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
          <div className="tab-row">
            <button className={`tab-btn ${kind === 'name' ? 'active' : ''}`} onClick={() => setKind('name')}>神社名で探す</button>
            <button className={`tab-btn ${kind === 'deity' ? 'active' : ''}`} onClick={() => setKind('deity')}>ご祭神で探す</button>
          </div>
          <input className="field-input" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
            placeholder={kind === 'deity' ? 'ご祭神の名前（例：スサノオ、稲荷、八幡）' : '神社名・よみがな（例：八幡 世田谷）'} />
          {kind === 'deity' && <DeityHint query={query} />}
          <div className="filter-row">
            <select className="select" value={prefecture} onChange={(e) => setPrefecture(e.target.value)} aria-label="都道府県">
              <option value="">全国</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {status === 'downloading' && <p className="muted small">神社一覧を準備中…（サーバーで検索しています）</p>}

          {results && (
            <div className="mt8">
              {results.length === 0 && <p className="muted small center">見つかりませんでした</p>}
              {results.map((r) => <ShrineRow key={r.id} item={r} onClick={() => navigate(`/shrine/${r.id}`)} right="›" />)}
              {index && positions.length > LIST_LIMIT && (
                <p className="muted small center">一覧は{LIST_LIMIT}件まで表示しています。ほかは地図で見られます</p>
              )}
            </div>
          )}
          {!results && !index && (query.trim() || prefecture || mode === 'nobody') && <div className="spinner" />}
        </div>
      </div>
    </div>
  )
}
