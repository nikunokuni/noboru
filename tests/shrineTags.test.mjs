import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEITY_OPTIONS, deityLabel, splitTags, splitDeityTags } from '../src/lib/shrineTags.js'

test('情報提供のタグ：文字の欄をタグに分け、ご祭神は表記をそろえる', () => {
  assert.deepEqual(splitTags('式内社（小）・旧県社、別表神社、旧県社'), ['式内社（小）', '旧県社', '別表神社'])
  assert.deepEqual(splitTags(null), [])
  assert.deepEqual(splitDeityTags('須佐之男命、スサノオ、稲田姫命'), ['素戔嗚尊', '櫛稲田姫命'])
  assert.equal(DEITY_OPTIONS[0], '天照大御神')
  assert.equal(new Set(DEITY_OPTIONS).size, DEITY_OPTIONS.length)
  assert.equal(deityLabel('天照大御神'), '天照大御神（アマテラス）')
  assert.equal(deityLabel('保食神'), '保食神')
})

test('マップの検索タグ：神社詳細の値から同じタグを選ぶ', async () => {
  const { SEARCH_TAGS, tagForValue, tagsFromParams } = await import('../src/lib/searchTags.js')
  assert.deepEqual(SEARCH_TAGS.map((g) => g.key), ['goshuin', 'deity', 'benefit', 'rank', 'parking'])
  assert.equal(tagForValue('goshuin', 'available').label, 'あり')
  assert.ok(tagForValue('goshuin', 'available').goshuin.includes('both'))
  assert.equal(tagForValue('goshuin', 'unknown'), null)
  assert.equal(tagForValue('parking', 'nearby').key, 'yes')
  const amaterasu = SEARCH_TAGS.find((g) => g.key === 'deity').tags[0]
  assert.equal(amaterasu.label, '天照大御神（アマテラス）')
  assert.equal(tagForValue('deity', 'アマテラス'), amaterasu)
  assert.equal(tagForValue('deity', '天照大神'), amaterasu)
  assert.equal(tagForValue('benefit', '縁結び').key, 'enmusubi')
  assert.deepEqual(tagForValue('benefit', '家内安全').benefit, ['家内安全'])
  assert.deepEqual(tagForValue('rank', '旧県社').rank, ['旧県社'])
  assert.equal(tagForValue('rank', '名神大社').key, 'myojin')
  const tags = tagsFromParams(new URLSearchParams('deity=素戔嗚尊&benefit=縁結び'))
  assert.deepEqual(Object.keys(tags), ['deity', 'benefit'])
  assert.equal(tags.deity[0].label, '素戔嗚尊（スサノオ）')
})
