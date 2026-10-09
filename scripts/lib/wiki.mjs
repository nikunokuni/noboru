// Wikidata（ご祭神・読み仮名・Wikipedia記事名）と Wikipedia（特徴の要約）で補う
import { normalizeDeities } from '../../src/lib/deities.js'

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

// テンプレート・リンクの入れ子を見ながら、トップレベルの '|' で区切る
function splitTopLevel(s) {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; i++ } else if (two === '}}' || two === ']]') { depth--; i++ } else if (s[i] === '|' && depth === 0) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out
}

// 中身をそのまま見せてよいテンプレート（最後の引数を残す）
const PASS_TEMPLATES = /^(small|smaller|nowrap|lang|font|color|ruby|仮リンク)$/i

// 値の wikitext を読める文字にする
export function cleanWikiValue(v) {
  let s = (v || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, '、')
    .replace(/<[^>]+>/g, '')
  // 内側のテンプレートから順に処理する
  for (let i = 0; i < 10 && /\{\{/.test(s); i++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body) => {
      const [name, ...params] = splitTopLevel(body)
      if (name.trim() === '仮リンク') return params[0] ?? ''
      if (!PASS_TEMPLATES.test(name.trim())) return ''
      const pos = params.filter((p) => !/^\s*[\w-]+\s*=/.test(p))
      return pos.at(-1) ?? ''
    })
  }
  s = s
    .replace(/\[\[(?:ファイル|画像|File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '、')
    .replace(/(^[、・\s]+|[、・\s]+$)/g, '')
    .replace(/、{2,}/g, '、')
  return s || null
}

// 記事の wikitext から神社のインフォボックス（{{Infobox 神社}}）の項目を取り出す
export function parseShrineInfobox(wikitext) {
  const m = /\{\{\s*(?:Infobox[ _]*)?(?:日本の)?神社\s*(?=[|\n])/i.exec(wikitext || '')
  if (!m) return null
  // 対応する '}}' までを切り出す
  let depth = 0
  let end = -1
  for (let i = m.index; i < wikitext.length - 1; i++) {
    const two = wikitext.slice(i, i + 2)
    if (two === '{{') { depth++; i++ } else if (two === '}}') {
      depth--
      i++
      if (depth === 0) { end = i - 1; break }
    }
  }
  if (end < 0) return null
  const body = wikitext.slice(m.index + 2, end)
  const fields = {}
  for (const part of splitTopLevel(body).slice(1)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    const value = cleanWikiValue(part.slice(eq + 1))
    if (key && value) fields[key] = value
  }
  return fields
}

// インフォボックスの項目 → shrines の列
const INFOBOX_COLUMNS = { 主祭神: 'deities', 祭神: 'deities', 社格: 'shrine_rank', 創建: 'founded', 例祭: 'annual_festival' }
const COLUMN_MAX = 200

export function infoboxColumns(fields) {
  const out = {}
  for (const [key, col] of Object.entries(INFOBOX_COLUMNS)) {
    const v = fields?.[key]
    if (v && !out[col] && v.length <= COLUMN_MAX) out[col] = v
  }
  if (out.deities) out.deities = normalizeDeities(out.deities).text || out.deities
  return out
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
    if (deities.length) r.deities = normalizeDeities(deities.join('、')).text || null
    const kana = stringValue(e.claims, 'P1814')
    if (kana && !r.name_kana) r.name_kana = kana.normalize('NFKC').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    const title = e.sitelinks?.jawiki?.title
    if (title) r.wikipedia_title = title
  }

  // 3. Wikipedia の冒頭の要約を「特徴」に、インフォボックスから社格・創建・例祭（ご祭神は Wikidata になければ）
  const titles = [...new Set(rows.map((r) => r.wikipedia_title).filter(Boolean))]
  const pages = new Map()
  for (const batch of chunk(titles, 20)) {
    const data = await getJson(WIKIPEDIA_API, {
      action: 'query', prop: 'extracts|revisions', exintro: '1', explaintext: '1', exlimit: '20',
      rvprop: 'content', rvslots: 'main', redirects: '1', titles: batch.join('|'),
    }, userAgent)
    const alias = new Map()
    for (const n of data.query?.normalized || []) alias.set(n.to, n.from)
    for (const n of data.query?.redirects || []) alias.set(n.to, alias.get(n.from) || n.from)
    for (const p of data.query?.pages || []) {
      const wikitext = p.revisions?.[0]?.slots?.main?.content
      const value = {
        title: p.title,
        text: p.extract ? trimExtract(p.extract) : null,
        info: infoboxColumns(parseShrineInfobox(wikitext)),
      }
      pages.set(p.title, value)
      if (alias.has(p.title)) pages.set(alias.get(p.title), value)
    }
    await sleep(200)
  }

  let infoCount = 0
  for (const r of rows) {
    const page = r.wikipedia_title && pages.get(r.wikipedia_title)
    if (!page) continue
    if (page.text) {
      r.features = page.text
      r.features_source = `wikipedia:${page.title}`
    }
    const { deities, ...info } = page.info
    if (deities && !r.deities) r.deities = deities
    Object.assign(r, info)
    if (deities || Object.keys(info).length) infoCount++
  }
  log(`  Wikipedia: ${pages.size}件（社格・創建・例祭など: ${infoCount}件）`)
  return rows
}
