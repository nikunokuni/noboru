// 神社一覧（軽い一覧）をアプリ全体で共有する
// 端末に保存済みならすぐ使い、裏で新しい版の確認・取得をする
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { loadCachedIndex, fetchIndexVersion, downloadIndex, syncVisited, saveIndex } from '../lib/shrineIndex'
import { applyVisited } from '../lib/indexCore'

const ShrineIndexContext = createContext(null)

export function ShrineIndexProvider({ children }) {
  // status: loading（端末の一覧を確認中）/ downloading（初回取得中）/ ready / unavailable（一覧なし・取得失敗）
  const [state, setState] = useState({ status: 'loading', index: null, revision: 0 })
  const indexRef = useRef(null)
  const lastVisitedSync = useRef(0)

  const publish = (index, status = 'ready') => {
    indexRef.current = index
    setState((s) => ({ status, index, revision: s.revision + 1 }))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await loadCachedIndex()
      if (cancelled) return
      if (cached) publish(cached)
      try {
        const version = await fetchIndexVersion()
        if (cancelled) return
        if (!version || version === '0') {
          if (!cached) setState((s) => ({ ...s, status: 'unavailable' }))
          return
        }
        if (cached?.raw.version === version) return
        if (!cached) setState((s) => ({ ...s, status: 'downloading' }))
        const fresh = await downloadIndex(version)
        if (!cancelled) publish(fresh)
      } catch {
        if (!cancelled && !cached) setState((s) => ({ ...s, status: 'unavailable' }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 「誰も行っていない」の最新化。画面を開くたびに呼ばれるので1分に1回まで
  const refreshVisited = useCallback(async () => {
    const index = indexRef.current
    if (!index || Date.now() - lastVisitedSync.current < 60000) return
    lastVisitedSync.current = Date.now()
    try {
      if (await syncVisited(index)) publish(index)
    } catch { /* 圏外など。次の機会に */ }
  }, [])

  // 自分が記録した神社をすぐ参拝済みにする（送信前でも）
  const markVisited = useCallback((shrineId) => {
    const index = indexRef.current
    if (index && applyVisited(index, [{ id: shrineId, visited: true }])) {
      saveIndex(index)
      publish(index)
    }
  }, [])

  return (
    <ShrineIndexContext.Provider value={{ ...state, refreshVisited, markVisited }}>
      {children}
    </ShrineIndexContext.Provider>
  )
}

export const useShrineIndex = () => useContext(ShrineIndexContext)
