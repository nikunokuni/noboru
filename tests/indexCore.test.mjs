import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeIndex, prepareIndex, searchIndex, nearbyIndex, getById, applyVisited, normalize, newIndexVersion, indexVersionDate } from '../src/lib/indexCore.js'
import { titleFor } from '../src/lib/constants.js'

const rows = [
  { id: 1, name: '八坂神社', name_kana: 'やさかじんじゃ', prefecture: '京都府', lat: 35.003674, lng: 135.778514, first_visited_on: '2026-01-01' },
  { id: 2, name: '伏見稲荷大社', name_kana: 'ふしみいなりたいしゃ', prefecture: '京都府', lat: 34.967146, lng: 135.772695, first_visited_on: null },
  { id: 3, name: '明治神宮', name_kana: 'めいじじんぐう', prefecture: '東京都', lat: 35.676398, lng: 139.699326, first_visited_on: null },
  { id: 4, name: '弥栄八坂社', name_kana: '', prefecture: '京都府', lat: 35.0040, lng: 135.7790, first_visited_on: null },
]
const index = () => prepareIndex(JSON.parse(JSON.stringify(encodeIndex(rows, { version: 'v1' }))))

test('エンコードして元に戻せる', () => {
  const idx = index()
  assert.equal(idx.size, 4)
  const item = getById(idx, 1)
  assert.equal(item.name, '八坂神社')
  assert.equal(item.prefecture, '京都府')
  assert.ok(Math.abs(item.lat - 35.003674) < 1e-5)
  assert.equal(item.visited, true)
})

test('名前・読み仮名で検索し、前方一致を先に出す', () => {
  const idx = index()
  assert.deepEqual(searchIndex(idx, '八坂').map((r) => r.id), [1, 4])
  assert.deepEqual(searchIndex(idx, 'ヤサカ').map((r) => r.id), [1])
  assert.deepEqual(searchIndex(idx, 'いなり').map((r) => r.id), [2])
  assert.deepEqual(searchIndex(idx, '', { prefecture: '東京都' }).map((r) => r.id), [3])
  assert.deepEqual(searchIndex(idx, '', { prefecture: '京都府', unvisitedOnly: true }).map((r) => r.id), [2, 4])
  assert.equal(normalize('ﾔｻｶ 神社'), 'やさか神社')
})

test('近い順に返す', () => {
  const idx = index()
  const near = nearbyIndex(idx, 35.0037, 135.7786, { radiusM: 1000 })
  assert.deepEqual(near.map((r) => r.id), [1, 4])
  assert.ok(near[0].distance < 20)
})

test('参拝済みフラグを更新する', () => {
  const idx = index()
  assert.equal(applyVisited(idx, [{ id: 2, visited: true }, { id: 1, visited: true }, { id: 99, visited: true }]), 1)
  assert.equal(getById(idx, 2).visited, true)
})

test('称号', () => {
  assert.deepEqual(titleFor(0), { current: '参拝初心者', next: { label: '氏子', remaining: 5 } })
  assert.deepEqual(titleFor(30), { current: '神主', next: { label: '大神主', remaining: 20 } })
  assert.equal(titleFor(150).next, null)
})

test('一覧ファイルの版は作った時刻（UTC）で、時刻に戻せる', () => {
  const now = new Date('2026-10-05T12:34:56.789Z')
  const v = newIndexVersion(now)
  assert.equal(v, '20261005123456')
  assert.equal(indexVersionDate(v).toISOString(), '2026-10-05T12:34:56.000Z')
  assert.equal(indexVersionDate('0'), null)
  assert.equal(indexVersionDate(undefined), null)
})
