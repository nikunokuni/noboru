// 管理者用：神社の追加申請・一覧から外す報告を確認して、承認・却下する
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { fetchShrine } from '../lib/community'
import { fetchIndexVersion } from '../lib/shrineIndex'
import {
  fetchIsAdmin, fetchPendingRequests, fetchReviewedRequests, reviewShrineRequest,
  countUnpublishedApprovals, rebuildShrineIndex,
} from '../lib/admin'
import { nearbyIndex } from '../lib/indexCore'
import { formatDistance } from '../lib/geo'
import { formatDate } from '../lib/format'
import { PREFECTURES } from '../lib/constants'

const KIND_LABELS = { add: '追加申請', hide: '外す報告' }
const STATUS_LABELS = { approved: '承認', rejected: '却下' }

const mapUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

// 「35.0036, 135.7785」のように貼り付けた緯度経度を読む
function parseLatLng(s) {
  const m = /(-?\d+(?:\.\d+)?)\s*[,，、\s]\s*(-?\d+(?:\.\d+)?)/.exec(s || '')
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

export default function AdminRequestsPage() {
  const { user, loading } = useAuth()
  const { index, refreshIndex } = useShrineIndex()
  const { showToast } = useToast()
  const [isAdmin, setIsAdmin] = useState(null)
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState(null)
  const [reviewed, setReviewed] = useState(null)
  const [unpublished, setUnpublished] = useState(0)
  const [rebuilding, setRebuilding] = useState(null) // null / 取得した件数

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    fetchIsAdmin(user.id).then(setIsAdmin)
  }, [user])

  const reload = useCallback(async () => {
    try {
      const [p, r, u] = await Promise.all([
        fetchPendingRequests(), fetchReviewedRequests(),
        fetchIndexVersion().then(countUnpublishedApprovals),
      ])
      setPending(p)
      setReviewed(r)
      setUnpublished(u)
    } catch {
      showToast('申請を読み込めませんでした')
    }
  }, [showToast])

  useEffect(() => { if (isAdmin) reload() }, [isAdmin, reload])

  const onReviewed = (approve) => {
    showToast(approve ? '承認しました' : '却下しました')
    reload()
  }

  const rebuild = async () => {
    setRebuilding(0)
    try {
      const { count } = await rebuildShrineIndex(setRebuilding)
      await Promise.all([refreshIndex(), reload()])
      showToast(`神社一覧を更新しました（${count.toLocaleString()}社）`)
    } catch (e) {
      showToast(e.message || '神社一覧を更新できませんでした')
    } finally {
      setRebuilding(null)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="申請の確認" />
      <div className="page-content">
        {(loading || (user && isAdmin === null)) && <div className="spinner" />}
        {!loading && isAdmin === false && <p className="muted center mt24">管理者だけが見られる画面です</p>}

        {isAdmin && (
          <>
            {unpublished > 0 ? (
              <div className="card">
                <p className="small">承認した{unpublished}件が、まだアプリの神社一覧（検索・マップ）に入っていません。</p>
                <button className="btn-primary mt8" onClick={rebuild} disabled={rebuilding != null}>
                  {rebuilding != null ? `作り直し中… ${rebuilding.toLocaleString()}社` : '神社一覧を更新する'}
                </button>
              </div>
            ) : (
              // 情報提供されたご祭神・よみがなを検索に反映したいときなど
              <p className="small">
                <button className="text-btn" onClick={rebuild} disabled={rebuilding != null}>
                  {rebuilding != null ? `作り直し中… ${rebuilding.toLocaleString()}社` : '神社一覧を作り直す（情報提供されたご祭神・よみがなを検索に反映）'}
                </button>
              </p>
            )}

            <div className="chip-row mt8">
              <button type="button" className={`chip ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
                未確認{pending ? `（${pending.length}）` : ''}
              </button>
              <button type="button" className={`chip ${tab === 'reviewed' ? 'active' : ''}`} onClick={() => setTab('reviewed')}>
                処理済み
              </button>
            </div>

            {tab === 'pending' && (
              !pending ? <div className="spinner" />
                : pending.length === 0 ? <p className="muted center mt24">未確認の申請はありません</p>
                  : pending.map((r) => <PendingRequest key={r.id} request={r} index={index} onReviewed={onReviewed} />)
            )}

            {tab === 'reviewed' && (
              !reviewed ? <div className="spinner" />
                : reviewed.length === 0 ? <p className="muted center mt24">まだありません</p>
                  : reviewed.map((r) => <ReviewedRequest key={r.id} request={r} />)
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RequestHead({ request: r }) {
  return (
    <>
      <div className="request-head">
        <span className="pill">{KIND_LABELS[r.kind]}</span>
        <span className="muted small">{formatDate(r.created_at)}</span>
      </div>
      <p className="request-name">⛩ {r.name || '（名前なし）'}</p>
      {r.note && <p className="small request-note">{r.note}</p>}
      {r.lat != null && r.lng != null && (
        <p className="small mt8">
          <a className="inline-link" href={mapUrl(r.lat, r.lng)} target="_blank" rel="noopener noreferrer">申請された場所を地図で見る</a>
        </p>
      )}
    </>
  )
}

function ReviewedRequest({ request: r }) {
  return (
    <div className="card">
      <RequestHead request={r} />
      <p className="small mt8">
        <span className={r.status === 'approved' ? 'tag-pending' : 'tag-plain'}>{STATUS_LABELS[r.status]}</span>
        <span className="muted"> {formatDate(r.reviewed_at)}</span>
        {r.status === 'approved' && r.kind === 'add' && r.shrine_id && (
          <> · <Link to={`/shrine/${r.shrine_id}`} className="inline-link">追加した神社</Link></>
        )}
      </p>
    </div>
  )
}

function PendingRequest({ request, index, onReviewed }) {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)

  const review = async (approve, shrine) => {
    setSaving(true)
    try {
      await reviewShrineRequest(request.id, approve, shrine)
      onReviewed(approve)
    } catch (e) {
      showToast(e.message || '処理できませんでした')
      setSaving(false)
    }
  }

  const reject = () => { if (window.confirm(`「${request.name}」の${KIND_LABELS[request.kind]}を却下しますか？`)) review(false) }

  return (
    <div className="card">
      <RequestHead request={request} />
      {request.kind === 'add'
        ? <AddForm request={request} index={index} saving={saving} onApprove={(s) => review(true, s)} onReject={reject} />
        : <HideActions request={request} saving={saving} onApprove={() => review(true)} onReject={reject} />}
    </div>
  )
}

function HideActions({ request, saving, onApprove, onReject }) {
  const [target, setTarget] = useState(undefined)
  useEffect(() => { fetchShrine(request.shrine_id).then(setTarget).catch(() => setTarget(null)) }, [request.shrine_id])

  const approve = () => { if (window.confirm(`「${request.name}」を一覧から外しますか？`)) onApprove() }

  return (
    <>
      <p className="small mt8">
        {target === undefined ? '…'
          : target ? <Link to={`/shrine/${target.id}`} className="inline-link">対象の神社を見る（{target.prefecture}{target.municipality || ''}）</Link>
            : <span className="muted">対象の神社はすでに一覧にありません</span>}
      </p>
      <div className="btn-row mt16">
        <button className="btn-secondary" onClick={onReject} disabled={saving}>却下</button>
        <button className="btn-primary" onClick={approve} disabled={saving}>一覧から外す</button>
      </div>
    </>
  )
}

function AddForm({ request, index, saving, onApprove, onReject }) {
  const hasPos = request.lat != null && request.lng != null
  const [name, setName] = useState(request.name)
  const [kana, setKana] = useState('')
  const [address, setAddress] = useState('')
  const [latLng, setLatLng] = useState(hasPos ? `${request.lat}, ${request.lng}` : '')
  const pos = parseLatLng(latLng)
  const posKey = pos ? `${pos.lat},${pos.lng}` : ''

  // 近くの登録済みの神社：重複の確認と、都道府県の推定に使う
  const nearby = useMemo(() => (index && pos ? nearbyIndex(index, pos.lat, pos.lng, { radiusM: 30000, limit: 5 }) : []),
    [index, posKey])
  const close = nearby.filter((s) => s.distance <= 500)
  const [prefecture, setPrefecture] = useState('')
  useEffect(() => { if (!prefecture && nearby[0]) setPrefecture(nearby[0].prefecture) }, [nearby, prefecture])

  const approve = () => {
    if (!name.trim()) return window.alert('神社名を入力してください')
    if (!pos) return window.alert('場所（緯度, 経度）を入力してください')
    if (!prefecture) return window.alert('都道府県を選んでください')
    onApprove({ name: name.trim(), name_kana: kana.trim(), prefecture, address: address.trim(), lat: pos.lat, lng: pos.lng })
  }

  return (
    <div className="mt16">
      <div className="field-wrap">
        <label className="field-label">神社名</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-wrap">
        <label className="field-label">読み仮名（わかれば）</label>
        <input className="field-input" value={kana} onChange={(e) => setKana(e.target.value)} placeholder="例：やさかじんじゃ" />
      </div>
      <div className="field-wrap">
        <label className="field-label">場所（緯度, 経度）</label>
        <input className="field-input" value={latLng} onChange={(e) => setLatLng(e.target.value)} placeholder="例：35.0036, 135.7785" />
        {latLng && !pos && <p className="small muted mt8">緯度, 経度の形で入力してください</p>}
        {!hasPos && <p className="small muted mt8">申請に現在地が付いていません。地図で場所を調べて入力してください</p>}
      </div>
      <div className="field-wrap">
        <label className="field-label">都道府県</label>
        <select className="field-input" value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
          <option value="">選んでください</option>
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="field-wrap">
        <label className="field-label">住所（わかれば）</label>
        <input className="field-input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      {close.length > 0 && (
        <div className="request-warn small">
          <p>近くに登録済みの神社があります。同じ神社でないか確認してください</p>
          {close.map((s) => (
            <p key={s.id}>
              <Link to={`/shrine/${s.id}`} className="inline-link">{s.name}</Link>
              <span className="muted">（{formatDistance(s.distance)}）</span>
            </p>
          ))}
        </div>
      )}

      <div className="btn-row mt16">
        <button className="btn-secondary" onClick={onReject} disabled={saving}>却下</button>
        <button className="btn-primary" onClick={approve} disabled={saving}>承認して追加</button>
      </div>
    </div>
  )
}
