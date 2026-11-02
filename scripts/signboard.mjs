#!/usr/bin/env node
// 案内板の写真（photos.tag = 'signboard'）を集め、読んだ内容を神社詳細の空欄に入れる
// 手順は .claude/skills/signboard-to-shrine/SKILL.md
//
//   npm run signboard -- fetch                       空欄のある神社の案内板写真を集める（20社まで）
//   npm run signboard -- fetch --shrine 123,456      決めた神社だけ
//   npm run signboard -- fetch --pref 13 --limit 50  都道府県で絞る・社数を変える
//   npm run signboard -- apply <提案.json>           入れる内容を表示するだけ（書き込まない）
//   npm run signboard -- apply <提案.json> --write   空欄だけ shrine_edits に入れる
//
// 対象は公開記録の写真だけ（非公開記録の写真は使わない）
// 必要な環境変数（.env に書いてもよい）: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SIGNBOARD_EDITOR_USER_ID: 情報提供者として記録するユーザー（省略時は管理者が1人ならその人）

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { PREFECTURES } from '../src/lib/constants.js'
import { SIGNBOARD_FIELDS, blankFields, planEdits } from './lib/signboard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '.cache', 'signboard')
const DONE_FILE = join(OUT, 'done.json')

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    shrine: { type: 'string' },
    pref: { type: 'string' },
    limit: { type: 'string', default: '20' },
    'include-done': { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
  },
})

function supabaseAdmin() {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  return createClient(url, key, { auth: { persistSession: false } })
}

const SHRINE_COLUMNS = ['id', 'name', 'prefecture', 'municipality', 'status', ...SIGNBOARD_FIELDS].join(', ')

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(await readFile(path, 'utf8'))
}

// 都道府県の指定（「13」「東京都」）を名前に
function prefNames(spec) {
  if (!spec) return null
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    if (/^\d+$/.test(s)) {
      const name = PREFECTURES[Number(s) - 1]
      if (!name) throw new Error(`都道府県の番号が違います: ${s}`)
      return name
    }
    return s
  })
}

// 公開記録の案内板写真をすべて取る（新しい順）
async function signboardPhotos(db, shrineIds) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = db.from('photos')
      .select('id, path, created_at, records!inner(shrine_id, is_public)')
      .eq('tag', 'signboard').eq('records.is_public', true)
      .order('created_at', { ascending: false }).range(from, from + 999)
    if (shrineIds) q = q.in('records.shrine_id', shrineIds)
    const { data, error } = await q
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

async function fetchShrines(db, ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('shrines').select(SHRINE_COLUMNS).in('id', ids.slice(i, i + 200))
    if (error) throw error
    out.push(...data)
  }
  return new Map(out.map((s) => [s.id, s]))
}

async function cmdFetch(db) {
  const shrineIds = args.shrine ? args.shrine.split(',').map((s) => Number(s.trim())).filter(Boolean) : null
  const prefs = prefNames(args.pref)
  const limit = Number(args.limit) || 20
  const done = new Set(args['include-done'] ? [] : await readJson(DONE_FILE, []))

  const photos = (await signboardPhotos(db, shrineIds)).filter((p) => !done.has(p.id))
  const byShrine = new Map()
  for (const p of photos) {
    const id = p.records.shrine_id
    if (!byShrine.has(id)) byShrine.set(id, [])
    byShrine.get(id).push(p)
  }
  const shrines = await fetchShrines(db, [...byShrine.keys()])

  const targets = []
  for (const [id, list] of byShrine) {
    const s = shrines.get(id)
    if (!s || s.status !== 'active') continue
    if (prefs && !prefs.includes(s.prefecture)) continue
    const blank = blankFields(s)
    if (!blank.length) continue
    targets.push({ shrine: s, photos: list, blank })
    if (targets.length >= limit) break
  }

  const manifest = []
  let files = 0
  for (const { shrine: s, photos: list, blank } of targets) {
    const dir = join(OUT, String(s.id))
    await mkdir(dir, { recursive: true })
    const saved = []
    for (const p of list) {
      const { data, error } = await db.storage.from('photos').download(p.path)
      if (error) { console.warn(`  取れなかった写真 ${p.path}: ${error.message}`); continue }
      const file = join(dir, `${p.id}.jpg`)
      await writeFile(file, Buffer.from(await data.arrayBuffer()))
      saved.push({ id: p.id, file, created_at: p.created_at })
      files++
    }
    if (!saved.length) continue
    const filled = Object.fromEntries(SIGNBOARD_FIELDS.filter((f) => !blank.includes(f)).map((f) => [f, s[f]]))
    manifest.push({
      shrine_id: s.id, name: s.name, prefecture: s.prefecture, municipality: s.municipality,
      blank_fields: blank, filled, photos: saved,
    })
  }

  await mkdir(OUT, { recursive: true })
  const path = join(OUT, 'manifest.json')
  await writeFile(path, JSON.stringify(manifest, null, 2))
  console.log(`案内板の写真（公開記録）: ${photos.length}枚 / 神社 ${byShrine.size}社`)
  console.log(`空欄のある神社: ${manifest.length}社・写真 ${files}枚を保存 → ${path}`)
  if (done.size) console.log(`（処理済みの写真 ${done.size}枚は除いた。含めるなら --include-done）`)
}

async function editorUserId(db) {
  if (process.env.SIGNBOARD_EDITOR_USER_ID) return process.env.SIGNBOARD_EDITOR_USER_ID
  const { data, error } = await db.from('admins').select('user_id')
  if (error) throw error
  if (data.length === 1) return data[0].user_id
  throw new Error('情報提供者にするユーザーを SIGNBOARD_EDITOR_USER_ID で指定してください（管理者が1人ではありません）')
}

async function cmdApply(db) {
  const file = positionals[1]
  if (!file) throw new Error('提案ファイルを指定してください: npm run signboard -- apply <提案.json>')
  const proposals = JSON.parse(await readFile(resolve(file), 'utf8'))
  if (!Array.isArray(proposals)) throw new Error('提案ファイルは配列にしてください')

  const write = args.write
  const userId = write ? await editorUserId(db) : null
  const shrines = await fetchShrines(db, [...new Set(proposals.map((p) => p.shrine_id))])
  const done = new Set(await readJson(DONE_FILE, []))
  const report = [`# 案内板からの反映${write ? '' : '（下見・まだ書き込んでいません）'}`, '']
  let written = 0

  for (const p of proposals) {
    const s = shrines.get(p.shrine_id)
    if (!s) { report.push(`## #${p.shrine_id}`, '', '- 神社が見つかりません', ''); continue }
    const { rows, skipped } = planEdits(p, s, userId)
    report.push(`## ${s.name}（${s.prefecture}${s.municipality || ''}） #${s.id}`, '')
    for (const r of rows) report.push(`- 入れる ${r.field}: ${Array.isArray(r.value) ? r.value.join('、') : r.value}`)
    for (const k of skipped) report.push(`- 入れない ${k.field}: ${k.reason}`)
    if (!rows.length && !skipped.length) report.push('- 入れる項目なし')
    if (p.note) report.push(`- メモ: ${p.note}`)
    report.push('')

    if (write && rows.length) {
      const { error } = await db.from('shrine_edits').insert(rows)
      if (error) { report.push(`- **書き込めませんでした**: ${error.message}`, ''); continue }
      written += rows.length
    }
    if (write) for (const id of p.photo_ids || []) done.add(id)
  }

  await mkdir(OUT, { recursive: true })
  if (write) await writeFile(DONE_FILE, JSON.stringify([...done], null, 2))
  const reportPath = join(OUT, write ? 'report.md' : 'preview.md')
  await writeFile(reportPath, report.join('\n'))
  console.log(report.join('\n'))
  console.log(write ? `${written}項目を入れました → ${reportPath}` : `下見のみ。入れるときは --write → ${reportPath}`)
}

const db = supabaseAdmin()
const cmd = positionals[0]
if (cmd === 'fetch') await cmdFetch(db)
else if (cmd === 'apply') await cmdApply(db)
else {
  console.error('使い方: npm run signboard -- fetch [--shrine ID,..] [--pref 13] [--limit 20] | apply <提案.json> [--write]')
  process.exit(1)
}
