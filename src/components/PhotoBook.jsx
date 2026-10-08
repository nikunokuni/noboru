// 御朱印帳・鳥居帳・狛犬帳：タグごとの写真を並べる。押すと大きく出し、神社や記録へ行ける
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSignedUrls } from './Photos'
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
        {items.map((p) => (
          <button key={p.path} type="button" className="book-cell" onClick={() => setOpen(p)}>
            {urls[p.path] ? <img src={urls[p.path]} alt="" loading="lazy" className="photo" /> : <div className="photo placeholder" />}
            <span className="book-caption">{p.title}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="lightbox book-lightbox" onClick={() => setOpen(null)} role="dialog" aria-label="写真">
          {urls[open.path] && <img src={urls[open.path]} alt="" />}
          <div className="book-lightbox-info" onClick={(e) => e.stopPropagation()}>
            <div>{open.title}</div>
            {open.sub && <div className="small">{open.sub}</div>}
            <Link to={open.to} className="inline-link small">{open.linkLabel} ›</Link>
          </div>
        </div>
      )}
    </>
  )
}
