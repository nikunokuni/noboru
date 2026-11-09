// 「駅から歩いた」：自分の記録の「あるく」に、最寄り駅までの往復の距離を足す
import React from 'react'

export default function WalkedFromStation({ checked, onChange }) {
  return (
    <div className="field-wrap">
      <label className="check-row">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>最寄り駅から歩いた</span>
      </label>
      <p className="muted small">マイページの「あるく」に、最寄り駅までの往復の距離（直線）を足します。「現地で記録」の記録だけ数えます</p>
    </div>
  )
}
