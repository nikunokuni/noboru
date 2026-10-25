// 非公開バケットの写真を一時URLで表示。押すと大きく出し、＜ ＞ で送れる
import React, { useEffect, useState } from 'react'
import { signedPhotoUrls } from '../lib/records'
import Lightbox from './Lightbox'

export function useSignedUrls(paths) {
  const key = paths.join('|')
  const [urls, setUrls] = useState({})
  useEffect(() => {
    let alive = true
    if (key) signedPhotoUrls(key.split('|')).then((u) => alive && setUrls(u))
    return () => { alive = false }
  }, [key])
  return urls
}

export default function Photos({ paths, size = 72 }) {
  const urls = useSignedUrls(paths)
  const [zoom, setZoom] = useState(null)
  if (!paths.length) return null
  return (
    <div className="photo-row">
      {paths.map((p, i) => urls[p]
        ? <img key={p} src={urls[p]} alt="" loading="lazy" style={{ width: size, height: size }} className="photo zoomable" onClick={() => setZoom(i)} />
        : <div key={p} className="photo placeholder" style={{ width: size, height: size }} />)}
      {zoom !== null && <Lightbox urls={paths.map((p) => urls[p])} start={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}
