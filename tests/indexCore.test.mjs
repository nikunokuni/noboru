import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeIndex, prepareIndex, searchIndex, searchPositions, nearbyIndex, getById, applyVisited, normalize, newIndexVersion, indexVersionDate } from '../src/lib/indexCore.js'
import { titleFor } from '../src/lib/constants.js'
import { canonicalDeity, normalizeDeities, deityKey, DEITIES } from '../src/lib/deities.js'

const rows = [
  { id: 1, name: '八坂神社', name_kana: 'やさかじんじゃ', prefecture: '京都府', lat: 35.003674, lng: 135.778514, first_visited_on: '2026-01-01' },
  { id: 2, name: '伏見稲荷大社', name_kana: 'ふしみいなりたいしゃ', prefecture: '京都府', lat: 34.967146, lng: 135.772695, first_visited_on: null },
  { id: 3, name: '明治神宮', name_kana: 'めいじじんぐう', prefecture: '東京都', lat: 35.676398, lng: 139.699326, first_visited_on: null },
  { id: 4, name: '弥栄八坂社', name_kana: '', prefecture: '京都府', lat: 35.0040, lng: 135.7790, first_visited_on: null },
  { id: 5, name: '八幡神社', name_kana: 'はちまんじんじゃ', prefecture: '東京都', municipality: '世田谷区', locality: '上町', deities: '応神天皇', lat: 35.64, lng: 139.64, first_visited_on: null },
  { id: 6, name: '八幡神社', name_kana: 'はちまんじんじゃ', prefecture: '東京都', municipality: '練馬区', locality: '練馬区', deities: '誉田別命（応神天皇）、比売神', lat: 35.73, lng: 139.65, first_visited_on: null },
  { id: 7, name: '須賀神社', name_kana: 'すがじんじゃ', prefecture: '東京都', municipality: '世田谷区', deities: '須佐之男命、宇迦之御魂神', lat: 35.65, lng: 139.65, first_visited_on: null },
]
const index = () => prepareIndex(JSON.parse(JSON.stringify(encodeIndex(rows, { version: 'v1' }))))

test('エンコードして元に戻せる', () => {
  const idx = index()
  assert.equal(idx.size, 7)
  const item = getById(idx, 1)
  assert.equal(item.name, '八坂神社')
  assert.equal(item.prefecture, '京都府')
  assert.ok(Math.abs(item.lat - 35.003674) < 1e-5)
  assert.equal(item.visited, true)
})

test('名前・読み仮名で検索し、前方一致を先に出す', () => {
  const idx = index()
  assert.deepEqual(searchIndex(idx, '八坂').map((r) => r.id), [1, 4])
  assert.deepEqual(searchIndex(idx, 'ヤサカ').map((r) => r.id), [1])
  assert.deepEqual(searchIndex(idx, 'いなり').map((r) => r.id), [2])
  assert.deepEqual(searchIndex(idx, '', { prefecture: '東京都' }).map((r) => r.id), [3, 5, 6, 7])
  assert.deepEqual(searchIndex(idx, '', { prefecture: '京都府', unvisitedOnly: true }).map((r) => r.id), [2, 4])
  assert.equal(normalize('ﾔｻｶ 神社'), 'やさか神社')
})

test('マップ用に、追加の条件で絞った位置を全件返す', () => {
  const idx = index()
  const mine = new Set([1, 5])
  const include = (i) => mine.has(idx.raw.id[i])
  const ids = (q, opts) => searchPositions(idx, q, { limit: Infinity, ...opts }).map((i) => idx.raw.id[i])
  assert.deepEqual(ids('', {}), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(ids('', { include }), [1, 5])
  assert.deepEqual(ids('八', { include }), [1, 5])
  assert.deepEqual(ids('八坂', { include: (i) => !include(i) }), [4])
  assert.deepEqual(ids('', { limit: 2 }), [1, 2])
})

test('近い順に返す', () => {
  const idx = index()
  const near = nearbyIndex(idx, 35.0037, 135.7786, { radiusM: 1000 })
  assert.deepEqual(near.map((r) => r.id), [1, 4])
  assert.ok(near[0].distance < 20)
})

test('参拝済みフラグを更新する', () => {
  const idx = index()
  assert.equal(applyVisited(idx, [{ id: 2, visited: true }, { id: 1, visited: true }, { id: 99, visited: true }]), 1)
  assert.equal(getById(idx, 2).visited, true)
})

test('称号', () => {
  assert.deepEqual(titleFor(0), { current: '参拝初心者', next: { label: '氏子', remaining: 5 } })
  assert.deepEqual(titleFor(30), { current: '神主', next: { label: '大神主', remaining: 20 } })
  assert.equal(titleFor(150).next, null)
})

test('一覧ファイルの版は作った時刻（UTC）で、時刻に戻せる', () => {
  const now = new Date('2026-10-05T12:34:56.789Z')
  const v = newIndexVersion(now)
  assert.equal(v, '20261005123456')
  assert.equal(indexVersionDate(v).toISOString(), '2026-10-05T12:34:56.000Z')
  assert.equal(indexVersionDate('0'), null)
  assert.equal(indexVersionDate(undefined), null)
})

test('同じ名前の神社は市区町村・地名で見分けられる', () => {
  const idx = index()
  assert.deepEqual(searchIndex(idx, '八幡').map((r) => r.id), [5, 6])
  assert.deepEqual(searchIndex(idx, '八幡 世田谷').map((r) => r.id), [5])
  assert.deepEqual(searchIndex(idx, 'はちまん　上町').map((r) => r.id), [5])
  assert.deepEqual(searchIndex(idx, '世田谷').map((r) => r.id), [])   // 地名だけでは探さない
  const item = getById(idx, 5)
  assert.equal(item.municipality, '世田谷区')
  assert.equal(item.locality, '上町')
  assert.equal(getById(idx, 6).locality, null)   // 市区町村と同じ地名は入れない
})

test('ご祭神で探す（書き方が違っても同じ神様）', () => {
  const idx = index()
  const ids = (q, opts) => searchIndex(idx, '', { deity: q, ...opts }).map((r) => r.id)
  assert.deepEqual(ids('スサノオ'), [7])
  assert.deepEqual(ids('素戔嗚尊'), [7])
  assert.deepEqual(ids('八幡神'), [5, 6])
  assert.deepEqual(ids('応神'), [5, 6])
  assert.deepEqual(ids('稲荷'), [7])
  assert.deepEqual(ids('比売'), [6])
  assert.deepEqual(ids('天照'), [])
})

test('古い一覧ファイル（市区町村・ご祭神なし）も読める', () => {
  const raw = encodeIndex(rows, { version: 'v1' })
  for (const k of ['munis', 'muni', 'locs', 'loc', 'deis', 'dei']) delete raw[k]
  const idx = prepareIndex(raw)
  assert.equal(getById(idx, 5).municipality, null)
  assert.deepEqual(searchIndex(idx, '八幡').map((r) => r.id), [5, 6])
  assert.deepEqual(searchIndex(idx, '', { deity: 'スサノオ' }), [])
})

test('ご祭神の表記をそろえる', () => {
  assert.equal(canonicalDeity('須佐之男命'), '素戔嗚尊')
  assert.equal(canonicalDeity('スサノヲ'), '素戔嗚尊')
  assert.equal(canonicalDeity('大國主神'), '大国主命')
  assert.equal(canonicalDeity('瓊々杵尊'), '瓊瓊杵尊')
  assert.equal(canonicalDeity('宇迦御魂命'), '宇迦之御魂神')
  assert.equal(canonicalDeity('天照大神'), '天照大御神')
  assert.equal(canonicalDeity('櫛稲田姫命'), '櫛稲田姫命')
  assert.equal(canonicalDeity('知らない神'), '知らない神')   // 辞書にない神様はそのまま
  assert.equal(canonicalDeity('天神'), '天神')

  const n = normalizeDeities('誉田別命（応神天皇）、須佐之男命・ 大己貴命')
  assert.deepEqual(n.names, ['誉田別命', '素戔嗚尊', '大国主命'])
  assert.equal(n.text, '誉田別命、素戔嗚尊、大国主命')
  assert.deepEqual(n.changed, [{ from: '応神天皇', to: '誉田別命' }, { from: '須佐之男命', to: '素戔嗚尊' }, { from: '大己貴命', to: '大国主命' }])
  assert.deepEqual(normalizeDeities('').names, [])
  assert.deepEqual(normalizeDeities(null).names, [])
})

test('辞書の別の神様どうしが同じ書き方にならない', () => {
  const owner = new Map()
  for (const names of DEITIES) {
    for (const n of names) {
      const k = deityKey(n)
      assert.ok(!owner.has(k) || owner.get(k) === names[0], `${n} が ${owner.get(k)} と ${names[0]} の両方に当たる`)
      owner.set(k, names[0])
    }
  }
})

test('マップのタグで絞り込む（同じ項目はどれか、別の項目はすべて）', async () => {
  const { SEARCH_TAGS, tagFilter, deityTag, hasTagColumns } = await import('../src/lib/searchTags.js')
  const tag = (group, key) => SEARCH_TAGS.find((g) => g.key === group).tags.find((t) => t.key === key)
  const idx = prepareIndex(encodeIndex([
    { id: 1, name: '八幡宮', prefecture: '東京都', lat: 35, lng: 139, deities: '応神天皇', goshuin: 'both', parking: 'dedicated', benefits: ['厄除け', '開運招福'], shrine_rank: '式内社（名神大社）' },
    { id: 2, name: '稲荷神社', prefecture: '東京都', lat: 35, lng: 139, deities: '倉稲魂命', goshuin: 'direct_only', parking: 'none', benefits: ['商売繁盛'], shrine_rank: '式内小社' },
    { id: 3, name: '神明社', prefecture: '東京都', lat: 35, lng: 139, deities: '天照大神、弁才天', goshuin: 'written_only', benefits: ['縁結び・恋愛成就'] },
    { id: 4, name: '須賀神社', prefecture: '東京都', lat: 35, lng: 139, deities: '須佐之男命', goshuin: 'available' },
  ], { version: 'v' }))
  assert.ok(hasTagColumns(idx))
  const ids = (selected) => {
    const f = tagFilter(idx, selected)
    return idx.raw.id.filter((_, i) => !f || f(i))
  }
  assert.deepEqual(ids({}), [1, 2, 3, 4])
  assert.deepEqual(ids({ goshuin: [tag('goshuin', 'direct')] }), [1, 2])
  assert.deepEqual(ids({ goshuin: [tag('goshuin', 'written')] }), [1, 3])
  assert.deepEqual(ids({ goshuin: [tag('goshuin', 'both')] }), [1])
  assert.deepEqual(ids({ goshuin: [tag('goshuin', 'yes')] }), [1, 2, 3, 4])   // 「あり」だけの神社も入る
  assert.deepEqual(ids({ parking: [tag('parking', 'yes')] }), [1])
  assert.deepEqual(ids({ parking: [tag('parking', 'no')] }), [2])   // 不明は「なし」に入れない
  assert.deepEqual(ids({ benefit: [tag('benefit', 'kaiun'), tag('benefit', 'enmusubi')] }), [1, 3])
  assert.deepEqual(ids({ benefit: [tag('benefit', 'kaiun'), tag('benefit', 'enmusubi')], goshuin: [tag('goshuin', 'direct')] }), [1])
  assert.deepEqual(ids({ rank: [tag('rank', 'myojin')] }), [1])
  assert.deepEqual(ids({ rank: [tag('rank', 'shosha')] }), [2])
  assert.deepEqual(ids({ rank: [tag('rank', 'hachiman'), tag('rank', 'ise')] }), [1, 3])
  assert.deepEqual(ids({ rank: [tag('rank', 'inari')] }), [2])
  assert.deepEqual(ids({ deity: [tag('deity', 'deity:天照大御神')] }), [3])
  assert.deepEqual(ids({ deity: [tag('deity', 'deity:弁財天'), tag('deity', 'deity:素戔嗚尊')] }), [3, 4])
  assert.deepEqual(ids({ deity: [deityTag('誉田別命')] }), [1])
  // 古い一覧ファイル（タグの項目がない）では、御朱印などのタグに当てはまる神社はない
  const raw = { ...index().raw }
  for (const k of ['goshs', 'gosh', 'parks', 'park', 'bens', 'ben', 'ranks', 'rank']) delete raw[k]
  const old = prepareIndex(raw)
  assert.ok(!hasTagColumns(old))
  assert.equal(tagFilter(old, { goshuin: [tag('goshuin', 'none')] })(0), false)
})

test('古い一覧ファイルは新しい方から2つを残して消す', async () => {
  const { staleIndexFiles } = await import('../src/lib/indexCore.js')
  const names = ['shrines-index.20260101000000.json.gz', 'shrines-index.20260301000000.json.gz', 'other.txt',
    'shrines-index.20260201000000.json.gz', 'shrines-index.20251201000000.json.gz']
  assert.deepEqual(staleIndexFiles(names), ['shrines-index.20260101000000.json.gz', 'shrines-index.20251201000000.json.gz'])
  assert.deepEqual(staleIndexFiles(names.slice(0, 2)), [])
})
