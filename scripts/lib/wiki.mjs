// Wikidata（ご祭神・読み仮名・Wikipedia記事名）と Wikipedia（特徴の要約）で補う
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const WIKIPEDIA_API = 'https://ja.wikipedia.org/w/api.php'
const FEATURES_MAX = 600

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function getJson(url, params, userAgent) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(5000 * attempt)
    const res = await fetch(`${url}?${qs}`, { headers: { 'User-Agent': userAgent } })
    if (res.status === 429 || res.status >= 500) continue
    if (!res.ok) throw new Error(`${url} ${res.status}`)
    return res.json()
  }
  throw new Error(`${url} の取得に失敗しました`)
}

const itemIds = (claims, prop) =>
  (claims?.[prop] || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)

const stringValue = (claims, prop) =>
  (claims?.[prop] || []).map((c) => c.mainsnak?.datavalue?.value).find((v) => typeof v === 'string') || null

// 要約を文の区切りで切り詰める
export function trimExtract(text, max = FEATURES_MAX) {
  const t = (text || '').replace(/\s+\n/g, '\n').trim()
  if (t.length <= max) return t || null
  const cut = t.slice(0, max)
  const end = cut.lastIndexOf('。')
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut}…`
}

export async function enrichWithWiki(rows, { userAgent, log = () => {} }) {
  // 1. Wikidata の項目を取得
  const qids = [...new Set(rows.map((r) => r.wikidata_id).filter((q) => /^Q\d+$/.test(q || '')))]
  const entities = new Map()
  for (const ids of chunk(qids, 50)) {
    const data = await getJson(WIKIDATA_API, { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|sitelinks', sitefilter: 'jawiki' }, userAgent)
    for (const [id, e] of Object.entries(data.entities || {})) entities.set(id, e)
    await sleep(200)
  }
  log(`  Wikidata: ${entities.size}件`)

  // 2. ご祭神（P825 dedicated to）の名前を取得
  const deityIds = [...new Set([...entities.values()].flatMap((e) => itemIds(e.claims, 'P825')))]
  const labels = new Map()
  for (const ids of chunk(deityIds, 50)) {
    const data = await getJson(WIKIDATA_API, { action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'ja' }, userAgent)
    for (const [id, e] of Object.entries(data.entities || {})) {
      const label = e.labels?.ja?.value
      if (label) labels.set(id, label)
    }
    await sleep(200)
  }

  for (const r of rows) {
    const e = entities.get(r.wikidata_id)
    if (!e) continue
    const deities = itemIds(e.claims, 'P825').map((id) => labels.get(id)).filter(Boolean)
    if (deities.length) r.deities = deities.join('、')
    const kana = stringValue(e.claims, 'P1814')
    if (kana && !r.name_kana) r.name_kana = kana.normalize('NFKC').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    const title = e.sitelinks?.jawiki?.title
    if (title) r.wikipedia_title = title
  }

  // 3. Wikipedia の冒頭の要約を「特徴」に
  const titles = [...new Set(rows.map((r) => r.wikipedia_title).filter(Boolean))]
  const extracts = new Map()
  for (const batch of chunk(titles, 20)) {
    const data = await getJson(WIKIPEDIA_API, {
      action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exlimit: '20', redirects: '1', titles: batch.join('|'),
    }, userAgent)
    const alias = new Map()
    for (const n of data.query?.normalized || []) alias.set(n.to, n.from)
    for (const n of data.query?.redirects || []) alias.set(n.to, alias.get(n.from) || n.from)
    for (const p of data.query?.pages || []) {
      if (!p.extract) continue
      const value = { title: p.title, text: trimExtract(p.extract) }
      extracts.set(p.title, value)
      if (alias.has(p.title)) extracts.set(alias.get(p.title), value)
    }
    await sleep(200)
  }
  log(`  Wikipedia: ${extracts.size}件`)

  for (const r of rows) {
    const ex = r.wikipedia_title && extracts.get(r.wikipedia_title)
    if (ex?.text) {
      r.features = ex.text
      r.features_source = `wikipedia:${ex.title}`
    }
  }
  return rows
}
