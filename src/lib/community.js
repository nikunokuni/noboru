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

export async function fetchPublicRecords(shrineId, limit = 20) {
  const { data, error } = await supabase.from('records')
    .select('id, visited_on, emotion_level, public_memo, photos(path)')
    .eq('shrine_id', shrineId).eq('is_public', true)
    .order('visited_on', { ascending: false }).limit(limit)
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
