import { test } from 'node:test'
import assert from 'node:assert/strict'
import { websiteLabel, websiteUrl } from '../src/lib/format.js'

test('公式サイト：http(s) のURLだけをリンクにし、短い形で表示する', () => {
  assert.equal(websiteUrl(' https://hebikubo.jp/ '), 'https://hebikubo.jp/')
  assert.equal(websiteUrl('http://www.example.jp/jinja?id=1'), 'http://www.example.jp/jinja?id=1')
  assert.equal(websiteUrl('javascript:alert(1)'), null)
  assert.equal(websiteUrl('hebikubo.jp'), null)
  assert.equal(websiteUrl('https://localhost'), null)
  assert.equal(websiteUrl(null), null)
  assert.equal(websiteLabel('https://hebikubo.jp/'), 'hebikubo.jp')
  assert.equal(websiteLabel('https://www.example.jp/jinja/'), 'example.jp/jinja')
})
