// マップの下の検索で選ぶタグ（仮）。同じ項目の中は「どれか」、別の項目どうしは「すべて」に当てはまる神社を残す
// ブラウザとテストの両方から使うため、外部依存なし

import { matchingDeities, normalize } from './indexCore.js'

// match の種類
//   goshuin / parking: 一覧の値がこのどれかなら当てはまる
//   benefit: ご利益のどれかにこの文字が入っていれば当てはまる
//   deity:   このご祭神（別の書き方でも）を祀っていれば当てはまる
//   rank:    社格の欄にこの文字が入っていれば当てはまる
//   name:    神社名にこの文字が入っていれば当てはまる（八幡宮・伊勢・稲荷は社格の欄にほぼ入っていないので名前で見る）
export const SEARCH_TAGS = [
  { key: 'goshuin', label: '御朱印', tags: [
    { key: 'direct', label: '直書き', goshuin: ['direct_only', 'both'] },
    { key: 'written', label: '書置き', goshuin: ['written_only', 'both'] },
    { key: 'both', label: '両方', goshuin: ['both'] },
    { key: 'none', label: 'なし', goshuin: ['none'] },
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
  { key: 'deity', label: 'ご祭神', tags: [
    { key: 'amaterasu', label: 'アマテラス', deity: 'アマテラス' },
    { key: 'susanoo', label: 'スサノオ', deity: 'スサノオ' },
    { key: 'tsukuyomi', label: 'ツクヨミ', deity: 'ツクヨミ' },
    { key: 'benzaiten', label: '弁財天', deity: '弁財天' },
    { key: 'daikokuten', label: '大黒天', deity: '大黒天' },
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
    { key: 'yes', label: 'あり', parking: ['dedicated', 'nearby'] },
    { key: 'no', label: 'なし', parking: ['none'] },
  ] },
]

// ご祭神の欄（神社詳細）から来たときなど、上のタグにない神様で絞り込むタグ
export const deityTag = (name) => ({ key: `deity:${name}`, label: name, deity: name })

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
