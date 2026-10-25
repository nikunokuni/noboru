// 写真を大きく見る。複数あれば ＜ ＞ ・左右のスワイプ・矢印キーで送る。写真の外や × を押すと閉じる
import React, { useEffect, useRef, useState } from 'react'

const SWIPE = 50 // これより大きく指を動かしたら次・前へ

// urls: 写真のURL（まだ読めていないものは undefined）。info(i) があれば写真の下に出す
export default function Lightbox({ urls, start = 0, onClose, info }) {
  const [index, setIndex] = useState(start)
  const [dx, setDx] = useState(0)
  const touch = useRef(null)
  const swipedAt = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const count = urls.length
  const go = (i) => setIndex(Math.max(0, Math.min(count - 1, i)))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(count - 1, i + 1))
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [count])

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false }
  }
  const onTouchMove = (e) => {
    const t = touch.current
    if (!t || e.touches.length !== 1) return
    const x = e.touches[0].clientX - t.x
    if (!t.moved && Math.abs(x) < Math.abs(e.touches[0].clientY - t.y)) return
    t.moved = Math.abs(x) > 8 || t.moved
    // 端ではそれ以上めくれないので、動きを小さくする
    const atEdge = (x > 0 && index === 0) || (x < 0 && index === count - 1)
    setDx(atEdge ? x / 3 : x)
  }
  const onTouchEnd = () => {
    if (touch.current?.moved) swipedAt.current = Date.now()
    touch.current = null
    if (dx <= -SWIPE) go(index + 1)
    else if (dx >= SWIPE) go(index - 1)
    setDx(0)
  }
  // スワイプのあとに来るクリックで閉じないようにする
  const onClick = () => {
    if (Date.now() - swipedAt.current < 400) return
    onClose()
  }
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return (
    <div className="lightbox" onClick={onClick} role="dialog" aria-label="写真">
      <div className="lightbox-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <div className="lightbox-track" style={{
          transform: `translateX(calc(${-index * 100}% + ${dx}px))`,
          transition: dx ? 'none' : 'transform 0.3s ease',
        }}>
          {urls.map((url, i) => (
            <div key={i} className="lightbox-slide">
              {Math.abs(i - index) <= 1 && (url ? <img src={url} alt="" draggable={false} /> : <div className="spinner" />)}
            </div>
          ))}
        </div>
        {count > 1 && <div className="lightbox-count">{index + 1} / {count}</div>}
        {index > 0 && <button type="button" className="lightbox-nav prev" aria-label="前の写真" onClick={stop(() => go(index - 1))}>‹</button>}
        {index < count - 1 && <button type="button" className="lightbox-nav next" aria-label="次の写真" onClick={stop(() => go(index + 1))}>›</button>}
        <button type="button" className="lightbox-close" aria-label="閉じる" onClick={stop(onClose)}>×</button>
      </div>
      {info && <div className="lightbox-info" onClick={(e) => e.stopPropagation()}>{info(index)}</div>}
    </div>
  )
}
