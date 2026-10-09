// 情報提供で選ぶタグ（社格・本殿の様式・ご祭神・ご利益）
// 選択肢にないものは「その他」として書き足せる。保存は今までどおり文字（「、」区切り）/ 配列
// ブラウザとテストの両方から使うため、外部依存なし

import { DEITIES, normalizeDeities } from './deities.js'

export const RANK_OPTIONS = [
  '名神大社', '式内大社', '式内小社', '式外社', '一宮', '二宮', '総社', '二十二社', '勅祭社', '別表神社',
  '旧官幣大社', '旧官幣中社', '旧官幣小社', '旧国幣大社', '旧国幣中社', '旧国幣小社', '旧別格官幣社',
  '旧府社', '旧県社', '旧郷社', '旧村社', '旧無格社',
]

export const HONDEN_OPTIONS = [
  '流造', '春日造', '神明造', '大社造', '住吉造', '八幡造', '権現造', '日吉造', '祇園造',
  '両流造', '入母屋造', '切妻造', '大鳥造', '浅間造', '吉備津造', '尾張造', '香椎造',
]

export const BENEFIT_OPTIONS = [
  '縁結び', '厄除け', '開運', '家内安全', '商売繁盛', '学業成就', '合格祈願', '安産', '子授け', '健康長寿',
  '病気平癒', '交通安全', '仕事運', '金運', '必勝祈願', '五穀豊穣', '芸能上達', '航海安全', '火除け', '縁切り',
]

// よく祀られる神様を先に、残りは辞書の順
const POPULAR_DEITIES = [
  '天照大御神', '誉田別命', '宇迦之御魂神', '素戔嗚尊', '大国主命', '菅原道真公',
  '大山祇神', '息長帯姫命', '建御名方命', '少彦名命', '事代主命', '武甕槌命',
]
export const DEITY_OPTIONS = [...new Set([...POPULAR_DEITIES, ...DEITIES.map((d) => d[0])])]

// 漢字の名前に、わかりやすいカタカナの呼び名を添える（天照大御神（アマテラス））
const KATAKANA = /^[ァ-ヶー]+$/
export const deityLabel = (name) => {
  const alias = DEITIES.find((d) => d[0] === name)?.find((s) => KATAKANA.test(s))
  return alias ? `${name}（${alias}）` : name
}

// 文字の欄 → タグの配列
export const splitTags = (text) =>
  [...new Set((text || '').split(/[、,，・\n]/).map((s) => s.trim()).filter(Boolean))]

export const splitDeityTags = (text) => normalizeDeities(text).names
