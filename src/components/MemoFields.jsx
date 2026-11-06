// 記録の公開設定とメモ（記録画面・記録の編集で共用）
// 「何がみんなに見えるか」を入力欄のそばに書いて、公開メモ・非公開メモ・記録の公開の関係をわかりやすくする
import React from 'react'

export function VisibilityChips({ isPublic, onChange }) {
  return (
    <div className="chip-row visibility-chips" role="group" aria-label="この記録を見られる人">
      <button type="button" className={`chip ${isPublic ? 'active' : ''}`} onClick={() => onChange(true)}>公開</button>
      <button type="button" className={`chip ${!isPublic ? 'active' : ''}`} onClick={() => onChange(false)}>非公開</button>
    </div>
  )
}

export function VisibilityNote({ isPublic }) {
  return (
    <p className="muted small">
      {isPublic
        ? '公開：神社のページの「みんなの記録」に、参拝日・感動の温度・写真・みんなへのメモが載ります（名前は出ません）'
        : '非公開：この記録は自分だけが見られます。「訪れた人」の人数や全社参拝の達成数にだけ、誰かわからない形で数えられます'}
    </p>
  )
}

export function VisibilityPicker({ isPublic, onChange }) {
  return (
    <div className="field-wrap">
      <label className="field-label">この記録を見られる人</label>
      <VisibilityChips isPublic={isPublic} onChange={onChange} />
      <VisibilityNote isPublic={isPublic} />
    </div>
  )
}

export function MemoFields({ isPublic, publicMemo, privateMemo, onChange }) {
  return (
    <>
      <div className="field-wrap">
        <label className="field-label">みんなへのメモ</label>
        <textarea className="field-textarea" value={publicMemo} onChange={(e) => onChange({ publicMemo: e.target.value })}
          placeholder={isPublic ? '感想・口コミ・穴場情報など（みんなが読めます）' : '感想・口コミ・穴場情報など（記録を「公開」にすると読まれます）'} />
      </div>
      <div className="field-wrap">
        <label className="field-label">自分だけのメモ</label>
        <textarea className="field-textarea" value={privateMemo} onChange={(e) => onChange({ privateMemo: e.target.value })}
          placeholder="個人的な気づき・深い内省など（記録を公開しても、自分以外は読めません）" />
      </div>
    </>
  )
}
