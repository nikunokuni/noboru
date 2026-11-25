// コレクション：参拝した神社から自動で集まるもの（神様リストなど）
// ブラウザとテストの両方から使うため、外部依存なし
//
// リストを増やすときは COLLECTIONS に足し、そのページを App.jsx の /collection/<key> に置く

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

// 一覧ファイルのご祭神（deis）ごとに、祀る神社の数と、自分が集めたか
//   visits: firstVisits の結果
//   戻り値: [{ name, shrineCount, collected, collectedOn, myShrineIds }]（祀る神社の多い順。同じなら名前順）
export function deityCollection(index, visits = new Map()) {
  const r = index?.raw
  const names = r?.deis || []
  const counts = new Array(names.length).fill(0)
  const mine = names.map(() => [])
  for (let i = 0; i < (r?.id.length || 0); i++) {
    const list = r.dei?.[i]
    if (!list?.length) continue
    const visited = visits.has(r.id[i])
    for (const j of list) {
      counts[j]++
      if (visited) mine[j].push(r.id[i])
    }
  }
  return names.map((name, j) => {
    const dates = mine[j].map((id) => visits.get(id)).filter(Boolean).sort()
    return {
      name,
      shrineCount: counts[j],
      collected: mine[j].length > 0,
      collectedOn: dates[0] || null,
      myShrineIds: mine[j],
    }
  }).filter((d) => d.shrineCount > 0)
    .sort((a, b) => b.shrineCount - a.shrineCount || a.name.localeCompare(b.name, 'ja'))
}

// この神様を祀る神社の一覧の位置（神様の詳細用）
export function deityShrinePositions(index, name) {
  const r = index?.raw
  const j = (r?.deis || []).indexOf(name)
  if (j < 0) return []
  const out = []
  for (let i = 0; i < r.id.length; i++) if (r.dei?.[i]?.includes(j)) out.push(i)
  return out
}

// その神社を参拝して新しく集まる神様（記録した直後のお知らせ用）
//   otherShrineIds: この記録より前から参拝していた神社のID
export function newDeitiesFor(index, shrineId, otherShrineIds) {
  const r = index?.raw
  const i = index?.byId?.get(Number(shrineId))
  if (i == null || !r.dei?.[i]?.length) return []
  const others = new Set([...otherShrineIds].map(Number))
  others.delete(Number(shrineId))
  const have = new Set()
  for (const id of others) {
    const k = index.byId.get(id)
    if (k != null) for (const j of r.dei?.[k] || []) have.add(j)
  }
  return r.dei[i].filter((j) => !have.has(j)).map((j) => r.deis[j])
}
