import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDateKey, matchFeatured, pickFeatured } from '../src/lib/featuredShrines.js'

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

test('名前で書いた候補は、名前・都道府県・市区町村が合う神社に決める', () => {
  const items = [
    { id: 1, name: '寒川神社', prefecture: '神奈川県', municipality: '相模原市' },
    { id: 2, name: '寒川神社', prefecture: '神奈川県', municipality: '寒川町' },
    { id: 3, name: '寒川神社摂社', prefecture: '神奈川県', municipality: '寒川町' },
  ]
  assert.equal(matchFeatured({ name: '寒川神社', prefecture: '神奈川県', municipality: '寒川町' }, items).id, 2)
  assert.equal(matchFeatured({ name: '寒川神社', prefecture: '千葉県' }, items), null)
})
