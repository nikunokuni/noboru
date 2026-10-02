import React from 'react'
import { NavLink } from 'react-router-dom'

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22" aria-hidden="true">
    {d}
  </svg>
)

const ITEMS = [
  { to: '/', label: '記録', end: true, icon: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/map', label: 'マップ', icon: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" strokeLinejoin="round" /><path d="M9 4v14M15 6v14" /></> },
  { to: '/search', label: '探す', icon: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" strokeLinecap="round" /></> },
  { to: '/records', label: '一覧', icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" /> },
  { to: '/profile', label: 'マイページ', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" /></> },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ to, label, icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon d={icon} />{label}
        </NavLink>
      ))}
    </nav>
  )
}
