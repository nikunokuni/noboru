// 参拝記録：端末への一時保存（オフライン対応）とサーバーとのやりとり
import { get, set } from 'idb-keyval'
import { supabase, isNetworkError } from './supabase.js'
import { DEFAULT_PHOTO_TAG } from './constants.js'

const KEY_PENDING = 'pending-records'

// ─── 未送信の記録（IndexedDB） ───────────────────────────────
// 1件の形: { id, user_id, shrine_id, shrine_name, visited_on, emotion_level, public_memo,
//           private_memo, next_memo, is_public, onsite, location_accuracy_m, photos: Blob[],
//           photo_tags: string[]（photos と同じ並び。以前の版で保存した記録にはない）, created_at, last_error }

export async function listPending(userId) {
  const all = (await get(KEY_PENDING)) || []
  return userId ? all.filter((r) => r.user_id === userId) : all
}

async function updatePending(fn) {
  const all = (await get(KEY_PENDING)) || []
  const next = fn(all)
  await set(KEY_PENDING, next)
  return next
}

export const enqueueRecord = (record) => updatePending((all) => [...all, record])
export const removePending = (id) => updatePending((all) => all.filter((r) => r.id !== id))
const markPendingError = (id, message) =>
  updatePending((all) => all.map((r) => (r.id === id ? { ...r, last_error: message } : r)))

// user_id を含めない（公開記録の写真から誰の記録か分からないように）
const photoPath = (recordId, n) => `${recordId}/${n}.jpg`

// 1件送信。何度送っても二重登録にならないように作る
async function uploadRecord(r) {
  const { error: recErr } = await supabase.from('records').upsert({
    id: r.id,
    user_id: r.user_id,
    shrine_id: r.shrine_id,
    visited_on: r.visited_on,
    emotion_level: r.emotion_level,
    public_memo: r.public_memo,
    next_memo: r.next_memo,
    is_public: r.is_public,
    onsite: r.onsite,
    location_accuracy_m: r.location_accuracy_m,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (recErr) throw recErr

  if (r.private_memo) {
    const { error } = await supabase.from('record_private_notes')
      .upsert({ record_id: r.id, user_id: r.user_id, private_memo: r.private_memo })
    if (error) throw error
  }

  for (const [n, blob] of (r.photos || []).entries()) {
    const path = photoPath(r.id, n)
    const { error: upErr } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (upErr && !/exists|Duplicate/i.test(upErr.message)) throw upErr
    const { error } = await supabase.from('photos')
      .upsert({ record_id: r.id, user_id: r.user_id, path, tag: r.photo_tags?.[n] || DEFAULT_PHOTO_TAG }, { onConflict: 'path', ignoreDuplicates: true })
    if (error) throw error
  }

  // この記録がこの神社の唯一の記録なら「最初の参拝者」
  const { data: shrine } = await supabase.from('shrines').select('record_count').eq('id', r.shrine_id).maybeSingle()
  return { id: r.id, shrineId: r.shrine_id, shrineName: r.shrine_name, firstVisitor: shrine?.record_count === 1 }
}

let syncing = null

// 未送信の記録をまとめて送る。同時に2回走らないようにする
export function syncPending(userId) {
  if (syncing) return syncing
  syncing = (async () => {
    const sent = []
    let failed = 0
    for (const r of await listPending(userId)) {
      try {
        sent.push(await uploadRecord(r))
        await removePending(r.id)
      } catch (e) {
        failed++
        if (isNetworkError(e)) break // 圏外：残りは次の機会に
        await markPendingError(r.id, e.message || String(e))
      }
    }
    return { sent, failed }
  })().finally(() => { syncing = null })
  return syncing
}

// ─── サーバー上の記録 ─────────────────────────────────────────
const RECORD_FIELDS = 'id, shrine_id, visited_on, emotion_level, public_memo, next_memo, is_public, onsite, created_at, shrines(id, name, prefecture), photos(path, tag)'

export async function fetchMyRecords(userId) {
  const { data, error } = await supabase.from('records').select(RECORD_FIELDS)
    .eq('user_id', userId).order('visited_on', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchRecord(id) {
  const { data, error } = await supabase.from('records')
    .select(`${RECORD_FIELDS}, user_id, record_private_notes(private_memo)`).eq('id', id)
    .order('created_at', { referencedTable: 'photos' }).maybeSingle()
  if (error) throw error
  if (!data) return null
  const notes = data.record_private_notes
  return { ...data, private_memo: (Array.isArray(notes) ? notes[0] : notes)?.private_memo || '' }
}

export async function updateRecord(record, changes) {
  const { private_memo, ...fields } = changes
  const { error } = await supabase.from('records').update(fields).eq('id', record.id)
  if (error) throw error
  if (private_memo !== undefined) {
    const { error: e2 } = await supabase.from('record_private_notes')
      .upsert({ record_id: record.id, user_id: record.user_id, private_memo })
    if (e2) throw e2
  }
}

// 写真のタグを付け直す。tags: { path: tag }
export async function updatePhotoTags(tags) {
  for (const [path, tag] of Object.entries(tags)) {
    const { error } = await supabase.from('photos').update({ tag }).eq('path', path)
    if (error) throw error
  }
}

// 写真を編集用に読み込む
export async function downloadPhoto(path) {
  const { data, error } = await supabase.storage.from('photos').download(path)
  if (error) throw error
  return data
}

// 編集した写真に差し替える。CDN やブラウザに古い画像が残らないよう、上書きせず新しいパスに置いてから古いものを消す
// タグと撮った順（created_at）は引き継ぐ。戻り値は新しいパス
export async function replacePhoto(record, oldPath, blob) {
  const { data: old, error: e0 } = await supabase.from('photos').select('tag, created_at').eq('path', oldPath).single()
  if (e0) throw e0
  const n = oldPath.split('/').pop().replace(/(-[0-9a-z]+)?\.jpg$/, '')
  const path = `${record.id}/${n}-${Date.now().toString(36)}.jpg`

  const { error: upErr } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
  if (upErr) throw upErr
  const { error: insErr } = await supabase.from('photos')
    .insert({ record_id: record.id, user_id: record.user_id, path, tag: old.tag, created_at: old.created_at })
  if (insErr) {
    await supabase.storage.from('photos').remove([path])
    throw insErr
  }
  const { error: delErr } = await supabase.from('photos').delete().eq('path', oldPath)
  if (delErr) {
    await supabase.from('photos').delete().eq('path', path)
    await supabase.storage.from('photos').remove([path])
    throw delErr
  }
  await supabase.storage.from('photos').remove([oldPath])
  return path
}

export async function deleteRecord(record) {
  const paths = (record.photos || []).map((p) => p.path)
  if (paths.length) await supabase.storage.from('photos').remove(paths)
  const { error } = await supabase.from('records').delete().eq('id', record.id)
  if (error) throw error
}

// 非公開バケットの写真を表示するための一時URL
export async function signedPhotoUrls(paths) {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from('photos').createSignedUrls(paths, 3600)
  if (error) return {}
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

// 自分が参拝した神社のID（マップ・称号用）。未送信分も含める
export async function fetchMyShrineIds(userId) {
  const { data, error } = await supabase.from('records').select('shrine_id').eq('user_id', userId)
  if (error) throw error
  return data.map((r) => r.shrine_id)
}
