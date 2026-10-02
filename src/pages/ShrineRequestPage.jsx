// 神社の追加申請・一覧から外す報告
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { fetchShrine, submitShrineRequest } from '../lib/community'
import { getCurrentPosition } from '../lib/geo'

const HIDE_REASONS = ['境内社です', '同じ神社が重複しています', '現存しません', '神社ではありません']

export default function ShrineRequestPage() {
  const [params] = useSearchParams()
  const hideId = params.get('hide')
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()
  const { showToast } = useToast()
  const [target, setTarget] = useState(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState(HIDE_REASONS[0])
  const [position, setPosition] = useState(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (hideId) fetchShrine(hideId).then(setTarget).catch(() => {}) }, [hideId])

  const locate = async () => {
    setLocating(true)
    const p = await getCurrentPosition()
    setLocating(false)
    if (p) setPosition(p)
    else showToast('現在地を取得できませんでした')
  }

  const submit = async () => {
    if (!hideId && !name.trim()) { showToast('神社名を入力してください'); return }
    setSaving(true)
    try {
      await submitShrineRequest(hideId
        ? { user_id: user.id, kind: 'hide', shrine_id: Number(hideId), name: target?.name || '', note: `${reason}　${note}`.trim() }
        : { user_id: user.id, kind: 'add', name: name.trim(), note: note.trim(), lat: position?.lat ?? null, lng: position?.lng ?? null })
      showToast('ありがとうございます。確認して反映します', 3500)
      navigate(-1)
    } catch {
      showToast('送信に失敗しました。電波の届く場所でお試しください')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title={hideId ? '一覧から外す報告' : '神社の追加申請'} />
      <div className="page-content">
        {!user ? (
          <div className="login-panel">
            <p>申請にはログインが必要です</p>
            <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
          </div>
        ) : (
          <>
            {hideId ? (
              <>
                <p className="shrine-name small-title">⛩ {target?.name || '…'}</p>
                <div className="field-wrap">
                  <label className="field-label">理由</label>
                  <div className="chip-row">
                    {HIDE_REASONS.map((r) => (
                      <button key={r} type="button" className={`chip ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>{r}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="req-name">神社名</label>
                  <input id="req-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：〇〇神社" />
                </div>
                <div className="field-wrap">
                  <label className="field-label">場所</label>
                  {position
                    ? <p className="small">現在地を添付します（誤差 約{position.accuracy}m）</p>
                    : <button type="button" className="btn-secondary" onClick={locate} disabled={locating}>{locating ? '取得中…' : '現在地を添付する'}</button>}
                </div>
              </>
            )}
            <div className="field-wrap">
              <label className="field-label" htmlFor="req-note">補足</label>
              <textarea id="req-note" className="field-textarea" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={hideId ? '例：〇〇神社の境内、本殿の右手にあります' : '住所、目印など'} />
            </div>
            <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? '送信中…' : '送信する'}</button>
          </>
        )}
      </div>
    </div>
  )
}
