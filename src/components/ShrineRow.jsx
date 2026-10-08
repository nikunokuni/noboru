// 神社の1行（名前・場所・右側に距離など）
import React from 'react'
import { placeLabel } from '../lib/format'

export default function ShrineRow({ item, onClick, right }) {
  return (
    <button type="button" className="shrine-row" onClick={onClick}>
      <span>
        <span className="shrine-row-name">{item.name}</span>
        <span className="muted small"> {placeLabel(item)}</span>
        {!item.visited && <span className="tag-unvisited">まだ誰も</span>}
      </span>
      <span className="muted small">{right}</span>
    </button>
  )
}
