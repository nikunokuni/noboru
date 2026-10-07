// 近くの神社（GPS）＋名前検索。行を押すと記録、「詳しく」で神社詳細
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShrineIndex } from '../hooks/useShrineIndex'
import { nearbyIndex, searchIndex } from '../lib/indexCore'
import { serverSearch } from '../lib/shrineIndex'
import { formatDistance } from '../lib/geo'
import { placeLabel } from '../lib/format'
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
        <span className="muted small"> {placeLabel(item)}</span>
        {!item.visited && <span className="tag-unvisited">まだ誰も</span>}
      </span>
      <span className="muted small">{right}</span>
    </button>
  )
}

// 行そのものは記録へ、右の「詳しく」は神社詳細へ
function FinderRow({ item, onPick, onDetail, right }) {
  return (
    <div className="finder-row">
      <ShrineRow item={item} onClick={() => onPick(item)} right={right} />
      <button type="button" className="detail-btn" onClick={() => onDetail(item)}>詳しく</button>
    </div>
  )
}

export default function ShrineFinder({ position, locating, onPick, onDetail }) {
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

  const results = index ? localResults : serverResults
  const row = (r, right) => <FinderRow key={r.id} item={r} onPick={onPick} onDetail={onDetail} right={right} />

  return (
    <div className="picker">
      <input
        className="field-input" placeholder="神社名・よみがなで検索（例：八幡 世田谷）" value={query}
        onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
      />
      {status === 'downloading' && <p className="muted small mt8">神社一覧を準備中…（検索はできます）</p>}

      {query.trim() ? (
        <div className="mt8">
          {searching && <div className="spinner" />}
          {!searching && results.length === 0 && <p className="muted small">見つかりませんでした</p>}
          {results.map((r) => row(r))}
        </div>
      ) : (
        <div className="mt8">
          <div className="section-mini">近くの神社</div>
          {locating && !position && <p className="muted small">現在地を確認中…</p>}
          {!locating && !position && <p className="muted small">現在地を取得できませんでした。名前で検索してください</p>}
          {position && !index && <p className="muted small">神社一覧の準備ができると表示されます</p>}
          {position && index && nearby.length === 0 && <p className="muted small">{formatDistance(NEARBY_RADIUS_M)}以内に神社が見つかりません</p>}
          {nearby.map((r) => row(r, formatDistance(r.distance)))}
        </div>
      )}
      <p className="mt8"><Link to="/request" className="inline-link">リストにない神社を申請する</Link></p>
    </div>
  )
}
