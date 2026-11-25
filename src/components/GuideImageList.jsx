// 参拝の手引き（図解）：項目の一覧を出し、押すとその図解を大きく出す
// 項目を足すときは、画像を src/assets/guide/ に置いて import し、GUIDES に足す（上から順に並ぶ）
// images に複数入れると、図解の中で左右にめくれる
import React, { useState } from 'react'
import Lightbox from './Lightbox'
import sanpaiManner from '../assets/etiquette/ja/01-sanpai-manner.webp'
import nireiNihakushuIchirei from '../assets/etiquette/ja/02-nirei-nihakushu-ichirei.webp'

export const GUIDES = [
  { key: 'sanpai-manner', title: '参拝マナー', description: '鳥居をくぐってから境内を見て回るまで', images: [sanpaiManner] },
  { key: 'nirei-nihakushu-ichirei', title: '二礼二拍手一礼', description: '拝殿でのお参りの作法', images: [nireiNihakushuIchirei] },
]

export default function GuideImageList() {
  const [openKey, setOpenKey] = useState(null)
  if (!GUIDES.length) return null
  const opened = GUIDES.find((g) => g.key === openKey)

  return (
    <>
      <ul className="guide-list">
        {GUIDES.map((g) => (
          <li key={g.key}>
            <button type="button" className="guide-item guide-button" onClick={() => setOpenKey(g.key)}>
              <span className="guide-title">{g.title}<span className="external" aria-hidden="true"> ›</span></span>
              {g.description && <span className="muted small">{g.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      {opened && (
        <Lightbox urls={opened.images} onClose={() => setOpenKey(null)}
          info={() => <div className="book-lightbox-info">{opened.title}</div>} />
      )}
    </>
  )
}
