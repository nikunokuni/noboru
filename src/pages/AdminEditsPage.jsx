// 管理者用：情報提供の確認
// 情報提供はすぐ反映される。ここで最近の変更を見て、いたずらなら元に戻し、繰り返す人は情報提供・申請を止める
import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import {
  fetchIsAdmin, fetchRecentEdits, fetchBannedEditors, fetchProfiles, revertShrineEdit, revertUserEdits, setEditorBanned, resetNickname,
} from '../lib/admin'
import { placeLabel } from '../lib/format'
import { EDIT_FIELD_LABELS, GOSHUIN_LABELS, PARKING_LABELS } from '../lib/constants'

const shortId = (uuid) => `#${uuid.slice(0, 6)}`

// 「#a1b2c3（たろう）」。ニックネームがあれば添える
const personLabel = (uuid, profiles) => {
  const nick = profiles[uuid]?.nickname
  return nick ? `${shortId(uuid)}（${nick}）` : shortId(uuid)
}

const formatTime = (iso) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatValue(field, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return <span className="muted">（空）</span>
  if (Array.isArray(v)) return v.join('、')
  if (field === 'parking') return PARKING_LABELS[v] || v
  if (field === 'goshuin') return GOSHUIN_LABELS[v] || v
  return String(v)
}

export default function AdminEditsPage() {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [isAdmin, setIsAdmin] = useState(null)
  const [edits, setEdits] = useState(null)
  const [banned, setBanned] = useState(new Set())
  const [profiles, setProfiles] = useState({})
  const [person, setPerson] = useState(null) // この人の変更だけ表示
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    fetchIsAdmin(user.id).then(setIsAdmin)
  }, [user])

  const reload = useCallback(async () => {
    try {
      const [e, b] = await Promise.all([fetchRecentEdits({ userId: person }), fetchBannedEditors()])
      setEdits(e)
      setBanned(b)
      setProfiles(await fetchProfiles([...e.map((x) => x.user_id), ...(person ? [person] : [])]).catch(() => ({})))
    } catch {
      showToast('情報提供を読み込めませんでした')
    }
  }, [person, showToast])

  useEffect(() => { if (isAdmin) { setEdits(null); reload() } }, [isAdmin, reload])

  const run = async (fn, done) => {
    setBusy(true)
    try {
      const result = await fn()
      showToast(done(result))
      await reload()
    } catch (e) {
      showToast(e.message || '処理できませんでした')
    } finally {
      setBusy(false)
    }
  }

  const revert = (edit) => {
    if (!window.confirm(`「${edit.shrines?.name ?? '神社'}」の${EDIT_FIELD_LABELS[edit.field]}を変更前に戻しますか？`)) return
    run(() => revertShrineEdit(edit.id), () => '元に戻しました')
  }

  const revertAll = () => {
    if (!window.confirm(`提供者 ${personLabel(person, profiles)} の変更をすべて元に戻しますか？`)) return
    run(() => revertUserEdits(person), (r) => `${r.reverted}件戻しました${r.skipped ? `（後から別の変更があった${r.skipped}件は戻していません）` : ''}`)
  }

  const toggleBan = () => {
    const ban = !banned.has(person)
    if (ban && !window.confirm(`提供者 ${personLabel(person, profiles)} の情報提供・申請を止めますか？`)) return
    run(() => setEditorBanned(person, ban), () => (ban ? '情報提供・申請を止めました' : '止めるのをやめました'))
  }

  const resetName = () => {
    if (!window.confirm(`ニックネーム「${profiles[person].nickname}」を初期化しますか？`)) return
    run(() => resetNickname(person), () => 'ニックネームを初期化しました')
  }

  return (
    <div className="app-shell">
      <TopBar back title="情報提供の確認" />
      <div className="page-content">
        {(loading || (user && isAdmin === null)) && <div className="spinner" />}
        {!loading && isAdmin === false && <p className="muted center mt24">管理者だけが見られる画面です</p>}

        {isAdmin && (
          <>
            <p className="muted small">
              情報提供はすぐ反映されています。内容の真偽まで確かめる必要はありません。
              明らかないたずら・荒らしだけ「元に戻す」で戻し、繰り返す人は情報提供を止めてください。
            </p>

            {person && (
              <div className="card mt16">
                <p className="small">
                  提供者 {personLabel(person, profiles)} の変更だけを表示中
                  {banned.has(person) && <span className="tag-pending">停止中</span>}
                </p>
                <div className="btn-row mt8">
                  <button className="btn-secondary" onClick={revertAll} disabled={busy}>すべて元に戻す</button>
                  <button className="btn-secondary" onClick={toggleBan} disabled={busy}>
                    {banned.has(person) ? '止めるのをやめる' : '情報提供を止める'}
                  </button>
                </div>
                {profiles[person]?.nickname && (
                  <button className="btn-secondary mt8" onClick={resetName} disabled={busy}>ニックネームを初期化する</button>
                )}
                <button className="text-btn mt8" onClick={() => setPerson(null)}>すべての変更を表示</button>
              </div>
            )}

            <div className="section-mini">{person ? 'この人の変更' : '最近の変更（新しい順・100件）'}</div>
            {!edits ? <div className="spinner" />
              : edits.length === 0 ? <p className="muted center mt24">まだありません</p>
                : edits.map((e) => (
                  <EditItem key={e.id} edit={e} who={personLabel(e.user_id, profiles)} banned={banned.has(e.user_id)} busy={busy}
                    onRevert={() => revert(e)} onPerson={person ? null : () => setPerson(e.user_id)} />
                ))}
          </>
        )}
      </div>
    </div>
  )
}

function EditItem({ edit: e, who, banned, busy, onRevert, onPerson }) {
  return (
    <div className={`card ${e.reverted_at ? 'reverted' : ''}`}>
      <div className="request-head">
        <Link to={`/shrine/${e.shrine_id}`} className="inline-link">⛩ {e.shrines?.name ?? `神社 ${e.shrine_id}`}</Link>
        <span className="muted small">{formatTime(e.created_at)}</span>
      </div>
      {e.shrines && <p className="muted small">{placeLabel(e.shrines)}</p>}
      <dl className="info mt8">
        <div className="info-row">
          <dt>{EDIT_FIELD_LABELS[e.field] ?? e.field}</dt>
          <dd>
            <div className="edit-before small">{e.old_value ? formatValue(e.field, e.old_value[e.field]) : <span className="muted">（記録なし）</span>}</div>
            <div className="pre-wrap">→ {formatValue(e.field, e.value)}</div>
          </dd>
        </div>
      </dl>
      <div className="request-head mt8">
        <span className="small">
          {onPerson ? <button className="text-btn" onClick={onPerson}>提供者 {who}</button> : <span className="muted">提供者 {who}</span>}
          {banned && <span className="tag-pending">停止中</span>}
        </span>
        {e.reverted_at
          ? <span className="tag-plain">戻し済み</span>
          : e.old_value && <button className="text-btn" onClick={onRevert} disabled={busy}>元に戻す</button>}
      </div>
    </div>
  )
}
