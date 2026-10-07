// 管理者用：アプリへのご意見・ご要望を読む。読んだら「対応済み」にする
import React, { useCallback, useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { fetchFeedback, fetchIsAdmin, setFeedbackDone } from '../lib/admin'
import { FEEDBACK_SCREEN_LABELS } from '../lib/constants'

const shortId = (uuid) => `#${uuid.slice(0, 6)}`
const formatDateTime = (iso) => new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdminFeedbackPage() {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [isAdmin, setIsAdmin] = useState(null)
  const [tab, setTab] = useState('open')
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    fetchIsAdmin(user.id).then(setIsAdmin)
  }, [user])

  const reload = useCallback(async () => {
    setItems(null)
    try {
      setItems(await fetchFeedback({ done: tab === 'done' }))
    } catch {
      showToast('読み込めませんでした')
      setItems([])
    }
  }, [tab, showToast])

  useEffect(() => { if (isAdmin) reload() }, [isAdmin, reload])

  const toggle = async (item) => {
    setBusy(item.id)
    try {
      await setFeedbackDone(item.id, !item.done_at)
      setItems((list) => list.filter((x) => x.id !== item.id))
    } catch {
      showToast('更新に失敗しました')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="ご意見・ご要望の確認" />
      <div className="page-content">
        {(loading || (user && isAdmin === null)) && <div className="spinner" />}
        {!loading && isAdmin === false && <p className="muted center mt24">管理者だけが見られる画面です</p>}
        {isAdmin && (
          <>
            <div className="chip-row mt8">
              <button type="button" className={`chip ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>未対応</button>
              <button type="button" className={`chip ${tab === 'done' ? 'active' : ''}`} onClick={() => setTab('done')}>対応済み</button>
            </div>
            {items === null && <div className="spinner" />}
            {items?.length === 0 && <p className="muted small">{tab === 'open' ? '未対応のご意見はありません' : '対応済みのご意見はありません'}</p>}
            {items?.map((f) => (
              <div key={f.id} className="card">
                <div className="feedback-head">
                  <span className="pill">{FEEDBACK_SCREEN_LABELS[f.screen]}</span>
                  <span className="muted small">{formatDateTime(f.created_at)}・送信者 {shortId(f.user_id)}</span>
                </div>
                <p className="memo pre-wrap">{f.body}</p>
                <button className="text-btn" onClick={() => toggle(f)} disabled={busy === f.id}>
                  {f.done_at ? '未対応に戻す' : '対応済みにする'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
