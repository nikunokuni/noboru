// 管理者用：紹介記事の確認
// 記事はすぐ公開される。ここで新しい順に見て、不適切な記事（神社と関係ない宣伝・荒らしなど）を非公開にする。繰り返す人は記事・情報提供を止める
import React, { useCallback, useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import ArticleCard from '../components/ArticleCard'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { fetchIsAdmin, fetchBannedEditors, setEditorBanned } from '../lib/admin'
import { fetchArticlesForAdmin, setArticleHidden } from '../lib/articles'

const shortId = (uuid) => `#${uuid.slice(0, 6)}`

export default function AdminArticlesPage() {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [isAdmin, setIsAdmin] = useState(null)
  const [articles, setArticles] = useState(null)
  const [banned, setBanned] = useState(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    fetchIsAdmin(user.id).then(setIsAdmin)
  }, [user])

  const reload = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetchArticlesForAdmin(), fetchBannedEditors()])
      setArticles(a)
      setBanned(b)
    } catch {
      showToast('紹介記事を読み込めませんでした')
    }
  }, [showToast])

  useEffect(() => { if (isAdmin) reload() }, [isAdmin, reload])

  const run = async (fn, message) => {
    setBusy(true)
    try {
      await fn()
      showToast(message)
      await reload()
    } catch (e) {
      showToast(e.message || '処理できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="紹介記事の確認" />
      <div className="page-content">
        {(loading || (user && isAdmin === null)) && <div className="spinner" />}
        {!loading && isAdmin === false && <p className="muted center mt24">管理者だけが見られる画面です</p>}

        {isAdmin && (<>
          <p className="muted small">
            紹介記事はすぐ公開されています。神社と関係のない宣伝・不適切なページだけ「非公開にする」で外し、繰り返す人は記事・情報提供を止めてください。
          </p>
          {!articles && <div className="spinner mt24" />}
          {articles?.length === 0 && <p className="muted small center mt24">まだ記事はありません</p>}
          {articles?.map((a) => (
            <div key={a.id} className={`card mt16 ${a.hidden ? 'reverted' : ''}`}>
              <ArticleCard article={a} shrine={{ id: a.shrine_id, name: a.shrines?.name ?? '（削除された神社）', prefecture: a.shrines?.prefecture ?? '' }} />
              <p className="muted small break-all">{a.url}</p>
              <p className="muted small">
                {new Date(a.created_at).toLocaleString('ja-JP')}・載せた人 {shortId(a.user_id)}
                {a.hidden && <span className="tag-pending">非公開</span>}
                {banned.has(a.user_id) && <span className="tag-pending">停止中</span>}
              </p>
              <div className="btn-row mt8">
                <button className="btn-secondary" disabled={busy}
                  onClick={() => run(() => setArticleHidden(a.id, !a.hidden), a.hidden ? '公開に戻しました' : '非公開にしました')}>
                  {a.hidden ? '公開に戻す' : '非公開にする'}
                </button>
                <button className="btn-secondary" disabled={busy}
                  onClick={() => {
                    const ban = !banned.has(a.user_id)
                    if (ban && !window.confirm(`${shortId(a.user_id)} の記事・情報提供・申請を止めますか？`)) return
                    run(() => setEditorBanned(a.user_id, ban), ban ? '止めました' : '止めるのをやめました')
                  }}>
                  {banned.has(a.user_id) ? '止めるのをやめる' : 'この人を止める'}
                </button>
              </div>
            </div>
          ))}
        </>)}
      </div>
    </div>
  )
}
