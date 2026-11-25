import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NIKUNOKUNI_SHRINES, nikunokuniCollection, nikunokuniPosition, newNikunokuniFor } from '../src/lib/nikunokuni.js'

// 一覧ファイルの形（必要なところだけ）
function makeIndex(rows) {
  const prefs = [...new Set(rows.map((r) => r.pref))]
  const munis = [...new Set(rows.map((r) => r.muni))]
  const raw = {
    id: rows.map((r) => r.id), name: rows.map((r) => r.name),
    prefs, pref: rows.map((r) => prefs.indexOf(r.pref)),
    munis, muni: rows.map((r) => munis.indexOf(r.muni)),
  }
  return { raw, byId: new Map(raw.id.map((id, i) => [id, i])) }
}

const index = makeIndex([
  { id: 10, name: '出雲大社', pref: '北海道', muni: '札幌市' },
  { id: 20, name: '出雲大社', pref: '島根県', muni: '出雲市' },
])

test('リストの key は重ならず、エピソードがある', () => {
  const keys = NIKUNOKUNI_SHRINES.map((e) => e.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const e of NIKUNOKUNI_SHRINES) {
    assert.match(e.key, /^[a-z0-9-]+$/)
    assert.ok(e.episode.length > 0)
  }
})

test('名前・都道府県・市区町村が合う神社に決める', () => {
  assert.equal(nikunokuniPosition(index, { name: '出雲大社', prefecture: '島根県', municipality: '出雲市' }), 1)
  assert.equal(nikunokuniPosition(index, { name: '出雲大社', prefecture: '京都府' }), null)
  assert.equal(nikunokuniPosition(index, { id: 10, name: 'ちがう名前' }), 0)
})

test('参拝した神社だけ集まる（分祠では集まらない）', () => {
  const izumo = (v) => nikunokuniCollection(index, v).find((e) => e.key === 'izumo-taisha')
  assert.equal(izumo(new Map()).collected, false)
  assert.equal(izumo(new Map([[10, '2026-01-01']])).collected, false)
  const got = izumo(new Map([[20, '2026-03-04']]))
  assert.equal(got.collected, true)
  assert.equal(got.collectedOn, '2026-03-04')
  assert.equal(got.shrineId, 20)
})

test('初めて参拝したときだけ、読めるようになったと知らせる', () => {
  assert.deepEqual(newNikunokuniFor(index, 20, [5]).map((e) => e.key), ['izumo-taisha'])
  assert.deepEqual(newNikunokuniFor(index, 20, [20]), [])
  assert.deepEqual(newNikunokuniFor(index, 10, []), [])
})
