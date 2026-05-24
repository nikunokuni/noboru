import React, { useState } from 'react'
import { getGodMessage } from '../lib/gemini'

export default function GodMessage({ shrineName, emotionLevel, memo }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [shown, setShown] = useState(false)

  const fetchMessage = async () => {
    if (!shrineName) return
    setLoading(true)
    try {
      const msg = await getGodMessage(shrineName, emotionLevel, memo)
      setMessage(msg)
      setShown(true)
    } catch {
      setMessage('メッセージを受け取れませんでした')
      setShown(true)
    }
    setLoading(false)
  }

  if (shown && message) {
    return (
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(184,150,12,0.06), rgba(192,57,43,0.04))',
        borderRadius: 10,
        border: '1px solid rgba(184,150,12,0.15)',
        marginBottom: 20,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.25em', color: 'var(--gold)', marginBottom: 10 }}>
          神様からのことば
        </div>
        <div style={{
          fontSize: 15,
          lineHeight: 1.9,
          color: 'var(--ink)',
          fontFamily: 'var(--font-mincho)',
          letterSpacing: '0.08em',
        }}>
          {message}
        </div>
        <button
          onClick={() => { setShown(false); setMessage('') }}
          style={{ marginTop: 12, fontSize: 10, color: 'var(--mist)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
        >
          もう一度受け取る
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={fetchMessage}
      disabled={loading || !shrineName}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(184,150,12,0.07), rgba(192,57,43,0.05))',
        borderRadius: 8,
        border: '1px solid rgba(184,150,12,0.18)',
        marginBottom: 16,
        cursor: shrineName ? 'pointer' : 'not-allowed',
        textAlign: 'left',
        opacity: shrineName ? 1 : 0.5,
      }}
    >
      <span style={{ fontSize: 20 }}>✨</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 12, color: 'var(--ink)', letterSpacing: '0.08em', marginBottom: 2 }}>
          {loading ? '神様に問いかけています...' : '神様からのことばを受け取る'}
        </div>
        <div style={{ fontSize: 9, color: 'var(--mist)' }}>
          {shrineName ? `${shrineName}の神様より` : '神社名を入力してください'}
        </div>
      </div>
      {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <span style={{ fontSize: 14, color: 'var(--gold)' }}>›</span>}
    </button>
  )
}
