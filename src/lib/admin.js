// 管理者用：神社の追加申請・外す報告の承認と、神社一覧ファイルの作り直し
import { supabase } from './supabase.js'
import { encodeIndex, fetchIndexRows, newIndexVersion, indexVersionDate } from './indexCore.js'

export async function fetchIsAdmin(userId) {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) return false
  return !!data
}

const REQUEST_COLUMNS = 'id, kind, shrine_id, name, lat, lng, note, from_map, status, created_at, reviewed_at'

export async function fetchPendingRequests() {
  const { data, error } = await supabase.from('shrine_requests')
    .select(REQUEST_COLUMNS).eq('status', 'pending').order('created_at')
  if (error) throw error
  return data
}

export async function fetchReviewedRequests(limit = 50) {
  const { data, error } = await supabase.from('shrine_requests')
    .select(REQUEST_COLUMNS).neq('status', 'pending')
    .order('reviewed_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function countPendingRequests() {
  const { count, error } = await supabase.from('shrine_requests')
    .select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

// ご意見・ご要望（新しい順）。done: true で対応済み、false で未対応
export async function fetchFeedback({ done, limit = 200 }) {
  let q = supabase.from('feedback').select('id, user_id, screen, body, done_at, created_at')
  q = done ? q.not('done_at', 'is', null) : q.is('done_at', null)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function countOpenFeedback() {
  const { count, error } = await supabase.from('feedback')
    .select('id', { count: 'exact', head: true }).is('done_at', null)
  if (error) throw error
  return count ?? 0
}

export async function setFeedbackDone(id, done) {
  const { error } = await supabase.from('feedback').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw error
}

// shrine: add を承認するときの内容 { name, name_kana, prefecture, address, lat, lng }
export async function reviewShrineRequest(requestId, approve, shrine = {}) {
  const { data, error } = await supabase.rpc('review_shrine_request', { request_id: requestId, approve, shrine })
  if (error) throw error
  return data
}

// 神社を完全に削除する（みんなの参拝記録・写真・情報提供・申請も消える）
// DB から消したあと、残った写真ファイルを消す。ファイルが消せなくても神社の削除は済んでいる
export async function deleteShrine(shrineId) {
  const { data: paths, error } = await supabase.rpc('delete_shrine', { target: Number(shrineId) })
  if (error) throw error
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from('photos').remove(paths.slice(i, i + 100))
  }
}

// 今の一覧ファイルを作ったあとに承認した申請の数（＝アプリの一覧にまだ入っていない）
export async function countUnpublishedApprovals(version) {
  let q = supabase.from('shrine_requests')
    .select('id', { count: 'exact', head: true }).eq('status', 'approved')
  const builtAt = indexVersionDate(version)
  if (builtAt) q = q.gt('reviewed_at', builtAt.toISOString())
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

// 神社一覧ファイルを作り直して public-data に置き、版を更新する（取り込みスクリプトの --index-only と同じ）
export async function rebuildShrineIndex(onProgress = () => {}) {
  const rows = await fetchIndexRows(supabase, onProgress)
  const version = newIndexVersion()
  const json = JSON.stringify(encodeIndex(rows, { version }))
  // Blob で渡すと multipart で送られ contentType が効かないので、バイト列で渡す
  const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()

  const path = `shrines-index.${version}.json.gz`
  const { error: upErr } = await supabase.storage.from('public-data').upload(path, gz, {
    contentType: 'application/gzip', cacheControl: '31536000', upsert: false,
  })
  if (upErr) throw new Error(`アップロード失敗: ${upErr.message}`)

  const { data, error } = await supabase.from('app_meta')
    .update({ value: version }).eq('key', 'shrine_index_version').select('key')
  if (error) throw error
  if (!data?.length) throw new Error('版を更新できませんでした（管理者の権限を確認してください）')
  return { version, count: rows.length }
}

// ─── 情報提供の確認（すぐ反映された変更を見て、いたずらなら元に戻す） ───

const EDIT_COLUMNS = 'id, shrine_id, user_id, field, value, old_value, created_at, reverted_at, shrines(name, prefecture, municipality)'

// 新しい順。userId を指定するとその人の変更だけ
export async function fetchRecentEdits({ userId = null, limit = 100 } = {}) {
  let q = supabase.from('shrine_edits').select(EDIT_COLUMNS).order('created_at', { ascending: false }).limit(limit)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q
  if (error) throw error
  return data
}

// ─── ニックネーム（管理者は全員分を読める） ───

// { user_id: { nickname, show_name } }
export async function fetchProfiles(userIds) {
  const ids = [...new Set(userIds)]
  if (!ids.length) return {}
  const { data, error } = await supabase.from('profiles').select('user_id, nickname, show_name').in('user_id', ids)
  if (error) throw error
  return Object.fromEntries(data.map((p) => [p.user_id, p]))
}

// ニックネームのある人（新しく登録・変更した順）。query で名前の一部を検索
export async function fetchNicknames({ query = '', limit = 100 } = {}) {
  let q = supabase.from('profiles').select('user_id, nickname, show_name, updated_at').not('nickname', 'is', null)
  const word = query.trim().replace(/[%_\\,()]/g, '')
  if (word) q = q.ilike('nickname', `%${word}%`)
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function resetNickname(userId) {
  const { error } = await supabase.rpc('reset_nickname', { target: userId })
  if (error) throw error
}

export async function revertShrineEdit(editId) {
  const { error } = await supabase.rpc('revert_shrine_edit', { edit_id: editId })
  if (error) throw error
}

// 戻り値: { reverted, skipped }
export async function revertUserEdits(userId) {
  const { data, error } = await supabase.rpc('revert_user_edits', { target: userId })
  if (error) throw error
  return data
}

export async function setEditorBanned(userId, banned) {
  const { error } = await supabase.rpc('set_editor_banned', { target: userId, banned })
  if (error) throw error
}

export async function fetchBannedEditors() {
  const { data, error } = await supabase.from('banned_editors').select('user_id')
  if (error) throw error
  return new Set(data.map((r) => r.user_id))
}
