// 記録の保存前に、写真を1枚ずつ出してタグを選んでもらう。選ぶと次の写真へ
import React from 'react'
import { PHOTO_TAGS } from '../lib/constants'

export default function PhotoTagger({ photos, index, saving, onTag, onBack }) {
  const photo = photos[index]
  return (
    <div className="tagger">
      <p className="tagger-step">写真 {index + 1} / {photos.length}</p>
      <img src={photo.preview} alt="" className="tagger-photo" />
      <p className="tagger-question">何が写っていますか？</p>
      <div className="tagger-tags">
        {PHOTO_TAGS.map(([tag, label]) => (
          <button key={tag} type="button" className={`chip ${photo.tag === tag ? 'active' : ''}`}
            onClick={() => onTag(tag)} disabled={saving}>{label}</button>
        ))}
      </div>
      <p className="muted small center">選ぶと次へ進みます。変えないときは「{PHOTO_TAGS.find(([t]) => t === photo.tag)[1]}」のまま押してください</p>
      {saving
        ? <div className="spinner mt16" />
        : <button type="button" className="text-btn mt16 block" onClick={onBack}>{index > 0 ? '‹ 前の写真' : '‹ 入力に戻る'}</button>}
    </div>
  )
}
