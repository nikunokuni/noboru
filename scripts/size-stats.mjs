#!/usr/bin/env node
// 神社の大きさの判定を調整するための集計（ネットワーク・DBを使わない）
// scripts/.cache/ に保存した Overpass の神社データから、大きさを決める材料ごとの件数を全国でまとめて出す
//
// 使い方: npm run size-stats
//   社格は Wikipedia から取るため、ここでは数えない（「大きな神社」は社格の分だけ実際より少なく出る）

import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PREFECTURES, prefectureIso } from '../src/lib/constants.js'
import { processPrefecture, classifyShrineSize } from './lib/process.mjs'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '.cache')
const AREA_BUCKETS = [100, 300, 1000, 3000, 10000, Infinity]   // ㎡ の上限
const areaLabel = (i) => (i === 0 ? '〜100㎡' : AREA_BUCKETS[i] === Infinity ? `${AREA_BUCKETS[i - 1].toLocaleString()}㎡〜` : `${AREA_BUCKETS[i - 1].toLocaleString()}〜${AREA_BUCKETS[i].toLocaleString()}㎡`)

const files = new Set(await readdir(CACHE).catch(() => []))
const count = new Map()
const add = (key, wiki) => {
  const c = count.get(key) || { all: 0, wiki: 0 }
  c.all++
  if (wiki) c.wiki++
  count.set(key, c)
}
const sizes = { large: 0, medium: 0, small: 0 }
const missing = []
let total = 0

for (const [i, prefecture] of PREFECTURES.entries()) {
  const file = `${prefectureIso(i)}.shrines.json`
  if (!files.has(file)) { missing.push(`${prefecture}（未取得）`); continue }
  const json = JSON.parse(await readFile(join(CACHE, file), 'utf8'))
  if (!json.elements?.length) { missing.push(`${prefecture}（0件）`); continue }
  const { rows } = processPrefecture(json.elements, prefecture)
  for (const r of rows) {
    const s = r.size_signals
    total++
    sizes[classifyShrineSize({ ...s, shrineRank: null })]++
    if (s.wayside) add('祠（wayside_shrine）', s.hasWiki)
    else if (!s.named) add('名前なし', s.hasWiki)
    else if (!s.hasPolygon) add('点だけ', s.hasWiki)
    else add(`境内 ${areaLabel(AREA_BUCKETS.findIndex((max) => s.areaM2 < max))}`, s.hasWiki)
  }
}

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`
console.log(`神社 ${total.toLocaleString()}件（境内社を除いたあと）\n`)
console.log('材料ごとの件数（うち Wikipedia/Wikidata あり）')
const order = ['祠（wayside_shrine）', '名前なし', '点だけ', ...AREA_BUCKETS.map((_, i) => `境内 ${areaLabel(i)}`)]
for (const key of order) {
  const c = count.get(key) || { all: 0, wiki: 0 }
  console.log(`  ${key}: ${c.all.toLocaleString()}件 ${pct(c.all)}（うち ${c.wiki.toLocaleString()}件）`)
}
console.log('\n今の判定（社格を除く）')
console.log(`  大きな神社 ${sizes.large}件 ${pct(sizes.large)} / ふつうの神社 ${sizes.medium}件 ${pct(sizes.medium)} / 小さな祠 ${sizes.small}件 ${pct(sizes.small)}`)
if (missing.length) console.log(`\n神社のデータがない都道府県: ${missing.join('、')}`)
