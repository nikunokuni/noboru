// アプリ全体で使う定数（ブラウザと取り込みスクリプトの両方から読む）

// 都道府県（配列の位置 + 1 が JIS コード。ISO 3166-2 は JP-01〜JP-47）
export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

export const prefectureIso = (index) => `JP-${String(index + 1).padStart(2, '0')}`

// 「現地で記録」とみなす神社からの距離（m）
export const ONSITE_RADIUS_M = 300

// 記録画面の「近くの神社」に出す範囲と件数
export const NEARBY_RADIUS_M = 3000
export const NEARBY_LIMIT = 8

// 徒歩の目安（m/分）
export const WALK_M_PER_MIN = 80

export const MAX_PHOTOS = 5

// 称号：参拝した神社の数（重複なし）
export const TITLES = [
  [0, '参拝初心者'], [5, '氏子'], [15, '神主見習い'], [30, '神主'], [50, '大神主'], [100, '神域の訪人'],
]

export function titleFor(shrineCount) {
  let current = TITLES[0][1]
  let next = null
  for (const [min, label] of TITLES) {
    if (shrineCount >= min) current = label
    else { next = { label, remaining: min - shrineCount }; break }
  }
  return { current, next }
}

export const PARKING_LABELS = {
  dedicated: '専用駐車場あり',
  nearby: '近くに駐車場あり',
  none: '駐車場なし',
  unknown: '不明',
}

export const GOSHUIN_LABELS = {
  direct_only: '直書き',
  written_only: '書き置き',
  both: '直書き・書き置き',
  available: 'あり',
  none: 'なし',
  unknown: '不明',
}

// 御朱印の値 ⇔ 直書き・書き置きの選択（両方選べる）
export function goshuinKinds(value) {
  return { direct: value === 'direct_only' || value === 'both', written: value === 'written_only' || value === 'both' }
}

export function goshuinFromKinds({ direct, written }) {
  if (direct && written) return 'both'
  if (direct) return 'direct_only'
  if (written) return 'written_only'
  return null
}

export function emotionLabel(value) {
  if (value >= 80) return '魂が震えた'
  if (value >= 60) return '深く感動した'
  if (value >= 40) return 'とても良かった'
  if (value >= 20) return '穏やかな気持ち'
  return '静かな気づき'
}

export function emotionColor(value) {
  if (value >= 75) return 'var(--vermillion)'
  if (value >= 45) return 'var(--gold)'
  return 'rgba(26,18,8,0.3)'
}

export function emotionMarks(value) {
  return value >= 75 ? '▲▲▲' : value >= 45 ? '▲▲' : '▲'
}
