// 紹介記事：記事のページの HTML から、タイトル・アイキャッチ画像・サイト名を取り出す（OGP → Twitter カード → <title> の順）
// サーバーの関数（api/article-meta.js）とテストの両方から使うため、外部依存なし

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const clean = (s, max) => {
  const t = decodeEntities(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// <meta property="og:title" content="..."> の属性を読む（属性の順番・引用符の違いを問わない）
function metaTags(html) {
  const out = {}
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = {}
    for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? ''
    }
    const key = (attrs.property || attrs.name || '').toLowerCase()
    if (key && attrs.content != null && !(key in out)) out[key] = attrs.content
  }
  return out
}

// 画像のURLは https のものだけ（http の画像はアプリ（https）の中で出せないので）
function imageUrl(src, base) {
  if (!src) return null
  try {
    const u = new URL(decodeEntities(src.trim()), base)
    return u.protocol === 'https:' && u.href.length <= 2000 ? u.href : null
  } catch {
    return null
  }
}

// 戻り値: { title, image, siteName }（取れないものは null）
export function parseArticleMeta(html, baseUrl) {
  const head = (html || '').slice(0, 300000)
  const meta = metaTags(head)
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  return {
    title: clean(meta['og:title'] || meta['twitter:title'] || titleTag, 200),
    image: imageUrl(meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src'], baseUrl),
    siteName: clean(meta['og:site_name'] || meta['application-name'], 100),
  }
}

// HTML の文字コード（Content-Type の charset → <meta charset> の順）。わからなければ utf-8
export function detectCharset(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1]
  if (fromHeader) return fromHeader.toLowerCase()
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096))
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
  return (fromMeta || 'utf-8').toLowerCase()
}

// 記事のURLとして受け付けるか（http(s) で、空白を含まない）
export function articleUrl(s) {
  const t = (s || '').trim()
  if (!/^https?:\/\/[^\s/?#]+\.[^\s]*$/i.test(t) || t.length > 2000) return null
  try { return new URL(t).href } catch { return null }
}

// 表示用のサイト名（www. を省いたホスト名）
export const hostLabel = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
