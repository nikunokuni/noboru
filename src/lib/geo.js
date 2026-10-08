import { PREFECTURES, WALK_M_PER_MIN } from './constants.js'

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

// 中心から東西南北に halfM ずつの四角（[[南, 西], [北, 東]]）
export function squareBounds(lat, lng, halfM) {
  const dLat = halfM / 111000
  const dLng = halfM / (111000 * Math.cos((lat * Math.PI) / 180))
  return [[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]]
}

export const inBounds = ([[s, w], [n, e]], lat, lng) => lat >= s && lat <= n && lng >= w && lng <= e

// 市区町村コード → 名前（国土地理院の muni.js）。一度だけ読む
let muniTable = null
function loadMuniTable() {
  if (!muniTable) {
    muniTable = fetch('https://maps.gsi.go.jp/js/muni.js')
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        // GSI.MUNI_ARRAY["13112"] = '13,東京都,13112,世田谷区';
        const table = new Map()
        for (const m of text.matchAll(/\["(\d+)"\]\s*=\s*'[^,]*,([^,]*),[^,]*,([^']*)'/g)) {
          table.set(String(Number(m[1])), { prefecture: m[2], municipality: m[3].replace(/[\s　]/g, '') })
        }
        return table
      })
      .catch(() => { muniTable = null; return new Map() })
  }
  return muniTable
}

// 座標 → おおよその住所「東京都世田谷区上町」（国土地理院）。番地までは出ない。取れなければ ''
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`)
    if (!res.ok) return ''
    const { results } = await res.json()
    if (!results?.muniCd) return ''
    const code = String(Number(results.muniCd))
    const muni = (await loadMuniTable()).get(code)
    const town = results.lv01Nm && results.lv01Nm !== '－' ? results.lv01Nm : ''
    // 市区町村名が取れないときは、コードの上2桁から都道府県だけ出す
    const pref = muni?.prefecture || PREFECTURES[Number(code.padStart(5, '0').slice(0, 2)) - 1] || ''
    return `${pref}${muni?.municipality || ''}${town}`
  } catch {
    return ''
  }
}
