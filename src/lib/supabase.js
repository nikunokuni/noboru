import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, supabaseAnonKey)

// fetch 失敗（圏外など）かどうか
export function isNetworkError(error) {
  if (!error) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(error.message || error)
  return /Failed to fetch|NetworkError|Load failed|network/i.test(msg)
}
