// 投稿済みの写真の編集：回転・切り取り・隠す（写ってはいけないものを黒く塗る）
// 1回の操作ごとに新しい Canvas を作って積む。「元に戻す」で1つ前へ
import React, { useEffect, useRef, useState } from 'react'
import { downloadPhoto } from '../lib/records'
import { canvasToJpeg } from '../lib/imageCompress'

const MIN_SIZE = 8 // これより小さい範囲は指が滑っただけとみなす

function newCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function rotate(src, dir) {
  const c = newCanvas(src.height, src.width)
  const ctx = c.getContext('2d')
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((dir * Math.PI) / 2)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return c
}

function crop(src, r) {
  const c = newCanvas(r.w, r.h)
  c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
  return c
}

function mask(src, r) {
  const c = newCanvas(src.width, src.height)
  const ctx = c.getContext('2d')
  ctx.drawImage(src, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(r.x, r.y, r.w, r.h)
  return c
}

// ドラッグの始点・終点から、画像の中に収まる四角形を作る
function toRect(d, cv) {
  const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max))
  const x0 = clamp(Math.min(d.x0, d.x1), cv.width), x1 = clamp(Math.max(d.x0, d.x1), cv.width)
  const y0 = clamp(Math.min(d.y0, d.y1), cv.height), y1 = clamp(Math.max(d.y0, d.y1), cv.height)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const HINTS = {
  mask: '隠したいところを指でなぞって囲むと、黒く塗りつぶします',
  crop: '残したい範囲を指でなぞって囲んでください',
}

export default function PhotoEditor({ path, onSave, onClose }) {
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [mode, setMode] = useState('mask')
  const [drag, setDrag] = useState(null)
  const [saving, setSaving] = useState(false)
  const viewRef = useRef(null)
  const current = history[history.length - 1]

  useEffect(() => {
    let alive = true
    downloadPhoto(path)
      .then((blob) => createImageBitmap(blob))
      .then((bmp) => {
        if (!alive) return
        const c = newCanvas(bmp.width, bmp.height)
        c.getContext('2d').drawImage(bmp, 0, 0)
        setHistory([c])
      })
      .catch(() => alive && setError('写真を読み込めませんでした'))
    return () => { alive = false }
  }, [path])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !current) return
    view.width = current.width
    view.height = current.height
    view.getContext('2d').drawImage(current, 0, 0)
  }, [current])

  const push = (c) => { setHistory((h) => [...h, c]); setDrag(null) }

  // 画面上の位置 → 画像のピクセル
  const toImage = (ev) => {
    const box = viewRef.current.getBoundingClientRect()
    return { x: ((ev.clientX - box.left) / box.width) * current.width, y: ((ev.clientY - box.top) / box.height) * current.height }
  }

  const onPointerDown = (ev) => {
    if (!current || saving) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const p = toImage(ev)
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, active: true })
  }
  const onPointerMove = (ev) => {
    if (!drag?.active) return
    const p = toImage(ev)
    setDrag({ ...drag, x1: p.x, y1: p.y })
  }
  const onPointerUp = () => {
    if (!drag?.active) return
    const r = toRect(drag, current)
    if (r.w < MIN_SIZE || r.h < MIN_SIZE) return setDrag(null)
    if (mode === 'mask') push(mask(current, r))
    else setDrag({ ...drag, active: false }) // 切り取りは範囲を見てから決める
  }

  const changeMode = (m) => { setMode(m); setDrag(null) }

  const save = async () => {
    if (history.length <= 1) return onClose()
    setSaving(true)
    try {
      await onSave(await canvasToJpeg(current))
    } catch {
      setSaving(false)
    }
  }

  const sel = drag && current && toRect(drag, current)
  const selStyle = sel && {
    left: `${(sel.x / current.width) * 100}%`, top: `${(sel.y / current.height) * 100}%`,
    width: `${(sel.w / current.width) * 100}%`, height: `${(sel.h / current.height) * 100}%`,
  }

  return (
    <div className="editor" role="dialog" aria-label="写真の編集">
      <div className="editor-bar">
        <button type="button" className="text-btn" onClick={onClose} disabled={saving}>やめる</button>
        <span className="page-title">写真の編集</span>
        <button type="button" className="text-btn" onClick={save} disabled={!current || saving}>保存</button>
      </div>

      <div className="editor-stage">
        {error ? <p className="muted center">{error}</p>
          : !current ? <div className="spinner" />
          : (
            <div className="editor-canvas-wrap" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
              <canvas ref={viewRef} className="editor-canvas" />
              {sel && <div className={`editor-sel ${mode}`} style={selStyle} />}
            </div>
          )}
      </div>

      {saving ? <div className="spinner" /> : (
        <div className="editor-panel">
          <p className="muted small center">{HINTS[mode]}</p>
          {mode === 'crop' && drag && !drag.active && (
            <button type="button" className="btn-primary" onClick={() => push(crop(current, sel))}>この範囲で切り取る</button>
          )}
          <div className="editor-tools">
            <button type="button" className={`chip ${mode === 'mask' ? 'active' : ''}`} onClick={() => changeMode('mask')} disabled={!current}>■ 隠す</button>
            <button type="button" className={`chip ${mode === 'crop' ? 'active' : ''}`} onClick={() => changeMode('crop')} disabled={!current}>✂ 切り取る</button>
            <button type="button" className="chip" onClick={() => push(rotate(current, -1))} disabled={!current}>↺ 左に回す</button>
            <button type="button" className="chip" onClick={() => push(rotate(current, 1))} disabled={!current}>↻ 右に回す</button>
          </div>
          <button type="button" className="text-btn editor-undo" onClick={() => { setHistory((h) => h.slice(0, -1)); setDrag(null) }}
            disabled={history.length <= 1}>元に戻す</button>
        </div>
      )}
    </div>
  )
}
