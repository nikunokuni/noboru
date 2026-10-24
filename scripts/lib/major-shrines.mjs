// 大きな神社（式内社・別表神社・一宮・二十二社・勅祭社）を Wikipedia のカテゴリから集め、
// 記事の座標の近くにある OSM の神社とつなぐ。神社からではなく記事の側から探すので、名前の書き方が違っていても拾える
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { distanceM } from '../../src/lib/geo.js'
import { shrineNameKey } from './wikidata-match.mjs'

// [カテゴリ名, 社格として入れる文字, 下位カテゴリをたどる深さ]
export const MAJOR_CATEGORIES = [
  ['式内社', '式内社', 2],
  ['別表神社', '別表神社', 0],
  ['一宮', '一宮', 1],
  ['二十二社', '二十二社', 0],
  ['勅祭社', '勅祭社', 0],
]
const NAME_MATCH_M = 300   // 名前が同じ（片方がもう片方を含む）ならこの距離までつなぐ
const NEAR_MATCH_M = 60    // 名前が違っても（名前なしでも）この距離ならつなぐ

const UNNAMED = '名称不明の社'
const titleKey = (title) => shrineNameKey((title || '').replace(/\s*[(（][^()（）]*[)）]\s*$/, ''))

let memo = null   // 全都道府県を続けて取り込むとき、2県目からは読み直さない

// [{ title, qid, lat, lon, ranks: ['式内社', ...] }]。getJson は wiki.mjs の取得関数
export async function fetchMajorShrines({ getJson, api, userAgent, cacheFile = null, log = () => {} }) {
  if (memo) return memo
  if (cacheFile) {
    try {
      const items = JSON.parse(await readFile(cacheFile, 'utf8'))
      if (items.length) { log(`  大きな神社の記事: 保存済みのデータを使用（${items.length}件）`); return (memo = items) }
    } catch { /* なければ取る */ }
  }
  log('  大きな神社の記事を Wikipedia のカテゴリから集めています…')

  const ranksByTitle = new Map()
  for (const [category, rank, depth] of MAJOR_CATEGORIES) {
    const titles = await categoryPages(category, depth, { getJson, api, userAgent })
    log(`    カテゴリ「${category}」: ${titles.size}件`)
    for (const t of titles) {
      if (!ranksByTitle.has(t)) ranksByTitle.set(t, new Set())
      ranksByTitle.get(t).add(rank)
    }
  }

  // 座標と Wikidata の番号
  const items = []
  const titles = [...ranksByTitle.keys()]
  for (let i = 0; i < titles.length; i += 50) {
    const data = await getJson(api, {
      action: 'query', prop: 'coordinates|pageprops', ppprop: 'wikibase_item', coprimary: 'primary', colimit: 'max',
      redirects: '1', titles: titles.slice(i, i + 50).join('|'),
    }, userAgent)
    const from = new Map((data.query?.redirects || []).map((r) => [r.to, r.from]))
    for (const p of data.query?.pages || []) {
      const c = p.coordinates?.[0]
      if (!c) continue
      const ranks = ranksByTitle.get(p.title) || ranksByTitle.get(from.get(p.title)) || new Set()
      items.push({ title: p.title, qid: p.pageprops?.wikibase_item || null, lat: c.lat, lon: c.lon, ranks: [...ranks] })
    }
  }
  log(`  大きな神社の記事: ${items.length}件（座標のあるもの）`)
  if (!items.length) throw new Error('大きな神社の記事が0件でした')
  if (cacheFile) {
    await mkdir(dirname(cacheFile), { recursive: true })
    await writeFile(cacheFile, JSON.stringify(items))
  }
  return (memo = items)
}

// カテゴリの記事名（下位カテゴリを depth 段までたどる）
async function categoryPages(category, depth, ctx, seen = new Set()) {
  const pages = new Set()
  if (seen.has(category)) return pages
  seen.add(category)
  let cont = {}
  do {
    const data = await ctx.getJson(ctx.api, {
      action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`,
      cmtype: 'page|subcat', cmlimit: '500', ...cont,
    }, ctx.userAgent)
    for (const m of data.query?.categorymembers || []) {
      if (m.ns === 0) pages.add(m.title)
      else if (m.ns === 14 && depth > 0) {
        for (const t of await categoryPages(m.title.replace(/^Category:/, ''), depth - 1, ctx, seen)) pages.add(t)
      }
    }
    cont = data.continue || null
  } while (cont)
  return pages
}

// 記事を OSM の神社とつなぐ（wikipedia_title・wikidata_id を入れる）。つないだ件数を返す
//   まだどの記事ともつながっていない神社だけを使う。名前が同じ（片方がもう片方を含む）なら300m、名前が違っても60m以内ならつなぐ
//   1つの神社に複数の記事が当たったら、名前が合う方 → 近い方を選ぶ
export function matchMajorShrines(rows, items) {
  const linkedTitles = new Set(rows.map((r) => r.wikipedia_title).filter(Boolean))
  const linkedQids = new Set(rows.map((r) => r.wikidata_id).filter(Boolean))
  const free = rows.filter((r) => !r.wikipedia_title && !r.wikidata_id)
  const CELL = 0.01
  const grid = new Map()
  for (const r of free) {
    const k = `${Math.floor(r.lat / CELL)},${Math.floor(r.lng / CELL)}`
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(r)
  }

  const claims = new Map()   // row → { item, named, distance }
  for (const it of items) {
    if (linkedTitles.has(it.title) || (it.qid && linkedQids.has(it.qid))) continue
    const key = titleKey(it.title)
    const cy = Math.floor(it.lat / CELL)
    const cx = Math.floor(it.lon / CELL)
    let best = null
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const r of grid.get(`${cy + dy},${cx + dx}`) || []) {
          const distance = distanceM(it.lat, it.lon, r.lat, r.lng)
          const rKey = r.name.startsWith(UNNAMED) ? '' : shrineNameKey(r.name)
          const named = Boolean(rKey && key && (rKey.includes(key) || key.includes(rKey)) && Math.min(rKey.length, key.length) >= 2)
          if (!(named ? distance <= NAME_MATCH_M : distance <= NEAR_MATCH_M)) continue
          if (!best || better({ named, distance }, best)) best = { row: r, named, distance }
        }
      }
    }
    if (!best) continue
    const prev = claims.get(best.row)
    if (!prev || better(best, prev)) claims.set(best.row, { item: it, named: best.named, distance: best.distance })
  }

  for (const [row, { item }] of claims) {
    row.wikipedia_title = item.title
    if (item.qid) row.wikidata_id = item.qid
    if (row.size_signals) row.size_signals.hasWiki = true
  }
  return claims.size
}

const better = (a, b) => (a.named !== b.named ? a.named : a.distance < b.distance)

// どの神社ともつながらなかった記事（全都道府県を取り込んだあとに書き出す）
const seenTitles = new Set()
export const markSeenTitles = (titles) => { for (const t of titles) if (t) seenTitles.add(t) }
export const unmatchedMajorShrines = () => (memo || []).filter((it) => !seenTitles.has(it.title))

// 記事のカテゴリから社格の文字を作る（「式内社、別表神社」）
export function rankFromItems(items) {
  const byTitle = new Map(items.map((it) => [it.title, it.ranks.join('、')]))
  return (title) => byTitle.get(title) || null
}
