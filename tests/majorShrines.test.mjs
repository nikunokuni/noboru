import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchMajorShrines, matchMajorShrines, rankFromItems } from '../scripts/lib/major-shrines.mjs'

test('大きな神社の記事を、座標の近くの神社とつなぐ', () => {
  const row = (name, lat, lng, extra = {}) => ({ name, lat, lng, wikidata_id: null, wikipedia_title: null, size_signals: { hasWiki: false }, ...extra })
  const rows = [
    row('八幡神社', 35.0, 135.0),                    // 記事「若宮八幡神社」が200m先 → 名前を含むのでつなぐ
    row('名称不明の社（山田）', 35.1, 135.0),        // 名前なしでも40m以内ならつなぐ
    row('稲荷社', 35.2, 135.0),                      // 名前が違い150m離れている → つながない
    row('天満宮', 35.3, 135.0, { wikidata_id: 'Q9' }), // もうつながっている神社は使わない
    row('白山神社', 35.4, 135.0),                    // 2つの記事が当たる → 名前の合う方
  ]
  const items = [
    { title: '若宮八幡神社', qid: 'Q1', lat: 35.0018, lon: 135.0, ranks: ['式内社'] },
    { title: '山田神社 (山田市)', qid: 'Q2', lat: 35.1003, lon: 135.0, ranks: ['式内社'] },
    { title: '大野神社', qid: 'Q3', lat: 35.2014, lon: 135.0, ranks: ['式内社'] },
    { title: '天満宮', qid: 'Q4', lat: 35.3, lon: 135.0, ranks: ['別表神社'] },
    { title: '別の神社', qid: null, lat: 35.4001, lon: 135.0, ranks: ['式内社'] },
    { title: '白山神社 (加賀市)', qid: null, lat: 35.4004, lon: 135.0, ranks: ['一宮'] },
  ]
  assert.equal(matchMajorShrines(rows, items), 3)
  assert.deepEqual(rows.map((r) => r.wikipedia_title), ['若宮八幡神社', '山田神社 (山田市)', null, null, '白山神社 (加賀市)'])
  assert.deepEqual(rows.map((r) => r.wikidata_id), ['Q1', 'Q2', null, 'Q9', null])
  assert.equal(rows[0].size_signals.hasWiki, true)
  assert.equal(rankFromItems(items)('若宮八幡神社'), '式内社')
})

test('カテゴリをたどって記事と座標を集める', async () => {
  const calls = []
  const getJson = async (_api, p) => {
    calls.push(p.list || p.prop)
    if (p.list === 'categorymembers') {
      const members = {
        'Category:式内社': p.cmcontinue
          ? [{ ns: 0, title: 'B神社' }]
          : [{ ns: 0, title: 'A神社' }, { ns: 14, title: 'Category:大和国の式内社' }],
        'Category:大和国の式内社': [{ ns: 0, title: 'C神社' }, { ns: 14, title: 'Category:深すぎる' }],
        'Category:別表神社': [{ ns: 0, title: 'A神社' }],
      }[p.cmtitle] || []
      const more = p.cmtitle === 'Category:式内社' && !p.cmcontinue
      return { query: { categorymembers: members }, ...(more ? { continue: { cmcontinue: 'x', continue: '-||' } } : {}) }
    }
    return { query: {
      redirects: [{ from: 'C神社', to: 'C神社 (奈良県)' }],
      pages: [
        { title: 'A神社', pageprops: { wikibase_item: 'Q1' }, coordinates: [{ lat: 35, lon: 135 }] },
        { title: 'B神社', coordinates: [] },
        { title: 'C神社 (奈良県)', pageprops: { wikibase_item: 'Q3' }, coordinates: [{ lat: 34, lon: 135.8 }] },
      ],
    } }
  }
  const items = await fetchMajorShrines({ getJson, api: 'x', userAgent: 'test' })
  assert.deepEqual(items, [
    { title: 'A神社', qid: 'Q1', lat: 35, lon: 135, ranks: ['式内社', '別表神社'] },
    { title: 'C神社 (奈良県)', qid: 'Q3', lat: 34, lon: 135.8, ranks: ['式内社'] },
  ])
  assert.ok(!calls.includes(undefined))
})
