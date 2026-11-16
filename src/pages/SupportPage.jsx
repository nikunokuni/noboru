// 支援の受け皿：支援を受け付けている神社の一覧（押すと神社詳細）と、神社を支援している外部サイトへのリンク
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import WishStar from '../components/WishStar'
import { GuideLinkList } from '../components/GuideLinks'
import { fetchSupportShrines } from '../lib/community'
import { placeLabel, websiteUrl } from '../lib/format'
import { PREFECTURES } from '../lib/constants'

function SupportRow({ shrine, onOpen }) {
  const url = websiteUrl(shrine.support_url)
  return (
    <div className="support-row">
      <div className="support-row-head">
        <button type="button" className="support-open" onClick={onOpen}>
          <span className="timeline-name">⛩ {shrine.name}</span>
          <span className="muted small">{placeLabel(shrine)}</span>
          {shrine.challenges && <span className="support-text clamp"><span className="support-label">課題</span>{shrine.challenges}</span>}
          {shrine.support_note && <span className="support-text clamp"><span className="support-label">支援</span>{shrine.support_note}</span>}
        </button>
        <WishStar shrineId={shrine.id} />
      </div>
      <div className="support-links">
        <button type="button" className="inline-link link-button" onClick={onOpen}>詳しく見る ›</button>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-link">支援のページ（{new URL(url).hostname.replace(/^www\./, '')}）↗</a>}
      </div>
    </div>
  )
}

export default function SupportPage() {
  const navigate = useNavigate()
  const [shrines, setShrines] = useState(null)
  const [failed, setFailed] = useState(false)
  const [pref, setPref] = useState('')

  const load = () => {
    setFailed(false)
    fetchSupportShrines().then(setShrines).catch(() => { setFailed(true); setShrines((s) => s || []) })
  }
  useEffect(load, [])

  // 都道府県で絞り込む（入っている都道府県だけを北から並べる）
  const prefs = useMemo(() => [...new Set((shrines || []).map((s) => s.prefecture))]
    .sort((a, b) => PREFECTURES.indexOf(a) - PREFECTURES.indexOf(b)), [shrines])
  const shown = (shrines || []).filter((s) => !pref || s.prefecture === pref)

  return (
    <div className="app-shell">
      <TopBar back title="支援の受け皿" />
      <div className="page-content">
        <p className="small support-intro">
          後継者がいない、社殿が傷んでいる、お祭りの担い手が足りない——そんな課題を抱えながら、支援を受け付けている神社です。
          押すと神社の詳しい情報と、抱える課題が見られます。
        </p>

        <div className="section-mini">支援を受け付けている神社{shrines?.length ? `（${shrines.length}社）` : ''}</div>
        {prefs.length > 1 && (
          <div className="chip-row">
            <button type="button" className={`chip ${!pref ? 'active' : ''}`} onClick={() => setPref('')}>すべて</button>
            {prefs.map((p) => (
              <button key={p} type="button" className={`chip ${pref === p ? 'active' : ''}`} onClick={() => setPref(p)}>{p}</button>
            ))}
          </div>
        )}
        {!shrines && <div className="spinner" />}
        {shrines && !failed && shrines.length === 0 && (
          <p className="muted small">まだ登録されていません。支援を受け付けている神社をご存じでしたら、神社詳細の「情報を追加・訂正する」から「支援の方法」「支援のページ」を教えてください。</p>
        )}
        {shown.map((s) => <SupportRow key={s.id} shrine={s} onOpen={() => navigate(`/shrine/${s.id}`)} />)}
        {failed && (
          <>
            <p className="muted small center mt8">読み込めませんでした</p>
            <button className="btn-secondary mt8" onClick={load}>もう一度読み込む</button>
          </>
        )}

        <section className="mt24">
          <div className="section-mini">神社を支援しているサイト</div>
          <p className="muted small">神社の修繕・お祭りの継承などを応援する、外部のサイトです</p>
          <GuideLinkList context="support" />
        </section>

        <p className="source mt24">
          神社の課題・支援の情報は、みなさんからの情報提供です。支援の前に、神社の公式サイトや社務所で最新の情報をお確かめください。
        </p>
      </div>
    </div>
  )
}
