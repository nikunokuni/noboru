import React from 'react'
import { useNavigate } from 'react-router-dom'

// back: true で「‹」戻るボタン。right に任意の要素
export default function TopBar({ title, back = false, right = null }) {
  const navigate = useNavigate()
  return (
    <header className="top-bar">
      <div className="top-bar-side">
        {back && <button className="back-btn" onClick={() => navigate(-1)} aria-label="戻る">‹</button>}
      </div>
      <h1 className="page-title">{title}</h1>
      <div className="top-bar-side right">{right}</div>
    </header>
  )
}
