// 記録する（ホーム）：参拝したときにさっと記録するための画面
// 現在地のまわり約2km四方の地図と、近い順の一覧。押すと記録画面へ
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import ShrineRow from '../components/ShrineRow'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { nearbyIndex } from '../lib/indexCore'
import { formatDistance, getCurrentPosition, inBounds, squareBounds } from '../lib/geo'
import { fetchAppStats } from '../lib/community'
import { NEARBY_HALF_M } from '../lib/constants'

// 地図ライブラリは大きいので、現在地が取れてから読み込む
const NearbyMap = lazy(() => import('../components/NearbyMap'))

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
  const { index, status, revision } = useShrineIndex()
  const [position, setPosition] = useState(null)
  const [locating, setLocating] = useState(true)
  // マップにない神社の申請：地図を押してピンを立てる
  const [placing, setPlacing] = useState(false)
  const [newPin, setNewPin] = useState(null)

  // 位置の取得は待たずに画面を出す
  useEffect(() => {
    let alive = true
    getCurrentPosition().then((p) => { if (alive) { setPosition(p); setLocating(false) } })
    return () => { alive = false }
  }, [])

  const bounds = useMemo(() => (position ? squareBounds(position.lat, position.lng, NEARBY_HALF_M) : null), [position])

  // 四角の角まで含めて探し、四角の中だけ残す
  const shrines = useMemo(
    () => (index && position
      ? nearbyIndex(index, position.lat, position.lng, { radiusM: NEARBY_HALF_M * Math.SQRT2, limit: Infinity })
        .filter((s) => inBounds(bounds, s.lat, s.lng))
      : []),
    [index, revision, position, bounds],
  )

  // 以前の「/?shrine=ID」（記録画面がホームだったころ）のリンク
  const legacy = params.get('shrine')
  if (legacy) return <Navigate to={`/record/${legacy}`} replace />

  const pick = (s) => navigate(`/record/${s.id}`)
  const startPlacing = () => { setNewPin({ lat: position.lat, lng: position.lng }); setPlacing(true) }
  const cancelPlacing = () => { setPlacing(false); setNewPin(null) }
  const request = () => navigate(`/request?lat=${newPin.lat.toFixed(6)}&lng=${newPin.lng.toFixed(6)}`)

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="app-logo">ノ<span>ボ</span>ル</div>
      </header>
      <div className="page-content">
        <RecentVisitors />

        {position ? (
          <div className="nearby-map-wrap">
            <Suspense fallback={<div className="nearby-map"><div className="spinner" /></div>}>
              <NearbyMap
                position={position} bounds={bounds} shrines={shrines} onPick={pick}
                placing={placing} newPin={newPin} onPlace={(ll) => setNewPin({ lat: ll.lat, lng: ll.lng })}
              />
            </Suspense>
            {placing && <div className="nearby-map-hint">神社の場所をタップしてください</div>}
          </div>
        ) : (
          <div className="nearby-map nearby-map-empty">
            {locating ? <><div className="spinner" /><p className="muted small">現在地を確認中…</p></>
              : <p className="muted small">現在地を取得できませんでした。<br />位置情報の利用を許可してください（「探す」から名前でも探せます）</p>}
          </div>
        )}

        {position && (placing ? (
          <div className="place-actions">
            <button type="button" className="btn-primary" onClick={request}>この場所で申請する</button>
            <button type="button" className="text-btn" onClick={cancelPlacing}>やめる</button>
          </div>
        ) : (
          <button type="button" className="btn-secondary mt8" onClick={startPlacing}>マップにない神社を申請する</button>
        ))}

        {position && !placing && (
          <div>
            <div className="section-mini">近い順</div>
            {!index && <p className="muted small">{status === 'unavailable' ? '神社一覧を取得できませんでした' : '神社一覧を準備中…'}</p>}
            {index && shrines.length === 0 && <p className="muted small">このあたりに登録された神社はありません</p>}
            {shrines.map((s) => <ShrineRow key={s.id} item={s} onClick={() => pick(s)} right={formatDistance(s.distance)} />)}
          </div>
        )}
      </div>
    </div>
  )
}
