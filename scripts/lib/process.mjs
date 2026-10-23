// Overpass の取得結果を shrines の行に変換する（ネットワークを使わない純粋な処理）
import { polygonOf, pointInPolygon, representativePoint, PointGrid } from './geometry.mjs'

const PARKING_NEARBY_M = 200
const STATION_MAX_M = 30000
const BUS_STOP_MAX_M = 10000
const PLACE_MAX_M = 3000

// 神社の大きさ（shrine_size）の目安
const LARGE_AREA_M2 = 10000   // 境内がこれ以上なら大きな神社
const SMALL_AREA_M2 = 100     // 境内がこれ未満で Wikipedia の記事もなければ小さな祠
// 社格がこれに当たれば大きな神社（一宮・旧官幣社／国幣社・別表神社・勅祭社）
const MAJOR_RANK = /一宮|一之宮|一の宮|官幣|国幣|別表|勅祭/

// 多角形の面積（度²）を、その緯度での平方メートルに直す
const toM2 = (deg2, lat) => deg2 * 111320 * 111320 * Math.cos((lat * Math.PI) / 180)

// 神社の大きさを決める。'large' 大きな神社 / 'medium' ふつうの神社 / 'small' 小さな祠
//   s: { named, wayside, hasPolygon, areaM2, hasWiki, shrineRank }
//   rankKnown: 社格を調べたか（Wikipedia を取らなかったときは false）。
//              false のときは、社格がわからないと決められない「ふつう」を null（今の値のまま）にする
export function classifyShrineSize(s, { rankKnown = true } = {}) {
  if (s.shrineRank && MAJOR_RANK.test(s.shrineRank)) return 'large'
  if (s.wayside || !s.named) return 'small'
  if (s.hasPolygon && s.areaM2 >= LARGE_AREA_M2) return 'large'
  if (!s.hasWiki && (!s.hasPolygon || s.areaM2 < SMALL_AREA_M2)) return 'small'
  return rankKnown ? 'medium' : null
}

const isShrine = (t) =>
  t.religion === 'shinto' && (t.amenity === 'place_of_worship' || t.historic === 'wayside_shrine')

const nameOf = (t) => t?.['name:ja'] || t?.name || null

export function toHiragana(s) {
  return s ? s.normalize('NFKC').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)) : null
}

export function addressOf(t) {
  if (t['addr:full']) return t['addr:full']
  const block = t['addr:block_number']
  const house = t['addr:housenumber']
  const num = block && house ? `${block}-${house}` : block || house || ''
  const parts = [t['addr:province'], t['addr:city'], t['addr:suburb'], t['addr:quarter'], t['addr:neighbourhood'], t['addr:street']]
    .filter(Boolean).join('')
  const s = parts + num
  return s || null
}

export function processPrefecture(elements, prefecture) {
  const shrines = []
  const stations = []
  const busStops = []
  const parkings = []
  const places = []
  const municipalities = []

  for (const el of elements) {
    const t = el.tags || {}
    if (isShrine(t)) {
      const poly = polygonOf(el)
      const pt = representativePoint(el, poly)
      if (pt) shrines.push({ el, tags: t, poly, pt, area: poly ? poly.area : 0 })
      continue
    }
    if (el.type === 'relation' && t.boundary === 'administrative' && t.admin_level === '7') {
      const poly = polygonOf(el)
      if (poly && nameOf(t)) municipalities.push({ name: nameOf(t), poly })
      continue
    }
    const pt = representativePoint(el, null)
    if (!pt) continue
    const name = nameOf(t)
    if (t.railway === 'station' && name) stations.push({ ...pt, name: name.endsWith('駅') ? name : `${name}駅` })
    else if (t.highway === 'bus_stop' && name) busStops.push({ ...pt, name })
    else if (t.amenity === 'parking') parkings.push(pt)
    else if (t.place && name) places.push({ ...pt, name })
  }

  // 境内社の除外：自分より大きい別の神社の敷地内にあるものは除く
  const polys = shrines.filter((s) => s.poly)
  const kept = shrines.filter((s) =>
    !polys.some((o) => o !== s && o.area > s.area && pointInPolygon(s.pt.lat, s.pt.lon, o.poly)))

  const stationGrid = new PointGrid(stations, 0.1)
  const busGrid = new PointGrid(busStops, 0.02)
  const parkingGrid = new PointGrid(parkings, 0.01)
  const placeGrid = new PointGrid(places, 0.02)

  const rows = kept.map(({ el, tags: t, poly, pt }) => {
    const lat = pt.lat
    const lng = pt.lon
    const municipality = t['addr:city'] || municipalities.find((m) => pointInPolygon(lat, lng, m.poly))?.name || null

    // 近くの地名（町・字など）。同じ名前の神社を見分けるのに使う
    const nearPlace = placeGrid.nearest(lat, lng, PLACE_MAX_M)?.point.name || null
    const locality = t['addr:quarter'] || t['addr:suburb'] || t['addr:neighbourhood'] || nearPlace

    const named = Boolean(nameOf(t))
    let name = nameOf(t)
    if (!name) name = `名称不明の社（${nearPlace || municipality || prefecture}）`

    const station = stationGrid.nearest(lat, lng, STATION_MAX_M)
    const bus = busGrid.nearest(lat, lng, BUS_STOP_MAX_M)

    let parking = 'unknown'
    const nearParking = parkingGrid.nearest(lat, lng, PARKING_NEARBY_M)
    if (poly && parkings.some((p) => pointInPolygon(p.lat, p.lon, poly))) parking = 'dedicated'
    else if (nearParking) parking = 'nearby'

    const wp = t.wikipedia && /^ja:/.test(t.wikipedia) ? t.wikipedia.slice(3) : null

    return {
      osm_ref: `${el.type}/${el.id}`,
      wikidata_id: t.wikidata || null,
      wikipedia_title: wp,
      name,
      name_kana: toHiragana(t['name:ja-Hira'] || t['name:ja-Kana'] || t['name:ja_kana']),
      prefecture,
      municipality,
      locality: locality && locality !== municipality ? locality : null,
      address: addressOf(t),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      deities: null,
      benefits: [],
      shrine_rank: null,
      founded: null,
      annual_festival: null,
      honden_style: null,
      nearest_station: station?.point.name ?? null,
      nearest_station_m: station ? Math.round(station.distance) : null,
      nearest_bus_stop: bus?.point.name ?? null,
      nearest_bus_stop_m: bus ? Math.round(bus.distance) : null,
      parking,
      features: null,
      features_source: null,
      shrine_size: null,
      // 大きさを決める材料。社格がわかってから classifyShrineSize で決める（DBには入れない）
      size_signals: {
        named,
        wayside: t.historic === 'wayside_shrine',
        hasPolygon: Boolean(poly),
        areaM2: poly ? Math.round(toM2(poly.area, lat)) : 0,
        hasWiki: Boolean(t.wikipedia || t.wikidata),
      },
    }
  })

  return { rows, excluded: shrines.length - kept.length }
}
