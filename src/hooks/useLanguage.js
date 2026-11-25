// 表示する言語（参拝の手引きの図解などで使う）。この端末に保存する
// 言語を増やすときは LANGS に足し、図解を src/assets/guide/<key>/ に置く
import { useSyncExternalStore } from 'react'

export const LANGS = [
  { key: 'ja', label: '日本語' },
  { key: 'en', label: 'English' },
  { key: 'zh', label: '中文' },
]

const KEY = 'noboru.language'
const listeners = new Set()

function read() {
  try {
    const v = localStorage.getItem(KEY)
    if (LANGS.some((l) => l.key === v)) return v
  } catch { /* 読めなくても日本語で動く */ }
  return 'ja'
}

let current = read()

export function setLanguage(lang) {
  current = lang
  try { localStorage.setItem(KEY, lang) } catch { /* 保存できなくても動く */ }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

export function useLanguage() {
  return useSyncExternalStore(subscribe, () => current, () => 'ja')
}
