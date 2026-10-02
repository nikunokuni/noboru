// 日付の表示など

// 端末の現地時間での今日（YYYY-MM-DD）
export function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 'YYYY-MM-DD' → '2026年10月2日'
export function formatDate(s) {
  if (!s) return ''
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function percent(part, total) {
  if (!total) return '0'
  const v = (part / total) * 100
  return v > 0 && v < 0.1 ? '0.1未満' : v.toFixed(1)
}
