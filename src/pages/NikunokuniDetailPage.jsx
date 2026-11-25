// にくのくにリストの神社：集めた（参拝して記録した）人だけエピソードと写真を読める。まだの人には神社への案内を出す
import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import WishStar from '../components/WishStar'
import Lightbox from '../components/Lightbox'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useMyVisits } from '../hooks/useMyVisits'
import { findNikunokuni, nikunokuniCollection } from '../lib/nikunokuni'
import { formatDate } from '../lib/format'

export default function NikunokuniDetailPage() {
  const { key } = useParams()
  const { user } = useAuth()
  const { index, revision, status } = useShrineIndex()
  const { visits } = useMyVisits()
  const [zoom, setZoom] = useState(null)

  const entry = useMemo(() => {
    const base = findNikunokuni(key)
    if (!base || !index) return base && { ...base, pending: true }
    return nikunokuniCollection(index, visits || undefined).find((e) => e.key === key)
  }, [key, index, revision, visits]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) {
    return (
      <div className="app-shell">
        <TopBar title="にくのくにリスト" back />
        <div className="page-content"><p className="muted center mt24">この神社はリストにありません</p></div>
      </div>
    )
  }

  const { collected } = entry
  return (
    <div className="app-shell">
      <TopBar title="にくのくにリスト" back />
      <div className="page-content">
        <div className={`deity-head ${collected ? 'collected' : ''}`}>
          <div className="deity-seal" aria-hidden="true">{collected ? '⛩' : '？'}</div>
          <h2 className="shrine-name">{entry.name}</h2>
          <div className="muted small">{[entry.prefecture, entry.municipality].filter(Boolean).join(' ')}</div>
          <div className="mt8">
            {entry.pending && status !== 'unavailable' ? <div className="spinner" />
              : collected
                ? <span className="pill">{entry.collectedOn ? `${formatDate(entry.collectedOn)}に参拝` : '参拝済み'}</span>
                : <span className="tag-plain deity-not-yet">{user ? 'まだ参拝していません' : 'ログインすると集められます'}</span>}
          </div>
        </div>

        {collected ? (<>
          <section>
            <div className="section-mini">にくのくにのエピソード</div>
            <div className="niku-episode">
              {entry.episode.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {entry.written && <p className="source mt8">{formatDate(entry.written)} にくのくに</p>}
          </section>
          {entry.photos?.length > 0 && (
            <section>
              <div className="section-mini">写真</div>
              <div className="niku-photos">
                {entry.photos.map((ph, i) => (
                  <button key={ph.src} className="niku-photo" onClick={() => setZoom(i)}>
                    <img src={ph.src} alt={ph.caption || ''} loading="lazy" />
                    {ph.caption && <span className="muted small">{ph.caption}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>) : (
          <section>
            <div className="niku-locked">
              <p className="niku-lead">{entry.lead}</p>
              <p className="muted small mt8">この神社を参拝して記録すると、にくのくにのエピソードと写真を読めます</p>
            </div>
          </section>
        )}

        {entry.shrineId != null && (
          <div className="niku-shrine-actions mt16">
            <WishStar shrineId={entry.shrineId} />
            <Link to={`/shrine/${entry.shrineId}`} className="btn-secondary niku-shrine-link">神社の詳細を見る</Link>
          </div>
        )}
        {!entry.pending && entry.shrineId == null && <p className="muted small mt16">この神社はまだマップの中にありません</p>}
      </div>
      {zoom != null && (
        <Lightbox urls={entry.photos.map((p) => p.src)} start={zoom} onClose={() => setZoom(null)}
          info={(i) => entry.photos[i].caption} />
      )}
    </div>
  )
}
