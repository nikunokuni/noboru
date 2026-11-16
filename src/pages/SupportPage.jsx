// 支援の受け皿：支援を受け付けている神社の一覧（押すと神社詳細）と、神社を支援している外部サイトへのリンク
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import WishStar from '../components/WishStar'
import { GuideLinkList } from '../components/GuideLinks'
import { fetchSupportShrines } from '../lib/community'
import { placeLabel, websiteUrl } from '../lib/format'
import { PREFECTURES } from '../lib/constants'
import { CHALLENGE_OPTIONS, splitTags } from '../lib/shrineTags'

function SupportRow({ shrine, onOpen }) {
  const url = websiteUrl(shrine.support_url)
  return (
    <div className="support-row">
      <div className="support-row-head">
        <button type="button" className="support-open" onClick={onOpen}>
          <span className="timeline-name">⛩ {shrine.name}</span>
          <span className="muted small">{placeLabel(shrine)}</span>
          {splitTags(shrine.challenges).length > 0 && (
            <span className="support-tags">{splitTags(shrine.challenges).map((c) => <span key={c} className="support-tag">{c}</span>)}</span>
          )}
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
  // 課題と都道府県で絞り込む。課題は URL に残す（神社詳細の課題のタグから開ける）
  const [params, setParams] = useSearchParams()
  const challenge = params.get('challenge') || ''
  const pref = params.get('pref') || ''
  const setFilter = (key, value) => setParams((p) => {
    const next = new URLSearchParams(p)
    if (value) next.set(key, value); else next.delete(key)
    return next
  }, { replace: true })

  const load = () => {
    setFailed(false)
    fetchSupportShrines().then(setShrines).catch(() => { setFailed(true); setShrines((s) => s || []) })
  }
  useEffect(load, [])

  // 都道府県で絞り込む（入っている都道府県だけを北から並べる）
  const prefs = useMemo(() => [...new Set((shrines || []).map((s) => s.prefecture))]
    .sort((a, b) => PREFECTURES.indexOf(a) - PREFECTURES.indexOf(b)), [shrines])
  // 一覧に出てくる課題だけを、選択肢の順（書き足されたものは後ろ）で並べる
  const challenges = useMemo(() => {
    const used = new Set((shrines || []).flatMap((s) => splitTags(s.challenges)))
    if (challenge) used.add(challenge)
    return [...CHALLENGE_OPTIONS.filter((c) => used.has(c)), ...[...used].filter((c) => !CHALLENGE_OPTIONS.includes(c))]
  }, [shrines, challenge])
  const shown = (shrines || []).filter((s) => (!pref || s.prefecture === pref)
    && (!challenge || splitTags(s.challenges).includes(challenge)))

  return (
    <div className="app-shell">
      <TopBar back title="支援の受け皿" />
      <div className="page-content">
        <p className="small support-intro">
          後継者がいない、社殿が傷んでいる、お祭りの担い手が足りない——そんな課題を抱えながら、支援を受け付けている神社です。
          押すと神社の詳しい情報と、抱える課題が見られます。
        </p>

        <div className="section-mini">支援を受け付けている神社{shrines?.length ? `（${shown.length < shrines.length ? `${shown.length}／` : ''}${shrines.length}社）` : ''}</div>
        {challenges.length > 0 && (
          <div className="chip-row">
            <button type="button" className={`chip ${!challenge ? 'active' : ''}`} onClick={() => setFilter('challenge', '')}>すべての課題</button>
            {challenges.map((c) => (
              <button key={c} type="button" className={`chip ${challenge === c ? 'active' : ''}`} onClick={() => setFilter('challenge', challenge === c ? '' : c)}>{c}</button>
            ))}
          </div>
        )}
        {prefs.length > 1 && (
          <div className="chip-row">
            <button type="button" className={`chip ${!pref ? 'active' : ''}`} onClick={() => setFilter('pref', '')}>全国</button>
            {prefs.map((p) => (
              <button key={p} type="button" className={`chip ${pref === p ? 'active' : ''}`} onClick={() => setFilter('pref', pref === p ? '' : p)}>{p}</button>
            ))}
          </div>
        )}
        {shrines && shrines.length > 0 && shown.length === 0 && <p className="muted small">この条件の神社はまだありません</p>}
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
