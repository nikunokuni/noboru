// URL の QR コードを全画面の上に出す。外側・× で閉じる（QR を作る部品は開いたときに読み込む）
import React, { useEffect, useState } from 'react'

export default function QrModal({ url, title, onClose }) {
  const [svg, setSvg] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    import('qrcode')
      .then((QR) => QR.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1a1208', light: '#ffffff' } }))
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [url])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="qr-modal" role="dialog" aria-label="QRコード" onClick={onClose}>
      <div className="qr-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qr-close" aria-label="閉じる" onClick={onClose}>×</button>
        {title && <div className="qr-title">{title}</div>}
        {svg
          ? <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
          : <div className="qr-code qr-loading">{failed ? <p className="muted small">QRコードを作れませんでした</p> : <div className="spinner" />}</div>}
        <p className="muted small qr-url">{url}</p>
        <p className="muted small">スマホのカメラで読み取ると開きます</p>
      </div>
    </div>
  )
}
