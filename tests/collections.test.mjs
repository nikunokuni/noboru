import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeIndex, prepareIndex } from '../src/lib/indexCore.js'
import { deityCollection, deityShrinePositions, firstVisits, newDeitiesFor } from '../src/lib/collections.js'
import { DEITIES } from '../src/lib/deities.js'
import { DEITY_PROFILES, deityProfile } from '../src/lib/deityProfiles.js'

const row = (id, deities) => ({ id, name: `神社${id}`, prefecture: '東京都', lat: 35, lng: 139, deities })
const index = prepareIndex(encodeIndex([
  row(1, '天照大御神、豊受大神'),
  row(2, '須佐之男命'),
  row(3, 'スサノオ、櫛名田比売'),
  row(4, ''),
  row(5, '天照皇大神'),
], { version: 'v' }))

test('参拝の記録から神社ごとの最初の参拝日', () => {
  const v = firstVisits([
    { shrine_id: 2, visited_on: '2026-05-01' }, { shrine_id: '2', visited_on: '2026-03-01' }, { shrine_id: 3, visited_on: '2026-04-01' },
  ])
  assert.deepEqual([...v], [[2, '2026-03-01'], [3, '2026-04-01']])
})

test('神様リスト：祀る神社の多い順で、参拝した神社のご祭神が集まる', () => {
  const list = deityCollection(index, firstVisits([{ shrine_id: 3, visited_on: '2026-04-01' }, { shrine_id: 2, visited_on: '2026-03-01' }]))
  assert.deepEqual(list.map((d) => [d.name, d.shrineCount, d.collected]), [
    ['素戔嗚尊', 2, true], ['天照大御神', 2, false], ['櫛稲田姫命', 1, true], ['豊受大御神', 1, false],
  ])
  assert.equal(list[0].collectedOn, '2026-03-01')
  assert.deepEqual(list[0].myShrineIds, [2, 3])
  assert.ok(deityCollection(index).every((d) => !d.collected))
  assert.deepEqual(deityShrinePositions(index, '天照大御神').map((i) => index.raw.id[i]), [1, 5])
  assert.deepEqual(deityShrinePositions(index, 'いない神'), [])
})

test('記録した神社で新しく集まる神様', () => {
  assert.deepEqual(newDeitiesFor(index, 3, [2]), ['櫛稲田姫命'])
  assert.deepEqual(newDeitiesFor(index, 3, [3]), ['素戔嗚尊', '櫛稲田姫命'])
  assert.deepEqual(newDeitiesFor(index, 4, []), [])
  assert.deepEqual(newDeitiesFor(index, 99, []), [])
})

test('神様の詳細：辞書の神様にはすべて紹介がある', () => {
  for (const [name] of DEITIES) assert.ok(deityProfile(name), name)
  assert.equal(Object.keys(DEITY_PROFILES).length, DEITIES.length)
  assert.equal(deityProfile('いない神'), null)
})
