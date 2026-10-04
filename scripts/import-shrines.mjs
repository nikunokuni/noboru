#!/usr/bin/env node
// 神社マスタの取り込み
//
// 使い方（詳しくは scripts/README.md）:
//   node scripts/import-shrines.mjs --pref 13            東京都だけ取り込む
//   node scripts/import-shrines.mjs --pref 13,14 --dry-run   DBに入れず scripts/out/ にJSONを書く
//   node scripts/import-shrines.mjs --all                全都道府県
//   node scripts/import-shrines.mjs --index-only         神社一覧ファイルだけ作り直す
//
// 必要な環境変数（.env に書いてもよい）: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { PREFECTURES, prefectureIso } from '../src/lib/constants.js'
import { encodeIndex } from '../src/lib/indexCore.js'
import { fetchOverpass } from './lib/overpass.mjs'
import { processPrefecture } from './lib/process.mjs'
import { enrichWithWiki } from './lib/wiki.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const USER_AGENT = 'noboru-shrine-import/0.1 (https://github.com/nikunokuni/noboru)'
const log = (...a) => console.log(...a)

const { values: args } = parseArgs({
  options: {
    pref: { type: 'string' },
    all: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'skip-wiki': { type: 'boolean', default: false },
    'index-only': { type: 'boolean', default: false },
    'no-index': { type: 'boolean', default: false },
    'no-cache': { type: 'boolean', default: false },
    input: { type: 'string' },
    endpoint: { type: 'string' },
  },
})

function targetPrefectures() {
  if (args.all) return PREFECTURES.map((_, i) => i)
  if (!args.pref) return []
  return args.pref.split(',').map((s) => {
    const n = Number(s.trim())
    if (!Number.isInteger(n) || n < 1 || n > 47) throw new Error(`--pref は 1〜47 で指定してください: ${s}`)
    return n - 1
  })
}

function supabaseAdmin() {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function importPrefecture(prefIndex, db) {
  const prefecture = PREFECTURES[prefIndex]
  const iso = prefectureIso(prefIndex)
  log(`■ ${prefecture} (${iso})`)

  const overpass = args.input
    ? JSON.parse(await readFile(args.input, 'utf8'))
    : await fetchOverpass(iso, {
      endpoint: args.endpoint,
      userAgent: USER_AGENT,
      cacheFile: args['no-cache'] ? null : join(HERE, '.cache', `${iso}.json`),
      log,
    })

  const { rows, excluded } = processPrefecture(overpass.elements || [], prefecture)
  log(`  神社: ${rows.length}件（境内社として除外: ${excluded}件）`)

  if (!args['skip-wiki']) await enrichWithWiki(rows, { userAgent: USER_AGENT, log })

  const dbRows = rows.map(({ wikipedia_title, ...r }) => r)

  if (args['dry-run']) {
    const file = join(HERE, 'out', `${iso}.json`)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(dbRows, null, 1))
    log(`  → ${file}`)
    return dbRows
  }

  let done = 0
  for (let i = 0; i < dbRows.length; i += 500) {
    const { error } = await db.rpc('import_shrines', { rows: dbRows.slice(i, i + 500) })
    if (error) throw new Error(`import_shrines: ${error.message}`)
    done += Math.min(500, dbRows.length - i)
  }
  log(`  DBに反映: ${done}件`)
  return dbRows
}

async function fetchAllShrines(db) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('shrines')
      .select('id, name, name_kana, prefecture, lat, lng, first_visited_on')
      .eq('status', 'active').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

const newVersion = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

async function buildIndex(rows, db) {
  const version = newVersion()
  const json = JSON.stringify(encodeIndex(rows, { version }))
  const gz = gzipSync(json, { level: 9 })
  log(`■ 神社一覧ファイル: ${rows.length}件 / ${(json.length / 1e6).toFixed(2)}MB（gzip後 ${(gz.length / 1e6).toFixed(2)}MB）`)

  if (!db) {
    const file = join(HERE, 'out', `shrines-index.${version}.json.gz`)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, gz)
    log(`  → ${file}`)
    return
  }

  const path = `shrines-index.${version}.json.gz`
  const { error: upErr } = await db.storage.from('public-data').upload(path, gz, {
    contentType: 'application/gzip', cacheControl: '31536000', upsert: true,
  })
  if (upErr) throw new Error(`アップロード失敗: ${upErr.message}`)
  const { error: metaErr } = await db.from('app_meta').upsert({ key: 'shrine_index_version', value: version })
  if (metaErr) throw new Error(`app_meta 更新失敗: ${metaErr.message}`)
  log(`  → public-data/${path}（バージョン ${version}）`)
}

async function main() {
  const prefs = targetPrefectures()
  if (!prefs.length && !args['index-only']) {
    log('--pref <番号> / --all / --index-only のいずれかを指定してください（例: --pref 13 は東京都）')
    process.exit(1)
  }
  if (args.input && prefs.length !== 1) throw new Error('--input は --pref で1つの都道府県を指定したときだけ使えます')

  const db = args['dry-run'] ? null : supabaseAdmin()
  const dryRows = []

  for (const [i, p] of prefs.entries()) {
    if (i && !args.input) await new Promise((r) => setTimeout(r, 10000)) // Overpass への配慮
    const rows = await importPrefecture(p, db)
    if (args['dry-run']) dryRows.push(...rows)
  }

  if (args['no-index']) return
  if (args['dry-run']) {
    // 試算用：仮の連番IDでファイルサイズを確認
    await buildIndex(dryRows.map((r, i) => ({ ...r, id: i + 1 })), null)
  } else {
    await buildIndex(await fetchAllShrines(db), db)
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
