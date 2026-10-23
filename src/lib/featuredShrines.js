// 今日の神社：「記録する」タブの一番上で紹介する神社の候補
// 候補の中から日付ごとに1社を選ぶ（同じ日は何度開いても同じ神社）
//
// 候補の書き方:
//   { id: 神社のID（/shrine/:id の数字）, image: '画像のURL', text: '紹介文' }
//   id がわからないときは、id の代わりに name・prefecture・municipality（市区町村）で書けば、その名前の神社を探して使う
//   image … 省略すると、その神社の本殿の写真（みんなの記録から）を使う。public/ に置いた画像は '/featured/xxx.jpg' のように書く
//   text  … 省略すると、神社の「見どころ」→「由緒」の順に使う
// 候補が空のあいだは、今日の神社は表示しない
export const FEATURED_SHRINES = [
  {
    name: '寒川神社', prefecture: '神奈川県', municipality: '寒川町',
    text: 'ここはリセットしたい人がいくところ。\n借金・人間関係・仕事全部詰まってる人、流れが変わると言われてる',
  },
  {
    id: 4171, // 蛇窪神社（品川区）
    text: 'ここは金運を上げたい人がいくところ。\n白蛇さまの清水でお金を洗って、種銭をお財布に入れて帰る',
  },
]

// 名前で書いた候補を、検索結果から1社に決める（名前が同じで、都道府県・市区町村が合うもの）
export function matchFeatured(candidate, items) {
  return items.find((s) => s.name === candidate.name
    && (!candidate.prefecture || s.prefecture === candidate.prefecture)
    && (!candidate.municipality || s.municipality === candidate.municipality)) || null
}

// その日の日付（端末の時刻で YYYY-MM-DD）
export const localDateKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

// 日付から候補を1つ選ぶ。日付の文字列を数にして候補の数で割った余り（連続した日でも散らばるようにかき混ぜる）
export function pickFeatured(candidates, dateKey) {
  if (!candidates.length) return null
  let h = 2166136261
  for (const c of dateKey) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return candidates[(h >>> 0) % candidates.length]
}
