// 記録する（ホーム）：参拝したときにさっと記録するための画面
// 現在地のまわり約2km四方の地図と、近い順の一覧。押すと記録画面へ
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import ShrineRow from '../components/ShrineRow'
import TodayShrine from '../components/TodayShrine'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { GOOD_ACCURACY_M, useLivePosition } from '../hooks/useLivePosition'
import { nearbyIndex } from '../lib/indexCore'
import { formatDistance, inBounds, squareBounds } from '../lib/geo'
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

// 誤差がこれより大きいと、地図が神社からずれていることが多い
const ROUGH_ACCURACY_M = 300

// 地図の下に、いまの位置の確かさ。おおまかなら、端末の設定を案内する
function LocationNote({ position, locating, onRefresh }) {
  const rough = position.accuracy > ROUGH_ACCURACY_M
  return (
    <div className="location-note">
      <p className="muted small">
        {locating && position.accuracy > GOOD_ACCURACY_M ? '現在地を確認中…' : '現在地'}（誤差 約{formatDistance(position.accuracy)}）
        <button type="button" className="text-btn small" onClick={onRefresh}>測り直す</button>
      </p>
      {rough && !locating && (
        <p className="muted small">
          位置がおおまかです。空の見える場所で「測り直す」を押してください。
          iPhone は「設定 › プライバシーとセキュリティ › 位置情報サービス」で、使っているブラウザ（Safari など）の「正確な位置情報」をオンに。
          Android は位置情報の設定で「Google 位置情報の精度」をオンにすると正確になります
        </p>
      )}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { index, status, revision } = useShrineIndex()
  const { position, locating, denied, refresh } = useLivePosition()
  // マップにない神社の申請：地図を押してピンを立てる
  const [placing, setPlacing] = useState(false)
  const [newPin, setNewPin] = useState(null)

  // ピンを置いている間は、位置が更新されても地図を動かさない
  const [frozen, setFrozen] = useState(null)
  const center = placing && frozen ? frozen : position
  const bounds = useMemo(() => (center ? squareBounds(center.lat, center.lng, NEARBY_HALF_M) : null), [center])

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
  const startPlacing = () => { setFrozen(position); setNewPin({ lat: position.lat, lng: position.lng }); setPlacing(true) }
  const cancelPlacing = () => { setPlacing(false); setNewPin(null) }
  const request = () => navigate(`/request?lat=${newPin.lat.toFixed(6)}&lng=${newPin.lng.toFixed(6)}`)

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="app-logo">ノ<span>ボ</span>ル</div>
      </header>
      <div className="page-content">
        <TodayShrine />
        <RecentVisitors />

        {position ? (
          <div className="nearby-map-wrap">
            <Suspense fallback={<div className="nearby-map"><div className="spinner" /></div>}>
              <NearbyMap
                position={position} accuracy={position.accuracy} bounds={bounds} shrines={shrines} onPick={pick}
                placing={placing} newPin={newPin} onPlace={(ll) => setNewPin({ lat: ll.lat, lng: ll.lng })}
              />
            </Suspense>
            {placing && <div className="nearby-map-hint">拡大して、神社の場所をタップ</div>}
          </div>
        ) : (
          <div className="nearby-map nearby-map-empty">
            {locating ? <><div className="spinner" /><p className="muted small">現在地を確認中…</p></>
              : <>
                <p className="muted small">現在地を取得できませんでした。<br />{denied ? '位置情報の利用を許可してください' : '空の見える場所で、もう一度お試しください'}（「マップ」の下の検索から名前でも探せます）</p>
                <button type="button" className="text-btn mt8" onClick={refresh}>もう一度試す</button>
              </>}
          </div>
        )}

        {position && !placing && <LocationNote position={position} locating={locating} onRefresh={refresh} />}

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
