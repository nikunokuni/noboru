// 記録画面（近くの神社・神社詳細から、神社を選んだ状態で開く）
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { usePendingRecords } from '../hooks/usePendingRecords'
import EmotionSlider from '../components/EmotionSlider'
import { MemoFields, VisibilityPicker } from '../components/MemoFields'
import { GuideInlineLink } from '../components/GuideLinks'
import { compressImage } from '../lib/imageCompress'
import { distanceM, formatDistance, getCurrentPosition } from '../lib/geo'
import { getById } from '../lib/indexCore'
import { serverGetShrineItem } from '../lib/shrineIndex'
import { placeLabel, todayStr } from '../lib/format'
import { MAX_PHOTOS, ONSITE_RADIUS_M } from '../lib/constants'

const emptyForm = () => ({
  visitedOn: todayStr(), emotion: 50,
  publicMemo: '', privateMemo: '', nextMemo: '', isPublic: true, photos: [],
})

// 端末の神社一覧にあればそれを、なければ（一覧の準備中・追加されたばかり）サーバーから
function useShrine(id) {
  const { index } = useShrineIndex()
  const fromIndex = index && getById(index, id)
  const [fromServer, setFromServer] = useState(undefined)
  useEffect(() => {
    if (fromIndex) return
    let alive = true
    serverGetShrineItem(id)
      .then((item) => alive && setFromServer(item || null))
      .catch(() => alive && setFromServer(null))
    return () => { alive = false }
  }, [id, !!fromIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  return fromIndex || fromServer
}

export default function RecordPage() {
  const { shrineId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const { showToast } = useToast()
  const { markVisited } = useShrineIndex()
  const { addRecord } = usePendingRecords()
  const shrine = useShrine(shrineId)
  const [form, setForm] = useState(emptyForm)
  const [position, setPosition] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const update = (patch) => setForm((f) => ({ ...f, ...patch }))

  // 「現地で記録」の判定に使う。待たずに入力できる
  useEffect(() => {
    let alive = true
    getCurrentPosition().then((p) => alive && setPosition(p))
    return () => { alive = false }
  }, [])

  // プレビュー用URLの後始末
  const photosRef = useRef(form.photos)
  photosRef.current = form.photos
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  // 来た画面へ戻る。直接開いたときは近くの神社へ
  const leave = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }

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
    if (form.visitedOn > todayStr()) { showToast('参拝日が未来になっています'); return }
    setSaving(true)
    try {
      const dist = position ? distanceM(position.lat, position.lng, shrine.lat, shrine.lng) : null
      const onsite = dist != null && dist <= ONSITE_RADIUS_M && form.visitedOn === todayStr()
      await addRecord({
        id: crypto.randomUUID(),
        user_id: user.id,
        shrine_id: shrine.id,
        shrine_name: shrine.name,
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
      markVisited(shrine.id)
      form.photos.forEach((p) => URL.revokeObjectURL(p.preview))
      photosRef.current = []
      leave()
    } catch {
      showToast('端末への保存に失敗しました')
      setSaving(false)
    }
  }

  if (shrine === undefined) return <div className="app-shell"><TopBar back title="参拝を記録" /><div className="page-content"><div className="spinner" /></div></div>
  if (shrine === null) return <div className="app-shell"><TopBar back title="参拝を記録" /><div className="page-content"><p className="muted center">神社が見つかりませんでした（電波の届く場所で開き直してください）</p></div></div>

  const distance = position ? distanceM(position.lat, position.lng, shrine.lat, shrine.lng) : null

  return (
    <div className="app-shell">
      <TopBar back title="参拝を記録" />
      <div className="page-content">
        <div className="card picked">
          <div>
            <div className="picked-name">⛩ {shrine.name}</div>
            <div className="muted small">{placeLabel(shrine)}{distance != null && `・${formatDistance(distance)}`}</div>
          </div>
        </div>

        {!authLoading && !user ? (
          <div className="login-panel">
            <p>参拝の記録を残すには<br />ログインが必要です</p>
            <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
          </div>
        ) : (
          <>
            <div className="field-wrap">
              <label className="field-label" htmlFor="visited-on">参拝日</label>
              <input id="visited-on" type="date" className="field-input" value={form.visitedOn} max={todayStr()}
                onChange={(e) => update({ visitedOn: e.target.value || todayStr() })} />
            </div>

            <div className="field-wrap">
              <label className="field-label">感動の温度</label>
              <EmotionSlider value={form.emotion} onChange={(emotion) => update({ emotion })} />
            </div>

            <VisibilityPicker isPublic={form.isPublic} onChange={(isPublic) => update({ isPublic })} />
            <MemoFields isPublic={form.isPublic} publicMemo={form.publicMemo} privateMemo={form.privateMemo} onChange={update} />

            <div className="field-wrap">
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
