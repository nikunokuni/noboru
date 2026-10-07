// 管理者用：ニックネームの確認。不適切な名前を初期化（消す）する
import React, { useCallback, useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { fetchIsAdmin, fetchNicknames, resetNickname } from '../lib/admin'

const shortId = (uuid) => `#${uuid.slice(0, 6)}`
const formatTime = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AdminNicknamesPage() {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [isAdmin, setIsAdmin] = useState(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    fetchIsAdmin(user.id).then(setIsAdmin)
  }, [user])

  const reload = useCallback(async (q) => {
    try {
      setItems(await fetchNicknames({ query: q }))
    } catch {
      showToast('読み込めませんでした')
      setItems([])
    }
  }, [showToast])

  // 入力が止まってから検索
  useEffect(() => {
    if (!isAdmin) return
    const t = setTimeout(() => reload(query), 300)
    return () => clearTimeout(t)
  }, [isAdmin, query, reload])

  const reset = async (p) => {
    if (!window.confirm(`ニックネーム「${p.nickname}」を初期化しますか？（本人の画面では未登録に戻ります）`)) return
    setBusy(p.user_id)
    try {
      await resetNickname(p.user_id)
      setItems((list) => list.filter((x) => x.user_id !== p.user_id))
      showToast('初期化しました')
    } catch {
      showToast('初期化できませんでした')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="ニックネームの確認" />
      <div className="page-content">
        {(loading || (user && isAdmin === null)) && <div className="spinner" />}
        {!loading && isAdmin === false && <p className="muted center mt24">管理者だけが見られる画面です</p>}
        {isAdmin && (
          <>
            <p className="muted small">不適切なニックネームを「初期化」すると、その名前は消えて表示されなくなります。本人はまた登録できます。繰り返す人は「情報提供の確認」から情報提供を止めると、ニックネームも変えられなくなります。</p>
            <input className="field-input mt8" placeholder="ニックネームで検索" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="section-mini">{query.trim() ? '検索結果' : '最近登録・変更した順（100件）'}</div>
            {items === null && <div className="spinner" />}
            {items?.length === 0 && <p className="muted small">見つかりませんでした</p>}
            {items?.map((p) => (
              <div key={p.user_id} className="card nickname-row">
                <div>
                  <div className="picked-name">{p.nickname}</div>
                  <div className="muted small">{p.show_name ? '名前を出す' : '名前を出さない'}・{formatTime(p.updated_at)}・{shortId(p.user_id)}</div>
                </div>
                <button className="text-btn" onClick={() => reset(p)} disabled={busy === p.user_id}>初期化</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
