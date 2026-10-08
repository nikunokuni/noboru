// みんなの数字・手引きリンク・情報提供
import { supabase } from './supabase.js'

export async function fetchAppStats() {
  const { data, error } = await supabase.rpc('get_app_stats')
  if (error) throw error
  return data // { recent_visitors, total_shrines, visited_shrines }
}

export async function fetchPrefectureProgress() {
  const { data, error } = await supabase.rpc('get_prefecture_progress')
  if (error) throw error
  return data // [{ prefecture, total, visited }]
}

export async function fetchGuideLinks(context) {
  const { data, error } = await supabase.from('guide_links')
    .select('id, title, url, description').eq('context', context).order('sort_order')
  if (error) throw error
  return data
}

export async function fetchShrine(id) {
  const { data, error } = await supabase.from('shrines').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

// 他人の記録・写真・情報提供は、user_id を返さない読み取り用の関数から読む

// 神社の公開記録（新しい順）: [{ id, visited_on, emotion_level, public_memo, photos: [{ path, tag }], author }]
// author は「名前を出す」にした人のニックネーム（ほかは null）
export async function fetchPublicRecords(shrineId, limit = 20) {
  const { data, error } = await supabase.rpc('get_public_records', { target: Number(shrineId), max_rows: limit })
  if (error) throw error
  return data
}

// みんなの参拝：全国の公開記録（参拝日の新しい順）: [{ id, shrine_id, shrine_name, prefecture, photo, author }]
// photo は最初の写真のパス（なければ null）。author は「名前を出す」にした人のニックネーム（ほかは null）
export async function fetchPublicTimeline({ limit = 30, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_public_timeline', { max_rows: limit, skip: offset })
  if (error) throw error
  return data
}

// 御朱印帳など：公開記録の写真のうち、そのタグのもの（参拝日の新しい順。自分の写真は除く）
// [{ path, shrine_id, shrine_name, visited_on, author }]
export async function fetchPublicPhotosByTag(tag, { limit = 60, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_public_photos_by_tag', { photo_tag: tag, max_rows: limit, skip: offset })
  if (error) throw error
  return data
}

// 名前を出していない人の、みんなの参拝での呼び名
export const ANONYMOUS_NAME = 'にくみん'

// 神社の写真（公開記録のものだけ・新しい順）: [{ path, tag }]
export async function fetchShrinePhotos(shrineId, limit = 200) {
  const { data, error } = await supabase.rpc('get_shrine_photos', { target: Number(shrineId), max_rows: limit })
  if (error) throw error
  return data
}

// 神社の情報提供者（最後に提供した順）: [{ name, edit_count, last_edited_at }]。name が null は名前を出していない人
export async function fetchShrineContributors(shrineId) {
  const { data, error } = await supabase.rpc('get_shrine_contributors', { target: Number(shrineId) })
  if (error) throw error
  return data
}

export async function fetchMyRecordsForShrine(shrineId, userId) {
  const { data, error } = await supabase.from('records')
    .select('id, user_id, visited_on, emotion_level, public_memo, is_public, photos(path)')
    .eq('shrine_id', shrineId).eq('user_id', userId)
    .order('visited_on', { ascending: false })
  if (error) throw error
  return data
}

// 管理者に情報提供・申請を止められている（RLS で追加を断られた）
export const isBannedError = (e) => e?.code === '42501'

// changes: { 項目名: 値 }。まとめて1回で送る（全部反映されるか、全部失敗するか）
export async function submitShrineEdits({ shrineId, userId, changes }) {
  const rows = Object.entries(changes).map(([field, value]) => ({ shrine_id: shrineId, user_id: userId, field, value }))
  const { error } = await supabase.from('shrine_edits').insert(rows)
  if (error) throw error
}

export async function submitShrineRequest(request) {
  const { error } = await supabase.from('shrine_requests').insert(request)
  if (error) throw error
}

export async function submitFeedback({ userId, screen, body }) {
  const { error } = await supabase.from('feedback').insert({ user_id: userId, screen, body })
  if (error) throw error
}

// ─── ニックネーム ─────────────────────────────────────────
export const NICKNAME_MAX_LENGTH = 20

export async function fetchMyProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('nickname, show_name').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data || { nickname: null, show_name: false }
}

export async function saveMyProfile({ userId, nickname, showName }) {
  const { error } = await supabase.from('profiles')
    .upsert({ user_id: userId, nickname: nickname || null, show_name: showName, updated_at: new Date().toISOString() })
  if (error) throw error
}

export const isDuplicateNicknameError = (e) => e?.code === '23505'

// ─── 神社でお祈りしたいこと（本人だけが読める） ─────────────
export const PRAYER_MAX_LENGTH = 1000

export async function fetchMyPrayer(userId) {
  const { data, error } = await supabase.from('prayers').select('body').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.body || ''
}

export async function saveMyPrayer({ userId, body }) {
  const { error } = await supabase.from('prayers')
    .upsert({ user_id: userId, body, updated_at: new Date().toISOString() })
  if (error) throw error
}
