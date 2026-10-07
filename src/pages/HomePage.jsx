// 近くの神社（ホーム）
import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import ShrineFinder from '../components/ShrineFinder'
import { getCurrentPosition } from '../lib/geo'
import { fetchAppStats } from '../lib/community'

function RecentVisitors() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    fetchAppStats().then((s) => setCount(s.recent_visitors)).catch(() => {})
  }, [])
  if (!count) return null
  return <p className="quiet-count">この30日で、全国 {count.toLocaleString()}人 が参拝しています</p>
}

export default function HomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [position, setPosition] = useState(null)
  const [locating, setLocating] = useState(true)

  // 位置の取得は待たずに画面を出す
  useEffect(() => {
    let alive = true
    getCurrentPosition().then((p) => { if (alive) { setPosition(p); setLocating(false) } })
    return () => { alive = false }
  }, [])

  // 以前の「/?shrine=ID」（記録画面がホームだったころ）のリンク
  const legacy = params.get('shrine')
  if (legacy) return <Navigate to={`/record/${legacy}`} replace />

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="app-logo">ノ<span>ボ</span>ル</div>
      </header>
      <div className="page-content">
        <RecentVisitors />
        <ShrineFinder
          position={position} locating={locating}
          onPick={(s) => navigate(`/record/${s.id}`)}
          onDetail={(s) => navigate(`/shrine/${s.id}`)}
        />
      </div>
    </div>
  )
}
