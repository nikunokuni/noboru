// ============================================================
// lib.js — ノボル ユーティリティ全まとめ
// Supabase / Gemini API / 画像圧縮 / 認証 / Toast
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// ─── Supabase ───────────────────────────────────────────────
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ─── 画像圧縮（100KB以下になるまで繰り返す）────────────────
export async function compressImage(file, maxKB = 100) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const maxDim = 1200
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        let quality = 0.85
        const compress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('圧縮失敗'))
            if (blob.size <= maxKB * 1024 || quality <= 0.1) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
            } else { quality = Math.max(quality - 0.1, 0.1); compress() }
          }, 'image/jpeg', quality)
        }
        compress()
      }
      img.onerror = () => reject(new Error('画像読み込み失敗'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('ファイル読み込み失敗'))
    reader.readAsDataURL(file)
  })
}

// ─── Gemini API ─────────────────────────────────────────────
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`

async function gemini(parts, maxTokens = 400, temperature = 0.8) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  })
  if (!res.ok) throw new Error('Gemini APIエラー')
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

export const getGodMessage = (shrineName, emotionLevel, memo) =>
  gemini([{ text: `あなたは${shrineName}に宿る神様です。参拝者が感動レベル${emotionLevel}/100でこう体験しました：「${memo || 'ただ静かに参拝しました。'}」。この参拝者に神様として一言〜二行のメッセージを日本語で。短く詩的に。この神社の祭神・神話にまつわる言葉を自然に。余韻を残す。メッセージ本文のみ。` }], 150, 0.9)

export const interpretOmikuji = (text) =>
  gemini([{ text: `以下のおみくじを現代語でわかりやすく解釈してください（300字以内・自然な文章・前向きな表現・種類があれば最初に触れる）：「${text}」` }])

export const readOmikujiFromImage = (base64, mimeType) =>
  gemini([
    { inline_data: { mime_type: mimeType, data: base64 } },
    { text: 'このおみくじの写真を読み取り、現代語でわかりやすく解釈してください（300字以内・自然な文章・前向きな表現・種類があれば最初に触れる）' },
  ])

// ─── 認証 Context ────────────────────────────────────────────
import React from 'react'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: window.location.origin }
  })
  const signOut = () => supabase.auth.signOut()

  return React.createElement(AuthContext.Provider, { value: { user, loading, signInWithGoogle, signOut } }, children)
}

export const useAuth = () => useContext(AuthContext)

// ─── Toast hook ──────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = useCallback((msg, ms = 2500) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }, [])
  return { toast, showToast }
}
