// 自分の記録の詳細・編集・削除
import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useSignedUrls } from '../components/Photos'
import EmotionSlider from '../components/EmotionSlider'
import { MemoFields, VisibilityPicker } from '../components/MemoFields'
import { useToast } from '../hooks/useToast'
import { deleteRecord, fetchRecord, updatePhotoTags, updateRecord } from '../lib/records'
import { formatDate, todayStr } from '../lib/format'
import { DEFAULT_PHOTO_TAG, PHOTO_TAGS, PHOTO_TAG_LABELS, emotionColor, emotionLabel } from '../lib/constants'

// 写真とタグ。onChange があればタグを選べる
function TaggedPhotos({ photos, tags, onChange }) {
  const urls = useSignedUrls(photos.map((p) => p.path))
  if (!photos.length) return null
  return (
    <div className="photo-row">
      {photos.map(({ path }) => (
        <div key={path} className="tagged-photo">
          {urls[path] ? <img src={urls[path]} alt="" loading="lazy" className="photo" /> : <div className="photo placeholder" />}
          {onChange
            ? <select className="tag-select" value={tags[path]} onChange={(ev) => onChange(path, ev.target.value)}>
                {PHOTO_TAGS.map(([t, label]) => <option key={t} value={t}>{label}</option>)}
              </select>
            : <span className="photo-tag">{PHOTO_TAG_LABELS[tags[path]]}</span>}
        </div>
      ))}
    </div>
  )
}

export default function RecordDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [record, setRecord] = useState(undefined)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchRecord(id).then(setRecord).catch(() => setRecord(null)) }, [id])

  const startEdit = () => setEditing({
    visited_on: record.visited_on, emotion_level: record.emotion_level, public_memo: record.public_memo,
    private_memo: record.private_memo, next_memo: record.next_memo, is_public: record.is_public,
    tags: photoTags(record),
  })

  const photoTags = (r) => Object.fromEntries((r.photos || []).map((p) => [p.path, p.tag || DEFAULT_PHOTO_TAG]))

  const save = async () => {
    setBusy(true)
    try {
      const { tags, ...fields } = editing
      const before = photoTags(record)
      await updateRecord(record, fields)
      await updatePhotoTags(Object.fromEntries(Object.entries(tags).filter(([path, tag]) => before[path] !== tag)))
      setRecord({ ...record, ...fields, photos: record.photos.map((p) => ({ ...p, tag: tags[p.path] })) })
      setEditing(null)
      showToast('更新しました')
    } catch {
      showToast('更新に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('この記録を削除しますか？写真も削除され、元に戻せません')) return
    setBusy(true)
    try {
      await deleteRecord(record)
      showToast('削除しました')
      navigate('/records', { replace: true })
    } catch {
      showToast('削除に失敗しました')
      setBusy(false)
    }
  }

  if (record === undefined) return <div className="app-shell"><TopBar back title="記録" /><div className="page-content"><div className="spinner" /></div></div>
  if (record === null) return <div className="app-shell"><TopBar back title="記録" /><div className="page-content"><p className="muted center">記録が見つかりませんでした</p></div></div>

  const e = editing
  const set = (patch) => setEditing({ ...e, ...patch })

  return (
    <div className="app-shell">
      <TopBar back title="記録" right={!e && <button className="text-btn" onClick={startEdit}>編集</button>} />
      <div className="page-content">
        <Link to={`/shrine/${record.shrine_id}`} className="shrine-name small-title link-plain">⛩ {record.shrines?.name} ›</Link>

        {!e ? (
          <>
            <p className="muted small">
              {formatDate(record.visited_on)}
              <span className="tag-plain">{record.is_public ? 'みんなに公開' : '自分だけ'}</span>
              {record.onsite && <span className="tag-plain">現地で記録</span>}
            </p>
            <p className="emotion-label mt16" style={{ color: emotionColor(record.emotion_level) }}>
              {emotionLabel(record.emotion_level)}<span className="muted small">　{record.emotion_level}</span>
            </p>
            <TaggedPhotos photos={record.photos || []} tags={photoTags(record)} />
            {record.public_memo && <><div className="section-mini">みんなへのメモ{!record.is_public && '（記録が自分だけなので、いまは誰にも見えません）'}</div><p className="memo">{record.public_memo}</p></>}
            {record.private_memo && <><div className="section-mini">自分だけのメモ</div><p className="memo">{record.private_memo}</p></>}
            {record.next_memo && <><div className="section-mini">次回へのメモ</div><p className="memo">{record.next_memo}</p></>}
          </>
        ) : (
          <>
            <div className="field-wrap mt16">
              <label className="field-label" htmlFor="ed-date">参拝日</label>
              <input id="ed-date" type="date" className="field-input" value={e.visited_on} max={todayStr()} onChange={(ev) => set({ visited_on: ev.target.value || e.visited_on })} />
            </div>
            <div className="field-wrap">
              <label className="field-label">感動の温度</label>
              <EmotionSlider value={e.emotion_level} onChange={(v) => set({ emotion_level: v })} />
            </div>
            <VisibilityPicker isPublic={e.is_public} onChange={(v) => set({ is_public: v })} />
            <MemoFields isPublic={e.is_public} publicMemo={e.public_memo} privateMemo={e.private_memo}
              onChange={(p) => set({
                ...('publicMemo' in p && { public_memo: p.publicMemo }),
                ...('privateMemo' in p && { private_memo: p.privateMemo }),
              })} />
            <div className="field-wrap">
              <label className="field-label">次回へのメモ</label>
              <input className="field-input" value={e.next_memo} onChange={(ev) => set({ next_memo: ev.target.value })} />
            </div>
            {record.photos?.length > 0 && (
              <div className="field-wrap">
                <label className="field-label">写真のタグ</label>
                <TaggedPhotos photos={record.photos} tags={e.tags} onChange={(path, tag) => set({ tags: { ...e.tags, [path]: tag } })} />
              </div>
            )}
            <button className="btn-primary mt16" onClick={save} disabled={busy}>保存する</button>
            <button className="text-btn mt16 block" onClick={() => setEditing(null)}>やめる</button>
          </>
        )}

        <button className="text-btn danger mt24" onClick={remove} disabled={busy}>この記録を削除する</button>
      </div>
    </div>
  )
}
