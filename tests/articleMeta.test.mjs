import { test } from 'node:test'
import assert from 'node:assert/strict'
import { articleUrl, detectCharset, hostLabel, parseArticleMeta } from '../src/lib/articleMeta.js'

test('紹介記事：OGP からタイトル・アイキャッチ・サイト名を取る', () => {
  const html = `<html><head><title>予備のタイトル</title>
    <meta content="氷川神社に行ってきた &amp; 御朱印" property="og:title">
    <meta property='og:image' content='/img/eye.jpg'>
    <meta property="og:site_name" content="note">
  </head></html>`
  assert.deepEqual(parseArticleMeta(html, 'https://note.com/a/n/n1'), {
    title: '氷川神社に行ってきた & 御朱印', image: 'https://note.com/img/eye.jpg', siteName: 'note',
  })
})

test('紹介記事：OGP がなければ <title>、http の画像は使わない', () => {
  const html = '<title>\n  わたしの &#x795E;社めぐり </title><meta name="twitter:image" content="http://example.com/a.jpg">'
  assert.deepEqual(parseArticleMeta(html, 'https://example.com/'), { title: 'わたしの 神社めぐり', image: null, siteName: null })
  assert.deepEqual(parseArticleMeta('', 'https://example.com/'), { title: null, image: null, siteName: null })
})

test('紹介記事：URLと文字コード', () => {
  assert.equal(articleUrl(' https://note.com/x '), 'https://note.com/x')
  assert.equal(articleUrl('javascript:alert(1)'), null)
  assert.equal(articleUrl('note.com/x'), null)
  assert.equal(hostLabel('https://www.example.jp/a'), 'example.jp')
  assert.equal(detectCharset('text/html; charset=Shift_JIS', new Uint8Array()), 'shift_jis')
  assert.equal(detectCharset('text/html', new TextEncoder().encode('<meta charset="EUC-JP">')), 'euc-jp')
  assert.equal(detectCharset('', new Uint8Array()), 'utf-8')
})
