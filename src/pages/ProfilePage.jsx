// マイページ：ニックネーム・称号・お祈りしたいこと・参拝の手引き（note）
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { GuideLinkList } from '../components/GuideLinks'
import NicknameSettings from '../components/NicknameSettings'
import PrayerBox from '../components/PrayerBox'
import { useAuth } from '../hooks/useAuth'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyRecords } from '../lib/records'
import { fetchIsAdmin, countPendingRequests, countOpenFeedback } from '../lib/admin'
import { titleFor } from '../lib/constants'

export default function ProfilePage() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const { syncRevision } = usePendingRecords()
  const [shrineCount, setShrineCount] = useState(null)
  const [pendingRequests, setPendingRequests] = useState(null) // 管理者のときだけ数が入る
  const [openFeedback, setOpenFeedback] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchMyRecords(user.id).then((records) => {
      setShrineCount(new Set(records.map((r) => r.shrine_id)).size)
    }).catch(() => {})
  }, [user, syncRevision])

  useEffect(() => {
    setPendingRequests(null)
    if (!user) return
    fetchIsAdmin(user.id).then((admin) => {
      if (!admin) return
      countPendingRequests().then(setPendingRequests).catch(() => {})
      countOpenFeedback().then(setOpenFeedback).catch(() => {})
    }).catch(() => {})
  }, [user])

  const title = shrineCount != null && titleFor(shrineCount)

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
            <NicknameSettings userId={user.id} />
            <div className="center mt24">
              {title && <div className="title-badge">⛩ {title.current}</div>}
              {title?.next && <p className="muted small mt8">「{title.next.label}」まで あと{title.next.remaining}社</p>}
            </div>
            <PrayerBox userId={user.id} />
          </>
        )}

        {pendingRequests != null && (
          <>
            <Link to="/admin/requests" className="btn-secondary mt24">
              申請の確認{pendingRequests > 0 ? `（未確認 ${pendingRequests}件）` : ''}
            </Link>
            <Link to="/admin/edits" className="btn-secondary mt8">情報提供の確認</Link>
            <Link to="/admin/nicknames" className="btn-secondary mt8">ニックネームの確認</Link>
            <Link to="/admin/feedback" className="btn-secondary mt8">
              ご意見・ご要望の確認{openFeedback > 0 ? `（未対応 ${openFeedback}件）` : ''}
            </Link>
          </>
        )}

        <section className="mt24">
          <div className="section-mini">参拝の手引き</div>
          <GuideLinkList context="general" />
        </section>

        <Link to="/feedback" className="btn-secondary mt24">アプリへのご意見・ご要望</Link>

        {user && (
          <div className="logout">
            <button className="text-btn" onClick={signOut}>ログアウト</button>
          </div>
        )}
      </div>
    </div>
  )
}
