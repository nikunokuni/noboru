// 自分の記録の一覧
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useSignedUrls } from '../components/Photos'
import PhotoBook, { PhotoBookPicker } from '../components/PhotoBook'
import { useAuth } from '../hooks/useAuth'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyRecords } from '../lib/records'
import { formatDate } from '../lib/format'
import { PHOTO_BOOKS, emotionColor, emotionMarks } from '../lib/constants'

const FILTERS = [
  { key: 'all', label: 'すべて', test: () => true },
  { key: 'high', label: '感動大', test: (r) => r.emotion_level >= 75 },
  { key: 'photo', label: '写真あり', test: (r) => r.photoCount > 0 },
  { key: 'public', label: 'みんなに公開', test: (r) => r.is_public },
  { key: 'private', label: '自分だけ', test: (r) => !r.is_public },
  { key: 'pending', label: '未送信', test: (r) => r.pending },
]

export default function RecordsPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { pending, syncNow, discard, syncRevision } = usePendingRecords()
  const [records, setRecords] = useState(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState('all')
  // 御朱印帳など（写真のタグ）。null なら記録の一覧
  const [book, setBook] = useState(null)

  useEffect(() => {
    if (!user) { setRecords([]); return }
    fetchMyRecords(user.id)
      .then((r) => { setRecords(r); setFailed(false) })
      .catch(() => { setRecords((prev) => prev || []); setFailed(true) })
  }, [user, syncRevision])

  // 全記録の1枚目の写真を一度に署名
  const thumbs = useSignedUrls((records || []).map((r) => r.photos?.[0]?.path).filter(Boolean))

  const items = [
    ...pending.map((p) => ({
      id: p.id, pending: true, error: p.last_error, shrineName: p.shrine_name, visited_on: p.visited_on,
      emotion_level: p.emotion_level, public_memo: p.public_memo, is_public: p.is_public, photoCount: p.photos?.length || 0,
    })),
    ...(records || []).map((r) => ({
      id: r.id, shrineName: r.shrines?.name, visited_on: r.visited_on, emotion_level: r.emotion_level,
      public_memo: r.public_memo, is_public: r.is_public, onsite: r.onsite,
      photoCount: r.photos?.length || 0, thumb: thumbs[r.photos?.[0]?.path],
    })),
  ].filter(FILTERS.find((f) => f.key === filter).test)

  // 帳面：送信済みの自分の写真のうち、そのタグのもの（参拝日の新しい順）
  const bookItems = book ? (records || []).flatMap((r) => (r.photos || []).filter((p) => p.tag === book).map((p) => ({
    path: p.path, title: r.shrines?.name, sub: formatDate(r.visited_on), to: `/records/${r.id}`, linkLabel: '記録を見る',
  }))) : []

  // 参拝の数字（送信済みの記録から）
  const stats = records && {
    shrines: new Set(records.map((r) => r.shrine_id)).size,
    records: records.length,
    avg: records.length ? Math.round(records.reduce((s, r) => s + r.emotion_level, 0) / records.length) : 0,
  }

  return (
    <div className="app-shell">
      <TopBar title="自分の記録" />
      <div className="page-content">
        {user && (
          <div className="stat-row mb16">
            <div className="stat"><div className="stat-num">{stats?.shrines ?? '—'}</div><div className="stat-label">参拝した神社</div></div>
            <div className="stat"><div className="stat-num">{stats?.records ?? '—'}</div><div className="stat-label">記録</div></div>
            <div className="stat"><div className="stat-num">{stats?.avg ?? '—'}</div><div className="stat-label">感動の平均</div></div>
          </div>
        )}
        {user && <PhotoBookPicker value={book} onChange={setBook} />}
        {book ? (
          records === null ? <div className="spinner mt24" />
            : <PhotoBook items={bookItems} emptyText={`「${PHOTO_BOOKS.find(([t]) => t === book)[1].replace(/帳$/, '')}」のタグを付けた写真はまだありません`} />
        ) : (<>
        <div className="chip-row">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        {failed && <p className="muted small">電波が届かないため、送信済みの記録を表示できません</p>}
        {pending.length > 0 && (
          <button className="text-btn" onClick={syncNow}>未送信の記録を今すぐ送る（{pending.length}件）</button>
        )}

        {!authLoading && !user && <p className="muted center mt24">ログインすると記録が表示されます</p>}
        {user && records === null && <div className="spinner mt24" />}
        {user && records && items.length === 0 && <p className="muted center mt24">まだ記録がありません</p>}

        {items.map((r) => (
          <div key={r.id} className="card record-card" style={{ borderLeftColor: emotionColor(r.emotion_level) }}
            onClick={() => !r.pending && navigate(`/records/${r.id}`)} role={r.pending ? undefined : 'button'}>
            <div className="record-card-body">
              <div className="record-card-head">
                <span className="record-card-name">{r.shrineName}</span>
                <span className="small" style={{ color: emotionColor(r.emotion_level) }}>{emotionMarks(r.emotion_level)}</span>
              </div>
              <div className="muted small">
                {formatDate(r.visited_on)}
                {r.pending && <span className="tag-pending">未送信</span>}
                {!r.is_public && <span className="tag-plain">自分だけ</span>}
                {r.onsite && <span className="tag-plain">現地で記録</span>}
              </div>
              {r.public_memo && <p className="memo clamp">{r.public_memo}</p>}
              {r.error && (
                <p className="small error">
                  送信できませんでした：{r.error}
                  <button className="text-btn" onClick={(e) => { e.stopPropagation(); if (confirm('この未送信の記録を削除しますか？')) discard(r.id) }}>削除</button>
                </p>
              )}
            </div>
            {r.thumb && <img src={r.thumb} alt="" className="photo thumb" />}
          </div>
        ))}
        </>)}
      </div>
    </div>
  )
}
