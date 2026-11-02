import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEATURES_MAX, blankFields, isBlank, normalizeValue, planEdits } from '../scripts/lib/signboard.mjs'

test('空かどうか: 空白だけの文字・空のご利益は空', () => {
  assert.equal(isBlank('founded', null), true)
  assert.equal(isBlank('founded', '  '), true)
  assert.equal(isBlank('founded', '明治33年'), false)
  assert.equal(isBlank('benefits', []), true)
  assert.equal(isBlank('benefits', ['  ']), true)
  assert.equal(isBlank('benefits', ['厄除け']), false)
})

test('空欄の項目だけを挙げる', () => {
  const shrine = { deities: '天照大御神', benefits: [], founded: null, features: '' }
  const blank = blankFields(shrine)
  assert.ok(!blank.includes('deities'))
  assert.ok(blank.includes('benefits'))
  assert.ok(blank.includes('founded'))
  assert.ok(blank.includes('features'))
})

test('値をそろえる', () => {
  assert.deepEqual(normalizeValue('benefits', '厄除け、縁結び、厄除け'), { value: ['厄除け', '縁結び'] })
  assert.deepEqual(normalizeValue('founded', ' 伝・天平年間 '), { value: '伝・天平年間' })
  assert.ok(normalizeValue('name_kana', 'ヒカワジンジャ').error)
  assert.deepEqual(normalizeValue('name_kana', 'ひかわじんじゃ'), { value: 'ひかわじんじゃ' })
  assert.ok(normalizeValue('features', 'あ'.repeat(FEATURES_MAX + 1)).error)
  assert.ok(normalizeValue('founded', 123).error)
})

test('埋まっている項目は上書きしない', () => {
  const shrine = { id: 7, deities: '素戔嗚尊', founded: null, benefits: [] }
  const proposal = {
    shrine_id: 7,
    fields: { deities: '大国主命', founded: '伝・景行天皇の御代', benefits: ['開運'], address: '東京都', annual_festival: '' },
  }
  const { rows, skipped } = planEdits(proposal, shrine, 'u1')
  assert.deepEqual(rows, [
    { shrine_id: 7, user_id: 'u1', field: 'founded', value: '伝・景行天皇の御代' },
    { shrine_id: 7, user_id: 'u1', field: 'benefits', value: ['開運'] },
  ])
  assert.deepEqual(skipped.map((s) => s.field).sort(), ['address', 'deities'])
})
