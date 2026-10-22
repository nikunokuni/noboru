// 共有ボタン（URLをコピー・Xで共有）。アプリの紹介と神社の紹介で使う
import React from 'react'
import { useToast } from '../hooks/useToast'

export const APP_SHARE_TEXT = 'ノボル｜神社参拝を記録し、みんなで全国の神社を巡るアプリ'

// path はアプリ内のパス（'/' や '/shrine/123'）。今開いているドメインの URL にする
export const shareUrl = (path) => new URL(path, window.location.origin).href

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 古いブラウザや http では clipboard API が使えない
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}

export default function ShareButtons({ url, text, className = '' }) {
  const { showToast } = useToast()
  const xUrl = `https://x.com/intent/post?${new URLSearchParams({ text, url })}`

  const copy = async () => {
    showToast(await copyText(url) ? 'URLをコピーしました' : 'コピーできませんでした')
  }

  return (
    <div className={`share-row ${className}`}>
      <button className="btn-secondary" onClick={copy}>URLをコピー</button>
      <a className="btn-secondary" href={xUrl} target="_blank" rel="noopener noreferrer">Xで共有</a>
    </div>
  )
}
