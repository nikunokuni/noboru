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

function crop(src, box) {
  const r = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) }
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

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

// 切り取り枠を動かす。handle は四隅・各辺（n/s/e/w の組み合わせ）か 'move'。d はつかんでからの移動量
function moveBox(b, handle, d, W, H, min) {
  if (handle === 'move') return { ...b, x: clamp(b.x + d.x, 0, W - b.w), y: clamp(b.y + d.y, 0, H - b.h) }
  let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h
  if (handle.includes('w')) x0 = clamp(x0 + d.x, 0, x1 - min)
  if (handle.includes('e')) x1 = clamp(x1 + d.x, x0 + min, W)
  if (handle.includes('n')) y0 = clamp(y0 + d.y, 0, y1 - min)
  if (handle.includes('s')) y1 = clamp(y1 + d.y, y0 + min, H)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_CROP_PX = 48 // 画面上でこれより小さい枠にはしない

const HINTS = {
  mask: '隠したいところを、斜めに指を動かして四角で囲むと黒く塗りつぶします',
  crop: '四隅と各辺の白いバーで範囲を決めます。枠の中を動かすと位置を変えられます',
}

export default function PhotoEditor({ path, onSave, onClose }) {
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [mode, setMode] = useState('mask')
  const [drag, setDrag] = useState(null)
  const [cropBox, setCropBox] = useState(null)
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

  // 切り取り枠は写真全体から始める（回転や元に戻すで写真が変わったときも）
  useEffect(() => {
    setCropBox(mode === 'crop' && current ? { x: 0, y: 0, w: current.width, h: current.height } : null)
  }, [mode, current])

  const push = (c) => { setHistory((h) => [...h, c]); setDrag(null) }

  // 画面上の位置 → 画像のピクセル
  const toImage = (ev) => {
    const box = viewRef.current.getBoundingClientRect()
    return { x: ((ev.clientX - box.left) / box.width) * current.width, y: ((ev.clientY - box.top) / box.height) * current.height }
  }

  const onPointerDown = (ev) => {
    if (!current || saving) return
    const p = toImage(ev)
    if (mode === 'crop') {
      const handle = ev.target.closest('[data-handle]')?.dataset.handle
      if (!handle || !cropBox) return
      ev.currentTarget.setPointerCapture(ev.pointerId)
      const scale = current.width / viewRef.current.getBoundingClientRect().width
      setDrag({ handle, start: p, box: cropBox, min: Math.min(MIN_CROP_PX * scale, current.width, current.height) })
      return
    }
    ev.currentTarget.setPointerCapture(ev.pointerId)
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const onPointerMove = (ev) => {
    if (!drag) return
    const p = toImage(ev)
    if (drag.handle) {
      setCropBox(moveBox(drag.box, drag.handle, { x: p.x - drag.start.x, y: p.y - drag.start.y }, current.width, current.height, drag.min))
      return
    }
    setDrag({ ...drag, x1: p.x, y1: p.y })
  }
  const onPointerUp = () => {
    if (!drag) return
    if (drag.handle) return setDrag(null)
    const r = toRect(drag, current)
    if (r.w < MIN_SIZE || r.h < MIN_SIZE) return setDrag(null)
    push(mask(current, r))
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

  const pct = (r) => ({
    left: `${(r.x / current.width) * 100}%`, top: `${(r.y / current.height) * 100}%`,
    width: `${(r.w / current.width) * 100}%`, height: `${(r.h / current.height) * 100}%`,
  })
  const sel = mode === 'mask' && drag && current && toRect(drag, current)
  const cropped = cropBox && (Math.round(cropBox.w) < current.width || Math.round(cropBox.h) < current.height)

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
              {sel && <div className="editor-sel mask" style={pct(sel)} />}
              {cropBox && <div className="editor-clip"><div className="editor-crop-dim" style={pct(cropBox)} /></div>}
              {cropBox && (
                <div className="editor-crop" style={pct(cropBox)} data-handle="move">
                  {HANDLES.map((h) => <div key={h} className={`crop-handle ${h}`} data-handle={h} />)}
                </div>
              )}
            </div>
          )}
      </div>

      {saving ? <div className="spinner" /> : (
        <div className="editor-panel">
          <p className="muted small center">{HINTS[mode]}</p>
          {mode === 'crop' && (
            <button type="button" className="btn-primary" onClick={() => push(crop(current, cropBox))} disabled={!cropped || !!drag}>この範囲で切り取る</button>
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
