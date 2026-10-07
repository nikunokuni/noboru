// マイページ：ニックネームと「名前を出す」の設定
import React, { useEffect, useState } from 'react'
import { useToast } from '../hooks/useToast'
import { NICKNAME_MAX_LENGTH, fetchMyProfile, isBannedError, isDuplicateNicknameError, saveMyProfile } from '../lib/community'

export default function NicknameSettings({ userId }) {
  const { showToast } = useToast()
  const [saved, setSaved] = useState(null) // { nickname, show_name }
  const [nickname, setNickname] = useState('')
  const [showName, setShowName] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMyProfile(userId).then((p) => {
      if (!alive) return
      setSaved(p)
      setNickname(p.nickname || '')
      setShowName(p.show_name)
    }).catch(() => alive && setSaved({ nickname: null, show_name: false }))
    return () => { alive = false }
  }, [userId])

  const trimmed = nickname.trim()
  const changed = saved && (trimmed !== (saved.nickname || '') || showName !== saved.show_name)

  const save = async () => {
    if (/[\u0000-\u001f\u007f]/.test(trimmed)) { showToast('使えない文字が入っています'); return }
    setSaving(true)
    try {
      await saveMyProfile({ userId, nickname: trimmed, showName })
      setSaved({ nickname: trimmed || null, show_name: showName })
      setNickname(trimmed)
      showToast('保存しました')
    } catch (e) {
      showToast(isDuplicateNicknameError(e) ? 'このニックネームはほかの人が使っています'
        : isBannedError(e) ? 'このアカウントではニックネームを変更できません'
          : '保存に失敗しました。電波の届く場所でお試しください')
    } finally {
      setSaving(false)
    }
  }

  if (!saved) return null

  return (
    <section className="mt24">
      <div className="section-mini">ニックネーム</div>
      <input className="field-input" placeholder={`${NICKNAME_MAX_LENGTH}文字まで`} maxLength={NICKNAME_MAX_LENGTH}
        value={nickname} onChange={(e) => setNickname(e.target.value)} aria-label="ニックネーム" />
      <label className="check-row mt8">
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
        <span>名前を出す</span>
      </label>
      <p className="muted small">
        {showName
          ? trimmed ? `公開した記録と、神社の情報提供者の一覧に「${trimmed}」と表示されます。`
            : 'ニックネームを入れると、公開した記録と情報提供者の一覧に表示されます。'
          : '名前は表示されません（情報提供者の一覧では「名前を出していない方」に数えます）。'}
      </p>
      {saved.nickname == null && saved.show_name && !trimmed && (
        <p className="muted small">ニックネームが未登録か、運営によって消されています。</p>
      )}
      {changed && <button className="btn-primary mt8" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存する'}</button>}
    </section>
  )
}
