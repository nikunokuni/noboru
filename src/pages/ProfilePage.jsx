import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const BADGES = [
  { id: 'first', icon: '⛩️', name: '初参拝', condition: (s) => s.total >= 1 },
  { id: 'ten', icon: '🌟', name: '10社達成', condition: (s) => s.total >= 10 },
  { id: 'spring', icon: '🌸', name: '春の参拝', condition: (s) => s.hasSeason?.spring },
  { id: 'mountain', icon: '🗻', name: '山岳神社', condition: (s) => s.total >= 3 },
  { id: 'sea', icon: '🌊', name: '海の神社', condition: (s) => s.prefectures >= 5 },
  { id: 'fifty', icon: '🎌', name: '50社達成', condition: (s) => s.total >= 50 },
]

const TITLES = [
  { min: 0, label: '参拝初心者' },
  { min: 5, label: '氏子' },
  { min: 15, label: '神主見習い' },
  { min: 30, label: '神主' },
  { min: 50, label: '大神主' },
  { min: 100, label: '神域の訪人' },
]

const getTitle = (total) => {
  let title = TITLES[0].label
  for (const t of TITLES) {
    if (total >= t.min) title = t.label
  }
  return title
}

export default function ProfilePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [stats, setStats] = useState({ total: 0, prefectures: 0, avgEmotion: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchStats()
    else setLoading(false)
  }, [user])

  const fetchStats = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('records')
      .select('emotion_level, visited_at')
      .eq('user_id', user.id)

    const total = data?.length || 0
    const avg = total > 0
      ? (data.reduce((s, r) => s + r.emotion_level, 0) / total / 20).toFixed(1)
      : 0

    setStats({ total, prefectures: 0, avgEmotion: avg, hasSeason: { spring: true } })
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="app-shell">
        <div className="top-bar">
          <div style={{ width: 24 }} />
          <div className="page-title">マイページ</div>
          <div style={{ width: 24 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 40px', gap: 20 }}>
          <div style={{ fontSize: 48 }}>⛩️</div>
          <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 16, color: 'var(--ink)', letterSpacing: '0.12em', textAlign: 'center', lineHeight: 1.8 }}>
            記録を残すには<br />ログインが必要です
          </div>
          <button className="btn-primary" onClick={signInWithGoogle} style={{ maxWidth: 240 }}>
            Googleでログイン
          </button>
        </div>
      </div>
    )
  }

  const title = getTitle(stats.total)
  const earnedBadges = BADGES.filter(b => b.condition(stats))
  const lockedBadges = BADGES.filter(b => !b.condition(stats))

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div style={{ width: 24 }} />
        <div className="page-title">マイページ</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page-content">
        {/* プロフィールヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(192,57,43,0.08)',
            border: '1.5px solid rgba(192,57,43,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, margin: '0 auto 10px',
          }}>🌿</div>
          <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 16, color: 'var(--ink)', letterSpacing: '0.1em', marginBottom: 6 }}>
            {user.email?.split('@')[0]}
          </div>
          <div style={{
            display: 'inline-block', fontSize: 11,
            color: 'var(--gold)', background: 'var(--gold-bg)',
            border: '1px solid rgba(184,150,12,0.2)', borderRadius: 20,
            padding: '3px 14px', letterSpacing: '0.1em',
            fontFamily: 'var(--font-mincho)',
          }}>
            ⛩ {title}
          </div>
        </div>

        {/* 統計 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { num: stats.total, label: '参拝記録' },
            { num: stats.prefectures || '—', label: '都道府県' },
            { num: stats.avgEmotion, label: '感動平均' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, textAlign: 'center',
              background: 'var(--paper2)', borderRadius: 8, padding: '10px 4px',
            }}>
              <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 22, color: 'var(--ink)' }}>{s.num}</div>
              <div style={{ fontSize: 9, color: 'var(--mist)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* バッジ */}
        <div className="section-mini">獲得バッジ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {[...earnedBadges, ...lockedBadges].map(badge => {
            const earned = earnedBadges.includes(badge)
            return (
              <div key={badge.id} style={{ textAlign: 'center', width: 56 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: earned ? 'rgba(192,57,43,0.08)' : 'var(--paper2)',
                  border: earned ? '1.5px solid rgba(192,57,43,0.15)' : '1.5px solid rgba(26,18,8,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, margin: '0 auto 4px',
                  opacity: earned ? 1 : 0.35,
                }}>
                  {badge.icon}
                </div>
                <div style={{ fontSize: 8, color: earned ? 'rgba(26,18,8,0.6)' : 'rgba(26,18,8,0.3)', lineHeight: 1.3 }}>
                  {badge.name}
                </div>
              </div>
            )
          })}
        </div>

        {/* ログアウト */}
        <div style={{ borderTop: '1px solid rgba(26,18,8,0.08)', paddingTop: 20, marginTop: 8 }}>
          <button
            onClick={signOut}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--mist)', fontFamily: 'var(--font-mincho)',
              letterSpacing: '0.12em', padding: '8px 0',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}
