// 記録画面（ホーム）
import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { usePendingRecords } from '../hooks/usePendingRecords'
import EmotionSlider from '../components/EmotionSlider'
import ShrinePicker from '../components/ShrinePicker'
import { GuideInlineLink } from '../components/GuideLinks'
import { compressImage } from '../lib/imageCompress'
import { distanceM, getCurrentPosition } from '../lib/geo'
import { getById } from '../lib/indexCore'
import { serverGetShrineItem } from '../lib/shrineIndex'
import { fetchAppStats } from '../lib/community'
import { todayStr } from '../lib/format'
import { MAX_PHOTOS, ONSITE_RADIUS_M } from '../lib/constants'

function RecentVisitors() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    fetchAppStats().then((s) => setCount(s.recent_visitors)).catch(() => {})
  }, [])
  if (!count) return null
  return <p className="quiet-count">この30日で、全国 {count.toLocaleString()}人 が参拝しています</p>
}

const emptyForm = () => ({
  shrine: null, visitedOn: todayStr(), emotion: 50, tab: 'public',
  publicMemo: '', privateMemo: '', nextMemo: '', isPublic: true, photos: [],
})

export default function HomePage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const { showToast } = useToast()
  const { index, markVisited } = useShrineIndex()
  const { addRecord } = usePendingRecords()
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState(emptyForm)
  const [position, setPosition] = useState(null)
  const [locating, setLocating] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const update = (patch) => setForm((f) => ({ ...f, ...patch }))

  // 位置の取得は待たずに画面を出す
  useEffect(() => {
    let alive = true
    getCurrentPosition().then((p) => { if (alive) { setPosition(p); setLocating(false) } })
    return () => { alive = false }
  }, [])

  // 神社詳細の「ここを記録する」から来たとき
  const preset = params.get('shrine')
  useEffect(() => {
    if (!preset) return
    const fromIndex = index && getById(index, preset)
    if (fromIndex) { update({ shrine: fromIndex }); setParams({}, { replace: true }); return }
    if (index) return
    serverGetShrineItem(preset).then((item) => { if (item) update({ shrine: item }) }).catch(() => {})
  }, [preset, index]) // eslint-disable-line react-hooks/exhaustive-deps

  // プレビュー用URLの後始末
  const photosRef = useRef(form.photos)
  photosRef.current = form.photos
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (form.photos.length + files.length > MAX_PHOTOS) { showToast(`写真は${MAX_PHOTOS}枚までです`); return }
    for (const file of files) {
      try {
        const blob = await compressImage(file)
        const photo = { blob, preview: URL.createObjectURL(blob) }
        setForm((f) => ({ ...f, photos: [...f.photos, photo] }))
      } catch {
        showToast('画像の処理に失敗しました')
      }
    }
  }

  const removePhoto = (i) => {
    URL.revokeObjectURL(form.photos[i].preview)
    update({ photos: form.photos.filter((_, j) => j !== i) })
  }

  const handleSave = async () => {
    if (!form.shrine) { showToast('神社を選んでください'); return }
    if (form.visitedOn > todayStr()) { showToast('参拝日が未来になっています'); return }
    setSaving(true)
    try {
      const dist = position ? distanceM(position.lat, position.lng, form.shrine.lat, form.shrine.lng) : null
      const onsite = dist != null && dist <= ONSITE_RADIUS_M && form.visitedOn === todayStr()
      await addRecord({
        id: crypto.randomUUID(),
        user_id: user.id,
        shrine_id: form.shrine.id,
        shrine_name: form.shrine.name,
        visited_on: form.visitedOn,
        emotion_level: form.emotion,
        public_memo: form.publicMemo.trim(),
        private_memo: form.privateMemo.trim(),
        next_memo: form.nextMemo.trim(),
        is_public: form.isPublic,
        onsite,
        location_accuracy_m: onsite ? position.accuracy : null,
        photos: form.photos.map((p) => p.blob),
        created_at: new Date().toISOString(),
      })
      markVisited(form.shrine.id)
      form.photos.forEach((p) => URL.revokeObjectURL(p.preview))
      setForm(emptyForm())
      window.scrollTo(0, 0)
    } catch {
      showToast('端末への保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="app-logo">ノ<span>ボ</span>ル</div>
      </header>
      <div className="page-content">
        <RecentVisitors />

        {!authLoading && !user ? (
          <div className="login-panel">
            <div className="login-mark">⛩</div>
            <p>参拝の記録を残すには<br />ログインが必要です</p>
            <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
          </div>
        ) : (
          <>
            <div className="field-wrap">
              <label className="field-label">神社</label>
              <ShrinePicker value={form.shrine} onChange={(shrine) => update({ shrine })} position={position} locating={locating} />
            </div>

            <div className="field-wrap">
              <label className="field-label" htmlFor="visited-on">参拝日</label>
              <input id="visited-on" type="date" className="field-input" value={form.visitedOn} max={todayStr()}
                onChange={(e) => update({ visitedOn: e.target.value || todayStr() })} />
            </div>

            <div className="field-wrap">
              <label className="field-label">感動の温度</label>
              <EmotionSlider value={form.emotion} onChange={(emotion) => update({ emotion })} />
            </div>

            <div className="tab-row">
              <button className={`tab-btn ${form.tab === 'public' ? 'active' : ''}`} onClick={() => update({ tab: 'public' })}>公開メモ</button>
              <button className={`tab-btn ${form.tab === 'private' ? 'active' : ''}`} onClick={() => update({ tab: 'private' })}>非公開メモ</button>
            </div>
            {form.tab === 'public'
              ? <textarea className="field-textarea" placeholder="感想・口コミ・穴場情報（記録を公開すると、みんなが読めます）"
                  value={form.publicMemo} onChange={(e) => update({ publicMemo: e.target.value })} />
              : <textarea className="field-textarea" placeholder="個人的な気づき・深い内省（自分だけが読めます）"
                  value={form.privateMemo} onChange={(e) => update({ privateMemo: e.target.value })} />}

            <div className="field-wrap mt16">
              <label className="field-label" htmlFor="next-memo">次回へのメモ</label>
              <input id="next-memo" className="field-input" placeholder="次に来るときのために…"
                value={form.nextMemo} onChange={(e) => update({ nextMemo: e.target.value })} />
            </div>

            <div className="field-wrap">
              <label className="field-label">写真（{form.photos.length}/{MAX_PHOTOS}）</label>
              <div className="photo-row">
                {form.photos.map((p, i) => (
                  <div key={p.preview} className="photo-edit">
                    <img src={p.preview} alt="" className="photo" />
                    <button className="photo-remove" onClick={() => removePhoto(i)} aria-label="写真を削除">✕</button>
                  </div>
                ))}
                {form.photos.length < MAX_PHOTOS && (
                  <button type="button" className="photo-add" onClick={() => fileRef.current.click()} aria-label="写真を追加">＋</button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} />
            </div>

            <label className="toggle-row">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => update({ isPublic: e.target.checked })} />
              <span>この記録を公開する<span className="muted small">（非公開メモは公開されません）</span></span>
            </label>

            <button className="btn-primary mt16" onClick={handleSave} disabled={saving || !user}>
              {saving ? '保存中…' : '記録する'}
            </button>

            <p className="center mt16"><GuideInlineLink context="etiquette" /></p>
          </>
        )}
      </div>
    </div>
  )
}
