import { WALK_M_PER_MIN } from './constants.js'

const R = 6371000

// 2点間の距離（m）
export function distanceM(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function formatDistance(m) {
  if (m == null) return ''
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`
}

// 「約12分」。直線距離からの目安
export function walkMinutes(m) {
  return Math.max(1, Math.round(m / WALK_M_PER_MIN))
}

// 現在地を取得。取れなければ null（エラーにしない）
// 山の中では最初の測位に時間がかかるので、timeout は長め
export function getCurrentPosition({ timeout = 20000, maximumAge = 60000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge },
    )
  })
}
