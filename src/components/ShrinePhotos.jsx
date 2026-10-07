// 神社詳細の写真：本殿の写真を1枚大きく、ほかはタグのボタンだけ。タグを押すとその写真を並べる
import React, { useEffect, useState } from 'react'
import { useSignedUrls } from './Photos'
import { fetchShrinePhotos } from '../lib/community'
import { MAIN_PHOTO_TAG, PHOTO_TAGS } from '../lib/constants'

function Lightbox({ url, onClose }) {
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="写真">
      <img src={url} alt="" />
    </div>
  )
}

export default function ShrinePhotos({ shrineId, revision }) {
  const [photos, setPhotos] = useState([])
  const [openTag, setOpenTag] = useState(null)
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    let alive = true
    fetchShrinePhotos(shrineId).then((p) => alive && setPhotos(p)).catch(() => {})
    return () => { alive = false }
  }, [shrineId, revision])

  const main = photos.find((p) => p.tag === MAIN_PHOTO_TAG)
  const opened = openTag ? photos.filter((p) => p.tag === openTag) : []
  const urls = useSignedUrls([main, ...opened].filter(Boolean).map((p) => p.path))
  const counts = Object.fromEntries(PHOTO_TAGS.map(([t]) => [t, photos.filter((p) => p.tag === t).length]))

  if (!photos.length) return null

  return (
    <section className="shrine-photos">
      {main && (urls[main.path]
        ? <img src={urls[main.path]} alt="本殿" className="main-photo" onClick={() => setZoom(urls[main.path])} />
        : <div className="main-photo placeholder" />)}
      <div className="chip-row photo-tags">
        {PHOTO_TAGS.filter(([t]) => counts[t]).map(([t, label]) => (
          <button key={t} type="button" className={`chip ${openTag === t ? 'active' : ''}`}
            onClick={() => setOpenTag(openTag === t ? null : t)}>
            {label} {counts[t]}
          </button>
        ))}
      </div>
      {opened.length > 0 && (
        <div className="photo-grid">
          {opened.map((p) => urls[p.path]
            ? <img key={p.path} src={urls[p.path]} alt="" loading="lazy" className="photo" onClick={() => setZoom(urls[p.path])} />
            : <div key={p.path} className="photo placeholder" />)}
        </div>
      )}
      {zoom && <Lightbox url={zoom} onClose={() => setZoom(null)} />}
    </section>
  )
}
