// 未送信の記録の管理と自動送信（起動時・電波が戻ったとき・保存直後）
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { useShrineIndex } from './useShrineIndex'
import { enqueueRecord, fetchMyShrineIds, listPending, removePending, syncPending } from '../lib/records'
import { newDeitiesFor } from '../lib/collections'

const PendingContext = createContext(null)

export function PendingRecordsProvider({ children }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { index } = useShrineIndex()
  const [pending, setPending] = useState([])
  // 送信が終わるたびに増える。一覧などの再読み込みのきっかけに使う
  const [syncRevision, setSyncRevision] = useState(0)

  const reload = useCallback(async () => {
    setPending(user ? await listPending(user.id) : [])
  }, [user])

  // 送るだけ（お知らせは出さない）
  const send = useCallback(async () => {
    if (!user || !navigator.onLine) return []
    const { sent } = await syncPending(user.id)
    await reload()
    if (sent.length) setSyncRevision((n) => n + 1)
    return sent
  }, [user, reload])

  const syncNow = useCallback(async () => {
    const sent = await send()
    if (!sent.length) return sent
    const first = sent.find((s) => s.firstVisitor)
    if (first) showToast(`あなたが「${first.shrineName}」の最初の参拝者です　⛩`, 5000)
    else showToast(sent.length === 1 ? '記録を送信しました　⛩' : `${sent.length}件の記録を送信しました`)
    return sent
  }, [send, showToast])

  useEffect(() => {
    reload().then(syncNow)
    window.addEventListener('online', syncNow)
    return () => window.removeEventListener('online', syncNow)
  }, [reload, syncNow])

  // 電波が弱く送れなかった分は1分ごとに再送
  useEffect(() => {
    if (!pending.some((r) => !r.last_error)) return
    const t = setInterval(syncNow, 60000)
    return () => clearInterval(t)
  }, [pending, syncNow])

  // 記録の保存。お知らせは「記録完了！」の1つにまとめる（3秒ほどで消える）
  // 新しく集まった神様（コレクション）も添える。これまでの参拝を読めないとき（圏外など）は添えない
  const addRecord = useCallback(async (record) => {
    const before = await fetchMyShrineIds(record.user_id).catch(() => null)
    const others = before && [...before, ...(await listPending(record.user_id)).map((p) => p.shrine_id)]
    const deities = others && index ? newDeitiesFor(index, record.shrine_id, others) : []
    const deityNote = deities.length
      ? `\n新しい神様を集めました：${deities[0]}${deities.length > 1 ? ` ほか${deities.length - 1}柱` : ''}`
      : ''
    await enqueueRecord(record)
    await reload()
    const mine = (await send()).find((s) => s.id === record.id)
    const extra = deityNote ? 1500 : 0
    if (!mine) showToast(`記録完了！　電波が戻ったら送信します${deityNote}`, 4000 + extra)
    else if (mine.firstVisitor) showToast(`記録完了！　あなたが「${mine.shrineName}」の最初の参拝者です　⛩${deityNote}`, 5000 + extra)
    else showToast(`記録完了！${deityNote}`, 3000 + extra)
  }, [index, reload, send, showToast])

  const discard = useCallback(async (id) => {
    await removePending(id)
    await reload()
  }, [reload])

  return (
    <PendingContext.Provider value={{ pending, addRecord, syncNow, discard, syncRevision }}>
      {children}
    </PendingContext.Provider>
  )
}

export const usePendingRecords = () => useContext(PendingContext)
