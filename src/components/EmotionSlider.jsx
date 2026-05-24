import React from 'react'

export default function EmotionSlider({ value, onChange }) {
  const getLabel = (v) => {
    if (v >= 80) return '魂が震えた'
    if (v >= 60) return '深く感動した'
    if (v >= 40) return 'とても良かった'
    if (v >= 20) return '穏やかな気持ち'
    return '静かな気づき'
  }

  const getColor = (v) => {
    if (v >= 80) return '#c0392b'
    if (v >= 60) return '#d4583a'
    if (v >= 40) return '#b8960c'
    if (v >= 20) return '#8b9ea8'
    return 'rgba(26,18,8,0.3)'
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 13,
          fontFamily: 'var(--font-mincho)',
          color: getColor(value),
          letterSpacing: '0.08em',
          transition: 'color 0.3s',
        }}>
          {getLabel(value)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--mist)' }}>{value}</span>
      </div>

      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          height: 4,
          background: 'var(--paper2)',
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${value}%`,
          height: 4,
          background: `linear-gradient(90deg, var(--vermillion-soft), ${getColor(value)})`,
          borderRadius: 2,
          transition: 'width 0.1s, background 0.3s',
        }} />
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            left: 0, right: 0,
            width: '100%',
            opacity: 0,
            height: 20,
            cursor: 'pointer',
            margin: 0,
          }}
        />
        <div style={{
          position: 'absolute',
          left: `calc(${value}% - 8px)`,
          width: 16, height: 16,
          background: getColor(value),
          border: '2.5px solid var(--paper)',
          borderRadius: '50%',
          boxShadow: '0 2px 6px rgba(192,57,43,0.3)',
          transition: 'left 0.1s, background 0.3s',
          pointerEvents: 'none',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 8, color: 'rgba(26,18,8,0.3)', letterSpacing: '0.1em' }}>静かな気づき</span>
        <span style={{ fontSize: 8, color: 'rgba(26,18,8,0.3)', letterSpacing: '0.1em' }}>魂が震えた</span>
      </div>
    </div>
  )
}
