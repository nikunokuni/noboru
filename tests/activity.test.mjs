import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLIMB_GOALS, computeActivity, formatWalk, goalProgress } from '../src/lib/activity.js'
import { distanceM } from '../src/lib/geo.js'

const A = { lat: 35.0, lng: 139.0, stair_steps: 100, nearest_station_m: 500 }
const B = { lat: 35.01, lng: 139.0, stair_steps: null, nearest_station_m: 300 }
const C = { lat: 35.02, lng: 139.0, stair_steps: 50, nearest_station_m: null }
const rec = (shrine_id, shrines, visited_on, created_at, extra = {}) =>
  ({ shrine_id, shrines, visited_on, created_at, onsite: true, walked_from_station: false, ...extra })

test('のぼる：現地で記録した記録の石段の段数を、同じ日・同じ神社は1回だけ足す', () => {
  const a = computeActivity([
    rec(1, A, '2026-11-01', '2026-11-01T01:00:00Z'),
    rec(1, A, '2026-11-01', '2026-11-01T03:00:00Z'), // 同じ日にもう一度：数えない
    rec(1, A, '2026-11-02', '2026-11-02T01:00:00Z'), // 別の日：数える
    rec(2, B, '2026-11-02', '2026-11-02T02:00:00Z'), // 段数不明
    rec(3, C, '2026-11-03', '2026-11-03T01:00:00Z', { onsite: false }), // 現地で記録でない：数えない
  ])
  assert.equal(a.steps, 200)
  assert.equal(a.unknownStepShrines, 1)
  assert.ok(Math.abs(a.climbM - 34) < 1e-9)
})

test('あるく：同じ日の神社の間の距離×1.3と、駅から歩いた記録の往復を足す', () => {
  const ab = distanceM(A.lat, A.lng, B.lat, B.lng)
  const bc = distanceM(B.lat, B.lng, C.lat, C.lng)
  const a = computeActivity([
    // 並びは記録した時刻順にそろえる
    rec(3, C, '2026-11-01', '2026-11-01T03:00:00Z', { walked_from_station: true }), // 駅の距離なし
    rec(1, A, '2026-11-01', '2026-11-01T01:00:00Z', { walked_from_station: true }),
    rec(2, B, '2026-11-01', '2026-11-01T02:00:00Z'),
    rec(2, B, '2026-11-01', '2026-11-01T04:00:00Z', { walked_from_station: true }), // 同じ日の2回目のチェックも生かす
    rec(3, C, '2026-11-02', '2026-11-02T01:00:00Z'), // 別の日：前の日の神社とはつながない
  ])
  assert.ok(Math.abs(a.betweenM - (ab + bc) * 1.3) < 1e-6)
  assert.equal(a.stationM, 500 * 2 + 300 * 2)
  assert.ok(Math.abs(a.walkM - (a.betweenM + a.stationM)) < 1e-6)
})

test('目標：次の目標までの残りと、すべて超えたあとの回数', () => {
  const g = goalProgress(100, CLIMB_GOALS)
  assert.equal(g.reached.label, 'ビル10階')
  assert.equal(g.next.label, '東京タワー')
  assert.equal(g.remaining, 233)
  assert.equal(goalProgress(0, CLIMB_GOALS).reached, null)
  const over = goalProgress(8849 * 2 + 1, CLIMB_GOALS)
  assert.equal(over.next, null)
  assert.equal(over.laps, 2)
  assert.equal(formatWalk(850), '850m')
  assert.equal(formatWalk(12345), '12.3km')
})
