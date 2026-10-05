// 神社一覧ファイル（軽い一覧）の形式と、検索・近くの神社の計算
// ブラウザと取り込みスクリプトの両方から使うため、外部依存なし
//
// 形式（列ごとの配列にしてサイズを抑える）:
// {
//   format: 1, version: '...', generated_at: ISO文字列,
//   prefs: ['北海道', ...],          // pref の参照先
//   id:   [1, 2, ...],
//   name: ['〇〇神社', ...],
//   kana: ['まるまるじんじゃ', ...],  // 不明は ''
//   lat:  [3568123, ...],             // 緯度 × 1e5 の整数
//   lng:  [13976543, ...],
//   pref: [12, ...],                  // prefs の位置
//   vis:  [0, 1, ...],                // 誰かが参拝済みなら 1
// }

import { distanceM } from './geo.js'

export const INDEX_FORMAT = 1
const SCALE = 1e5

// 一覧ファイルの版。作った時刻（UTC）の YYYYMMDDHHMMSS
export const newIndexVersion = (now = new Date()) => now.toISOString().replace(/\D/g, '').slice(0, 14)

// 版から作った時刻を戻す。時刻の形でなければ null
export function indexVersionDate(version) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(version || '')
  return m ? new Date(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6])) : null
}

// 一覧ファイルに入れる神社（status = 'active'）を DB から全件取る。db は supabase-js のクライアント
export async function fetchIndexRows(db, onProgress = () => {}) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('shrines')
      .select('id, name, name_kana, prefecture, lat, lng, first_visited_on')
      .eq('status', 'active').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    onProgress(rows.length)
    if (data.length < PAGE) return rows
  }
}

export function encodeIndex(rows, { version, generatedAt = new Date().toISOString() }) {
  const prefs = []
  const prefPos = new Map()
  const out = { format: INDEX_FORMAT, version, generated_at: generatedAt, prefs, id: [], name: [], kana: [], lat: [], lng: [], pref: [], vis: [] }
  for (const r of rows) {
    if (!prefPos.has(r.prefecture)) { prefPos.set(r.prefecture, prefs.length); prefs.push(r.prefecture) }
    out.id.push(Number(r.id))
    out.name.push(r.name)
    out.kana.push(r.name_kana || '')
    out.lat.push(Math.round(r.lat * SCALE))
    out.lng.push(Math.round(r.lng * SCALE))
    out.pref.push(prefPos.get(r.prefecture))
    out.vis.push(r.first_visited_on ? 1 : 0)
  }
  return out
}

// ひらがな・カタカナ、全角・半角、空白の違いを吸収
export function normalize(s) {
  return (s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･]/g, '')
}

// 保存用の生データに検索用の索引を付ける
export function prepareIndex(raw) {
  if (!raw || raw.format !== INDEX_FORMAT) return null
  const byId = new Map()
  const keys = new Array(raw.id.length)
  for (let i = 0; i < raw.id.length; i++) {
    byId.set(raw.id[i], i)
    keys[i] = normalize(raw.name[i]) + '\u0000' + normalize(raw.kana[i])
  }
  return { raw, byId, keys, size: raw.id.length }
}

export function getItem(index, i) {
  const r = index.raw
  return {
    id: r.id[i],
    name: r.name[i],
    kana: r.kana[i],
    prefecture: r.prefs[r.pref[i]],
    lat: r.lat[i] / SCALE,
    lng: r.lng[i] / SCALE,
    visited: r.vis[i] === 1,
  }
}

export function getById(index, id) {
  const i = index.byId.get(Number(id))
  return i == null ? null : getItem(index, i)
}

// 名前・読み仮名で検索。前方一致を先に並べる
export function searchIndex(index, query, { prefecture = null, unvisitedOnly = false, limit = 50 } = {}) {
  const q = normalize(query)
  const r = index.raw
  const prefPos = prefecture ? r.prefs.indexOf(prefecture) : -1
  if (prefecture && prefPos < 0) return []
  const head = []
  const rest = []
  for (let i = 0; i < index.size; i++) {
    if (prefPos >= 0 && r.pref[i] !== prefPos) continue
    if (unvisitedOnly && r.vis[i] === 1) continue
    if (q) {
      const key = index.keys[i]
      const pos = key.indexOf(q)
      if (pos < 0) continue
      if (pos === 0 || key.indexOf('\u0000' + q) >= 0) { head.push(i); if (head.length >= limit) break; continue }
    }
    if (rest.length < limit) rest.push(i)
    if (!q && rest.length >= limit) break
  }
  return head.concat(rest).slice(0, limit).map((i) => getItem(index, i))
}

// 近くの神社（距離順）
export function nearbyIndex(index, lat, lng, { radiusM = 3000, limit = 8 } = {}) {
  const r = index.raw
  const dLat = (radiusM / 111000) * SCALE
  const dLng = (radiusM / (111000 * Math.cos((lat * Math.PI) / 180))) * SCALE
  const la = lat * SCALE
  const ln = lng * SCALE
  const found = []
  for (let i = 0; i < index.size; i++) {
    if (Math.abs(r.lat[i] - la) > dLat || Math.abs(r.lng[i] - ln) > dLng) continue
    const d = distanceM(lat, lng, r.lat[i] / SCALE, r.lng[i] / SCALE)
    if (d <= radiusM) found.push([d, i])
  }
  found.sort((a, b) => a[0] - b[0])
  return found.slice(0, limit).map(([d, i]) => ({ ...getItem(index, i), distance: d }))
}

// 参拝済みフラグを更新（差分取得の結果を反映）
export function applyVisited(index, changes) {
  let changed = 0
  for (const { id, visited } of changes) {
    const i = index.byId.get(Number(id))
    if (i == null) continue
    const v = visited ? 1 : 0
    if (index.raw.vis[i] !== v) { index.raw.vis[i] = v; changed++ }
  }
  return changed
}
