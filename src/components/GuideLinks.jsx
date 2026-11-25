// note 記事へのリンク（guide_links テーブル）
import React, { useEffect, useState } from 'react'
import { fetchGuideLinks } from '../lib/community'

export function useGuideLinks(context) {
  const [links, setLinks] = useState([])
  useEffect(() => {
    let alive = true
    fetchGuideLinks(context).then((l) => alive && setLinks(l)).catch(() => {})
    return () => { alive = false }
  }, [context])
  return links
}

// 一覧表示（マイページ）
// emptyText に null を渡すと、リンクがないとき何も出さない
export function GuideLinkList({ context = 'general', emptyText = '準備中です' }) {
  const links = useGuideLinks(context)
  if (!links.length) return emptyText ? <p className="muted small">{emptyText}</p> : null
  return (
    <ul className="guide-list">
      {links.map((l) => (
        <li key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="guide-item">
            <span className="guide-title">{l.title}<span className="external" aria-hidden="true"> ↗</span></span>
            {l.description && <span className="muted small">{l.description}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

// 1行の小さなリンク（記録画面・御朱印欄など）。リンクがなければ何も出さない
export function GuideInlineLink({ context }) {
  const [link] = useGuideLinks(context)
  if (!link) return null
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-link">
      {link.title} ↗
    </a>
  )
}
