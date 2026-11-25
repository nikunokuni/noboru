// コレクション：参拝した神社から自動で集まるもの（神様リストなど）
// ブラウザとテストの両方から使うため、外部依存なし
//
// 一覧ファイルのご祭神は作ったときの辞書でそろえてある。あとから辞書に足した書き方（伊奘諾尊 など）も
// 同じ神様として数えるよう、ここで代表の表記にそろえ直す
//
// リストを増やすときは COLLECTIONS に足し、そのページを App.jsx の /collection/<key> に置く

import { canonicalDeity } from './deities.js'

export const COLLECTIONS = [
  { key: 'deities', label: '神様リスト', note: 'マップの神社のご祭神。祀られている神社を参拝すると集まる', to: '/collection/deities' },
]

// 自分の参拝（送信済みの記録と未送信の記録）から、神社ごとの最初の参拝日
//   records: [{ shrine_id, visited_on }]。戻り値: Map(神社ID → 'YYYY-MM-DD')
export function firstVisits(records) {
  const out = new Map()
  for (const r of records || []) {
    const id = Number(r.shrine_id)
    if (!id) continue
    const prev = out.get(id)
    if (!prev || (r.visited_on && r.visited_on < prev)) out.set(id, r.visited_on || prev || '')
  }
  return out
}

// 一覧ファイルのご祭神の表（deis）の位置 → 代表の表記。一覧ごとに1回だけ作る
const canonCache = new WeakMap()
function canonNames(raw) {
  if (!canonCache.has(raw)) canonCache.set(raw, (raw.deis || []).map(canonicalDeity))
  return canonCache.get(raw)
}

// 一覧の位置 i の神社が祀る神様（代表の表記、重なりなし）
function shrineDeities(raw, i) {
  const canon = canonNames(raw)
  return [...new Set((raw.dei?.[i] || []).map((j) => canon[j]))]
}

// ご祭神ごとに、祀る神社の数と、自分が集めたか
//   visits: firstVisits の結果
//   戻り値: [{ name, shrineCount, collected, collectedOn, myShrineIds }]（祀る神社の多い順。同じなら名前順）
export function deityCollection(index, visits = new Map()) {
  const r = index?.raw
  const byName = new Map()
  for (let i = 0; i < (r?.id.length || 0); i++) {
    const visited = visits.has(r.id[i])
    for (const name of shrineDeities(r, i)) {
      if (!byName.has(name)) byName.set(name, { name, shrineCount: 0, myShrineIds: [] })
      const d = byName.get(name)
      d.shrineCount++
      if (visited) d.myShrineIds.push(r.id[i])
    }
  }
  return [...byName.values()].map((d) => {
    const dates = d.myShrineIds.map((id) => visits.get(id)).filter(Boolean).sort()
    return { ...d, collected: d.myShrineIds.length > 0, collectedOn: dates[0] || null }
  }).sort((a, b) => b.shrineCount - a.shrineCount || a.name.localeCompare(b.name, 'ja'))
}

// この神様を祀る神社の一覧の位置（神様の詳細用）
export function deityShrinePositions(index, name) {
  const r = index?.raw
  const out = []
  for (let i = 0; i < (r?.id.length || 0); i++) if (shrineDeities(r, i).includes(name)) out.push(i)
  return out
}

// その神社を参拝して新しく集まる神様（記録した直後のお知らせ用）
//   otherShrineIds: この記録より前から参拝していた神社のID
export function newDeitiesFor(index, shrineId, otherShrineIds) {
  const r = index?.raw
  const i = index?.byId?.get(Number(shrineId))
  if (i == null) return []
  const others = new Set([...otherShrineIds].map(Number))
  others.delete(Number(shrineId))
  const have = new Set()
  for (const id of others) {
    const k = index.byId.get(id)
    if (k != null) for (const name of shrineDeities(r, k)) have.add(name)
  }
  return shrineDeities(r, i).filter((name) => !have.has(name))
}
