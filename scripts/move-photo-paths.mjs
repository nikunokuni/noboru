#!/usr/bin/env node
// 写真のパスを <user_id>/<record_id>/<n>.jpg から <record_id>/<n>.jpg に移す（1回だけ実行。何度実行しても大丈夫）
// 公開記録の写真のパスから、誰の記録か（user_id）が分からないようにするため
//
//   npm run move:photos -- --dry-run   … 移す件数だけ表示
//   npm run move:photos                … 移す
//
// 必要な環境変数（.env に書いてもよい）: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const { values: args } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })

function supabaseAdmin() {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  return createClient(url, key, { auth: { persistSession: false } })
}

// 以前の形（区切りが2つ）の写真をすべて取る
async function oldPhotos(db) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('photos').select('id, record_id, path')
      .like('path', '%/%/%').order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

async function exists(db, path) {
  const [folder, name] = path.split('/')
  const { data } = await db.storage.from('photos').list(folder, { search: name })
  return !!data?.some((f) => f.name === name)
}

const db = supabaseAdmin()
const rows = await oldPhotos(db)
console.log(`移す写真: ${rows.length}件`)
if (args['dry-run'] || !rows.length) process.exit(0)

let moved = 0
let failed = 0
for (const row of rows) {
  const to = `${row.record_id}/${row.path.split('/').pop()}`
  const { error: mvErr } = await db.storage.from('photos').move(row.path, to)
  // 前回の途中で移し終えていて、表の更新だけ残っている場合もある
  if (mvErr && !(await exists(db, to))) {
    failed++
    console.error(`失敗: ${row.path} → ${to}: ${mvErr.message}`)
    continue
  }
  const { error } = await db.from('photos').update({ path: to }).eq('id', row.id)
  if (error) {
    failed++
    console.error(`表の更新に失敗: ${row.path} → ${to}: ${error.message}`)
    continue
  }
  moved++
  if (moved % 100 === 0) console.log(`${moved}件 移しました`)
}
console.log(`完了: ${moved}件 移しました${failed ? `、${failed}件 失敗（もう一度実行してください）` : ''}`)
process.exit(failed ? 1 : 0)
