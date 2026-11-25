// 参拝の手引き（図解）：項目の一覧を出し、押すとその図解を大きく出す
// マイページで選んだ言語の図解・項目名を出す（その言語の図解がない項目は出さない）
// 項目を足すときは、画像を src/assets/guide/<言語>/ に置いて GUIDES に足す（上から順に並ぶ）
// images に複数のファイル名を入れると、図解の中で左右にめくれる
import React, { useState } from 'react'
import Lightbox from './Lightbox'
import { useLanguage } from '../hooks/useLanguage'

const FILES = import.meta.glob('../assets/guide/*/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
const image = (lang, file) => FILES[`../assets/guide/${lang}/${file}`]

export const GUIDES = [
  {
    key: 'sanpai-manner',
    images: ['01-sanpai-manner.webp'],
    title: { ja: '参拝マナー', en: 'Shrine Visit Manners', zh: '参拜礼仪' },
    description: {
      ja: '鳥居をくぐってから境内を見て回るまで',
      en: 'From passing through the torii to looking around the grounds',
      zh: '从穿过鸟居到参观神社境内',
    },
  },
  {
    key: 'nirei-nihakushu-ichirei',
    images: ['02-nirei-nihakushu-ichirei.webp'],
    title: { ja: '二礼二拍手一礼', en: 'Two Bows, Two Claps, One Bow', zh: '二拜二拍手一拜' },
    description: {
      ja: '拝殿でのお参りの作法',
      en: 'How to pray at the hall of worship',
      zh: '在拜殿参拜的礼法',
    },
  },
]

// その言語で出せる項目（画像がそろっているものだけ）
export function guidesFor(lang) {
  return GUIDES
    .map((g) => ({
      key: g.key,
      title: g.title[lang] || g.title.ja,
      description: g.description?.[lang] ?? g.description?.ja,
      urls: g.images.map((f) => image(lang, f)),
    }))
    .filter((g) => g.urls.length && g.urls.every(Boolean))
}

export default function GuideImageList() {
  const lang = useLanguage()
  const [openKey, setOpenKey] = useState(null)
  const guides = guidesFor(lang)
  if (!guides.length) return null
  const opened = guides.find((g) => g.key === openKey)

  return (
    <>
      <ul className="guide-list" lang={lang}>
        {guides.map((g) => (
          <li key={g.key}>
            <button type="button" className="guide-item guide-button" onClick={() => setOpenKey(g.key)}>
              <span className="guide-title">{g.title}<span className="external" aria-hidden="true"> ›</span></span>
              {g.description && <span className="muted small">{g.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      {opened && (
        <Lightbox urls={opened.urls} onClose={() => setOpenKey(null)}
          info={() => <div className="book-lightbox-info">{opened.title}</div>} />
      )}
    </>
  )
}
