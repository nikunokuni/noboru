// にくのくにリスト：作者が思い入れのある神社。参拝して記録すると集まり、押すとエピソードを読める
import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useMyVisits } from '../hooks/useMyVisits'
import { nikunokuniCollection, nikunokuniPath } from '../lib/nikunokuni'
import { formatDate } from '../lib/format'

export default function NikunokuniListPage() {
  const { user, loading } = useAuth()
  const { index, revision, status } = useShrineIndex()
  const { visits, failed } = useMyVisits()

  const items = useMemo(() => (index ? nikunokuniCollection(index, visits || undefined) : null),
    [index, revision, visits]) // eslint-disable-line react-hooks/exhaustive-deps
  const got = items ? items.filter((e) => e.collected).length : 0

  return (
    <div className="app-shell">
      <TopBar title="にくのくにリスト" back />
      <div className="page-content">
        {!index && (status === 'loading' || status === 'downloading') && <div className="spinner mt24" />}
        {!index && status === 'unavailable' && <p className="muted center mt24">神社一覧を読み込めませんでした。電波の届く場所でもう一度開いてください</p>}

        {items && (<>
          <div className="collection-summary">
            <div><span className="collection-got big">{user ? got : 0}</span><span className="muted"> / {items.length}社</span></div>
            <div className="collection-bar" aria-hidden="true"><span style={{ width: `${user && items.length ? (got / items.length) * 100 : 0}%` }} /></div>
            <p className="muted small mt8">作者（にくのくに）が思い入れのある神社です。参拝して記録すると、その神社のエピソードを読めます</p>
          </div>
          {!loading && !user && <p className="muted small center">ログインすると、参拝した記録から集まります</p>}
          {failed && <p className="muted small">電波が届かないため、送信済みの記録を反映できません</p>}

          <ul className="niku-list">
            {items.map((e) => (
              <li key={e.key}>
                <Link to={nikunokuniPath(e.key)} className={`card niku-entry ${e.collected ? 'collected' : ''}`}>
                  <span className="niku-thumb" aria-hidden="true">
                    {e.collected && e.photos?.[0]
                      ? <img src={e.photos[0].src} alt="" loading="lazy" />
                      : <span>{e.collected ? '⛩' : '？'}</span>}
                  </span>
                  <span className="niku-entry-body">
                    <span className="collection-entry-name">{e.name}</span>
                    <span className="muted small">{[e.prefecture, e.municipality].filter(Boolean).join(' ')}</span>
                    <span className="small niku-lead">{e.lead}</span>
                    {e.collected
                      ? <span className="pill mt8">{e.collectedOn ? `${formatDate(e.collectedOn)}に参拝・` : ''}エピソードを読めます</span>
                      : <span className="muted small mt8">参拝するとエピソードを読めます</span>}
                  </span>
                  <span className="collection-arrow">›</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="muted small center mt16">思い入れのある神社を少しずつ書き足していきます</p>
        </>)}
      </div>
    </div>
  )
}
