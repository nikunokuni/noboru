// 紹介記事の1件：アイキャッチ・タイトル・サイト名・載せた人。押すと記事を別のタブで開く
//   shrine を渡すと神社名も出す（みんなの参拝の「記事」）
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { hostLabel } from '../lib/articleMeta'
import { ANONYMOUS_NAME } from '../lib/community'

export default function ArticleCard({ article, shrine = null, right = null }) {
  const [imageFailed, setImageFailed] = useState(false)
  const host = hostLabel(article.url)
  return (
    <div className="article-card">
      {shrine && (
        <Link to={`/shrine/${shrine.id}`} className="article-shrine">⛩ {shrine.name}<span className="muted small">　{shrine.prefecture}</span></Link>
      )}
      <a href={article.url} target="_blank" rel="noopener noreferrer ugc" className="article-link">
        {article.image_url && !imageFailed
          ? <img src={article.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="article-image" onError={() => setImageFailed(true)} />
          : <div className="article-image placeholder" aria-hidden="true">✎</div>}
        <span className="article-body">
          <span className="article-title">{article.title || host}</span>
          <span className="muted small article-site">{article.site_name || host} ↗</span>
          {article.author !== undefined && <span className="muted small">載せた人：{article.author || ANONYMOUS_NAME}</span>}
        </span>
      </a>
      {right}
    </div>
  )
}
