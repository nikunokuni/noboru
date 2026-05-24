import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'high', label: '感動大' },
  { key: 'photo', label: '写真あり' },
  { key: 'public', label: '公開済み' },
  { key: 'private', label: '非公開' },
]

const emotionMark = (level) => {
  if (level >= 75) return { marks: '▲▲▲', color: 'var(--vermillion)' }
  if (level >= 45) return { marks: '▲▲', color: 'var(--gold)' }
  return { marks: '▲', color: 'rgba(26,18,8,0.3)' }
}

const borderColor = (level) => {
  if (level >= 75) return 'var(--vermillion)'
  if (level >= 45) return 'var(--gold)'
  return 'rgba(26,18,8,0.2)'
}

const formatDate = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function RecordsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchRecords()
  }, [user])

  const fetchRecords = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('records')
      .select('*, photos(url)')
      .eq('user_id', user.id)
      .order('visited_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  const filtered = records.filter(r => {
    if (filter === 'high') return r.emotion_level >= 75
    if (filter === 'photo') return r.photos?.length > 0
    if (filter === 'public') return r.is_public
    if (filter === 'private') return !r.is_public
    return true
  })

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div style={{ width: 24 }} />
        <div className="page-title">記録の一覧</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 10,
                padding: '4px 12px',
                borderRadius: 20,
                background: filter === f.key ? 'rgba(192,57,43,0.08)' : 'var(--paper2)',
                color: filter === f.key ? 'var(--vermillion)' : 'rgba(26,18,8,0.5)',
                border: filter === f.key ? '1px solid rgba(192,57,43,0.2)' : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-mincho)',
                letterSpacing: '0.1em',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--mist)', fontFamily: 'var(--font-mincho)', fontSize: 13, letterSpacing: '0.12em' }}>
            まだ記録がありません
          </div>
        ) : (
          filtered.map(r => {
            const em = emotionMark(r.emotion_level)
            const thumb = r.photos?.[0]?.url
            return (
              <div
                key={r.id}
                className="card"
                style={{ borderLeft: `3px solid ${borderColor(r.emotion_level)}`, cursor: 'pointer', display: 'flex', gap: 10 }}
                onClick={() => navigate(`/record/${r.id}`)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: em.color, marginBottom: 4, letterSpacing: '0.1em' }}>{em.marks}</div>
                  <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 16, color: 'var(--ink)', letterSpacing: '0.08em', marginBottom: 3 }}>
                    {r.shrine_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--mist)', marginBottom: 6 }}>{formatDate(r.visited_at)}</div>
                  {r.public_memo && (
                    <div style={{ fontSize: 11, color: 'rgba(26,18,8,0.55)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {r.public_memo}
                    </div>
                  )}
                  {!r.is_public && (
                    <div style={{ marginTop: 4, fontSize: 9, color: 'var(--mist)', letterSpacing: '0.1em' }}>🔒 非公開</div>
                  )}
                </div>
                {thumb && (
                  <img src={thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
