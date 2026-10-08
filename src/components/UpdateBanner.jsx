// 新しい版を公開したら「更新があります」を出し、押すと切り替えて読み込み直す
// ホーム画面に置いたアプリは開きっぱなしのことが多いので、1時間ごとと画面に戻ったときにも新しい版を確かめる
import React, { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

export default function UpdateBanner() {
  const registration = useRef(null)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) { registration.current = r },
  })

  useEffect(() => {
    const check = () => {
      const r = registration.current
      if (r && !r.installing && navigator.onLine) r.update().catch(() => {})
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // 新しい版に切り替わると自動で読み込み直す。切り替わりが伝わらなかったときのために、少し待って自分で読み込み直す
  const update = () => {
    updateServiceWorker(true)
    setTimeout(() => window.location.reload(), 3000)
  }

  if (!needRefresh) return null
  return (
    <div className="update-banner" role="status">
      <span>更新があります</span>
      <button type="button" className="update-btn" onClick={update}>更新する</button>
      <button type="button" className="update-later" onClick={() => setNeedRefresh(false)} aria-label="あとで">✕</button>
    </div>
  )
}
