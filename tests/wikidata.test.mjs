import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shrineNameKey, parseSparql, matchWikidata } from '../scripts/lib/wikidata-match.mjs'
import { nameFromTitle } from '../scripts/lib/wiki.mjs'

test('Wikidata の結果を読み、名前をそろえる', () => {
  assert.deepEqual(parseSparql({ results: { bindings: [
    { item: { value: 'http://www.wikidata.org/entity/Q123' }, label: { value: '八坂神社' }, coord: { value: 'Point(135.7785 34.9986)' } },
    { item: { value: 'http://www.wikidata.org/entity/Q9' }, label: { value: '座標なし' }, coord: { value: '' } },
  ] } }), [{ qid: 'Q123', name: '八坂神社', lat: 34.9986, lon: 135.7785 }])
  assert.equal(shrineNameKey('向日神社 (Muko Jinja)'), '向日神社')
  assert.equal(shrineNameKey('都波岐神社・奈加等神社'), '都波岐神社奈加等神社')
  assert.equal(shrineNameKey('八幡神社（京都市）'), '八幡神社')
  assert.equal(nameFromTitle('八幡神社 (京都市)'), '八幡神社')
  assert.equal(nameFromTitle('三重県護国神社'), '三重県護国神社')
})

test('つながっていない神社を、300m 以内の同じ名前の Wikidata の神社とつなぐ', () => {
  const row = (name, lat, lng, extra = {}) => ({ name, lat, lng, wikidata_id: null, size_signals: { named: true, hasWiki: false }, ...extra })
  const rows = [
    row('八坂神社', 35.0, 135.0),                     // 100m 先に同じ名前 → つなぐ
    row('稲荷神社', 35.1, 135.0),                     // 1km 先にしかない → つながない
    row('天満宮', 35.2, 135.0, { wikidata_id: 'Q3' }), // もうつながっている
    row('白山神社', 35.3, 135.0),                     // 同じ番号に2社 → 近い方だけ
    row('白山神社', 35.3015, 135.0),
    row('名称不明の社（山田）', 35.4, 135.0, { size_signals: { named: false, hasWiki: false } }),
    row('春日神社', 35.5, 135.0),                     // 別の神社がつながっている番号は使わない
    row('春日大社', 35.5, 135.001, { wikidata_id: 'Q5' }),
  ]
  const items = [
    { qid: 'Q1', name: '八坂神社', lat: 35.0009, lon: 135.0 },
    { qid: 'Q2', name: '稲荷神社', lat: 35.109, lon: 135.0 },
    { qid: 'Q3', name: '天満宮', lat: 35.2, lon: 135.0 },
    { qid: 'Q4', name: '白山神社', lat: 35.3012, lon: 135.0 },
    { qid: 'Q6', name: '名称不明の社（山田）', lat: 35.4, lon: 135.0 },
    { qid: 'Q5', name: '春日神社', lat: 35.5, lon: 135.0 },
  ]
  assert.equal(matchWikidata(rows, items), 2)
  assert.deepEqual(rows.map((r) => r.wikidata_id), ['Q1', null, 'Q3', null, 'Q4', null, null, 'Q5'])
  assert.equal(rows[0].size_signals.hasWiki, true)
  assert.equal(rows[1].size_signals.hasWiki, false)
})
