import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const formatDate = (iso) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 神社検索画面
export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [popular, setPopular] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchPopular()
  }, [])

  const fetchPopular = async () => {
    const { data } = await supabase
      .from('shrines')
      .select('*, records(count)')
      .order('created_at', { ascending: false })
      .limit(10)
    setPopular(data || [])
  }

  const handleSearch = async (q) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('shrines')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(20)
    setResults(data || [])
    setLoading(false)
  }

  const list = query ? results : popular

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div style={{ width: 24 }} />
        <div className="page-title">神社を探す</div>
        <div style={{ width: 24 }} />
      </div>

      <div className="page-content">
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            className="field-input"
            placeholder="神社名で検索..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            style={{ paddingRight: 32 }}
          />
          <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--mist)' }}>🔍</span>
        </div>

        {!query && (
          <div className="section-mini">みんなが記録した神社</div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--mist)', fontFamily: 'var(--font-mincho)', fontSize: 13 }}>
            {query ? '見つかりませんでした' : 'まだ登録された神社がありません'}
          </div>
        ) : (
          list.map(shrine => (
            <div
              key={shrine.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => navigate(`/shrine/${shrine.id}`)}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 15, color: 'var(--ink)', letterSpacing: '0.08em', marginBottom: 3 }}>
                  ⛩️ {shrine.name}
                </div>
                {shrine.location && (
                  <div style={{ fontSize: 10, color: 'var(--mist)' }}>{shrine.location}</div>
                )}
              </div>
              <span style={{ fontSize: 18, color: 'rgba(26,18,8,0.25)' }}>›</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 神社詳細ページ
export function ShrinePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shrine, setShrine] = useState(null)
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState({ count: 0, avgEmotion: 0, photoCount: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShrine()
  }, [id])

  const fetchShrine = async () => {
    setLoading(true)
    const { data: s } = await supabase.from('shrines').select('*').eq('id', id).single()
    setShrine(s)

    const { data: recs } = await supabase
      .from('records')
      .select('*, photos(url)')
      .eq('shrine_id', id)
      .eq('is_public', true)
      .order('visited_at', { ascending: false })
      .limit(20)

    setRecords(recs || [])

    if (recs && recs.length > 0) {
      const avg = recs.reduce((sum, r) => sum + r.emotion_level, 0) / recs.length
      const photos = recs.reduce((sum, r) => sum + (r.photos?.length || 0), 0)
      setStats({ count: recs.length, avgEmotion: (avg / 20).toFixed(1), photoCount: photos })
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="app-shell">
      {/* Hero */}
      <div style={{
        height: 120, background: 'linear-gradient(180deg, #d4c4a8, #c4b090)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 52,
      }}>⛩️</div>

      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--paper)', padding: '8px 20px', borderBottom: '1px solid rgba(26,18,8,0.08)', display: 'flex', alignItems: 'center' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
      </div>

      <div className="page-content" style={{ paddingTop: 16 }}>
        <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 22, color: 'var(--ink)', letterSpacing: '0.1em', marginBottom: 4 }}>
          {shrine?.name}
        </div>
        {shrine?.location && (
          <div style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>{shrine.location}</div>
        )}

        {/* ご利益タグ */}
        {shrine?.tags && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {shrine.tags.map((tag, i) => (
              <span key={i} className="pill">{tag}</span>
            ))}
          </div>
        )}

        {/* 統計 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { num: stats.count, label: '記録数' },
            { num: stats.avgEmotion, label: '感動平均' },
            { num: stats.photoCount, label: '写真' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, textAlign: 'center',
              background: 'var(--paper2)', borderRadius: 8, padding: '10px 4px',
            }}>
              <div style={{ fontFamily: 'var(--font-mincho)', fontSize: 20, color: 'var(--ink)' }}>{s.num}</div>
              <div style={{ fontSize: 9, color: 'var(--mist)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* みんなの記録 */}
        <div className="section-mini">みんなの記録</div>
        {records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--mist)', fontSize: 12, fontFamily: 'var(--font-mincho)' }}>
            まだ記録がありません
          </div>
        ) : (
          records.map(r => (
            <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(26,18,8,0.07)' }}>
              <div style={{ fontSize: 10, color: 'var(--mist)', marginBottom: 4 }}>
                {r.user_id?.slice(0, 6)}…　{formatDate(r.visited_at)}
              </div>
              {r.public_memo && (
                <div style={{ fontSize: 12, color: 'rgba(26,18,8,0.65)', lineHeight: 1.7 }}>{r.public_memo}</div>
              )}
              {r.photos?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {r.photos.slice(0, 3).map((p, i) => (
                    <img key={i} src={p.url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
