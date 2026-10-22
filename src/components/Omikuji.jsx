// マイページ：おみくじ。登録した画像を高速で入れ替え、タップで止まった画像が結果
// 画像は src/assets/omikuji/ に置けば自動で加わる
import React, { useEffect, useState } from 'react'

const IMAGES = Object.values(import.meta.glob('../assets/omikuji/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))
const SHUFFLE_MS = 70

export default function Omikuji({ onClose }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * IMAGES.length))
  const [spinning, setSpinning] = useState(true)

  // 入れ替えで画像の読み込み待ちが出ないよう、先に読んでおく
  useEffect(() => {
    IMAGES.forEach((src) => { new Image().src = src })
  }, [])

  useEffect(() => {
    if (!spinning || IMAGES.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % IMAGES.length), SHUFFLE_MS)
    return () => clearInterval(timer)
  }, [spinning])

  if (IMAGES.length === 0) return null

  return (
    <div className="omikuji" onClick={() => spinning && setSpinning(false)}>
      <div className="omikuji-stage">
        <img className={`omikuji-img${spinning ? '' : ' result'}`} src={IMAGES[index]} alt={spinning ? '' : 'おみくじの結果'} draggable={false} />
      </div>
      {spinning ? (
        <p className="omikuji-hint">タップしてとめる</p>
      ) : (
        <div className="omikuji-actions">
          <button className="btn-secondary" onClick={() => setSpinning(true)}>もう一度引く</button>
          <button className="btn-primary" onClick={onClose}>閉じる</button>
        </div>
      )}
    </div>
  )
}
