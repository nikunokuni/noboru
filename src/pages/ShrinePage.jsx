// 神社詳細
import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import Photos from '../components/Photos'
import ShrinePhotos from '../components/ShrinePhotos'
import ShrineContributors from '../components/ShrineContributors'
import { GuideInlineLink } from '../components/GuideLinks'
import { useAuth } from '../hooks/useAuth'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyRecordsForShrine, fetchPublicRecords, fetchShrine } from '../lib/community'
import { formatDistance, walkMinutes } from '../lib/geo'
import { formatDate, placeLabel } from '../lib/format'
import { normalizeDeities } from '../lib/deities'
import { GOSHUIN_LABELS, PARKING_LABELS, emotionColor, emotionMarks } from '../lib/constants'

function Row({ label, children }) {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const Unknown = () => <span className="muted">不明</span>

// ご祭神は表記をそろえて表示し、それぞれ同じ神様を祀る神社の検索へつなぐ
function Deities({ text }) {
  const { names } = normalizeDeities(text)
  if (!names.length) return <Unknown />
  return names.map((n, i) => (
    <React.Fragment key={n}>
      {i > 0 && '、'}
      <Link to={`/map?deity=${encodeURIComponent(n)}`} className="inline-link">{n}</Link>
    </React.Fragment>
  ))
}

// meters がないのは情報提供された駅・バス停（「〇〇駅 徒歩10分」のように書かれている）
function Access({ name, meters }) {
  if (!name) return <Unknown />
  if (meters == null) return name
  return <>{name}<span className="muted small">　{formatDistance(meters)}・徒歩約{walkMinutes(meters)}分（直線距離から）</span></>
}

function FeaturesSource({ source }) {
  if (!source) return null
  if (source.startsWith('wikipedia:')) {
    const title = source.slice('wikipedia:'.length)
    return (
      <p className="source">
        出典: <a href={`https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer">Wikipedia「{title}」</a>
        （<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ja" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>）
      </p>
    )
  }
  return <p className="source">ユーザーからの情報提供</p>
}

function RecordItem({ r, mine }) {
  return (
    <div className="record-line" style={{ borderLeftColor: emotionColor(r.emotion_level) }}>
      <div className="record-line-head">
        <span className="small" style={{ color: emotionColor(r.emotion_level) }}>{emotionMarks(r.emotion_level)}</span>
        <span className="muted small">{!mine && r.author && <span className="record-author">{r.author}</span>}{formatDate(r.visited_on)}</span>
      </div>
      {r.public_memo && <p className="memo">{r.public_memo}</p>}
      <Photos paths={(r.photos || []).map((p) => p.path)} size={56} />
      {mine && <Link to={`/records/${r.id}`} className="inline-link small">自分の記録を見る</Link>}
    </div>
  )
}

export default function ShrinePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { syncRevision } = usePendingRecords()
  const [shrine, setShrine] = useState(undefined)
  const [records, setRecords] = useState([])
  const [mine, setMine] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([fetchShrine(id), fetchPublicRecords(id), user ? fetchMyRecordsForShrine(id, user.id) : []])
      .then(([s, r, m]) => { if (alive) { setShrine(s); setRecords(r); setMine(m) } })
      .catch(() => alive && setShrine(null))
    return () => { alive = false }
  }, [id, user, syncRevision])

  if (shrine === undefined) return <div className="app-shell"><TopBar back title="" /><div className="page-content"><div className="spinner" /></div></div>
  if (shrine === null) return <div className="app-shell"><TopBar back title="" /><div className="page-content"><p className="muted center">神社が見つかりませんでした（電波の届く場所で開き直してください）</p></div></div>

  const mineIds = new Set(mine.map((r) => r.id))
  const others = records.filter((r) => !mineIds.has(r.id))

  return (
    <div className="app-shell">
      <TopBar back title="" />
      <div className="page-content">
        <div className="shrine-head">
          <h2 className="shrine-name">⛩ {shrine.name}</h2>
          {shrine.name_kana && <div className="muted small">{shrine.name_kana}</div>}
          <div className="muted small">{placeLabel(shrine)}</div>
          {!shrine.first_visited_on && <div className="pill mt8">まだ誰も参拝を記録していません</div>}
        </div>

        <ShrinePhotos shrineId={shrine.id} revision={syncRevision} />

        <div className="stat-row">
          <div className="stat"><div className="stat-num">{shrine.visitor_count}</div><div className="stat-label">訪れた人</div></div>
          <div className="stat"><div className="stat-num">{shrine.record_count}</div><div className="stat-label">記録</div></div>
        </div>

        <div className="action-row">
          <button className="btn-primary" onClick={() => navigate(`/record/${shrine.id}`)}>ここを記録する</button>
        </div>

        <section>
          <div className="section-mini">参拝の情報</div>
          <dl className="info">
            <Row label="拝観時間">{shrine.visiting_hours ? <span className="pre-wrap">{shrine.visiting_hours}</span> : <Unknown />}</Row>
            <Row label="御朱印">{GOSHUIN_LABELS[shrine.goshuin]} <GuideInlineLink context="goshuin" /></Row>
            {shrine.goshuin_note && <Row label="御朱印メモ"><span className="pre-wrap">{shrine.goshuin_note}</span></Row>}
          </dl>
        </section>

        <section>
          <div className="section-mini">見どころ</div>
          {shrine.highlights
            ? <p className="features">{shrine.highlights}</p>
            : <p className="muted small">まだ情報がありません。おすすめの見どころを教えてください。</p>}
        </section>

        <section>
          <div className="section-mini">基本情報</div>
          <dl className="info">
            <Row label="住所">{shrine.address || <Unknown />}</Row>
            <Row label="ご祭神"><Deities text={shrine.deities} /></Row>
            <Row label="ご利益">{shrine.benefits?.length ? shrine.benefits.join('・') : <Unknown />}</Row>
            <Row label="社格">{shrine.shrine_rank || <Unknown />}</Row>
            <Row label="創建">{shrine.founded || <Unknown />}</Row>
            <Row label="例祭">{shrine.annual_festival || <Unknown />}</Row>
          </dl>
        </section>

        <section>
          <div className="section-mini">由緒</div>
          {shrine.features
            ? <><p className="features">{shrine.features}</p><FeaturesSource source={shrine.features_source} /></>
            : <p className="muted small">まだ情報がありません。由緒や神話をご存じでしたら教えてください。</p>}
        </section>

        <section>
          <div className="section-mini">アクセス</div>
          <dl className="info">
            <Row label="最寄り駅"><Access name={shrine.nearest_station} meters={shrine.nearest_station_m} /></Row>
            <Row label="バス停"><Access name={shrine.nearest_bus_stop} meters={shrine.nearest_bus_stop_m} /></Row>
            <Row label="駐車場">{PARKING_LABELS[shrine.parking]}</Row>
            {shrine.access_note && <Row label="補足">{shrine.access_note}</Row>}
          </dl>
          <a className="inline-link small" target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${shrine.lat},${shrine.lng}`}>
            経路を調べる ↗
          </a>
        </section>

        <div className="action-row">
          <Link to={`/shrine/${shrine.id}/edit`} className="btn-secondary">情報を追加・訂正する</Link>
        </div>
        <ShrineContributors shrineId={shrine.id} />

        {mine.length > 0 && (
          <section>
            <div className="section-mini">自分の参拝（{mine.length}回）</div>
            {mine.map((r) => <RecordItem key={r.id} r={r} mine />)}
          </section>
        )}

        <section>
          <div className="section-mini">みんなの記録</div>
          {others.length === 0
            ? <p className="muted small">ほかの人の公開記録はまだありません</p>
            : others.map((r) => <RecordItem key={r.id} r={r} />)}
        </section>

        <p className="source mt24">
          位置・アクセス情報: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
        </p>
      </div>
    </div>
  )
}
