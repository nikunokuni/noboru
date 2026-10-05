// 神社一覧ファイルの取得・端末保存・参拝済みフラグの差分更新
import { get, set } from 'idb-keyval'
import { supabase, SUPABASE_URL } from './supabase.js'
import { prepareIndex, applyVisited, getItem } from './indexCore.js'
import { matchDeityNames, deityAliases } from './deities.js'

const KEY_INDEX = 'shrine-index'
const KEY_SYNCED_AT = 'shrine-index-visited-synced-at'

export async function loadCachedIndex() {
  try {
    return prepareIndex(await get(KEY_INDEX))
  } catch {
    return null
  }
}

export async function fetchIndexVersion() {
  const { data, error } = await supabase.from('app_meta').select('value').eq('key', 'shrine_index_version').maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export const indexFileUrl = (version) =>
  `${SUPABASE_URL}/storage/v1/object/public/public-data/shrines-index.${version}.json.gz`

// gzip のまま届いても、配信側で展開済みでも読めるようにする
async function readMaybeGzipJson(res) {
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return JSON.parse(await new Response(stream).text())
  }
  return JSON.parse(new TextDecoder().decode(buf))
}

export async function downloadIndex(version) {
  const res = await fetch(indexFileUrl(version))
  if (!res.ok) throw new Error(`神社一覧の取得に失敗しました (${res.status})`)
  const raw = await readMaybeGzipJson(res)
  const index = prepareIndex(raw)
  if (!index) throw new Error('神社一覧の形式が不正です')
  await set(KEY_INDEX, raw)
  await set(KEY_SYNCED_AT, raw.generated_at)
  return index
}

export async function saveIndex(index) {
  try { await set(KEY_INDEX, index.raw) } catch { /* 保存できなくても動作は続ける */ }
}

// 一覧ファイル生成以降に「誰かが参拝した／記録が消えた」神社を取得して反映
export async function syncVisited(index) {
  const since = (await get(KEY_SYNCED_AT)) || index.raw.generated_at
  // 端末とサーバーの時計のずれを見込んで10分戻した時刻を次回の起点にする
  const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const changes = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('shrines')
      .select('id, first_visited_on')
      .gt('stats_updated_at', since)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data) changes.push({ id: r.id, visited: r.first_visited_on != null })
    if (data.length < PAGE) break
  }
  const changed = applyVisited(index, changes)
  if (changed) await saveIndex(index)
  await set(KEY_SYNCED_AT, startedAt)
  return changed
}

const ITEM_COLUMNS = 'id, name, name_kana, prefecture, municipality, locality, lat, lng, first_visited_on'

// 一覧がまだないときの代わり：サーバーで名前検索
//   「八幡 世田谷」のように区切ると、1語目は名前・読み仮名、2語目以降は名前・市区町村・地名に当てはめる
export async function serverSearch(query, { prefecture = null, unvisitedOnly = false, limit = 30 } = {}) {
  const terms = query.replace(/[,()%*\\]/g, ' ').trim().split(/\s+/).filter(Boolean)
  let req = supabase.from('shrines').select(ITEM_COLUMNS).limit(limit)
  terms.forEach((q, i) => {
    req = req.or(i === 0
      ? `name.ilike.%${q}%,name_kana.ilike.%${q}%`
      : `name.ilike.%${q}%,name_kana.ilike.%${q}%,municipality.ilike.%${q}%,locality.ilike.%${q}%`)
  })
  if (prefecture) req = req.eq('prefecture', prefecture)
  if (unvisitedOnly) req = req.is('first_visited_on', null)
  const { data, error } = await req
  if (error) throw error
  return data.map(toItem)
}

// 一覧がまだないときの代わり：サーバーでご祭神から検索（辞書にある神様は別の書き方でも探す）
export async function serverSearchByDeity(query, { prefecture = null, unvisitedOnly = false, limit = 30 } = {}) {
  const clean = (s) => s.replace(/[,()%*\\]/g, '').trim()
  const words = [...new Set([clean(query), ...matchDeityNames(query).flatMap((n) => [n, ...deityAliases(n)]).map(clean)])].filter(Boolean)
  if (!words.length) return []
  let req = supabase.from('shrines').select(ITEM_COLUMNS).limit(limit)
    .or(words.map((w) => `deities.ilike.%${w}%`).join(','))
  if (prefecture) req = req.eq('prefecture', prefecture)
  if (unvisitedOnly) req = req.is('first_visited_on', null)
  const { data, error } = await req
  if (error) throw error
  return data.map(toItem)
}

export async function serverGetShrineItem(id) {
  const { data, error } = await supabase
    .from('shrines').select(ITEM_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toItem(data) : null
}

const toItem = (r) => ({
  id: r.id, name: r.name, kana: r.name_kana || '', prefecture: r.prefecture,
  municipality: r.municipality || null, locality: r.locality || null,
  lat: r.lat, lng: r.lng, visited: r.first_visited_on != null,
})

export { getItem }
