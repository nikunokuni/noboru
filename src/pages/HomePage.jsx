// 記録する（ホーム）：参拝したときにさっと記録するための画面
// 開くと現在地のまわり約2km四方の地図。指で自由に動かせて、「現在地に戻る」で戻る
// ピンを押すと神社のカード（記録する・行き方・詳しく見る）。下の一覧は地図に映っている神社を現在地から近い順に出し、押すと記録画面へ
// GPS がずれるときは「地図で直す」で、いまいる場所を地図で押して直せる
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import ShrineRow from '../components/ShrineRow'
import TodayShrine from '../components/TodayShrine'
import WishStar from '../components/WishStar'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { useWishes } from '../hooks/useWishes'
import { GOOD_ACCURACY_M, useLivePosition } from '../hooks/useLivePosition'
import { nearbyIndex } from '../lib/indexCore'
import { distanceM, formatDistance, inBounds, nearbyHalfM, squareBounds, walkMinutes } from '../lib/geo'
import { placeLabel } from '../lib/format'
import { fetchAppStats } from '../lib/community'
import { NEARBY_HALF_M, NEARBY_MAX_HALF_M } from '../lib/constants'

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

// 近い順の一覧に出す数（地図を縮小すると、街なかでは何百社にもなるので）
const LIST_MAX = 50

// 地図に出すピンの数の上限（縮小しすぎると重くなるので、地図の真ん中から近い順にここまで）
const PIN_MAX = 300

// 誤差がこれより大きいと、地図が神社からずれていることが多い
const ROUGH_ACCURACY_M = 300

// 地図の下に、いまの位置の確かさ。ずれているときは「地図で直す」で、いまいる場所を押して直せる
function LocationNote({ position, locating, onRefresh, onFix }) {
  if (position.manual) {
    return (
      <div className="location-note">
        <p className="muted small">
          地図で直した現在地
          <button type="button" className="text-btn small" onClick={onFix}>直し直す</button>
          <button type="button" className="text-btn small" onClick={onRefresh}>GPS に戻す</button>
        </p>
      </div>
    )
  }
  const rough = position.accuracy > ROUGH_ACCURACY_M
  return (
    <div className="location-note">
      <p className="muted small">
        {locating && position.accuracy > GOOD_ACCURACY_M ? '現在地を確認中…' : '現在地'}（誤差 約{formatDistance(position.accuracy)}）
        <button type="button" className="text-btn small" onClick={onRefresh}>測り直す</button>
        <button type="button" className="text-btn small" onClick={onFix}>地図で直す</button>
      </p>
      {rough && !locating && (
        <p className="muted small">
          位置がおおまかです。近くに神社が見当たらないときは、地図を縮小して探してください。
          ずれているときは「地図で直す」で、いまいる場所を押してください。
          空の見える場所で「測り直す」を押すと、正確になることもあります
        </p>
      )}
    </div>
  )
}

// ピンを押した神社のカード。行き方を調べたり詳しく見たりしてから、参拝して記録する
function ShrineCard({ shrine, distance, onRecord, onClose }) {
  return (
    <div className="nearby-card">
      <div className="nearby-card-head">
        <WishStar shrineId={shrine.id} />
        <div className="nearby-card-title">
          <div className="nearby-card-name">{shrine.name}</div>
          <div className="muted small">
            {placeLabel(shrine)}
            {distance != null && <> ・ 徒歩 約{walkMinutes(distance)}分（{formatDistance(distance)}）</>}
          </div>
        </div>
        <button type="button" className="nearby-card-close" onClick={onClose} aria-label="閉じる">×</button>
      </div>
      <button type="button" className="btn-primary" onClick={onRecord}>記録する</button>
      <div className="nearby-card-links">
        <a className="btn-secondary" target="_blank" rel="noopener noreferrer"
          href={`https://www.google.com/maps/dir/?api=1&destination=${shrine.lat},${shrine.lng}`}>行き方 ↗</a>
        <Link className="btn-secondary" to={`/shrine/${shrine.id}`}>詳しく見る</Link>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { index, status, revision } = useShrineIndex()
  const live = useLivePosition()
  // 「地図で直す」で押した現在地。GPS より優先する。「GPS に戻す」・アプリを開き直すと消える
  const [manual, setManual] = useState(null)
  const position = manual || live.position
  const { locating, denied } = live
  // 数を増やすと、地図を最初の範囲（現在地のまわり）に戻す
  const [recenter, setRecenter] = useState(0)
  const goHome = () => setRecenter((n) => n + 1)
  const refresh = () => { setManual(null); live.refresh(); goHome() }
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setManual(null) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // 地図を押してピンを立てる：'request'（マップにない神社の申請）／'fix'（現在地を地図で直す）
  const [placing, setPlacing] = useState(null)
  const [newPin, setNewPin] = useState(null)

  // ピンを置いている間は、位置が更新されても地図を動かさない
  const [frozen, setFrozen] = useState(null)
  const center = placing && frozen ? frozen : position
  // 最初に出す範囲は、誤差に関係なくいつも約2km四方
  // 現在地を直すときだけ、本当の場所が入るように誤差に合わせて広めに出す
  const homeHalfM = placing === 'fix' ? Math.min(nearbyHalfM(center?.accuracy) * 2, NEARBY_MAX_HALF_M) : NEARBY_HALF_M
  const home = useMemo(
    () => (center ? squareBounds(center.lat, center.lng, homeHalfM) : null),
    [center?.lat, center?.lng, homeHalfM],
  )

  // いま地図に映っている範囲（地図を動かすと変わる）
  const [view, setView] = useState(null)

  // 地図に映っている神社。ピンは地図の真ん中から近い順、距離は現在地から
  // ☆を付けた神社は地図の名前に★を付ける（参拝しに来たときに見つけやすく）
  const { ids: wishIds } = useWishes()
  const area = view || home
  const shrines = useMemo(() => {
    if (!index || !position || !area) return []
    const [[s, w], [n, e]] = area
    const cLat = (s + n) / 2
    const cLng = (w + e) / 2
    return nearbyIndex(index, cLat, cLng, { radiusM: distanceM(cLat, cLng, n, e), limit: Infinity })
      .filter((x) => inBounds(area, x.lat, x.lng))
      .map((x) => ({ ...x, wish: wishIds.has(Number(x.id)), distance: distanceM(position.lat, position.lng, x.lat, x.lng) }))
  }, [index, revision, position, area, wishIds])
  const pins = useMemo(() => shrines.slice(0, PIN_MAX), [shrines])
  const list = useMemo(() => [...shrines].sort((a, b) => a.distance - b.distance), [shrines])

  // ピンを押して選んだ神社（カードを出す）
  const [selected, setSelected] = useState(null)
  const selectedDistance = selected && position ? distanceM(position.lat, position.lng, selected.lat, selected.lng) : null

  // 以前の「/?shrine=ID」（記録画面がホームだったころ）のリンク
  const legacy = params.get('shrine')
  if (legacy) return <Navigate to={`/record/${legacy}`} replace />

  const record = (s) => navigate(`/record/${s.id}`)
  // 申請のピンは、いま地図の真ん中に出す（地図を動かして神社のあたりを見ているときのため）。現在地を直すときは広めの地図に戻す
  const startPlacing = (kind) => {
    setSelected(null); setFrozen(position)
    const [[s, w], [n, e]] = view || home
    setNewPin(kind === 'request' && view ? { lat: (s + n) / 2, lng: (w + e) / 2 } : { lat: position.lat, lng: position.lng })
    setPlacing(kind)
    if (kind === 'fix') goHome()
  }
  const cancelPlacing = () => { setPlacing(null); setNewPin(null) }
  // 現在地のまわり（「現地で記録」と同じ範囲）に立てたピンだけ、現地からの申請にする
  // 地図を動かして遠くに立てたときは、マップのタブからの申請と同じ扱い（承認しても参拝記録を作らない）
  const request = () => {
    const near = inBounds(squareBounds(center.lat, center.lng, nearbyHalfM(center.accuracy)), newPin.lat, newPin.lng)
    navigate(`/request?lat=${newPin.lat.toFixed(6)}&lng=${newPin.lng.toFixed(6)}${near ? '' : '&from=map'}`)
  }
  const fix = () => { setManual({ lat: newPin.lat, lng: newPin.lng, accuracy: null, manual: true }); cancelPlacing(); goHome() }

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
                position={position} accuracy={position.accuracy} home={home} shrines={pins}
                selectedId={selected?.id} onPick={setSelected} onMapClick={() => setSelected(null)} onView={setView} recenter={recenter}
                placing={!!placing} newPin={newPin} onPlace={(ll) => setNewPin({ lat: ll.lat, lng: ll.lng })}
              />
            </Suspense>
            {placing && <div className="nearby-map-hint">{placing === 'fix' ? '拡大して、いまいる場所をタップ' : '拡大して、神社の場所をタップ'}</div>}
            {!placing && shrines.length > PIN_MAX && <div className="nearby-map-hint">拡大すると、すべての神社が出ます</div>}
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

        {position && !placing && selected && (
          <ShrineCard shrine={selected} distance={selectedDistance} onRecord={() => record(selected)} onClose={() => setSelected(null)} />
        )}

        {position && !placing && <LocationNote position={position} locating={locating} onRefresh={refresh} onFix={() => startPlacing('fix')} />}

        {position && (placing ? (
          <div className="place-actions">
            {placing === 'fix'
              ? <button type="button" className="btn-primary" onClick={fix}>ここにいる</button>
              : <button type="button" className="btn-primary" onClick={request}>この場所で申請する</button>}
            <button type="button" className="text-btn" onClick={cancelPlacing}>やめる</button>
          </div>
        ) : (
          <button type="button" className="btn-secondary mt8" onClick={() => startPlacing('request')}>マップにない神社を申請する</button>
        ))}

        {position && !placing && (
          <div>
            <div className="section-mini">地図の中の神社（現在地から近い順）</div>
            {!index && <p className="muted small">{status === 'unavailable' ? '神社一覧を取得できませんでした' : '神社一覧を準備中…'}</p>}
            {index && list.length === 0 && <p className="muted small">地図の中に登録された神社はありません（地図を縮小すると探せます）</p>}
            {list.slice(0, LIST_MAX).map((s) => <ShrineRow key={s.id} item={s} onClick={() => record(s)} right={formatDistance(s.distance)} />)}
            {list.length > LIST_MAX && <p className="muted small center mt8">近い{LIST_MAX}社まで出しています（ほか{list.length - LIST_MAX}社は地図の点を押す）</p>}
          </div>
        )}
      </div>
    </div>
  )
}
