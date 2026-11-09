// マイページの「のぼる」「あるく」。現地で記録した記録から、のぼった石段・歩いた距離と、次の目標までを出す
import React, { useEffect, useState } from 'react'
import { usePendingRecords } from '../hooks/usePendingRecords'
import { fetchMyOnsiteRecords } from '../lib/records'
import {
  CLIMB_GOALS, WALK_GOALS, computeActivity, formatHeight, formatWalk, goalProgress,
} from '../lib/activity'

function Goal({ value, goals, format }) {
  const g = goalProgress(value, goals)
  return (
    <>
      <div className="goal-bar" aria-hidden="true"><span style={{ width: `${Math.round(g.ratio * 100)}%` }} /></div>
      <p className="muted small">
        {g.next
          ? <>次は「{g.next.label}」（{format(g.next.m)}）まで あと{format(g.remaining)}</>
          : <>「{goals[goals.length - 1].label}」{g.laps}回分</>}
        {g.reached && g.next && <>　✓ {g.reached.label}</>}
      </p>
    </>
  )
}

export default function ActivityPanel({ userId }) {
  const { syncRevision } = usePendingRecords()
  const [activity, setActivity] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchMyOnsiteRecords(userId)
      .then((records) => { setActivity(computeActivity(records)); setFailed(false) })
      .catch(() => setFailed(true))
  }, [userId, syncRevision])

  if (!activity) return failed ? null : <section className="mt24"><div className="section-mini">のぼる・あるく</div><div className="spinner" /></section>

  return (
    <section className="mt24">
      <div className="section-mini">のぼる</div>
      <div className="activity-num">
        {activity.steps.toLocaleString('ja-JP')}<span className="activity-unit">段</span>
        <span className="muted small">　高さ 約{formatHeight(activity.climbM)}</span>
      </div>
      <Goal value={activity.climbM} goals={CLIMB_GOALS} format={formatHeight} />
      {activity.unknownStepShrines > 0 && (
        <p className="muted small">石段の段数がわからない神社が{activity.unknownStepShrines}社あります。神社のページの「情報を追加・訂正する」で入れると、ここに足されます</p>
      )}

      <div className="section-mini mt16">あるく</div>
      <div className="activity-num">
        {formatWalk(activity.walkM)}
        {activity.stationM > 0 && <span className="muted small">　うち駅から {formatWalk(activity.stationM)}</span>}
      </div>
      <Goal value={activity.walkM} goals={WALK_GOALS} format={formatWalk} />

      <p className="muted small mt8">
        「現地で記録」の記録から数えます（同じ神社は1日1回）。のぼる＝石段の段数（1段 約17cm）。
        あるく＝同じ日に巡った神社の間の距離（直線の1.3倍）と、「最寄り駅から歩いた」記録の駅までの往復。どれも目安です
      </p>
    </section>
  )
}
