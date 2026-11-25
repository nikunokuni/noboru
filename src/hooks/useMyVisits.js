// 自分が参拝した神社と最初の参拝日（コレクション用）。送信済みの記録と未送信の記録を合わせる
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { usePendingRecords } from './usePendingRecords'
import { fetchMyRecords } from '../lib/records'
import { firstVisits } from '../lib/collections'

// 戻り値: { visits: Map(神社ID → 最初の参拝日) | null（読み込み中）, failed }
export function useMyVisits() {
  const { user } = useAuth()
  const { pending, syncRevision } = usePendingRecords()
  const [records, setRecords] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user) { setRecords([]); return }
    fetchMyRecords(user.id)
      .then((r) => { setRecords(r); setFailed(false) })
      .catch(() => { setRecords((prev) => prev || []); setFailed(true) })
  }, [user, syncRevision])

  const visits = useMemo(() => records && firstVisits([...records, ...pending]), [records, pending])
  return { visits, failed }
}
