import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processPrefecture, toHiragana, addressOf } from '../scripts/lib/process.mjs'
import { assembleRings, polygonOf, pointInPolygon } from '../scripts/lib/geometry.mjs'
import { trimExtract, parseShrineInfobox, infoboxColumns, cleanWikiValue } from '../scripts/lib/wiki.mjs'
import { parseMuniJs, gsiAddress, cleanTownName } from '../scripts/lib/gsi.mjs'

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
  assert.equal(c.locality, '山田')     // 近くの地名（同じ名前の神社の区別用）
  assert.equal(a.locality, null)       // 3km 以内に地名がない

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

test('国土地理院の逆ジオコーダーの結果から住所を作る', () => {
  const munis = parseMuniJs(`GSI.MUNI_ARRAY["13112"] = '13,東京都,13112,世田谷区';
GSI.MUNI_ARRAY["11101"] = '11,埼玉県,11101,さいたま市　西区';
GSI.MUNI_ARRAY["1100"] = '1,北海道,1100,札幌市';`)
  assert.equal(munis.get(13112), '世田谷区')
  assert.equal(munis.get(11101), 'さいたま市西区')
  assert.deepEqual(gsiAddress({ muniCd: '13112', lv01Nm: '上町' }, '東京都', munis), { address: '東京都世田谷区上町', town: '上町' })
  assert.deepEqual(gsiAddress({ muniCd: '01100', lv01Nm: '－' }, '北海道', munis), { address: '北海道札幌市', town: null })
  assert.equal(gsiAddress({ muniCd: '99999', lv01Nm: 'x' }, '東京都', munis), null)
  assert.equal(gsiAddress(null, '東京都', munis), null)
  assert.equal(cleanTownName('-'), null)
})

test('駅・バス停を取らないと、どの神社にも駅・バス停が入らない', () => {
  const noTransit = elements.filter((e) => !e.tags?.railway && !e.tags?.highway)
  const { rows } = processPrefecture(noTransit, '東京都')
  assert.ok(rows.every((r) => r.nearest_station == null && r.nearest_bus_stop == null))
})

test('Wikipedia の神社のインフォボックスから社格・創建・例祭・ご祭神を取り出す', () => {
  const wikitext = `{{otheruses|x}}
{{Infobox 神社
|名称 = 氷川神社
|画像 = [[ファイル:Hikawa.jpg|200px]]
|主祭神 = [[須佐之男命]]<br />[[稲田姫命]]<br />大己貴命
|社格 = [[式内社]]（[[名神大社]]）<br />[[武蔵国]][[一宮]]<br />旧[[官幣大社]]
|創建 = （伝）[[孝昭天皇]]3年<ref>社伝による</ref>
|例祭 = [[8月1日]]{{要出典|date=2020年1月}}
|本殿の様式 = [[流造]]
|主な神事 =
}}
'''氷川神社'''は…`
  const f = parseShrineInfobox(wikitext)
  assert.equal(f.名称, '氷川神社')
  assert.equal(f.画像, undefined)
  assert.equal(f.主な神事, undefined)
  assert.deepEqual(infoboxColumns(f), {
    deities: '素戔嗚尊、櫛稲田姫命、大国主命',
    shrine_rank: '式内社（名神大社）、武蔵国一宮、旧官幣大社',
    founded: '（伝）孝昭天皇3年',
    annual_festival: '8月1日',
    honden_style: '流造',
  })
  assert.equal(parseShrineInfobox('{{Infobox 寺院\n|名称 = 寺\n}}'), null)
  assert.equal(parseShrineInfobox(null), null)
  assert.equal(cleanWikiValue('{{small|[[延喜式神名帳|式内]]小社}}<!-- メモ -->'), '式内小社')
})
