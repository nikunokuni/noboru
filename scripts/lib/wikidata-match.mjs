// OSM で Wikidata とつながっていない神社を、近くにある同じ名前の Wikidata の神社とつなぐ
// つなぐと、Wikipedia の記事から社格・ご祭神・創建・由緒などが入る
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { PointGrid } from './geometry.mjs'

const SPARQL = 'https://query.wikidata.org/sparql'
const MATCH_MAX_M = 300

// 日本にある神社（Q845945 とその下位の種類）のうち、座標と日本語の名前があるもの
const QUERY = `SELECT ?item ?label ?coord WHERE {
  ?item wdt:P31/wdt:P279* wd:Q845945 ;
        wdt:P17 wd:Q17 ;
        wdt:P625 ?coord ;
        rdfs:label ?label .
  FILTER(LANG(?label) = "ja")
}`

// 名前を比べるための形：全角・半角をそろえ、空白・中黒・括弧の補足（「（京都市）」「(Muko Jinja)」など）を除く
export function shrineNameKey(name) {
  return (name || '')
    .normalize('NFKC')
    .replace(/\s*[(（][^()（）]*[)）]\s*/g, '')
    .replace(/[\s・･]/g, '')
}

// SPARQL の結果を [{ qid, name, lat, lon }] にする
export function parseSparql(json) {
  const out = []
  for (const b of json?.results?.bindings || []) {
    const qid = /Q\d+$/.exec(b.item?.value || '')?.[0]
    const m = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(b.coord?.value || '')
    if (qid && m && b.label?.value) out.push({ qid, name: b.label.value, lat: Number(m[2]), lon: Number(m[1]) })
  }
  return out
}

// 全国の神社を Wikidata から取る。結果は cacheFile に保存し、やり直しでは使い回す
let memo = null   // 全都道府県を続けて取り込むとき、2県目からは読み直さない

export async function fetchWikidataShrines({ userAgent, cacheFile = null, log = () => {} }) {
  if (memo) return memo
  memo = await loadWikidataShrines({ userAgent, cacheFile, log })
  return memo
}

async function loadWikidataShrines({ userAgent, cacheFile, log }) {
  if (cacheFile) {
    try {
      const items = JSON.parse(await readFile(cacheFile, 'utf8'))
      if (items.length) { log(`  Wikidata の神社: 保存済みのデータを使用（${items.length}件）`); return items }
    } catch { /* なければ取る */ }
  }
  log('  Wikidata の神社（全国）を取得中…')
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 30000 * attempt))
    try {
      const res = await fetch(`${SPARQL}?${new URLSearchParams({ query: QUERY, format: 'json' })}`, {
        headers: { 'User-Agent': userAgent, Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(180000),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const items = parseSparql(await res.json())
      if (!items.length) throw new Error('0件でした')
      log(`  Wikidata の神社: ${items.length}件取得`)
      if (cacheFile) {
        await mkdir(dirname(cacheFile), { recursive: true })
        await writeFile(cacheFile, JSON.stringify(items))
      }
      return items
    } catch (e) {
      lastError = e
      log(`    Wikidata の問い合わせに失敗しました（${e.message}）`)
    }
  }
  throw new Error(`Wikidata の神社を取得できませんでした: ${lastError?.message}`)
}

// Wikidata とつながっていない名前のある神社に、300m 以内で名前が同じ Wikidata の神社の番号を入れる
//   すでに別の神社がつながっている番号は使わない。同じ番号に複数の神社が当たったら、いちばん近い神社だけにする
//   つないだ件数を返す
export function matchWikidata(rows, items, { maxM = MATCH_MAX_M } = {}) {
  const used = new Set(rows.map((r) => r.wikidata_id).filter(Boolean))
  const byName = new Map()
  for (const it of items) {
    if (used.has(it.qid)) continue
    const key = shrineNameKey(it.name)
    if (!key) continue
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(it)
  }
  const grids = new Map([...byName].map(([key, list]) => [key, new PointGrid(list, 0.01)]))

  const best = new Map()   // qid → { row, distance }
  for (const r of rows) {
    if (r.wikidata_id || !r.size_signals?.named) continue
    const hit = grids.get(shrineNameKey(r.name))?.nearest(r.lat, r.lng, maxM)
    if (!hit) continue
    const prev = best.get(hit.point.qid)
    if (!prev || hit.distance < prev.distance) best.set(hit.point.qid, { row: r, distance: hit.distance })
  }
  for (const [qid, { row }] of best) {
    row.wikidata_id = qid
    row.size_signals.hasWiki = true
  }
  return best.size
}
