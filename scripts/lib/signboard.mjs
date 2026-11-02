// 案内板の写真から読んだ内容を、神社詳細の「空欄の項目だけ」に入れるための決まりごと
// scripts/signboard.mjs と、そのテストから使う（外部依存なし）

import { normalizeDeities } from '../../src/lib/deities.js'

// 案内板から埋める項目（shrine_edits.field と同じ名前）。並びは提案ファイルの並び
export const SIGNBOARD_FIELDS = [
  'name_kana', 'deities', 'benefits', 'shrine_rank', 'founded', 'annual_festival', 'honden_style', 'highlights', 'features',
]

// 由緒（features）は要約して入れる。長すぎるものは断る
export const FEATURES_MAX = 400
const TEXT_MAX = 200

// 項目が空か（文字は空白だけでも空、ご利益は配列が空なら空）
export function isBlank(field, value) {
  if (field === 'benefits') return !Array.isArray(value) || value.every((s) => !String(s ?? '').trim())
  return value == null || String(value).trim() === ''
}

// その神社でまだ空の項目
export const blankFields = (shrine) => SIGNBOARD_FIELDS.filter((f) => isBlank(f, shrine[f]))

// 提案の値を、情報提供の画面で送るのと同じ形にそろえる。使えなければ { error }
export function normalizeValue(field, value) {
  if (field === 'benefits') {
    const list = (Array.isArray(value) ? value : String(value ?? '').split(/[、,，]/))
      .map((s) => String(s).normalize('NFKC').trim()).filter(Boolean)
    const uniq = [...new Set(list)]
    return uniq.length ? { value: uniq } : { error: '空です' }
  }
  if (typeof value !== 'string') return { error: '文字で書いてください' }
  const text = value.trim()
  if (!text) return { error: '空です' }
  if (field === 'deities') return { value: normalizeDeities(text).text }
  if (field === 'name_kana' && !/^[\p{Script=Hiragana}ー\s・]+$/u.test(text)) return { error: 'ひらがなで書いてください' }
  if (field === 'features' && text.length > FEATURES_MAX) {
    return { error: `由緒は要約して ${FEATURES_MAX} 字以内にしてください（${text.length} 字）` }
  }
  if (field !== 'features' && field !== 'highlights' && text.length > TEXT_MAX) return { error: `${TEXT_MAX} 字以内にしてください` }
  return { value: text }
}

// 提案（{ shrine_id, fields: { 項目: 値 } }）を、今の神社の値と照らして shrine_edits の行にする
//   空の項目だけ入れる。埋まっている項目・知らない項目・使えない値は skipped に理由を付けて返す
export function planEdits(proposal, shrine, userId) {
  const rows = []
  const skipped = []
  for (const [field, raw] of Object.entries(proposal.fields || {})) {
    if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) continue   // 読めなかった項目は書かないでよい
    if (!SIGNBOARD_FIELDS.includes(field)) { skipped.push({ field, reason: '案内板からは入れない項目です' }); continue }
    if (!isBlank(field, shrine[field])) { skipped.push({ field, reason: 'すでに入っています', current: shrine[field] }); continue }
    const { value, error } = normalizeValue(field, raw)
    if (error) { skipped.push({ field, reason: error }); continue }
    rows.push({ shrine_id: shrine.id, user_id: userId, field, value })
  }
  return { rows, skipped }
}
