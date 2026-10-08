import React from 'react'
import { NavLink } from 'react-router-dom'

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22" aria-hidden="true">
    {d}
  </svg>
)

const ITEMS = [
  { to: '/', label: '記録する', end: true, icon: <path d="M3 5c3 1 15 1 18 0M5 9h14M7 5.5V21M17 5.5V21M12 9v-3" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/map', label: 'マップ', icon: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" strokeLinejoin="round" /><path d="M9 4v14M15 6v14" /></> },
  { to: '/community', label: 'みんなの参拝', icon: <><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9.5" r="2.5" /><path d="M3 20c1-3.5 3.2-5.5 6-5.5s5 2 6 5.5M15.5 14.6c.5-.1 1-.1 1.5-.1 2.2 0 3.8 1.5 4.5 4.5" strokeLinecap="round" /></> },
  { to: '/records', label: '自分の記録', icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" /> },
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
