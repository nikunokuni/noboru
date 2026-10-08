// みんなの参拝：みんなでの達成状況 ＋ 全国の公開記録のタイムライン
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useSignedUrls } from '../components/Photos'
import PhotoBook, { PhotoBookPicker } from '../components/PhotoBook'
import { ANONYMOUS_NAME, fetchAppStats, fetchPrefectureProgress, fetchPublicPhotosByTag, fetchPublicTimeline } from '../lib/community'
import { formatDate, percent } from '../lib/format'
import { PHOTO_BOOKS, PREFECTURES } from '../lib/constants'

const PAGE = 30
const BOOK_PAGE = 60

function Progress() {
  const [stats, setStats] = useState(null)
  const [prefs, setPrefs] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { fetchAppStats().then(setStats).catch(() => {}) }, [])
  useEffect(() => {
    if (open && !prefs) fetchPrefectureProgress().then(setPrefs).catch(() => setPrefs([]))
  }, [open, prefs])

  if (!stats || !stats.total_shrines) return null
  const sorted = prefs && [...prefs].sort((a, b) => PREFECTURES.indexOf(a.prefecture) - PREFECTURES.indexOf(b.prefecture))

  return (
    <div className="card progress-card">
      <div className="section-mini">みんなで全社参拝</div>
      <div className="progress-text">
        全国 {stats.total_shrines.toLocaleString()}社中 <strong>{stats.visited_shrines.toLocaleString()}社</strong> に参拝済み
        <span className="muted small">（{percent(stats.visited_shrines, stats.total_shrines)}%）</span>
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: `${(stats.visited_shrines / stats.total_shrines) * 100}%` }} /></div>
      <button className="text-btn mt8" onClick={() => setOpen((o) => !o)}>{open ? '閉じる' : '都道府県別に見る'}</button>
      {open && (
        <div className="pref-list">
          {!sorted && <div className="spinner" />}
          {sorted?.map((p) => (
            <div key={p.prefecture} className="pref-row">
              <span className="pref-name">{p.prefecture}</span>
              <div className="bar small"><div className="bar-fill" style={{ width: `${(p.visited / p.total) * 100}%` }} /></div>
              <span className="muted small pref-num">{p.visited}/{p.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineRow({ item, url, onClick }) {
  return (
    <button type="button" className="timeline-row" onClick={onClick}>
      {item.photo && url
        ? <img src={url} alt="" loading="lazy" className="timeline-photo" />
        : <div className={`timeline-photo placeholder ${item.photo ? '' : 'empty'}`}>{!item.photo && '⛩'}</div>}
      <span className="timeline-body">
        <span className="timeline-name">{item.shrine_name}</span>
        <span className="muted small">{item.author || ANONYMOUS_NAME}・{item.prefecture}</span>
      </span>
      <span className="muted small">›</span>
    </button>
  )
}

// 御朱印帳など：みんなの公開記録の写真のうち、そのタグのもの（自分の写真は除く）
function PublicBook({ tag }) {
  const [rows, setRows] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (offset) => {
    setLoading(true)
    try {
      const page = await fetchPublicPhotosByTag(tag, { limit: BOOK_PAGE, offset })
      setRows((prev) => {
        const base = offset ? prev || [] : []
        const seen = new Set(base.map((r) => r.path))
        return [...base, ...page.filter((r) => !seen.has(r.path))]
      })
      setHasMore(page.length === BOOK_PAGE)
      setFailed(false)
    } catch {
      setFailed(true)
      if (!offset) setRows([])
    } finally {
      setLoading(false)
    }
  }, [tag])

  useEffect(() => { setRows(null); load(0) }, [load])

  if (!rows) return <div className="spinner" />
  const label = PHOTO_BOOKS.find(([t]) => t === tag)[1].replace(/帳$/, '')
  const items = rows.map((r) => ({
    path: r.path, title: r.shrine_name, sub: `${formatDate(r.visited_on)}・${r.author || ANONYMOUS_NAME}`,
    to: `/shrine/${r.shrine_id}`, linkLabel: '神社を見る',
  }))
  return (
    <>
      {!(failed && !rows.length) && <PhotoBook items={items} emptyText={`みんなが公開した「${label}」の写真はまだありません`} />}
      {failed && <p className="muted small center mt8">読み込めませんでした</p>}
      {(hasMore || failed) && (
        <button className="btn-secondary mt16" disabled={loading} onClick={() => load(failed && !rows.length ? 0 : rows.length)}>
          {loading ? '読み込み中…' : failed ? 'もう一度読み込む' : 'もっと見る'}
        </button>
      )}
    </>
  )
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [book, setBook] = useState(null)

  const load = useCallback(async (offset) => {
    setLoading(true)
    try {
      const rows = await fetchPublicTimeline({ limit: PAGE, offset })
      // 読み込みの間に新しい参拝が入ると同じ記録が来ることがあるので、重ねない
      setItems((prev) => {
        const base = offset ? prev || [] : []
        const seen = new Set(base.map((r) => r.id))
        return [...base, ...rows.filter((r) => !seen.has(r.id))]
      })
      setHasMore(rows.length === PAGE)
      setFailed(false)
    } catch {
      setFailed(true)
      if (!offset) setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  const urls = useSignedUrls((items || []).map((r) => r.photo).filter(Boolean))

  return (
    <div className="app-shell">
      <TopBar title="みんなの参拝" />
      <div className="page-content">
        <Progress />

        <PhotoBookPicker value={book} onChange={setBook} />
        {book ? <PublicBook tag={book} /> : (<>
        <div className="section-mini">みんなの参拝</div>
        {!items && <div className="spinner" />}
        {items?.length === 0 && !failed && <p className="muted small center">まだ公開された参拝はありません</p>}
        {items?.map((r) => (
          <TimelineRow key={r.id} item={r} url={r.photo && urls[r.photo]} onClick={() => navigate(`/shrine/${r.shrine_id}`)} />
        ))}
        {failed && <p className="muted small center mt8">読み込めませんでした</p>}
        {items && (hasMore || failed) && (
          <button className="btn-secondary mt16" disabled={loading} onClick={() => load(failed && !items.length ? 0 : items.length)}>
            {loading ? '読み込み中…' : failed ? 'もう一度読み込む' : 'もっと見る'}
          </button>
        )}
        </>)}
      </div>
    </div>
  )
}
