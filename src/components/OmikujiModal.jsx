import React, { useState, useRef } from 'react'
import { interpretOmikuji, readOmikujiFromImage } from '../lib/gemini'

export default function OmikujiModal({ onClose }) {
  const [mode, setMode] = useState('text') // 'text' | 'image'
  const [text, setText] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [imageMime, setImageMime] = useState(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageMime(file.type)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setImagePreview(dataUrl)
      setImageData(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setResult('')
    try {
      let res
      if (mode === 'image' && imageData) {
        res = await readOmikujiFromImage(imageData, imageMime)
      } else {
        res = await interpretOmikuji(text)
      }
      setResult(res)
    } catch (e) {
      setResult('読み取りに失敗しました。もう一度お試しください。')
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(26,18,8,0.7)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 430, margin: '0 auto',
          background: 'var(--paper)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 40px',
          maxHeight: '85vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-mincho)', fontSize: 16, letterSpacing: '0.15em' }}>
            🎴 おみくじAI
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'rgba(26,18,8,0.4)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Mode selector */}
        <div className="tab-row">
          <button className={`tab-btn ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>テキスト入力</button>
          <button className={`tab-btn ${mode === 'image' ? 'active' : ''}`} onClick={() => setMode('image')}>写真で読む</button>
        </div>

        {mode === 'text' ? (
          <textarea
            className="field-textarea"
            placeholder="おみくじに書かれている内容を入力してください..."
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ minHeight: 120 }}
          />
        ) : (
          <div>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleImageSelect} style={{ display: 'none' }} />
            {imagePreview ? (
              <div style={{ marginBottom: 12, textAlign: 'center' }}>
                <img src={imagePreview} alt="おみくじ" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
                <button
                  onClick={() => { setImagePreview(null); setImageData(null) }}
                  style={{ display: 'block', margin: '8px auto 0', fontSize: 11, color: 'var(--mist)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  画像を変更
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border: '1.5px dashed rgba(26,18,8,0.2)',
                  borderRadius: 10, padding: '32px 20px',
                  textAlign: 'center', cursor: 'pointer', marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 12, color: 'var(--mist)', fontFamily: 'var(--font-mincho)', letterSpacing: '0.1em' }}>
                  おみくじの写真を選択
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || (mode === 'text' ? !text.trim() : !imageData)}
          style={{ marginTop: 12 }}
        >
          {loading ? '読み取り中...' : 'AIに読んでもらう'}
        </button>

        {result && (
          <div style={{
            marginTop: 20,
            padding: '16px',
            background: 'var(--gold-bg)',
            borderRadius: 10,
            border: '1px solid rgba(184,150,12,0.15)',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--gold)', marginBottom: 8 }}>AIの解釈</div>
            <div style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>{result}</div>
          </div>
        )}
      </div>
    </div>
  )
}
