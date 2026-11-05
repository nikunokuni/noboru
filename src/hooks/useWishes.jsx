// ☆（行きたい神社）。マップ・記録する・みんなの参拝・神社詳細で同じ印を使うので、アプリ全体で1つ持つ
// マップで探して☆を付ける → 参拝するときに☆で絞り込む → 参拝する、の流れで使う
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { fetchMyWishIds, setWish } from '../lib/records'

const WishesContext = createContext(null)

export function WishesProvider({ children }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [ids, setIds] = useState(() => new Set())
  const [ready, setReady] = useState(false)
  const idsRef = useRef(ids)
  idsRef.current = ids

  useEffect(() => {
    let alive = true
    setIds(new Set())
    setReady(false)
    if (!user) return
    fetchMyWishIds(user.id)
      .then((list) => { if (alive) { setIds(new Set(list.map(Number))); setReady(true) } })
      .catch(() => {})
    return () => { alive = false }
  }, [user])

  // 先に印を変え、保存に失敗したら戻す
  const toggle = useCallback(async (shrineId) => {
    if (!user) { showToast('ログインすると☆を付けられます'); return }
    if (!ready) { showToast('☆を読み込んでいます。少し待ってからお試しください'); return }
    const id = Number(shrineId)
    const on = !idsRef.current.has(id)
    const flip = (value) => setIds((prev) => {
      const next = new Set(prev)
      if (value) next.add(id); else next.delete(id)
      return next
    })
    flip(on)
    try {
      await setWish({ userId: user.id, shrineId: id, on })
      showToast(on ? '☆を付けました。マップの☆で絞り込めます' : '☆を外しました')
    } catch {
      flip(!on)
      showToast('保存できませんでした。電波の届く場所でお試しください')
    }
  }, [user, ready, showToast])

  return <WishesContext.Provider value={{ ids, ready, toggle }}>{children}</WishesContext.Provider>
}

export const useWishes = () => useContext(WishesContext)
