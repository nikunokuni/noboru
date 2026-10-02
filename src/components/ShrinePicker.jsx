// 記録画面の神社選択：近くの候補（GPS）＋名前検索
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { nearbyIndex, searchIndex } from '../lib/indexCore'
import { serverSearch } from '../lib/shrineIndex'
import { formatDistance } from '../lib/geo'
import { NEARBY_LIMIT, NEARBY_RADIUS_M } from '../lib/constants'

function useDebounced(value, ms) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function ShrineRow({ item, onClick, right }) {
  return (
    <button type="button" className="shrine-row" onClick={onClick}>
      <span>
        <span className="shrine-row-name">{item.name}</span>
        <span className="muted small"> {item.prefecture}</span>
        {!item.visited && <span className="tag-unvisited">まだ誰も</span>}
      </span>
      <span className="muted small">{right}</span>
    </button>
  )
}

export default function ShrinePicker({ value, onChange, position, locating }) {
  const { index, status, revision } = useShrineIndex()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, index ? 0 : 400)
  const [serverResults, setServerResults] = useState([])
  const [searching, setSearching] = useState(false)

  const nearby = useMemo(
    () => (index && position ? nearbyIndex(index, position.lat, position.lng, { radiusM: NEARBY_RADIUS_M, limit: NEARBY_LIMIT }) : []),
    [index, revision, position],
  )

  const localResults = useMemo(
    () => (index && debounced.trim() ? searchIndex(index, debounced, { limit: 20 }) : []),
    [index, revision, debounced],
  )

  // 一覧がまだないときはサーバーで検索
  useEffect(() => {
    if (index || !debounced.trim()) { setServerResults([]); return }
    let alive = true
    setSearching(true)
    serverSearch(debounced, { limit: 20 })
      .then((r) => alive && setServerResults(r))
      .catch(() => alive && setServerResults([]))
      .finally(() => alive && setSearching(false))
    return () => { alive = false }
  }, [index, debounced])

  if (value) {
    return (
      <div className="card picked">
        <div>
          <div className="picked-name">⛩ {value.name}</div>
          <div className="muted small">{value.prefecture}{value.distance != null && `・${formatDistance(value.distance)}`}</div>
        </div>
        <button type="button" className="text-btn" onClick={() => onChange(null)}>変更</button>
      </div>
    )
  }

  const results = index ? localResults : serverResults
  const pick = (item) => { setQuery(''); onChange(item) }

  return (
    <div className="picker">
      <input
        className="field-input" placeholder="神社名・よみがなで検索" value={query}
        onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
      />
      {status === 'downloading' && <p className="muted small mt8">神社一覧を準備中…（検索はできます）</p>}

      {query.trim() ? (
        <div className="mt8">
          {searching && <div className="spinner" />}
          {!searching && results.length === 0 && <p className="muted small">見つかりませんでした</p>}
          {results.map((r) => <ShrineRow key={r.id} item={r} onClick={() => pick(r)} />)}
        </div>
      ) : (
        <div className="mt8">
          <div className="section-mini">近くの神社</div>
          {locating && !position && <p className="muted small">現在地を確認中…</p>}
          {!locating && !position && <p className="muted small">現在地を取得できませんでした。名前で検索してください</p>}
          {position && !index && <p className="muted small">神社一覧の準備ができると表示されます</p>}
          {position && index && nearby.length === 0 && <p className="muted small">{formatDistance(NEARBY_RADIUS_M)}以内に神社が見つかりません</p>}
          {nearby.map((r) => <ShrineRow key={r.id} item={r} onClick={() => pick(r)} right={formatDistance(r.distance)} />)}
        </div>
      )}
      <p className="mt8"><Link to="/request" className="inline-link">リストにない神社を申請する</Link></p>
    </div>
  )
}
