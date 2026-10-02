// 非公開バケットの写真を一時URLで表示
import React, { useEffect, useState } from 'react'
import { signedPhotoUrls } from '../lib/records'

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
  if (!paths.length) return null
  return (
    <div className="photo-row">
      {paths.map((p) => urls[p]
        ? <img key={p} src={urls[p]} alt="" loading="lazy" style={{ width: size, height: size }} className="photo" />
        : <div key={p} className="photo placeholder" style={{ width: size, height: size }} />)}
    </div>
  )
}
