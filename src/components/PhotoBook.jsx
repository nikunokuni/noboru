// 御朱印帳・鳥居帳・狛犬帳：タグごとの写真を並べる。押すと大きく出し（＜ ＞ で送れる）、神社や記録へ行ける
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSignedUrls } from './Photos'
import Lightbox from './Lightbox'
import { PHOTO_BOOKS } from '../lib/constants'

// 帳面を選ぶボタン。もう一度押すと閉じる
export function PhotoBookPicker({ value, onChange }) {
  return (
    <div className="chip-row book-row">
      {PHOTO_BOOKS.map(([tag, label]) => (
        <button key={tag} type="button" className={`chip book-chip ${value === tag ? 'active' : ''}`}
          onClick={() => onChange(value === tag ? null : tag)}>{label}</button>
      ))}
    </div>
  )
}

// items: [{ path, title, sub, to, linkLabel }]
export default function PhotoBook({ items, emptyText }) {
  const urls = useSignedUrls(items.map((p) => p.path))
  const [open, setOpen] = useState(null)

  if (!items.length) return <p className="muted small center mt24">{emptyText}</p>

  return (
    <>
      <div className="photo-grid book-grid">
        {items.map((p, i) => (
          <button key={p.path} type="button" className="book-cell" onClick={() => setOpen(i)}>
            {urls[p.path] ? <img src={urls[p.path]} alt="" loading="lazy" className="photo" /> : <div className="photo placeholder" />}
            <span className="book-caption">{p.title}</span>
          </button>
        ))}
      </div>
      {open !== null && (
        <Lightbox urls={items.map((p) => urls[p.path])} start={open} onClose={() => setOpen(null)}
          info={(i) => (
            <div className="book-lightbox-info">
              <div>{items[i].title}</div>
              {items[i].sub && <div className="small">{items[i].sub}</div>}
              <Link to={items[i].to} className="inline-link small">{items[i].linkLabel} ›</Link>
            </div>
          )} />
      )}
    </>
  )
}
