// 神社の1行（名前・場所・右側に距離など）。左に☆（行きたい神社の印）を付け外しできるボタン
import React from 'react'
import WishStar from './WishStar'
import { placeLabel } from '../lib/format'

export default function ShrineRow({ item, onClick, right }) {
  return (
    <div className="shrine-row-wrap">
      <WishStar shrineId={item.id} />
      <button type="button" className="shrine-row" onClick={onClick}>
        <span>
          <span className="shrine-row-name">{item.name}</span>
          <span className="muted small"> {placeLabel(item)}</span>
          {!item.visited && <span className="tag-unvisited">まだ誰も</span>}
        </span>
        <span className="muted small">{right}</span>
      </button>
    </div>
  )
}
