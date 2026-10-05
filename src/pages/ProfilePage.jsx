// マイページ：参拝の数字・称号・参拝の手引き（note）
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { GuideLinkList } from '../components/GuideLinks'
import { useAuth } from '../hooks/useAuth'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyRecords } from '../lib/records'
import { fetchIsAdmin, countPendingRequests } from '../lib/admin'
import { titleFor } from '../lib/constants'

export default function ProfilePage() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const { syncRevision } = usePendingRecords()
  const [stats, setStats] = useState(null)
  const [pendingRequests, setPendingRequests] = useState(null) // 管理者のときだけ数が入る

  useEffect(() => {
    if (!user) return
    fetchMyRecords(user.id).then((records) => {
      const shrines = new Set(records.map((r) => r.shrine_id)).size
      const avg = records.length ? Math.round(records.reduce((s, r) => s + r.emotion_level, 0) / records.length) : 0
      setStats({ records: records.length, shrines, avg })
    }).catch(() => {})
  }, [user, syncRevision])

  useEffect(() => {
    setPendingRequests(null)
    if (!user) return
    fetchIsAdmin(user.id).then((admin) => admin && countPendingRequests().then(setPendingRequests))
      .catch(() => {})
  }, [user])

  const title = stats && titleFor(stats.shrines)

  return (
    <div className="app-shell">
      <TopBar title="マイページ" />
      <div className="page-content">
        {!loading && !user && (
          <div className="login-panel">
            <div className="login-mark">⛩</div>
            <p>記録を残すには<br />ログインが必要です</p>
            <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
          </div>
        )}

        {user && (
          <>
            <div className="center">
              <div className="profile-name">{user.user_metadata?.name || user.email?.split('@')[0]}</div>
              {title && <div className="title-badge">⛩ {title.current}</div>}
              {title?.next && <p className="muted small mt8">「{title.next.label}」まで あと{title.next.remaining}社</p>}
            </div>
            <div className="stat-row mt16">
              <div className="stat"><div className="stat-num">{stats?.shrines ?? '—'}</div><div className="stat-label">参拝した神社</div></div>
              <div className="stat"><div className="stat-num">{stats?.records ?? '—'}</div><div className="stat-label">記録</div></div>
              <div className="stat"><div className="stat-num">{stats?.avg ?? '—'}</div><div className="stat-label">感動の平均</div></div>
            </div>
          </>
        )}

        {pendingRequests != null && (
          <>
            <Link to="/admin/requests" className="btn-secondary mt24">
              申請の確認{pendingRequests > 0 ? `（未確認 ${pendingRequests}件）` : ''}
            </Link>
            <Link to="/admin/edits" className="btn-secondary mt8">情報提供の確認</Link>
          </>
        )}

        <section className="mt24">
          <div className="section-mini">参拝の手引き</div>
          <GuideLinkList context="general" />
        </section>

        {user && (
          <div className="logout">
            <button className="text-btn" onClick={signOut}>ログアウト</button>
          </div>
        )}
      </div>
    </div>
  )
}
