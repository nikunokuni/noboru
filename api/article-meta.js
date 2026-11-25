// 紹介記事のタイトル・アイキャッチ画像を取る（Vercel のサーバーの関数。GET /api/article-meta?url=...）
// ブラウザからはほかのサイトのページを読めない（CORS）ので、ここで代わりに読む
// 内部のネットワーク（127.0.0.1・10.x・169.254.x など）には行かない。読むのは先頭の 512KB まで、6秒まで
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { articleUrl, detectCharset, parseArticleMeta } from '../src/lib/articleMeta.js'

const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 4

function isPrivateAddress(addr) {
  if (isIP(addr) === 6) {
    const a = addr.toLowerCase()
    if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7))
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe8') || a.startsWith('fe9')
      || a.startsWith('fea') || a.startsWith('feb')
  }
  const [x, y] = addr.split('.').map(Number)
  return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31)
    || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) || x >= 224
}

async function assertPublicHost(url) {
  const u = new URL(url)
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol')
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('bad port')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('private address')
}

async function readLimited(res) {
  const reader = res.body.getReader()
  const chunks = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  reader.cancel().catch(() => {})
  const out = new Uint8Array(Math.min(size, MAX_BYTES))
  let pos = 0
  for (const c of chunks) {
    const part = c.subarray(0, out.length - pos)
    out.set(part, pos)
    pos += part.length
    if (pos >= out.length) break
  }
  return out
}

async function fetchPage(startUrl, signal) {
  let url = startUrl
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicHost(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NoboruLinkPreview/1.0)', Accept: 'text/html,application/xhtml+xml' },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url).href
      continue
    }
    if (!res.ok) throw new Error(`status ${res.status}`)
    const type = res.headers.get('content-type') || ''
    if (!/html/i.test(type)) return { url, html: '' }
    const bytes = await readLimited(res)
    let html
    try { html = new TextDecoder(detectCharset(type, bytes)).decode(bytes) } catch { html = new TextDecoder().decode(bytes) }
    return { url, html }
  }
  throw new Error('too many redirects')
}

export default async function handler(req, res) {
  const url = articleUrl(String(req.query?.url || ''))
  if (!url) {
    res.status(400).json({ error: 'URLが正しくありません' })
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const page = await fetchPage(url, controller.signal)
    const meta = parseArticleMeta(page.html, page.url)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    res.status(200).json(meta)
  } catch {
    // 読めなくても記事は載せられる（タイトルなしでサイト名を出す）
    res.setHeader('Cache-Control', 'public, s-maxage=600')
    res.status(200).json({ title: null, image: null, siteName: null })
  } finally {
    clearTimeout(timer)
  }
}
