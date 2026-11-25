// コレクション：○○リストの入り口。神様リスト・にくのくにリスト（増やすときは lib/collections.js の COLLECTIONS に足す）
import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useMyVisits } from '../hooks/useMyVisits'
import { COLLECTIONS, deityCollection } from '../lib/collections'
import { nikunokuniCollection } from '../lib/nikunokuni'

export default function CollectionPage() {
  const { user, loading } = useAuth()
  const { index, revision } = useShrineIndex()
  const { visits } = useMyVisits()

  // 各リストの「集めた数 / 全部」
  const progress = useMemo(() => {
    if (!index) return {}
    const deities = deityCollection(index, visits || undefined)
    const niku = nikunokuniCollection(index, visits || undefined)
    return {
      deities: { got: deities.filter((d) => d.collected).length, total: deities.length },
      nikunokuni: { got: niku.filter((d) => d.collected).length, total: niku.length },
    }
  }, [index, revision, visits]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      <TopBar title="コレクション" />
      <div className="page-content">
        <p className="muted small center mb16">神社を参拝して記録すると、自動で集まります</p>
        {COLLECTIONS.map((c) => {
          const p = progress[c.key]
          return (
            <Link key={c.key} to={c.to} className="card collection-entry">
              <div className="collection-entry-body">
                <div className="collection-entry-name">{c.label}</div>
                <div className="muted small">{c.note}</div>
                {p && p.total > 0 && (
                  <div className="collection-bar mt8" aria-hidden="true"><span style={{ width: `${(p.got / p.total) * 100}%` }} /></div>
                )}
              </div>
              <div className="collection-entry-count">
                {p ? <><span className="collection-got">{user ? p.got.toLocaleString() : 0}</span><span className="muted small"> / {p.total.toLocaleString()}</span></> : null}
                <span className="collection-arrow">›</span>
              </div>
            </Link>
          )
        })}
        {!loading && !user && <p className="muted small center mt24">ログインすると、参拝した記録から集まります</p>}
      </div>
    </div>
  )
}
