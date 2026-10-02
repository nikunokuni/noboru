// 神社を探す ＋ みんなでの達成状況
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { ShrineRow } from '../components/ShrinePicker'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { searchIndex } from '../lib/indexCore'
import { serverSearch } from '../lib/shrineIndex'
import { fetchAppStats, fetchPrefectureProgress } from '../lib/community'
import { percent } from '../lib/format'
import { PREFECTURES } from '../lib/constants'

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

export default function SearchPage() {
  const navigate = useNavigate()
  const { index, revision, status, refreshVisited } = useShrineIndex()
  const [query, setQuery] = useState('')
  const [prefecture, setPrefecture] = useState('')
  const [unvisitedOnly, setUnvisitedOnly] = useState(false)
  const [serverResults, setServerResults] = useState(null)

  useEffect(() => { refreshVisited() }, [refreshVisited])

  const active = query.trim() || prefecture || unvisitedOnly
  const opts = { prefecture: prefecture || null, unvisitedOnly, limit: 100 }

  const localResults = useMemo(
    () => (index && active ? searchIndex(index, query, opts) : null),
    [index, revision, query, prefecture, unvisitedOnly], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (index || !active) { setServerResults(null); return }
    let alive = true
    const t = setTimeout(() => {
      serverSearch(query, { ...opts, limit: 30 }).then((r) => alive && setServerResults(r)).catch(() => alive && setServerResults([]))
    }, 400)
    return () => { alive = false; clearTimeout(t) }
  }, [index, query, prefecture, unvisitedOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = index ? localResults : serverResults

  return (
    <div className="app-shell">
      <TopBar title="神社を探す" />
      <div className="page-content">
        <Progress />

        <input className="field-input" placeholder="神社名・よみがなで検索" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        <div className="filter-row">
          <select className="select" value={prefecture} onChange={(e) => setPrefecture(e.target.value)} aria-label="都道府県">
            <option value="">全国</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className={`chip ${unvisitedOnly ? 'active' : ''}`} onClick={() => setUnvisitedOnly((v) => !v)}>まだ誰も行っていない</button>
        </div>
        {status === 'downloading' && <p className="muted small">神社一覧を準備中…（サーバーで検索しています）</p>}

        {active && (
          <div className="mt8">
            {!results && <div className="spinner" />}
            {results?.length === 0 && <p className="muted small center">見つかりませんでした</p>}
            {results?.map((r) => <ShrineRow key={r.id} item={r} onClick={() => navigate(`/shrine/${r.id}`)} right="›" />)}
            {results?.length >= 100 && <p className="muted small center">上位100件を表示しています。条件を絞ってください</p>}
          </div>
        )}
      </div>
    </div>
  )
}
