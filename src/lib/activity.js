// 自分の記録の「のぼる」「あるく」
// 数えるのは「現地で記録」の記録だけ。同じ神社は1日1回まで
//   のぼる：神社の石段の段数（情報提供で入れたもの）の合計
//   あるく：同じ日に巡った神社の間の直線距離 × 1.3（道のり分）＋「駅から歩いた」記録の最寄り駅までの距離の往復
import { distanceM } from './geo.js'

export const STEP_HEIGHT_M = 0.17   // 石段1段の高さの目安
export const ROUTE_FACTOR = 1.3     // 直線距離を道のりにする目安

// 目標（小さい順）。高さ・距離はどれも「約」
export const CLIMB_GOALS = [
  { m: 30, label: 'ビル10階' },
  { m: 333, label: '東京タワー' },
  { m: 599, label: '高尾山' },
  { m: 634, label: '東京スカイツリー' },
  { m: 3776, label: '富士山' },
  { m: 8849, label: 'エベレスト' },
]
export const WALK_GOALS = [
  { m: 34500, label: '山手線一周' },
  { m: 42195, label: 'フルマラソン' },
  { m: 490000, label: '東海道五十三次（日本橋〜京都）' },
  { m: 3000000, label: '日本縦断（宗谷岬〜佐多岬）' },
  { m: 12000000, label: '日本一周' },
  { m: 40000000, label: '地球一周' },
]

// records: [{ shrine_id, visited_on, created_at, onsite, walked_from_station,
//             shrines: { lat, lng, stair_steps, nearest_station_m } }]
export function computeActivity(records) {
  // 現地で記録したものを、同じ日・同じ神社は最初の1件にまとめる
  const sorted = records.filter((r) => r.onsite && r.shrines)
    .slice().sort((a, b) => (a.visited_on === b.visited_on
      ? String(a.created_at).localeCompare(String(b.created_at))
      : a.visited_on.localeCompare(b.visited_on)))
  const visits = new Map()
  for (const r of sorted) {
    const key = `${r.visited_on}|${r.shrine_id}`
    const v = visits.get(key)
    if (v) v.walked_from_station ||= r.walked_from_station
    else visits.set(key, { ...r })
  }

  let steps = 0
  let betweenM = 0
  let stationM = 0
  let prev = null
  for (const v of visits.values()) {
    const s = v.shrines
    steps += s.stair_steps || 0
    if (v.walked_from_station && s.nearest_station_m != null) stationM += s.nearest_station_m * 2
    if (prev && prev.visited_on === v.visited_on) {
      betweenM += distanceM(prev.shrines.lat, prev.shrines.lng, s.lat, s.lng) * ROUTE_FACTOR
    }
    prev = v
  }

  const shrineIds = new Set([...visits.values()].map((v) => v.shrine_id))
  return {
    visits: visits.size,
    steps,
    climbM: steps * STEP_HEIGHT_M,
    // 段数が入っていない神社の数（重複なし）
    unknownStepShrines: new Set([...visits.values()].filter((v) => v.shrines.stair_steps == null).map((v) => v.shrine_id)).size,
    shrines: shrineIds.size,
    walkM: betweenM + stationM,
    betweenM,
    stationM,
  }
}

// いまの値から、達成した目標・次の目標。目標をすべて超えたら最後の目標の何回分かを数える
export function goalProgress(value, goals) {
  const reached = goals.filter((g) => value >= g.m)
  const next = goals.find((g) => value < g.m) || null
  const prevM = reached.length ? reached[reached.length - 1].m : 0
  const last = goals[goals.length - 1]
  return {
    reached: reached[reached.length - 1] || null,
    next,
    remaining: next ? next.m - value : 0,
    // 次の目標までの進み具合（0〜1）
    ratio: next ? (value - prevM) / (next.m - prevM) : 1,
    laps: next ? 0 : Math.floor(value / last.m),
  }
}

export function formatHeight(m) {
  return m < 10 ? `${m.toFixed(1)}m` : `${Math.round(m).toLocaleString('ja-JP')}m`
}

export function formatWalk(m) {
  if (m < 1000) return `${Math.round(m)}m`
  return `${(m / 1000).toLocaleString('ja-JP', { maximumFractionDigits: m < 100000 ? 1 : 0 })}km`
}
