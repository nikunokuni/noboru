import React from 'react'
import { emotionColor, emotionLabel } from '../lib/constants'

export default function EmotionSlider({ value, onChange }) {
  const color = emotionColor(value)
  return (
    <div className="emotion">
      <div className="emotion-head">
        <span className="emotion-label" style={{ color }}>{emotionLabel(value)}</span>
        <span className="muted small">{value}</span>
      </div>
      <div className="emotion-track">
        <div className="emotion-rail" />
        <div className="emotion-fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, var(--vermillion-soft), ${color})` }} />
        <input
          type="range" min="0" max="100" value={value} aria-label="感動の温度"
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="emotion-thumb" style={{ left: `calc(${value}% - 8px)`, background: color }} />
      </div>
    </div>
  )
}
