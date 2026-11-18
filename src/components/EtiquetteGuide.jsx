// 参拝作法の図解。日本語・英語・中国語をタブで切り替える
// 画像は src/assets/etiquette/<言語>/ に置けば自動で加わる（ファイル名の順に並ぶ）
// 言語を増やすときは LANGS に足し、同じ名前のフォルダを作る
import React, { useState } from 'react'
import Lightbox from './Lightbox'

const LANGS = [
  { key: 'ja', label: '日本語' },
  { key: 'en', label: 'English' },
  { key: 'zh', label: '中文' },
]

const FILES = import.meta.glob('../assets/etiquette/*/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
const IMAGES = {}
for (const path of Object.keys(FILES).sort()) {
  const lang = path.split('/').at(-2)
  ;(IMAGES[lang] ||= []).push(FILES[path])
}
// 画像がある言語だけタブに出す
const TABS = LANGS.filter((l) => IMAGES[l.key]?.length)

export default function EtiquetteGuide() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState(TABS[0]?.key)
  const [zoom, setZoom] = useState(null)
  if (!TABS.length) return null
  const images = IMAGES[lang] || []

  return (
    <div className="etiquette">
      <button type="button" className="text-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        ⛩ 参拝作法{open ? ' ▲' : ' ▼'}
      </button>
      {open && (
        <>
          {TABS.length > 1 && (
            <div className="tab-row" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={lang === t.key}
                  className={`tab-btn${lang === t.key ? ' active' : ''}`} onClick={() => setLang(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {images.map((src, i) => (
            <img key={src} src={src} alt="参拝作法の図解" className="etiquette-img" loading="lazy"
              onClick={() => setZoom(i)} />
          ))}
          <p className="muted small center">画像を押すと大きく見られます</p>
        </>
      )}
      {zoom != null && <Lightbox urls={images} start={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}
