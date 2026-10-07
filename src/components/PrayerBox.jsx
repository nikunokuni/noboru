// マイページ：神社でお祈りしたいこと（自由記述。本人だけが読める）
import React, { useEffect, useState } from 'react'
import { useToast } from '../hooks/useToast'
import { PRAYER_MAX_LENGTH, fetchMyPrayer, saveMyPrayer } from '../lib/community'

export default function PrayerBox({ userId }) {
  const { showToast } = useToast()
  const [saved, setSaved] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMyPrayer(userId).then((b) => {
      if (!alive) return
      setSaved(b)
      setBody(b)
    }).catch(() => alive && setSaved(''))
    return () => { alive = false }
  }, [userId])

  const changed = saved != null && body.trim() !== saved

  const save = async () => {
    const trimmed = body.trim()
    setSaving(true)
    try {
      await saveMyPrayer({ userId, body: trimmed })
      setSaved(trimmed)
      setBody(trimmed)
      showToast('保存しました')
    } catch {
      showToast('保存に失敗しました。電波の届く場所でお試しください')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="prayer-box mt24">
      <div className="section-mini">神社でお祈りしたいこと</div>
      <textarea className="field-textarea" placeholder="具体的に○○ありがとうという感謝や、これから○○やっていきますという報告などがよいとされています"
        maxLength={PRAYER_MAX_LENGTH} value={body} onChange={(e) => setBody(e.target.value)}
        disabled={saved == null} aria-label="神社でお祈りしたいこと" />
      {changed && <button className="btn-primary mt8" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存する'}</button>}
    </section>
  )
}
