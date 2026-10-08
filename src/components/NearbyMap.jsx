// 「記録する」の小さな地図。現在地を中心に約2km四方で固定（動かせない）
// 神社のピンを押すと onPick。placing のときは地図を押した場所に申請用のピンを動かす
// placing の間は、ピンを打ちやすいように最初の範囲の中で拡大・移動できる
import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function shrineIcon(shrine) {
  const el = document.createElement('div')
  el.className = 'nearby-pin'
  const dot = document.createElement('span')
  dot.className = `pin pin-${shrine.visited ? 'visited' : 'nobody'}`
  const label = document.createElement('span')
  label.className = 'nearby-pin-label'
  label.textContent = shrine.name
  el.append(dot, label)
  return L.divIcon({ html: el, className: '', iconSize: [16, 16], iconAnchor: [8, 8] })
}

const hereIcon = L.divIcon({ html: '<div class="here-dot"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
const newPinIcon = L.divIcon({ html: '<div class="new-pin"></div>', className: '', iconSize: [24, 32], iconAnchor: [12, 32] })

export default function NearbyMap({ position, bounds, shrines, onPick, placing, newPin, onPlace }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const shrineLayer = useRef(null)
  const hereMarker = useRef(null)
  const newPinMarker = useRef(null)
  const boundsRef = useRef(bounds)
  const placingRef = useRef(placing)
  const zoomControl = useRef(null)
  // 地図のイベントからは最新の関数を呼ぶ
  const handlers = useRef({})
  handlers.current = { onPick, onPlace, placing }

  useEffect(() => {
    const map = L.map(mapEl.current, {
      zoomControl: false, attributionControl: true, zoomSnap: 0,
      dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map)
    shrineLayer.current = L.layerGroup().addTo(map)
    map.on('click', (e) => { if (handlers.current.placing) handlers.current.onPlace(e.latlng) })
    mapRef.current = map
    // 画面の幅が変わったら同じ範囲に合わせ直す
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
      if (!placingRef.current) map.fitBounds(boundsRef.current, { animate: false })
    })
    ro.observe(mapEl.current)
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
  }, [])

  // 表示範囲と現在地
  useEffect(() => {
    const map = mapRef.current
    boundsRef.current = bounds
    map.fitBounds(bounds, { animate: false })
    const at = [position.lat, position.lng]
    if (hereMarker.current) hereMarker.current.setLatLng(at)
    else hereMarker.current = L.marker(at, { icon: hereIcon, interactive: false, keyboard: false }).addTo(map)
  }, [bounds, position])

  // ピンを置く間だけ拡大・移動できる。最初の範囲より外・より縮小はできない
  useEffect(() => {
    const map = mapRef.current
    placingRef.current = placing
    const gestures = [map.dragging, map.touchZoom, map.scrollWheelZoom]
    map.setMaxBounds(null)
    map.setMinZoom(0)
    map.fitBounds(boundsRef.current, { animate: false })
    if (placing) {
      map.setMinZoom(map.getZoom())
      map.options.maxBoundsViscosity = 1
      map.setMaxBounds(boundsRef.current)
      gestures.forEach((g) => g.enable())
      zoomControl.current = L.control.zoom({ position: 'topright' }).addTo(map)
    } else {
      gestures.forEach((g) => g.disable())
      zoomControl.current?.remove()
      zoomControl.current = null
    }
  }, [placing, bounds])

  // 神社のピン。申請のピンを置いている間は押せない（地図を押した扱いにする）
  useEffect(() => {
    const layer = shrineLayer.current
    layer.clearLayers()
    for (const s of shrines) {
      const m = L.marker([s.lat, s.lng], { icon: shrineIcon(s), title: s.name, interactive: !placing, keyboard: !placing })
      m.on('click', () => handlers.current.onPick(s))
      m.addTo(layer)
    }
  }, [shrines, placing])

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
    </div>
  )
}
