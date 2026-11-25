// 神様リスト：マップの神社のご祭神。祀られている神社を参拝（記録）すると自動で集まる。押すと神様の詳細へ
import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useMyVisits } from '../hooks/useMyVisits'
import { deityCollection } from '../lib/collections'
import { deityAliases } from '../lib/deities'
import { deityLabel } from '../lib/shrineTags'
import { normalize } from '../lib/indexCore'
import { formatDate } from '../lib/format'

const FILTERS = [
  { key: 'all', label: 'すべて', test: () => true },
  { key: 'got', label: '集めた', test: (d) => d.collected },
  { key: 'not', label: 'まだ', test: (d) => !d.collected },
]
const PAGE = 100

export const deityPath = (name) => `/collection/deities/${encodeURIComponent(name)}`

export default function DeityListPage() {
  const { user, loading } = useAuth()
  const { index, revision, status } = useShrineIndex()
  const { visits, failed } = useMyVisits()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const all = useMemo(() => (index ? deityCollection(index, visits || undefined) : null),
    [index, revision, visits]) // eslint-disable-line react-hooks/exhaustive-deps

  // 名前・別の書き方（スサノオ など）で探す
  const q = normalize(query)
  const items = (all || []).filter(FILTERS.find((f) => f.key === filter).test)
    .filter((d) => !q || [d.name, ...deityAliases(d.name)].some((n) => normalize(n).includes(q)))
  const got = all ? all.filter((d) => d.collected).length : 0

  return (
    <div className="app-shell">
      <TopBar title="神様リスト" back />
      <div className="page-content">
        {!index && (status === 'loading' || status === 'downloading') && <div className="spinner mt24" />}
        {!index && status === 'unavailable' && <p className="muted center mt24">神社一覧を読み込めませんでした。電波の届く場所でもう一度開いてください</p>}

        {all && (<>
          <div className="collection-summary">
            <div><span className="collection-got big">{user ? got.toLocaleString() : 0}</span><span className="muted"> / {all.length.toLocaleString()}柱</span></div>
            <div className="collection-bar" aria-hidden="true"><span style={{ width: `${user && all.length ? (got / all.length) * 100 : 0}%` }} /></div>
            <p className="muted small mt8">祀られている神社を参拝して記録すると、自動で集まります</p>
          </div>
          {!loading && !user && <p className="muted small center">ログインすると、参拝した記録から集まります</p>}
          {failed && <p className="muted small">電波が届かないため、送信済みの記録を反映できません</p>}

          <input className="field-input mb16" type="search" placeholder="神様の名前で探す（例：スサノオ）"
            value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} />
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => { setFilter(f.key); setLimit(PAGE) }}>{f.label}</button>
            ))}
          </div>

          {items.length === 0 && <p className="muted small center mt24">当てはまる神様はいません</p>}
          <ul className="deity-list">
            {items.slice(0, limit).map((d) => (
              <li key={d.name}>
                <Link to={deityPath(d.name)} className={`deity-row ${d.collected ? 'collected' : ''}`}>
                  <span className="deity-mark" aria-label={d.collected ? '集めた' : 'まだ'}>{d.collected ? '⛩' : ''}</span>
                  <span className="deity-row-body">
                    <span className="deity-row-name">{deityLabel(d.name)}</span>
                    <span className="muted small">
                      祀る神社 {d.shrineCount.toLocaleString()}社
                      {d.collected && d.collectedOn && <>　{formatDate(d.collectedOn)}に参拝</>}
                    </span>
                  </span>
                  <span className="collection-arrow">›</span>
                </Link>
              </li>
            ))}
          </ul>
          {items.length > limit && (
            <button className="btn-secondary mt16" onClick={() => setLimit((n) => n + PAGE)}>
              もっと見る（あと{(items.length - limit).toLocaleString()}柱）
            </button>
          )}
        </>)}
      </div>
    </div>
  )
}
