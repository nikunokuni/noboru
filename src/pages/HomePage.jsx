import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/imageCompress'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import EmotionSlider from '../components/EmotionSlider'
import OmikujiModal from '../components/OmikujiModal'
import GodMessage from '../components/GodMessage'

const today = () => {
  const d = new Date()
  const y = d.getFullYear() - 2018 // 令和換算
  const m = d.getMonth() + 1
  const day = d.getDate()
  const months = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
  return `令和${y}年　${months[m - 1]}月${day}日`
}

export default function HomePage() {
  const { user } = useAuth()
  const { toast, showToast } = useToast()

  const [shrineName, setShrineName] = useState('')
  const [emotionLevel, setEmotionLevel] = useState(50)
  const [tab, setTab] = useState('public') // 'public' | 'private'
  const [publicMemo, setPublicMemo] = useState('')
  const [privateMemo, setPrivateMemo] = useState('')
  const [nextMemo, setNextMemo] = useState('')
  const [photos, setPhotos] = useState([]) // { file, preview }[]
  const [showOmikuji, setShowOmikuji] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileRef = useRef()

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (photos.length + files.length > 5) {
      showToast('写真は最大5枚まで')
      return
    }
    for (const file of files) {
      try {
        const compressed = await compressImage(file, 100)
        const preview = URL.createObjectURL(compressed)
        setPhotos(prev => [...prev, { file: compressed, preview }])
      } catch {
        showToast('画像の処理に失敗しました')
      }
    }
    e.target.value = ''
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!shrineName.trim()) { showToast('神社名を入力してください'); return }
    if (!user) { showToast('ログインが必要です'); return }

    setSaving(true)
    try {
      // 1. 神社をupsert
      const { data: shrine } = await supabase
        .from('shrines')
        .upsert({ name: shrineName.trim() }, { onConflict: 'name' })
        .select()
        .single()

      // 2. 記録を保存
      const { data: record, error } = await supabase
        .from('records')
        .insert({
          user_id: user.id,
          shrine_name: shrineName.trim(),
          shrine_id: shrine?.id ?? null,
          emotion_level: emotionLevel,
          public_memo: publicMemo,
          private_memo: privateMemo,
          next_memo: nextMemo,
          is_public: true,
          visited_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // 3. 写真をアップロード
      for (const photo of photos) {
        const ext = 'jpg'
        const path = `${user.id}/${record.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(path, photo.file, { contentType: 'image/jpeg' })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
          await supabase.from('photos').insert({
            record_id: record.id,
            user_id: user.id,
            url: publicUrl,
            path,
          })
        }
      }

      showToast('記録しました　⛩')
      // reset
      setShrineName('')
      setEmotionLevel(50)
      setPublicMemo('')
      setPrivateMemo('')
      setNextMemo('')
      setPhotos([])
    } catch (e) {
      console.error(e)
      showToast('保存に失敗しました')
    }
    setSaving(false)
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="app-logo">ノ<span>ボ</span>ル</div>
        <div style={{ fontSize: 11, color: 'var(--mist)', letterSpacing: '0.15em' }}>{today()}</div>
      </div>

      <div className="page-content">
        {/* 神社名 */}
        <div className="field-wrap">
          <label className="field-label">神社名</label>
          <input
            className="field-input"
            placeholder="神社の名前を入力..."
            value={shrineName}
            onChange={e => setShrineName(e.target.value)}
          />
        </div>

        {/* 感動の温度 */}
        <div className="field-wrap">
          <label className="field-label">感動の温度</label>
          <EmotionSlider value={emotionLevel} onChange={setEmotionLevel} />
        </div>

        {/* 神様からのことば */}
        <GodMessage
          shrineName={shrineName}
          emotionLevel={emotionLevel}
          memo={publicMemo}
        />

        {/* おみくじAI */}
        <button
          onClick={() => setShowOmikuji(true)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            background: 'var(--gold-bg)',
            borderRadius: 8,
            border: '1px solid rgba(184,150,12,0.18)',
            marginBottom: 20,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 20 }}>🎴</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 12, color: 'var(--ink)', letterSpacing: '0.08em', marginBottom: 2 }}>
              おみくじをAIに読んでもらう
            </div>
            <div style={{ fontSize: 9, color: 'var(--mist)' }}>写真かテキストで入力</div>
          </div>
          <span style={{ fontSize: 14, color: 'var(--gold)' }}>›</span>
        </button>

        {/* 公開・非公開タブ */}
        <div className="tab-row">
          <button className={`tab-btn ${tab === 'public' ? 'active' : ''}`} onClick={() => setTab('public')}>公開</button>
          <button className={`tab-btn ${tab === 'private' ? 'active' : ''}`} onClick={() => setTab('private')}>非公開</button>
        </div>

        {tab === 'public' ? (
          <div className="field-wrap">
            <textarea
              className="field-textarea"
              placeholder="感想・口コミ・穴場情報など（みんなに公開されます）"
              value={publicMemo}
              onChange={e => setPublicMemo(e.target.value)}
            />
          </div>
        ) : (
          <div className="field-wrap">
            <textarea
              className="field-textarea"
              placeholder="個人的な気づき・深い内省（自分だけが見えます）"
              value={privateMemo}
              onChange={e => setPrivateMemo(e.target.value)}
            />
          </div>
        )}

        {/* 次回へのメモ */}
        <div className="field-wrap">
          <label className="field-label">次回へのメモ</label>
          <input
            className="field-input"
            placeholder="次回また来たいときのために..."
            value={nextMemo}
            onChange={e => setNextMemo(e.target.value)}
          />
        </div>

        {/* 写真 */}
        <div className="section-mini">写真（最大5枚）</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={p.preview}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
              />
              <button
                onClick={() => removePhoto(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--ink)', color: 'var(--paper)',
                  border: 'none', fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          ))}
          {photos.length < 5 && (
            <div
              onClick={() => fileRef.current.click()}
              style={{
                width: 72, height: 72, borderRadius: 8,
                background: 'var(--paper2)',
                border: '1.5px dashed rgba(26,18,8,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: 'rgba(26,18,8,0.2)', cursor: 'pointer',
              }}
            >＋</div>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileRef}
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* 記録ボタン */}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '記録中...' : '記　録　す　る'}
        </button>
      </div>

      {showOmikuji && <OmikujiModal onClose={() => setShowOmikuji(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
