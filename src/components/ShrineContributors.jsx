// 神社詳細の情報提供者：1行で要約し、押すと一覧
import React, { useEffect, useState } from 'react'
import { fetchShrineContributors } from '../lib/community'

const SHOWN_NAMES = 3

// 端末の時刻で「2026年10月7日」
const localDate = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function ShrineContributors({ shrineId }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetchShrineContributors(shrineId).then((r) => alive && setRows(r)).catch(() => {})
    return () => { alive = false }
  }, [shrineId])

  if (!rows.length) return null

  const named = rows.filter((r) => r.name)
  const unnamed = rows.filter((r) => !r.name)
  const shown = named.slice(0, SHOWN_NAMES).map((r) => r.name)
  const rest = rows.length - shown.length
  const summary = shown.length
    ? `${shown.join('、')}${rest ? ` ほか${rest}人` : ''}`
    : `${rows.length}人`

  return (
    <div className="contributors">
      <button type="button" className="contributors-line" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="muted">情報提供：</span>{summary}<span className="muted">{open ? ' ▴' : ' ▾'}</span>
      </button>
      {open && (
        <ul className="contributors-list">
          {named.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span>
              <span className="muted small">{r.edit_count}件・{localDate(r.last_edited_at)}</span>
            </li>
          ))}
          {unnamed.length > 0 && (
            <li>
              <span className="muted">名前を出していない方 {unnamed.length}人</span>
              <span className="muted small">{unnamed.reduce((n, r) => n + r.edit_count, 0)}件</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
