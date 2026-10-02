import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processPrefecture, toHiragana, addressOf } from '../scripts/lib/process.mjs'
import { assembleRings, polygonOf, pointInPolygon } from '../scripts/lib/geometry.mjs'
import { trimExtract } from '../scripts/lib/wiki.mjs'

// 正方形（左下 lat,lon と一辺 d 度）
const square = (lat, lon, d) => [
  { lat, lon }, { lat, lon: lon + d }, { lat: lat + d, lon: lon + d }, { lat: lat + d, lon }, { lat, lon },
]

const shrineTags = (name) => ({ amenity: 'place_of_worship', religion: 'shinto', ...(name ? { name } : {}) })

const elements = [
  // A: 敷地のある大きな神社（約1km四方）
  { type: 'way', id: 1, tags: { ...shrineTags('大神社'), wikidata: 'Q1', 'name:ja-Kana': 'オオジンジャ' }, geometry: square(35.0, 139.0, 0.01) },
  // B: A の敷地内の境内社 → 除外
  { type: 'node', id: 2, lat: 35.005, lon: 139.005, tags: shrineTags('境内社') },
  // A の敷地内の駐車場 → 専用駐車場
  { type: 'node', id: 3, lat: 35.002, lon: 139.002, tags: { amenity: 'parking' } },
  // C: 名前のない祠。近くに集落「山田」
  { type: 'node', id: 4, lat: 35.1, lon: 139.1, tags: { historic: 'wayside_shrine', religion: 'shinto' } },
  { type: 'node', id: 5, lat: 35.101, lon: 139.101, tags: { place: 'hamlet', name: '山田' } },
  // 駅とバス停
  { type: 'node', id: 6, lat: 35.11, lon: 139.1, tags: { railway: 'station', name: '山田' } },
  { type: 'node', id: 7, lat: 35.1005, lon: 139.1, tags: { highway: 'bus_stop', name: '山田口' } },
  // D: 2本のウェイでできたマルチポリゴンの神社、E はその中 → 除外
  { type: 'relation', id: 8, tags: { ...shrineTags('二本杉神社'), type: 'multipolygon' }, members: [
    { type: 'way', role: 'outer', geometry: [{ lat: 35.2, lon: 139.2 }, { lat: 35.2, lon: 139.21 }, { lat: 35.21, lon: 139.21 }] },
    { type: 'way', role: 'outer', geometry: [{ lat: 35.2, lon: 139.2 }, { lat: 35.21, lon: 139.2 }, { lat: 35.21, lon: 139.21 }] },
  ] },
  { type: 'node', id: 9, lat: 35.205, lon: 139.205, tags: shrineTags('摂社') },
  // 市区町村の境界（全体を含む）
  { type: 'relation', id: 10, tags: { boundary: 'administrative', admin_level: '7', name: '山田町' }, members: [
    { type: 'way', role: 'outer', geometry: square(34.9, 138.9, 0.5) },
  ] },
  // 近くに駐車場がある神社
  { type: 'node', id: 11, lat: 35.3, lon: 139.3, tags: { ...shrineTags('駐車場前神社'), 'addr:province': '東京都', 'addr:city': '山田市', 'addr:block_number': '1', 'addr:housenumber': '2' } },
  { type: 'way', id: 12, center: { lat: 35.3005, lon: 139.3 }, tags: { amenity: 'parking' } },
]

test('境内社を除外し、アクセス情報を計算する', () => {
  const { rows, excluded } = processPrefecture(elements, '東京都')
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]))
  assert.equal(excluded, 2)
  assert.deepEqual(Object.keys(byName).sort(), ['二本杉神社', '名称不明の社（山田）', '大神社', '駐車場前神社'].sort())

  const a = byName['大神社']
  assert.equal(a.osm_ref, 'way/1')
  assert.equal(a.parking, 'dedicated')
  assert.equal(a.name_kana, 'おおじんじゃ')
  assert.equal(a.wikidata_id, 'Q1')
  assert.equal(a.municipality, '山田町')

  const c = byName['名称不明の社（山田）']
  assert.equal(c.nearest_station, '山田駅')
  assert.ok(Math.abs(c.nearest_station_m - 1112) < 5)
  assert.equal(c.nearest_bus_stop, '山田口')
  assert.equal(c.parking, 'unknown')

  const p = byName['駐車場前神社']
  assert.equal(p.parking, 'nearby')
  assert.equal(p.municipality, '山田市')
  assert.equal(p.address, '東京都山田市1-2')
})

test('開いたウェイをつないでリングにする', () => {
  const rings = assembleRings([
    [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }],
    [{ lat: 1, lon: 1 }, { lat: 0, lon: 1 }],
    [{ lat: 1, lon: 1 }, { lat: 1, lon: 0 }, { lat: 0, lon: 0 }],
  ])
  assert.equal(rings.length, 1)
  assert.equal(rings[0].length, 5)
})

test('穴あきポリゴンの内外判定', () => {
  const poly = polygonOf({ type: 'relation', members: [
    { type: 'way', role: 'outer', geometry: square(0, 0, 10) },
    { type: 'way', role: 'inner', geometry: square(4, 4, 2) },
  ] })
  assert.ok(pointInPolygon(1, 1, poly))
  assert.ok(!pointInPolygon(5, 5, poly))
  assert.ok(!pointInPolygon(11, 11, poly))
})

test('文字の変換と住所', () => {
  assert.equal(toHiragana('ヤサカジンジャ'), 'やさかじんじゃ')
  assert.equal(addressOf({ 'addr:full': '京都府京都市東山区祇園町北側625' }), '京都府京都市東山区祇園町北側625')
  assert.equal(addressOf({}), null)
})

test('要約は文の区切りで切る', () => {
  const s = 'あ'.repeat(300) + '。' + 'い'.repeat(400) + '。'
  assert.equal(trimExtract(s), 'あ'.repeat(300) + '。')
  assert.equal(trimExtract('短い。'), '短い。')
})
