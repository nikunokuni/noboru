import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDateKey, pickFeatured } from '../src/lib/featuredShrines.js'

test('候補が空なら選ばない', () => {
  assert.equal(pickFeatured([], '2026-10-20'), null)
})

test('同じ日は同じ神社、日によって散らばる', () => {
  const list = [1, 2, 3, 4, 5].map((id) => ({ id }))
  assert.equal(pickFeatured(list, '2026-10-20'), pickFeatured(list, '2026-10-20'))
  const picked = new Set()
  for (let d = 1; d <= 30; d++) picked.add(pickFeatured(list, `2026-11-${String(d).padStart(2, '0')}`).id)
  assert.ok(picked.size >= 4)
})

test('日付は端末の時刻で YYYY-MM-DD', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
})
