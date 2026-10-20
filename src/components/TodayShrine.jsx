// 今日の神社：候補から日替わりで1社を、画像と紹介文で紹介する。押すと神社詳細へ
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSignedUrls } from './Photos'
import { fetchShrine, fetchShrinePhotos } from '../lib/community'
import { placeLabel } from '../lib/format'
import { FEATURED_SHRINES, localDateKey, pickFeatured } from '../lib/featuredShrines'
import { MAIN_PHOTO_TAG } from '../lib/constants'

export default function TodayShrine() {
  const [featured] = useState(() => pickFeatured(FEATURED_SHRINES, localDateKey()))
  const [shrine, setShrine] = useState(null)
  const [photoPath, setPhotoPath] = useState(null)

  useEffect(() => {
    if (!featured) return
    let alive = true
    fetchShrine(featured.id).then((s) => alive && setShrine(s)).catch(() => {})
    // 画像の指定がなければ、本殿の写真を使う
    if (!featured.image) {
      fetchShrinePhotos(featured.id)
        .then((p) => alive && setPhotoPath(p.find((x) => x.tag === MAIN_PHOTO_TAG)?.path || null))
        .catch(() => {})
    }
    return () => { alive = false }
  }, [featured])

  const urls = useSignedUrls(photoPath ? [photoPath] : [])

  if (!featured || !shrine) return null

  const image = featured.image || urls[photoPath]
  const text = featured.text || shrine.highlights || shrine.features

  return (
    <Link to={`/shrine/${shrine.id}`} className="today-shrine">
      <div className="today-shrine-label">今日の神社</div>
      {image
        ? <img src={image} alt={shrine.name} className="today-shrine-img" />
        : photoPath && <div className="today-shrine-img placeholder" />}
      <div className="today-shrine-body">
        <div className="today-shrine-name">⛩ {shrine.name}</div>
        <div className="muted small">{placeLabel(shrine)}</div>
        {text && <p className="today-shrine-text">{text}</p>}
      </div>
    </Link>
  )
}
