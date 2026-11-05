// 「記録する」の地図。開くと現在地を中心に約2km四方（home）を出し、あとは指で自由に動かせる
// 動かしたら onView(見えている範囲) を呼ぶ。「現在地に戻る」で home に戻る
// 神社のピンを押すと onPick、地図の空いたところを押すと onMapClick。placing のときは地図を押した場所に onPlace
import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// 神社が多いと名前が重なって読めないので、名前は地図の真ん中から近い順にこの数と☆の神社・選んだ神社だけに出す（ほかは点だけ）
const LABEL_MAX = 12

// 神社がこれより多いときは、点を小さくする
const SMALL_PIN_FROM = 60

function shrineIcon(shrine, showLabel, small, selected) {
  const el = document.createElement('div')
  el.className = `nearby-pin${small ? ' small' : ''}${selected ? ' selected' : ''}`
  const dot = document.createElement('span')
  dot.className = `pin pin-${shrine.visited ? 'visited' : 'nobody'}`
  const label = document.createElement('span')
  label.className = 'nearby-pin-label'
  label.textContent = shrine.wish ? `★ ${shrine.name}` : shrine.name
  if (shrine.wish) label.classList.add('wish')
  el.append(dot)
  if (showLabel) el.append(label)
  const size = small && !selected ? 10 : 16
  return L.divIcon({ html: el, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

const hereIcon = L.divIcon({ html: '<div class="here-dot"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
const newPinIcon = L.divIcon({ html: '<div class="new-pin"></div>', className: '', iconSize: [24, 32], iconAnchor: [12, 32] })

export default function NearbyMap({ position, accuracy, home, shrines, selectedId, onPick, onMapClick, onView, recenter, placing, newPin, onPlace }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const shrineLayer = useRef(null)
  const hereMarker = useRef(null)
  const hereCircle = useRef(null)
  const newPinMarker = useRef(null)
  const homeRef = useRef(home)
  // 指で動かしたら、位置が更新されても地図を勝手に戻さない（「現在地に戻る」を押すまで）
  const movedRef = useRef(false)
  const [moved, setMoved] = useState(false)
  // 地図のイベントからは最新の関数を呼ぶ
  const handlers = useRef({})
  handlers.current = { onPick, onMapClick, onView, onPlace, placing }

  const reportView = (map) => {
    const b = map.getBounds()
    handlers.current.onView?.([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]])
  }
  const goHome = () => {
    const map = mapRef.current
    movedRef.current = false
    setMoved(false)
    map.fitBounds(homeRef.current, { animate: false })
    reportView(map)
  }

  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true, zoomSnap: 0, minZoom: 5 })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    shrineLayer.current = L.layerGroup().addTo(map)
    map.on('click', (e) => {
      if (handlers.current.placing) handlers.current.onPlace(e.latlng)
      else handlers.current.onMapClick?.()
    })
    // 人が動かしたときだけ（fitBounds などでは起きない）
    const markMoved = () => { movedRef.current = true; setMoved(true) }
    map.on('dragstart', markMoved)
    map.getContainer().addEventListener('touchstart', (e) => { if (e.touches.length > 1) markMoved() }, { passive: true })
    map.getContainer().addEventListener('wheel', markMoved, { passive: true })
    map.on('dblclick', markMoved)
    map.getContainer().querySelector('.leaflet-control-zoom')?.addEventListener('click', markMoved)
    map.on('moveend', () => reportView(map))
    mapRef.current = map
    map.fitBounds(homeRef.current, { animate: false })
    reportView(map)
    // 画面の幅が変わったら、動かしていなければ同じ範囲に合わせ直す
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
      if (!movedRef.current) map.fitBounds(homeRef.current, { animate: false })
    })
    ro.observe(mapEl.current)
    return () => {
      ro.disconnect(); map.remove(); mapRef.current = null
      // 消した地図の印を使い回さない（作り直した地図に出なくなるので）
      hereMarker.current = null; hereCircle.current = null; newPinMarker.current = null
    }
  }, [])

  // 最初の範囲（現在地が更新されたら、動かしていなければ合わせ直す）
  useEffect(() => {
    homeRef.current = home
    if (!movedRef.current) mapRef.current.fitBounds(home, { animate: false })
  }, [home])

  // 測り直した・現在地を直したときなどは、動かしていても最初の範囲に戻す
  useEffect(() => { if (recenter) goHome() }, [recenter])

  // 現在地と誤差の円（この中のどこかにいる）
  useEffect(() => {
    const map = mapRef.current
    const at = [position.lat, position.lng]
    if (hereMarker.current) hereMarker.current.setLatLng(at)
    else hereMarker.current = L.marker(at, { icon: hereIcon, interactive: false, keyboard: false }).addTo(map)
    const radius = accuracy || 0
    if (hereCircle.current) hereCircle.current.setLatLng(at).setRadius(radius)
    else {
      hereCircle.current = L.circle(at, {
        radius, interactive: false, color: '#2b7bd9', weight: 1, opacity: 0.5, fillColor: '#2b7bd9', fillOpacity: 0.1,
      }).addTo(map)
    }
  }, [position, accuracy])

  // 神社のピン。申請のピンを置いている間は押せない（地図を押した扱いにする）
  useEffect(() => {
    const layer = shrineLayer.current
    layer.clearLayers()
    // shrines は地図の真ん中から近い順に並んでいる
    shrines.forEach((s, i) => {
      const selected = String(s.id) === String(selectedId)
      const icon = shrineIcon(s, i < LABEL_MAX || s.wish || selected, shrines.length > SMALL_PIN_FROM, selected)
      const m = L.marker([s.lat, s.lng], { icon, title: s.name, interactive: !placing, keyboard: !placing, zIndexOffset: selected ? 500 : 0 })
      m.on('click', () => handlers.current.onPick(s))
      m.addTo(layer)
    })
  }, [shrines, placing, selectedId])

  // 申請用のピン
  useEffect(() => {
    const map = mapRef.current
    if (!newPin) {
      newPinMarker.current?.remove()
      newPinMarker.current = null
      return
    }
    const at = [newPin.lat, newPin.lng]
    if (newPinMarker.current) newPinMarker.current.setLatLng(at)
    else newPinMarker.current = L.marker(at, { icon: newPinIcon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map)
  }, [newPin])

  // Leaflet が class を足すので、地図そのものの div の className は変えない
  return (
    <div className={`nearby-map ${placing ? 'placing' : ''}`}>
      <div ref={mapEl} className="nearby-map-canvas" />
      <button type="button" className={`nearby-home-btn ${moved ? 'moved' : ''}`} onClick={goHome} aria-label="現在地に戻る" title="現在地に戻る">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
