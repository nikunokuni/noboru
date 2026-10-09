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
