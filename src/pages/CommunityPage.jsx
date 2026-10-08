// みんなの参拝：みんなでの達成状況 ＋ 全国の公開記録のタイムライン
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useSignedUrls } from '../components/Photos'
import { ANONYMOUS_NAME, fetchAppStats, fetchPrefectureProgress, fetchPublicTimeline } from '../lib/community'
import { percent } from '../lib/format'
import { PREFECTURES } from '../lib/constants'

const PAGE = 30

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

export default function CommunityPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

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
      </div>
    </div>
  )
}
