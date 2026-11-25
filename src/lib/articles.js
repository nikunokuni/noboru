// 紹介記事：神社を紹介する記事のURL（一人1社につき1件）。タイトル・アイキャッチは載せるときに記事のページから取る
import { supabase } from './supabase.js'

// 記事のタイトル・アイキャッチ画像・サイト名（サーバーの関数 /api/article-meta が記事のページを読む）。取れなければ null
export async function fetchArticleMeta(url) {
  try {
    const res = await fetch(`/api/article-meta?url=${encodeURIComponent(url)}`)
    if (!res.ok) throw new Error(String(res.status))
    const m = await res.json()
    return { title: m.title || null, image: m.image || null, siteName: m.siteName || null }
  } catch {
    return { title: null, image: null, siteName: null }
  }
}

// 神社の紹介記事（新しい順）: [{ id, url, title, image_url, site_name, created_at, author, mine }]
export async function fetchShrineArticles(shrineId) {
  const { data, error } = await supabase.rpc('get_shrine_articles', { target: Number(shrineId) })
  if (error) throw error
  return data
}

// みんなの参拝の「記事」（載せた新しい順）: [{ id, shrine_id, shrine_name, prefecture, url, title, image_url, site_name, created_at, author }]
export async function fetchRecentArticles({ limit = 30, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_recent_articles', { max_rows: limit, skip: offset })
  if (error) throw error
  return data
}

const OWN_FIELDS = 'id, url, title, image_url, site_name, hidden, created_at'

export async function fetchMyArticle(shrineId, userId) {
  const { data, error } = await supabase.from('shrine_articles').select(OWN_FIELDS)
    .eq('shrine_id', shrineId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

// 載せる（同じ神社に載せていれば差し替える）。タイトルなどはここで取る
export async function saveMyArticle({ shrineId, userId, url }) {
  const meta = await fetchArticleMeta(url)
  const { data, error } = await supabase.from('shrine_articles').upsert({
    shrine_id: shrineId, user_id: userId, url, title: meta.title, image_url: meta.image, site_name: meta.siteName,
  }, { onConflict: 'shrine_id,user_id' }).select(OWN_FIELDS).single()
  if (error) throw error
  return data
}

export async function deleteMyArticle(id) {
  const { error } = await supabase.from('shrine_articles').delete().eq('id', id)
  if (error) throw error
}

// ─── 管理者 ───────────────────────────────────────────────
export async function fetchArticlesForAdmin(limit = 100) {
  const { data, error } = await supabase.from('shrine_articles')
    .select('id, user_id, url, title, image_url, site_name, hidden, created_at, shrine_id, shrines(name, prefecture)')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function setArticleHidden(id, hidden) {
  const { error } = await supabase.from('shrine_articles').update({ hidden }).eq('id', id)
  if (error) throw error
}
