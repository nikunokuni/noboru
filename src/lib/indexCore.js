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
//   munis: ['世田谷区', ...], muni: [3, -1, ...],   // 市区町村（同じ名前の神社の区別用）。-1 は不明
//   locs:  ['上町', ...],     loc:  [0, -1, ...],   // 近くの地名（町・字など）。-1 は不明
//   deis:  ['素戔嗚尊', ...], dei:  [[0, 4], [], ...], // ご祭神（表記をそろえたもの）
// }
// munis 以降は後から足した項目。古い一覧ファイルにはないので、ないときは空として扱う

import { distanceM } from './geo.js'
import { normalizeDeities, deityKey, matchDeityNames } from './deities.js'

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
      .select('id, name, name_kana, prefecture, municipality, locality, deities, lat, lng, first_visited_on')
      .eq('status', 'active').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    onProgress(rows.length)
    if (data.length < PAGE) return rows
  }
}

// 同じ文字を何度も持たないよう、文字の表（list）の位置で表す。空なら -1
function stringTable() {
  const list = []
  const pos = new Map()
  const at = (s) => {
    if (!s) return -1
    if (!pos.has(s)) { pos.set(s, list.length); list.push(s) }
    return pos.get(s)
  }
  return { list, at }
}

export function encodeIndex(rows, { version, generatedAt = new Date().toISOString() }) {
  const prefs = stringTable()
  const munis = stringTable()
  const locs = stringTable()
  const deis = stringTable()
  const out = {
    format: INDEX_FORMAT, version, generated_at: generatedAt, prefs: prefs.list,
    id: [], name: [], kana: [], lat: [], lng: [], pref: [], vis: [],
    munis: munis.list, muni: [], locs: locs.list, loc: [], deis: deis.list, dei: [],
  }
  for (const r of rows) {
    out.id.push(Number(r.id))
    out.name.push(r.name)
    out.kana.push(r.name_kana || '')
    out.lat.push(Math.round(r.lat * SCALE))
    out.lng.push(Math.round(r.lng * SCALE))
    out.pref.push(prefs.at(r.prefecture))
    out.vis.push(r.first_visited_on ? 1 : 0)
    out.muni.push(munis.at(r.municipality))
    // 地名が市区町村と同じなら区別の役に立たないので入れない
    out.loc.push(r.locality && r.locality !== r.municipality ? locs.at(r.locality) : -1)
    // 古い表記で入っているご祭神も、そろえた表記で探せるようにする
    out.dei.push(normalizeDeities(r.deities).names.map(deis.at))
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

const fromTable = (list, i) => (list && i != null && i >= 0 ? list[i] : null)

// 保存用の生データに検索用の索引を付ける
export function prepareIndex(raw) {
  if (!raw || raw.format !== INDEX_FORMAT) return null
  const byId = new Map()
  const keys = new Array(raw.id.length)
  const placeKeys = new Array(raw.id.length)
  for (let i = 0; i < raw.id.length; i++) {
    byId.set(raw.id[i], i)
    keys[i] = normalize(raw.name[i]) + '\u0000' + normalize(raw.kana[i])
    placeKeys[i] = [fromTable(raw.munis, raw.muni?.[i]), fromTable(raw.locs, raw.loc?.[i]), raw.prefs[raw.pref[i]]]
      .map(normalize).join('\u0000')
  }
  return { raw, byId, keys, placeKeys, size: raw.id.length }
}

export function getItem(index, i) {
  const r = index.raw
  return {
    id: r.id[i],
    name: r.name[i],
    kana: r.kana[i],
    prefecture: r.prefs[r.pref[i]],
    municipality: fromTable(r.munis, r.muni?.[i]),
    locality: fromTable(r.locs, r.loc?.[i]),
    lat: r.lat[i] / SCALE,
    lng: r.lng[i] / SCALE,
    visited: r.vis[i] === 1,
  }
}

export function getById(index, id) {
  const i = index.byId.get(Number(id))
  return i == null ? null : getItem(index, i)
}

// ご祭神の検索語に当てはまる、一覧ファイルのご祭神の表（deis）の位置
//   辞書にある神様は別の書き方（「スサノオ」→ 素戔嗚尊）でも、辞書にない神様は名前の一部でも当てはまる
export function matchingDeities(index, query) {
  const list = index.raw.deis || []
  const k = deityKey(query)
  if (!k) return new Set()
  const known = new Set(matchDeityNames(query))
  const out = new Set()
  list.forEach((name, j) => { if (known.has(name) || deityKey(name).includes(k)) out.add(j) })
  return out
}

// 名前・読み仮名で検索。前方一致を先に並べる
//   「八幡 世田谷」のように空白で区切ると、2語目以降は市区町村・地名・都道府県にも当てはめる（どれか1語は名前に当たること）
//   deity: ご祭神で絞り込む（検索語）
//   include: 一覧の位置 i を受け取り、残すなら true を返す（自分の参拝だけ、など）
export function searchIndex(index, query, opts = {}) {
  return searchPositions(index, query, opts).map((i) => getItem(index, i))
}

// searchIndex と同じ条件で、当てはまる一覧の位置を返す（マップのピン用。limit: Infinity で全件）
export function searchPositions(index, query, { prefecture = null, unvisitedOnly = false, deity = null, include = null, limit = 50 } = {}) {
  const terms = (query || '').normalize('NFKC').split(/\s+/).map(normalize).filter(Boolean)
  const r = index.raw
  const prefPos = prefecture ? r.prefs.indexOf(prefecture) : -1
  if (prefecture && prefPos < 0) return []
  const deities = deity && deity.trim() ? matchingDeities(index, deity) : null
  if (deities && !deities.size) return []
  const head = []
  const rest = []
  for (let i = 0; i < index.size; i++) {
    if (prefPos >= 0 && r.pref[i] !== prefPos) continue
    if (unvisitedOnly && r.vis[i] === 1) continue
    if (deities && !(r.dei?.[i] || []).some((j) => deities.has(j))) continue
    if (include && !include(i)) continue
    if (terms.length) {
      const key = index.keys[i]
      const place = index.placeKeys[i]
      let inName = false
      let ok = true
      for (const t of terms) {
        if (key.includes(t)) inName = true
        else if (!place.includes(t)) { ok = false; break }
      }
      if (!ok || !inName) continue
      const q = terms[0]
      if (key.startsWith(q) || key.includes('\u0000' + q)) { head.push(i); if (head.length >= limit) break; continue }
    }
    if (rest.length < limit) rest.push(i)
    if (!terms.length && rest.length >= limit) break
  }
  return head.concat(rest).slice(0, limit)
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
