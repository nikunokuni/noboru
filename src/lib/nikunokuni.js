// にくのくにリスト：作者（にくのくに）が思い入れのある神社と、そのエピソード
// 参拝者がその神社を参拝して記録すると集まり、エピソードを読めるようになる
// ブラウザとテストの両方から使うため、外部依存なし
//
// 神社の書き方（1社ずつ足していく）:
//   key        … URL に使う英数字（/collection/nikunokuni/<key>）。あとから変えない
//   name・prefecture・municipality … 一覧ファイルの神社を探す名前・都道府県・市区町村（今日の神社と同じ探し方）
//   id         … 神社のID（/shrine/:id の数字）がわかるときは書く（名前より先に使う）
//   lead       … 集める前にも見せる一言
//   episode    … エピソード（段落ごとに配列。集めると読める）
//   photos     … public/ に置いた写真（'/nikunokuni/<key>/1.webp' のように書く。集めると見られる）。caption は写真の説明
//   written    … 書いた日（YYYY-MM-DD）
export const NIKUNOKUNI_SHRINES = [
  {
    key: 'izumo-taisha',
    name: '出雲大社', prefecture: '島根県', municipality: '出雲市',
    lead: '僕が神社参拝を始めたころに参拝した神社',
    episode: [
      '僕が神社参拝を始めたころに参拝した神社。',
      '向かう電車でふと窓の外を撮ってみると窓が全面緑色に。',
      '出雲大社につくと神様に歓迎されているような不思議な感覚があった。',
      '空は晴天で、ちょうど拝殿の上には２匹の龍のような雲が見えた。',
      '神様の力を信じるきっかけになったし、その当時ちょっと落ち込んでいたが、元気をもらえてまた前を向くきっかけをいただくことができた。',
    ],
    photos: [
      { src: '/nikunokuni/izumo-taisha/1.webp', caption: '向かう電車の窓が緑色に' },
      { src: '/nikunokuni/izumo-taisha/2.webp', caption: '拝殿の上に2匹の龍のような雲' },
      { src: '/nikunokuni/izumo-taisha/3.webp', caption: '境内のうさぎ' },
    ],
    written: '2026-11-25',
  },
]

export const nikunokuniPath = (key) => `/collection/nikunokuni/${encodeURIComponent(key)}`
export const findNikunokuni = (key) => NIKUNOKUNI_SHRINES.find((s) => s.key === key) || null

// リストの神社を一覧ファイルの位置に決める（id があれば id、なければ名前・都道府県・市区町村が合うもの）
//   戻り値: 一覧の位置 | null（マップの中にない）
export function nikunokuniPosition(index, entry) {
  const r = index?.raw
  if (!r) return null
  if (entry.id != null) return index.byId?.get(Number(entry.id)) ?? null
  for (let i = 0; i < r.id.length; i++) {
    if (r.name[i] !== entry.name) continue
    if (entry.prefecture && r.prefs[r.pref[i]] !== entry.prefecture) continue
    if (entry.municipality && (r.munis?.[r.muni?.[i]] ?? null) !== entry.municipality) continue
    return i
  }
  return null
}

// リストの神社ごとに、一覧ファイルの神社と、自分が集めたか
//   visits: firstVisits の結果（Map(神社ID → 最初の参拝日)）
//   戻り値: [{ ...entry, shrineId, collected, collectedOn }]（リストの順）
export function nikunokuniCollection(index, visits = new Map()) {
  return NIKUNOKUNI_SHRINES.map((entry) => {
    const i = nikunokuniPosition(index, entry)
    const shrineId = i == null ? (entry.id != null ? Number(entry.id) : null) : index.raw.id[i]
    const collected = shrineId != null && visits.has(shrineId)
    return { ...entry, shrineId, collected, collectedOn: collected ? visits.get(shrineId) || null : null }
  })
}

// その神社を初めて参拝して読めるようになるエピソード（記録した直後のお知らせ用）
//   otherShrineIds: この記録より前から参拝していた神社のID
export function newNikunokuniFor(index, shrineId, otherShrineIds) {
  const id = Number(shrineId)
  if ([...otherShrineIds].some((o) => Number(o) === id)) return []
  return nikunokuniCollection(index).filter((e) => e.shrineId === id)
}
