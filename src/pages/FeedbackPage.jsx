// アプリへのご意見・ご要望。どの画面についてかを選んで自由に書く（管理者だけが読む）
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { isBannedError, submitFeedback } from '../lib/community'
import { FEEDBACK_MAX_LENGTH, FEEDBACK_SCREENS } from '../lib/constants'

export default function FeedbackPage() {
  const navigate = useNavigate()
  const { user, loading, signInWithGoogle } = useAuth()
  const { showToast } = useToast()
  const [screen, setScreen] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!screen) { showToast('どの画面についてか選んでください'); return }
    if (!body.trim()) { showToast('ご意見・ご要望を書いてください'); return }
    setSending(true)
    try {
      await submitFeedback({ userId: user.id, screen, body: body.trim() })
      showToast('ありがとうございます。送信しました')
      navigate(-1)
    } catch (e) {
      showToast(isBannedError(e) ? 'このアカウントからは送信できません' : '送信に失敗しました。電波の届く場所でお試しください')
      setSending(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="ご意見・ご要望" />
      <div className="page-content">
        {!loading && !user ? (
          <div className="login-panel">
            <p>送信にはログインが必要です</p>
            <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
          </div>
        ) : (
          <>
            <div className="field-wrap">
              <label className="field-label">どの画面について</label>
              <div className="chip-row">
                {FEEDBACK_SCREENS.map(([key, label]) => (
                  <button key={key} type="button" className={`chip ${screen === key ? 'active' : ''}`} onClick={() => setScreen(key)}>{label}</button>
                ))}
              </div>
            </div>

            <div className="field-wrap">
              <label className="field-label" htmlFor="feedback-body">ご意見・ご要望</label>
              <textarea id="feedback-body" className="field-textarea" rows={6} maxLength={FEEDBACK_MAX_LENGTH}
                placeholder="使いにくいところ、あったらうれしい機能など、なんでもどうぞ"
                value={body} onChange={(e) => setBody(e.target.value)} />
            </div>

            <p className="muted small">送った内容は運営者だけが読みます。個別の返信はしていません。</p>
            <button className="btn-primary mt16" onClick={submit} disabled={sending || !user}>
              {sending ? '送信中…' : '送信する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
