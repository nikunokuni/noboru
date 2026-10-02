// 神社情報の追加・訂正（情報提供）
import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { fetchShrine, submitShrineEdit } from '../lib/community'
import { GOSHUIN_LABELS, PARKING_LABELS } from '../lib/constants'

// type: text / textarea / tags（読点区切り）/ choice
const FIELDS = [
  { key: 'goshuin', label: '御朱印', type: 'choice', options: GOSHUIN_LABELS },
  { key: 'parking', label: '駐車場', type: 'choice', options: PARKING_LABELS },
  { key: 'access_note', label: 'アクセス補足', type: 'textarea', placeholder: '例：〇〇駅から徒歩15分。最後に長い石段あり' },
  { key: 'deities', label: 'ご祭神', type: 'text', placeholder: '例：素戔嗚尊、櫛稲田姫命' },
  { key: 'benefits', label: 'ご利益', type: 'tags', placeholder: '読点（、）で区切って入力　例：縁結び、厄除け' },
  { key: 'features', label: '特徴（神話・由緒など）', type: 'textarea', placeholder: '関連する神話、創建の背景、見どころなど' },
  { key: 'address', label: '住所', type: 'text' },
  { key: 'name_kana', label: 'よみがな', type: 'text', placeholder: 'ひらがなで' },
  { key: 'shrine_rank', label: '社格', type: 'text', placeholder: '例：式内社、旧郷社' },
]

const toInput = (field, value) => (field.type === 'tags' ? (value || []).join('、') : value ?? (field.type === 'choice' ? 'unknown' : ''))

const toValue = (field, input) => {
  if (field.type === 'tags') return input.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean)
  return field.type === 'choice' ? input : input.trim()
}

export default function ShrineEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()
  const { showToast } = useToast()
  const [shrine, setShrine] = useState(null)
  const [fieldKey, setFieldKey] = useState(FIELDS[0].key)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const field = FIELDS.find((f) => f.key === fieldKey)

  useEffect(() => { fetchShrine(id).then(setShrine).catch(() => {}) }, [id])
  useEffect(() => { if (shrine) setInput(toInput(field, shrine[field.key])) }, [shrine, field])

  const submit = async () => {
    const value = toValue(field, input)
    if (JSON.stringify(value) === JSON.stringify(toValue(field, toInput(field, shrine[field.key])))) {
      showToast('内容が変わっていません'); return
    }
    setSaving(true)
    try {
      await submitShrineEdit({ shrineId: shrine.id, userId: user.id, field: field.key, value })
      showToast('ありがとうございます。反映しました')
      navigate(`/shrine/${shrine.id}`, { replace: true })
    } catch {
      showToast('送信に失敗しました。電波の届く場所でお試しください')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="情報の追加・訂正" />
      <div className="page-content">
        {!shrine ? <div className="spinner" /> : (
          <>
            <p className="shrine-name small-title">⛩ {shrine.name}</p>
            {!user ? (
              <div className="login-panel">
                <p>情報の提供にはログインが必要です</p>
                <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
              </div>
            ) : (
              <>
                <div className="field-wrap">
                  <label className="field-label" htmlFor="field">項目</label>
                  <select id="field" className="field-input" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)}>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>

                <div className="field-wrap">
                  <label className="field-label">{field.label}</label>
                  {field.type === 'choice' && (
                    <div className="chip-row">
                      {Object.entries(field.options).map(([v, label]) => (
                        <button key={v} type="button" className={`chip ${input === v ? 'active' : ''}`} onClick={() => setInput(v)}>{label}</button>
                      ))}
                    </div>
                  )}
                  {field.type === 'textarea' && (
                    <textarea className="field-textarea" rows={6} placeholder={field.placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
                  )}
                  {(field.type === 'text' || field.type === 'tags') && (
                    <input className="field-input" placeholder={field.placeholder} value={input} onChange={(e) => setInput(e.target.value)} />
                  )}
                </div>

                <p className="muted small">提供された内容はすぐに反映され、変更の履歴が残ります。</p>
                <button className="btn-primary mt16" onClick={submit} disabled={saving}>{saving ? '送信中…' : '送信する'}</button>

                <p className="mt24 small">
                  境内社・重複・現存しない神社など、一覧から外すべき場合は
                  <Link to={`/request?hide=${shrine.id}`} className="inline-link">こちらから報告</Link>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
