// マップの下の検索で選ぶタグ（仮）。同じ項目の中は「どれか」、別の項目どうしは「すべて」に当てはまる神社を残す
// ブラウザとテストの両方から使うため、外部依存なし

import { matchingDeities, normalize } from './indexCore.js'
import { canonicalDeity } from './deities.js'
import { deityLabel } from './shrineTags.js'

// ご祭神のタグ。表記は情報提供と同じ「天照大御神（アマテラス）」
export function deityTag(name) {
  const canonical = canonicalDeity(name)
  return { key: `deity:${canonical}`, label: deityLabel(canonical), deity: canonical }
}

// match の種類
//   goshuin / parking: 一覧の値がこのどれかなら当てはまる
//   benefit: ご利益のどれかにこの文字が入っていれば当てはまる
//   deity:   このご祭神（別の書き方でも）を祀っていれば当てはまる
//   rank:    社格の欄にこの文字が入っていれば当てはまる
//   name:    神社名にこの文字が入っていれば当てはまる（八幡宮・伊勢・稲荷は社格の欄にほぼ入っていないので名前で見る）
// 項目の順番は神社詳細と同じ（御朱印 → ご祭神 → ご利益 → 社格 → 駐車場）
// status: 神社詳細から来たとき、その値（goshuin / parking の欄）をこのタグとして選ぶ
export const SEARCH_TAGS = [
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
  if (group === 'goshuin' || group === 'parking') return tags.find((t) => t.status.includes(v)) || null
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

const tableHits = (list, test) => {
  const out = new Set()
  ;(list || []).forEach((v, j) => { if (test(v)) out.add(j) })
  return out
}

// 1つのタグについて、一覧の位置 i が当てはまるかを返す関数を作る
function tagTest(index, tag) {
  const r = index.raw
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
