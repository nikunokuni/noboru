// 管理者用：神社の追加申請・外す報告の承認と、神社一覧ファイルの作り直し
import { supabase } from './supabase.js'
import { encodeIndex, fetchIndexRows, newIndexVersion, indexVersionDate } from './indexCore.js'

export async function fetchIsAdmin(userId) {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) return false
  return !!data
}

const REQUEST_COLUMNS = 'id, kind, shrine_id, name, lat, lng, note, status, created_at, reviewed_at'

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

// shrine: add を承認するときの内容 { name, name_kana, prefecture, address, lat, lng }
export async function reviewShrineRequest(requestId, approve, shrine = {}) {
  const { data, error } = await supabase.rpc('review_shrine_request', { request_id: requestId, approve, shrine })
  if (error) throw error
  return data
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
