// マップ：自分の参拝 / 自分の未参拝 / まだ誰も行っていない
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import Supercluster from 'supercluster'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyShrineIds } from '../lib/records'
import { getCurrentPosition } from '../lib/geo'

const MODES = [
  { key: 'mine', label: '自分の参拝' },
  { key: 'notmine', label: '未参拝' },
  { key: 'nobody', label: 'まだ誰も' },
]

const JAPAN = { center: [36.5, 138.0], zoom: 5 }

function buildPoints(index, mode, myIds) {
  const r = index.raw
  const features = []
  for (let i = 0; i < index.size; i++) {
    const mine = myIds.has(r.id[i])
    if (mode === 'mine' && !mine) continue
    if (mode === 'notmine' && mine) continue
    if (mode === 'nobody' && r.vis[i] === 1) continue
    features.push({
      type: 'Feature',
      properties: { i, mine },
      geometry: { type: 'Point', coordinates: [r.lng[i] / 1e5, r.lat[i] / 1e5] },
    })
  }
  return features
}

const clusterIcon = (count, mode) => {
  const size = count < 10 ? 30 : count < 100 ? 36 : count < 1000 ? 42 : 48
  return L.divIcon({
    html: `<div class="cluster cluster-${mode}" style="width:${size}px;height:${size}px">${count >= 1000 ? `${Math.round(count / 100) / 10}k` : count}</div>`,
    className: '', iconSize: [size, size],
  })
}

const pinIcon = (kind) => L.divIcon({ html: `<div class="pin pin-${kind}"></div>`, className: '', iconSize: [16, 16] })

export default function MapPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { index, revision, status, refreshVisited } = useShrineIndex()
  const { pending, syncRevision } = usePendingRecords()
  const [mode, setMode] = useState('mine')
  const [serverIds, setServerIds] = useState([])
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const fittedRef = useRef(false)

  useEffect(() => { refreshVisited() }, [refreshVisited])

  useEffect(() => {
    if (!user) { setServerIds([]); return }
    fetchMyShrineIds(user.id).then(setServerIds).catch(() => {})
  }, [user, syncRevision])

  const myIds = useMemo(() => new Set([...serverIds, ...pending.map((p) => p.shrine_id)]), [serverIds, pending])

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
    getCurrentPosition({ timeout: 10000 }).then((p) => {
      if (p && mapRef.current && !fittedRef.current) map.setView([p.lat, p.lng], 13)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  const cluster = useMemo(() => {
    if (!index) return null
    const sc = new Supercluster({ radius: 60, maxZoom: 15 })
    sc.load(buildPoints(index, mode, myIds))
    return sc
  }, [index, revision, mode, myIds])

  // 表示範囲が変わるたびにピンを描き直す
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
          const kind = mine ? 'mine' : r.vis[i] ? 'visited' : 'nobody'
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
          L.marker([lat, lng], { icon: pinIcon(kind) }).bindPopup(popup).addTo(layer)
        }
      }
    }
    render()
    map.on('moveend', render)
    return () => { map.off('moveend', render) }
  }, [cluster, index, mode, navigate])

  // 「自分の参拝」は最初に全体が入るように合わせる
  useEffect(() => {
    const map = mapRef.current
    if (!map || !index || mode !== 'mine' || fittedRef.current || myIds.size === 0) return
    const pts = []
    for (const id of myIds) {
      const i = index.byId.get(Number(id))
      if (i != null) pts.push([index.raw.lat[i] / 1e5, index.raw.lng[i] / 1e5])
    }
    if (pts.length) {
      fittedRef.current = true
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 })
    }
  }, [index, mode, myIds])

  const count = useMemo(() => (cluster ? cluster.points.length : 0), [cluster])

  return (
    <div className="app-shell map-shell">
      <div className="map-toolbar">
        {MODES.map((m) => (
          <button key={m.key} className={`chip ${mode === m.key ? 'active' : ''}`} onClick={() => setMode(m.key)}>{m.label}</button>
        ))}
        <span className="muted small map-count">{index ? `${count.toLocaleString()}社` : ''}</span>
      </div>
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
  )
}
