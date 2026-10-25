// マップの下の検索で選ぶタグ（仮）。同じ項目の中は「どれか」、別の項目どうしは「すべて」に当てはまる神社を残す
// ブラウザとテストの両方から使うため、外部依存なし

import { matchingDeities, normalize } from './indexCore.js'
import { canonicalDeity, isKnownDeity } from './deities.js'
import { deityLabel } from './shrineTags.js'

// ご祭神のタグ。表記は情報提供と同じ「天照大御神（アマテラス）」
export function deityTag(name) {
  const canonical = canonicalDeity(name)
  return { key: `deity:${canonical}`, label: deityLabel(canonical), deity: canonical }
}

// match の種類
//   size / goshuin / parking: 一覧の値がこのどれかなら当てはまる
//   benefit: ご利益のどれかにこの文字が入っていれば当てはまる
//   deity:   このご祭神（別の書き方でも）を祀っていれば当てはまる
//   deities: このご祭神のどれかを祀っていれば当てはまる（ご神徳。name もあれば、神社名に当たっても当てはまる）
//   rank:    社格の欄にこの文字が入っていれば当てはまる
//   name:    神社名にこの文字が入っていれば当てはまる（八幡宮・伊勢・稲荷は社格の欄にほぼ入っていないので名前で見る）
// 項目の順番は、大きさ（はじめての人がまず選ぶ）のあとは神社詳細と同じ（御朱印 → ご祭神 → ご利益 → 社格 → 駐車場）
// ご神徳は神社詳細にない項目で、ご利益のすぐあとに置く
// 大きさの「大きな神社」は社格（一宮・別表神社など）からも決めているが、社格のタグとは別の見方（境内の広さ・祠かどうか）で分ける
// status: 神社詳細から来たとき、その値（shrine_size / goshuin / parking の欄）をこのタグとして選ぶ
export const SEARCH_TAGS = [
  { key: 'size', label: '大きさ', tags: [
    { key: 'large', label: '大きな神社', size: ['large'], status: ['large'] },
    { key: 'medium', label: 'ふつうの神社', size: ['medium'], status: ['medium'] },
    { key: 'small', label: '小さな祠', size: ['small'], status: ['small'] },
  ] },
  { key: 'goshuin', label: '御朱印', tags: [
    { key: 'yes', label: 'あり', goshuin: ['direct_only', 'written_only', 'both', 'available'], status: ['available'] },
    { key: 'direct', label: '直書き', goshuin: ['direct_only', 'both'], status: ['direct_only'] },
    { key: 'written', label: '書き置き', goshuin: ['written_only', 'both'], status: ['written_only'] },
    { key: 'both', label: '直書き・書き置き', goshuin: ['both'], status: ['both'] },
    { key: 'none', label: 'なし', goshuin: ['none'], status: ['none'] },
  ] },
  { key: 'deity', label: 'ご祭神', tags: [
    deityTag('天照大御神'),
    deityTag('素戔嗚尊'),
    deityTag('月読命'),
    deityTag('弁財天'),
    deityTag('大黒天'),
  ] },
  { key: 'benefit', label: 'ご利益', tags: [
    { key: 'enmusubi', label: '縁結び', benefit: ['縁結'] },
    { key: 'yakuyoke', label: '厄除け', benefit: ['厄除', '厄よけ', '厄払', '厄祓'] },
    { key: 'kaiun', label: '開運', benefit: ['開運'] },
    { key: 'kotsu', label: '交通安全', benefit: ['交通'] },
    { key: 'shigoto', label: '仕事運', benefit: ['仕事', '出世'] },
    { key: 'shobai', label: '商売繁盛', benefit: ['商売'] },
    { key: 'gakugyo', label: '学業成就', benefit: ['学業', '合格'] },
    { key: 'kinun', label: '金運', benefit: ['金運', '財運'] },
    { key: 'kanai', label: '家内安全', benefit: ['家内安全'] },
    { key: 'fufu', label: '夫婦円満', benefit: ['夫婦円満'] },
    { key: 'anzan', label: '安産・子授け', benefit: ['安産', '子授', '子宝'] },
    { key: 'kenko', label: '健康・病気平癒', benefit: ['健康', '病気', '無病息災', '長寿', '延命'] },
    { key: 'shoun', label: '勝運・必勝', benefit: ['勝運', '必勝'] },
    { key: 'gokoku', label: '五穀豊穣', benefit: ['五穀', '豊作', '農業'] },
    { key: 'kokai', label: '航海安全・大漁', benefit: ['航海', '海上安全', '漁業', '大漁'] },
    { key: 'hibuse', label: '火難除け', benefit: ['火防', '火伏', '防火', '火難', '火除'] },
    { key: 'geino', label: '芸能上達', benefit: ['芸能', '芸事'] },
  ] },
  // ご祭神から見た一般的なご神徳。神社が掲げるご利益ではないので、ご利益とは分ける
  // 神様とご神徳の結びつきがまず外れないものだけを入れる（大国主命・素戔嗚尊のようにご神徳が多い神様は入れない）
  { key: 'shintoku', label: 'ご神徳', note: 'ご祭神から見た一般的なご神徳です。その神社が掲げるご利益とは限りません', tags: [
    { key: 'gakugyo', label: '学業成就（天神さま）', deities: ['菅原道真公'] },
    { key: 'shobai', label: '商売繁盛（お稲荷さま）', deities: ['宇迦之御魂神'], name: ['稲荷'] },
    { key: 'gokoku', label: '五穀豊穣（食物の神）', deities: ['宇迦之御魂神', '豊受大御神', '保食神', '大気都比売神'], name: ['稲荷'] },
    { key: 'kokai', label: '航海安全（海の神）', deities: ['田心姫命', '湍津姫命', '市杵島姫命', '底筒男命', '中筒男命', '表筒男命', '大綿津見神'] },
    { key: 'hibuse', label: '火伏せ（火の神）', deities: ['軻遇突智神'] },
    { key: 'geino', label: '芸能上達（天鈿女命）', deities: ['天鈿女命'] },
  ] },
  { key: 'rank', label: '社格', tags: [
    { key: 'myojin', label: '名神大社', rank: ['名神'] },
    { key: 'taisha', label: '大社', rank: ['大社'] },
    { key: 'shosha', label: '小社', rank: ['小社'] },
    { key: 'shikige', label: '式外社', rank: ['式外'] },
    { key: 'hachiman', label: '八幡宮', name: ['八幡'] },
    { key: 'ise', label: '伊勢', name: ['神明', '伊勢', '大神宮'] },
    { key: 'inari', label: '稲荷', name: ['稲荷'] },
  ] },
  { key: 'parking', label: '駐車場', tags: [
    { key: 'yes', label: 'あり', parking: ['dedicated', 'nearby'], status: ['dedicated', 'nearby'] },
    { key: 'no', label: 'なし', parking: ['none'], status: ['none'] },
  ] },
]

// 神社詳細の値（ご祭神・ご利益・社格は1つずつの名前、御朱印・駐車場は欄の値）を、マップで絞り込むタグにする
// 上の決まったタグに同じものがあればそれを、なければその値だけで絞り込むタグを作る。絞り込めない値（不明など）は null
export function tagForValue(group, value) {
  const v = (value || '').trim()
  if (!v) return null
  const tags = SEARCH_TAGS.find((g) => g.key === group)?.tags || []
  if (group === 'size' || group === 'goshuin' || group === 'parking') return tags.find((t) => t.status.includes(v)) || null
  if (group === 'deity') {
    const name = canonicalDeity(v)
    return tags.find((t) => t.deity === name) || deityTag(name)
  }
  if (group === 'benefit') return tags.find((t) => t.label === v) || { key: `benefit:${v}`, label: v, benefit: [v] }
  if (group === 'rank') return tags.find((t) => t.rank && t.label === v) || { key: `rank:${v}`, label: v, rank: [v] }
  return null
}

// 神社詳細からマップへ移るときのリンク先（/map?benefit=縁結び など）
export const tagLink = (group, value) => `/map?${group}=${encodeURIComponent(value)}`

// リンク先の ?項目=値 から、最初に選んでおくタグを作る
export function tagsFromParams(params) {
  const out = {}
  for (const g of SEARCH_TAGS) {
    const tag = tagForValue(g.key, params.get(g.key))
    if (tag) out[g.key] = [tag]
  }
  return out
}

// 一覧ファイルが御朱印・駐車場・ご利益・社格を持っているか（古い一覧ファイルにはない）
export const hasTagColumns = (index) => Array.isArray(index.raw.gosh)
// 一覧ファイルが大きさを持っているか（大きさを足す前の一覧ファイルにはない）
export const hasSizeColumn = (index) => Array.isArray(index.raw.size)

// ご利益の欄に文章が入っていることもあるので、タグにするのはこの文字数まで
const MAX_BENEFIT_LABEL = 12

// 大きな神社に入っているご祭神・ご利益を、祀る（掲げる）大きな神社が多い順にタグにする: { deity: [タグ], benefit: [タグ] }
// ご祭神は数百柱になるので、辞書にある（よく祀られる）神様だけにする
// 上の決まったタグと同じもの（ご利益は決まったタグの言葉を含むもの）は除く。大きさ・ご利益のない古い一覧ファイルでは空
export function largeShrineTags(index) {
  const r = index.raw
  const empty = { deity: [], benefit: [] }
  if (!hasTagColumns(index) || !hasSizeColumn(index)) return empty
  const large = r.sizes.indexOf('large')
  if (large < 0) return empty
  const deiCount = new Map()
  const benCount = new Map()
  r.size.forEach((s, i) => {
    if (s !== large) return
    for (const j of r.dei?.[i] || []) deiCount.set(j, (deiCount.get(j) || 0) + 1)
    for (const j of r.ben?.[i] || []) benCount.set(j, (benCount.get(j) || 0) + 1)
  })
  const byCount = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([j]) => j)
  const fixed = (group) => SEARCH_TAGS.find((g) => g.key === group).tags
  const uniq = (tags, seen) => tags.filter((t) => !seen.has(t.key) && seen.add(t.key))

  const deity = uniq(byCount(deiCount).map((j) => r.deis[j]).filter(isKnownDeity).map(deityTag),
    new Set(fixed('deity').map((t) => t.key)))
  const fixedWords = fixed('benefit').flatMap((t) => t.benefit.map(normalize))
  const benefit = uniq(byCount(benCount).map((j) => r.bens[j])
    .filter((v) => v && v.length <= MAX_BENEFIT_LABEL && !fixedWords.some((w) => normalize(v).includes(w)))
    .map((v) => tagForValue('benefit', v)), new Set(fixed('benefit').map((t) => t.key)))
  return { deity, benefit }
}

const tableHits = (list, test) => {
  const out = new Set()
  ;(list || []).forEach((v, j) => { if (test(v)) out.add(j) })
  return out
}

// 1つのタグについて、一覧の位置 i が当てはまるかを返す関数を作る
function tagTest(index, tag) {
  const r = index.raw
  if (tag.size) { const hit = tableHits(r.sizes, (v) => tag.size.includes(v)); return (i) => hit.has(r.size?.[i]) }
  if (tag.goshuin) { const hit = tableHits(r.goshs, (v) => tag.goshuin.includes(v)); return (i) => hit.has(r.gosh?.[i]) }
  if (tag.parking) { const hit = tableHits(r.parks, (v) => tag.parking.includes(v)); return (i) => hit.has(r.park?.[i]) }
  if (tag.benefit) {
    const words = tag.benefit.map(normalize)
    const hit = tableHits(r.bens, (v) => words.some((w) => normalize(v).includes(w)))
    return (i) => (r.ben?.[i] || []).some((j) => hit.has(j))
  }
  if (tag.rank) {
    const words = tag.rank.map(normalize)
    const hit = tableHits(r.ranks, (v) => words.some((w) => normalize(v).includes(w)))
    return (i) => hit.has(r.rank?.[i])
  }
  if (tag.deities) {
    const hit = new Set(tag.deities.flatMap((d) => [...matchingDeities(index, d)]))
    const words = (tag.name || []).map(normalize)
    return (i) => (r.dei?.[i] || []).some((j) => hit.has(j)) || words.some((w) => index.keys[i].includes(w))
  }
  if (tag.name) { const words = tag.name.map(normalize); return (i) => words.some((w) => index.keys[i].includes(w)) }
  if (tag.deity) { const hit = matchingDeities(index, tag.deity); return (i) => (r.dei?.[i] || []).some((j) => hit.has(j)) }
  return () => false
}

// 選んだタグ（{ 項目のkey: [タグ, ...] }）から、一覧の位置 i を残すかを返す関数を作る。何も選んでいなければ null
export function tagFilter(index, selected) {
  const groups = Object.values(selected || {}).filter((tags) => tags.length)
    .map((tags) => tags.map((t) => tagTest(index, t)))
  if (!groups.length) return null
  return (i) => groups.every((tests) => tests.some((test) => test(i)))
}
