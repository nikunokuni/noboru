// ☆ボタン（行きたい神社の印）。押すと付け外しする。行の中に置いても、行を押したことにはならない
import React from 'react'
import { useWishes } from '../hooks/useWishes'

export default function WishStar({ shrineId, className = '' }) {
  const { ids, toggle } = useWishes()
  const on = ids.has(Number(shrineId))
  return (
    <button type="button" className={`wish-star ${on ? 'on' : ''} ${className}`} aria-pressed={on}
      aria-label={on ? '☆を外す' : '☆を付ける'}
      onClick={(e) => { e.stopPropagation(); toggle(shrineId) }}>
      {on ? '★' : '☆'}
    </button>
  )
}
