// 神様の詳細：読み・紹介・ご利益（辞書にある神様）、別の書き方、集めたかどうか、祀る神社（参拝した神社を先に）
import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import WishStar from '../components/WishStar'
import { useAuth } from '../hooks/useAuth'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useMyVisits } from '../hooks/useMyVisits'
import { deityShrinePositions } from '../lib/collections'
import { deityAliases } from '../lib/deities'
import { deityProfile } from '../lib/deityProfiles'
import { deityFurigana } from '../lib/deityReadings'
import { getItem } from '../lib/indexCore'
import { tagLink } from '../lib/searchTags'
import { formatDate, placeLabel } from '../lib/format'

const PAGE = 30

export default function DeityDetailPage() {
  const { name } = useParams()
  const { user } = useAuth()
  const { index, revision, status } = useShrineIndex()
  const { visits } = useMyVisits()
  const [limit, setLimit] = useState(PAGE)

  const profile = deityProfile(name)
  const aliases = deityAliases(name)

  // 祀る神社。参拝した神社（最初の参拝日の順）を先に、残りは一覧の順
  const shrines = useMemo(() => {
    if (!index) return null
    const items = deityShrinePositions(index, name).map((i) => {
      const item = getItem(index, i)
      return { ...item, myVisit: visits?.get(item.id) || null }
    })
    const mine = items.filter((s) => s.myVisit).sort((a, b) => a.myVisit.localeCompare(b.myVisit))
    return [...mine, ...items.filter((s) => !s.myVisit)]
  }, [index, revision, name, visits]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = shrines ? shrines.filter((s) => s.myVisit) : []
  const collected = mine.length > 0

  return (
    <div className="app-shell">
      <TopBar title="神様の詳細" back />
      <div className="page-content">
        <div className={`deity-head ${collected ? 'collected' : ''}`}>
          <div className="deity-seal" aria-hidden="true">{collected ? '⛩' : '？'}</div>
          <h2 className="shrine-name">{name}</h2>
          {deityFurigana(name) && <div className="muted small">{deityFurigana(name)}</div>}
          <div className="mt8">
            {collected
              ? <span className="pill">{formatDate(mine[0].myVisit)}に集めた</span>
              : <span className="tag-plain deity-not-yet">{user ? 'まだ集めていません' : 'ログインすると集められます'}</span>}
          </div>
        </div>

        {profile ? (<>
          <section>
            <div className="section-mini">どんな神様</div>
            <p className="features">{profile.description}</p>
          </section>
          <section>
            <div className="section-mini">主なご利益</div>
            <div className="info-chips">{profile.benefits.map((b) => <span key={b} className="chip">{b}</span>)}</div>
            <p className="source mt8">神社によって伝わり方・ご利益が違うことがあります</p>
          </section>
        </>) : (
          <p className="muted small mt16">この神様の紹介はまだありません。祀っている神社の詳細で、由緒などを確かめてみてください。</p>
        )}

        {aliases.length > 0 && (
          <section>
            <div className="section-mini">別の書き方</div>
            <p className="small deity-aliases">{aliases.join('、')}</p>
          </section>
        )}

        <section>
          <div className="section-mini">祀る神社{shrines ? `（マップの中で${shrines.length.toLocaleString()}社）` : ''}</div>
          {!shrines && status !== 'unavailable' && <div className="spinner" />}
          {!shrines && status === 'unavailable' && <p className="muted small">神社一覧を読み込めませんでした</p>}
          {shrines && shrines.length === 0 && <p className="muted small">マップの中に、この神様を祀る神社はありません</p>}
          {shrines && shrines.length > 0 && (<>
            <Link to={tagLink('deity', name)} className="btn-secondary mb16">この神様の神社をマップで探す</Link>
            {shrines.slice(0, limit).map((s) => (
              <div key={s.id} className="shrine-row-wrap">
                <WishStar shrineId={s.id} />
                <Link to={`/shrine/${s.id}`} className="shrine-row deity-shrine-row">
                  <span>
                    <span className="shrine-row-name">{s.name}</span>
                    <span className="muted small"> {placeLabel(s)}</span>
                  </span>
                  {s.myVisit && <span className="pill deity-visit-pill">{formatDate(s.myVisit)} 参拝</span>}
                </Link>
              </div>
            ))}
            {shrines.length > limit && (
              <button className="btn-secondary mt16" onClick={() => setLimit((n) => n + PAGE)}>
                もっと見る（あと{(shrines.length - limit).toLocaleString()}社）
              </button>
            )}
          </>)}
        </section>
      </div>
    </div>
  )
}
