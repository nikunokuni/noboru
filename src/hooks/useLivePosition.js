// 現在地を見張り続ける。最初はおおまかな位置（Wi-Fi・基地局）が来て、GPS がつかめると精度が上がっていくので、
// 1回だけ取って終わりにせず、より正確な位置が来たら差し替える
// アプリを裏に回して神社で開き直したときも、前の場所のままにならないように、表に戻ったら測り直す
//
// 返り値: { position: { lat, lng, accuracy } | null, locating, failed, denied, refresh }
//   locating: まだ一度も位置が取れていない／測り直しの最中
//   failed:   位置が取れなかった（denied は位置情報の利用を許可していない）
import { useCallback, useEffect, useRef, useState } from 'react'
import { distanceM } from '../lib/geo'

// これより正確になったら、もう十分（見張りは続けるが「測り直し中」は消す）
export const GOOD_ACCURACY_M = 50

const toPosition = (pos) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: Math.round(pos.coords.accuracy),
})

// 新しい位置に差し替えるか。精度が同じか良くなった、または誤差の円が重ならないほど離れた（歩いて動いた）とき
function better(next, cur) {
  if (!cur) return true
  if (next.accuracy <= cur.accuracy) return true
  return distanceM(cur.lat, cur.lng, next.lat, next.lng) > cur.accuracy + next.accuracy
}

export function useLivePosition() {
  const [position, setPosition] = useState(null)
  const [locating, setLocating] = useState(true)
  const [failed, setFailed] = useState(false)
  const [denied, setDenied] = useState(false)
  const watchId = useRef(null)
  const timer = useRef(null)
  const current = useRef(null)
  // 測り直しの最初の1回は、精度が悪くても前の位置と差し替える（前の場所が古いかもしれないので）
  const fresh = useRef(true)

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    clearTimeout(timer.current)
  }, [])

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocating(false); setFailed(true); return
    }
    stop()
    fresh.current = true
    setLocating(true)
    setFailed(false)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = toPosition(pos)
        if (fresh.current || better(next, current.current)) {
          fresh.current = false
          current.current = next
          setPosition(next)
        }
        setDenied(false)
        setFailed(false)
        if (current.current.accuracy <= GOOD_ACCURACY_M) setLocating(false)
      },
      (err) => {
        // 時間切れでも見張りは続く。許可がないときだけやめる
        if (err.code === 1) { setDenied(true); stop() }
        if (!current.current) setFailed(true)
        setLocating(false)
      },
      // 山の中では最初の測位に時間がかかるので、timeout は長め。古い位置（maximumAge）は使わない
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
    // 精度が上がりきらなくても、しばらくしたら「測り直し中」は消す
    timer.current = setTimeout(() => setLocating(false), 20000)
  }, [stop])

  useEffect(() => {
    start()
    // 裏に回したら止め、表に戻ったら測り直す
    const onVisible = () => (document.visibilityState === 'visible' ? start() : stop())
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); stop() }
  }, [start, stop])

  return { position, locating, failed, denied, refresh: start }
}
