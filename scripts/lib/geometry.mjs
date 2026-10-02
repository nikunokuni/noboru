// 取り込み処理用の簡単な幾何計算（緯度経度をそのまま平面として扱う。県単位の判定には十分）
import { distanceM } from '../../src/lib/geo.js'

const key = (p) => `${p.lat},${p.lon}`

// 端点でつながるウェイ列を閉じたリングにまとめる（マルチポリゴンの outer / inner 用）
export function assembleRings(ways) {
  const pending = ways.filter((w) => w && w.length >= 2).map((w) => w.slice())
  const rings = []
  while (pending.length) {
    let ring = pending.shift()
    let guard = 0
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 10000) {
      const tail = key(ring[ring.length - 1])
      const i = pending.findIndex((w) => key(w[0]) === tail || key(w[w.length - 1]) === tail)
      if (i < 0) break
      const [w] = pending.splice(i, 1)
      ring = ring.concat((key(w[0]) === tail ? w : w.slice().reverse()).slice(1))
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring)
  }
  return rings
}

function bboxOf(rings) {
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity
  for (const ring of rings) for (const p of ring) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }
  return { minLat, minLon, maxLat, maxLon }
}

export function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j].lon + ring[i].lon) * (ring[j].lat - ring[i].lat)
  }
  return Math.abs(a / 2)
}

// Overpass の `out geom` 要素から多角形を作る。面でなければ null
export function polygonOf(el) {
  let outers = []
  let inners = []
  if (el.type === 'way' && el.geometry) {
    const g = el.geometry
    if (g.length >= 4 && key(g[0]) === key(g[g.length - 1])) outers = [g]
  } else if (el.type === 'relation' && el.members) {
    const ways = (role) => el.members.filter((m) => m.type === 'way' && m.geometry && role(m.role)).map((m) => m.geometry)
    outers = assembleRings(ways((r) => r === 'outer' || r === ''))
    inners = assembleRings(ways((r) => r === 'inner'))
  }
  if (!outers.length) return null
  const area = outers.reduce((s, r) => s + ringArea(r), 0) - inners.reduce((s, r) => s + ringArea(r), 0)
  return { outers, inners, bbox: bboxOf(outers), area }
}

export function pointInRing(lat, lon, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a.lat > lat) !== (b.lat > lat) && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside
  }
  return inside
}

export function pointInPolygon(lat, lon, poly) {
  const b = poly.bbox
  if (lat < b.minLat || lat > b.maxLat || lon < b.minLon || lon > b.maxLon) return false
  return poly.outers.some((r) => pointInRing(lat, lon, r)) && !poly.inners.some((r) => pointInRing(lat, lon, r))
}

// 代表点：ノードは座標、面は外周の頂点の平均、それ以外は範囲の中心
export function representativePoint(el, poly) {
  if (el.type === 'node') return { lat: el.lat, lon: el.lon }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon }
  if (poly) {
    const ring = poly.outers[0]
    const pts = ring.slice(0, -1)
    const p = {
      lat: pts.reduce((s, q) => s + q.lat, 0) / pts.length,
      lon: pts.reduce((s, q) => s + q.lon, 0) / pts.length,
    }
    // くぼんだ形で平均が外に出たら頂点を使う
    return pointInPolygon(p.lat, p.lon, poly) ? p : { lat: ring[0].lat, lon: ring[0].lon }
  }
  if (el.geometry?.length) return { lat: el.geometry[0].lat, lon: el.geometry[0].lon }
  if (el.bounds) return { lat: (el.bounds.minlat + el.bounds.maxlat) / 2, lon: (el.bounds.minlon + el.bounds.maxlon) / 2 }
  return null
}

// 最寄り点を探すための格子索引
export class PointGrid {
  constructor(points, cellDeg = 0.05) {
    this.cell = cellDeg
    this.cells = new Map()
    for (const p of points) {
      const k = this.#key(p.lat, p.lon)
      if (!this.cells.has(k)) this.cells.set(k, [])
      this.cells.get(k).push(p)
    }
  }

  #key(lat, lon) {
    return `${Math.floor(lat / this.cell)},${Math.floor(lon / this.cell)}`
  }

  // maxM 以内で最も近い点と距離。なければ null
  nearest(lat, lon, maxM) {
    const ring = Math.ceil(maxM / (111000 * this.cell * Math.cos((lat * Math.PI) / 180))) + 1
    const cy = Math.floor(lat / this.cell)
    const cx = Math.floor(lon / this.cell)
    let best = null
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const list = this.cells.get(`${cy + dy},${cx + dx}`)
        if (!list) continue
        for (const p of list) {
          const d = distanceM(lat, lon, p.lat, p.lon)
          if (d <= maxM && (!best || d < best.distance)) best = { point: p, distance: d }
        }
      }
    }
    return best
  }
}
