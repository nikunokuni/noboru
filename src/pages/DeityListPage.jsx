// 神様リスト：マップの神社のご祭神。祀られている神社を参拝（記録）すると自動で集まる。押すと神様の詳細へ
// 上に有名な神様（ご祭神の辞書にある神様）、下にその他の神様。どちらも祀る神社の多い順に、横3つずつ並べる（名前にフリガナを添える）
import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useMyVisits } from '../hooks/useMyVisits'
import { deityCollection } from '../lib/collections'
import { deityAliases, isKnownDeity } from '../lib/deities'
import { normalize } from '../lib/indexCore'
import { deityFurigana, deityReading } from '../lib/deityReadings'

const FILTERS = [
  { key: 'all', label: 'すべて', test: () => true },
  { key: 'got', label: '集めた', test: (d) => d.collected },
  { key: 'not', label: 'まだ', test: (d) => !d.collected },
]
// その他の神様は数が多いので少しずつ出す
const PAGE = 60

export const deityPath = (name) => `/collection/deities/${encodeURIComponent(name)}`

function DeityGrid({ items }) {
  return (
    <ul className="deity-grid">
      {items.map((d) => {
        const kana = deityFurigana(d.name)
        return (
          <li key={d.name}>
            <Link to={deityPath(d.name)} className={`deity-cell ${d.collected ? 'collected' : ''}`}>
              <span className="deity-mark" aria-label={d.collected ? '集めた' : 'まだ'}>{d.collected ? '⛩' : ''}</span>
              <span className="deity-cell-name">{d.name}</span>
              {kana && <span className="deity-cell-kana">{kana}</span>}
              <span className="deity-cell-count">{d.shrineCount.toLocaleString()}社</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function DeityListPage() {
  const { user, loading } = useAuth()
  const { index, revision, status } = useShrineIndex()
  const { visits, failed } = useMyVisits()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const all = useMemo(() => (index ? deityCollection(index, visits || undefined) : null),
    [index, revision, visits]) // eslint-disable-line react-hooks/exhaustive-deps

  // 名前・読み・別の書き方（スサノオ など）で探す
  const q = normalize(query)
  const items = (all || []).filter(FILTERS.find((f) => f.key === filter).test)
    .filter((d) => !q || [d.name, deityReading(d.name), ...deityAliases(d.name)].filter(Boolean).some((n) => normalize(n).includes(q)))
  const famous = items.filter((d) => isKnownDeity(d.name))
  const others = items.filter((d) => !isKnownDeity(d.name))
  const got = all ? all.filter((d) => d.collected).length : 0
  const count = (list) => (user ? `${list.filter((d) => d.collected).length} / ${list.length}` : `${list.length}`)

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

          {famous.length > 0 && (
            <section>
              <div className="deity-section-head"><span>有名な神様</span><span className="muted small">{count(famous)}</span></div>
              <DeityGrid items={famous} />
            </section>
          )}

          {others.length > 0 && (
            <section>
              <div className="deity-section-head"><span>その他の神様</span><span className="muted small">{count(others)}</span></div>
              <DeityGrid items={others.slice(0, limit)} />
              {others.length > limit && (
                <button className="btn-secondary mt16" onClick={() => setLimit((n) => n + PAGE)}>
                  もっと見る（あと{(others.length - limit).toLocaleString()}柱）
                </button>
              )}
            </section>
          )}
        </>)}
      </div>
    </div>
  )
}
