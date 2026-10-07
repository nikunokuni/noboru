// 神社情報の追加・訂正（情報提供）
// 神社詳細と同じ並びで全項目を表示し、変えた項目だけをまとめて送る
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { fetchShrine, submitShrineEdits, isBannedError } from '../lib/community'
import { normalizeDeities } from '../lib/deities'
import { formatDistance } from '../lib/geo'
import { GOSHUIN_LABELS, PARKING_LABELS, goshuinKinds, goshuinFromKinds } from '../lib/constants'

// type: text / textarea / tags（読点区切り）/ choice / goshuin / deities（表記をそろえる）
const FIELDS = {
  name_kana: { label: 'よみがな', type: 'text', placeholder: 'ひらがなで' },
  address: { label: '住所', type: 'text' },
  deities: { label: 'ご祭神', type: 'deities', placeholder: '読点（、）で区切る　例：素戔嗚尊、櫛稲田姫命' },
  benefits: { label: 'ご利益', type: 'tags', placeholder: '読点（、）で区切る　例：縁結び、厄除け' },
  shrine_rank: { label: '社格', type: 'text', placeholder: '例：式内社、旧郷社' },
  founded: { label: '創建', type: 'text', placeholder: '例：伝・景行天皇の御代、明治33年' },
  annual_festival: { label: '例祭', type: 'text', placeholder: '例：毎年9月15日' },
  visiting_hours: { label: '拝観時間', type: 'textarea', placeholder: '例：6:00〜17:00（冬は16:30まで）。境内は終日参拝可' },
  highlights: { label: '見どころ', type: 'textarea', placeholder: '例：樹齢800年の御神木、朱塗りの楼門' },
  nearest_station: { label: '最寄り駅', type: 'text', placeholder: '例：〇〇駅 徒歩10分' },
  nearest_bus_stop: { label: 'バス停', type: 'text', placeholder: '例：〇〇神社前 徒歩2分' },
  parking: { label: '駐車場', type: 'choice', options: PARKING_LABELS },
  access_note: { label: '補足', type: 'textarea', placeholder: '例：〇〇駅から徒歩15分。最後に長い石段あり' },
  goshuin: { label: '御朱印', type: 'goshuin' },
  goshuin_note: { label: '御朱印メモ', type: 'textarea', placeholder: '例：授与は9時〜16時。季節の限定御朱印あり' },
  features: { label: '由緒', type: 'textarea', placeholder: '創建の背景、関連する神話など' },
}

const SECTIONS = [
  ['参拝の情報', ['visiting_hours', 'goshuin', 'goshuin_note']],
  ['見どころ', ['highlights']],
  ['基本情報', ['name_kana', 'address', 'deities', 'benefits', 'shrine_rank', 'founded', 'annual_festival']],
  ['由緒', ['features']],
  ['アクセス', ['nearest_station', 'nearest_bus_stop', 'parking', 'access_note']],
]

const toInput = (field, value) => {
  if (field.type === 'tags') return (value || []).join('、')
  if (field.type === 'choice' || field.type === 'goshuin') return value || 'unknown'
  return value ?? ''
}

const toValue = (field, input) => {
  if (field.type === 'deities') return normalizeDeities(input).text
  if (field.type === 'tags') return input.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean)
  return field.type === 'choice' || field.type === 'goshuin' ? input : input.trim()
}

const initialInputs = (shrine) => Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, toInput(f, shrine[k])]))

// 変えた項目だけ { 項目名: 値 }
function diff(shrine, inputs) {
  const base = initialInputs(shrine)
  const changes = {}
  for (const [k, f] of Object.entries(FIELDS)) {
    const v = toValue(f, inputs[k])
    if (JSON.stringify(v) !== JSON.stringify(toValue(f, base[k]))) changes[k] = v
  }
  return changes
}

function GoshuinInput({ value, onChange }) {
  const kinds = goshuinKinds(value)
  const toggle = (key) => onChange(goshuinFromKinds({ ...kinds, [key]: !kinds[key] }) || 'unknown')
  return (
    <>
      <div className="chip-row">
        <button type="button" className={`chip ${kinds.direct ? 'active' : ''}`} onClick={() => toggle('direct')}>直書き</button>
        <button type="button" className={`chip ${kinds.written ? 'active' : ''}`} onClick={() => toggle('written')}>書き置き</button>
        <button type="button" className={`chip ${value === 'none' ? 'active' : ''}`} onClick={() => onChange('none')}>なし</button>
        <button type="button" className={`chip ${value === 'unknown' ? 'active' : ''}`} onClick={() => onChange('unknown')}>不明</button>
      </div>
      {value === 'available' && <p className="muted small">いまは「あり」（種類は不明）です。わかれば直書き・書き置きを選んでください</p>}
      {(kinds.direct || kinds.written) && <p className="muted small">直書きと書き置きは両方選べます</p>}
    </>
  )
}

// 同じ神様の書き方の違い（須佐之男命・スサノオ など）は代表の表記にそろえて送る
function DeitiesInput({ field, value, onChange }) {
  const { changed } = normalizeDeities(value)
  return (
    <>
      <input className="field-input edit-input" placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {changed.length > 0 && (
        <p className="muted small">
          表記をそろえて送ります：{changed.map((c) => `${c.from} → ${c.to}`).join('、')}
        </p>
      )}
    </>
  )
}

function FieldInput({ field, value, onChange }) {
  if (field.type === 'deities') return <DeitiesInput field={field} value={value} onChange={onChange} />
  if (field.type === 'goshuin') return <GoshuinInput value={value} onChange={onChange} />
  if (field.type === 'choice') {
    return (
      <div className="chip-row">
        {Object.entries(field.options).map(([v, label]) => (
          <button key={v} type="button" className={`chip ${value === v ? 'active' : ''}`} onClick={() => onChange(v)}>{label}</button>
        ))}
      </div>
    )
  }
  if (field.type === 'textarea') {
    return <textarea className="field-textarea edit-textarea" rows={3} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  }
  return <input className="field-input edit-input" placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
}

// 地図データから自動で入れた駅・バス停は、その旨と距離を添える
function AccessHint({ shrine, prefix }) {
  if (shrine[`${prefix}_by_user`] || !shrine[prefix] || shrine[`${prefix}_m`] == null) return null
  return <p className="muted small">地図データから自動で入れた値です（直線で{formatDistance(shrine[`${prefix}_m`])}）。徒歩の分数などを書き足せます</p>
}

export default function ShrineEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()
  const { showToast } = useToast()
  const [shrine, setShrine] = useState(null)
  const [inputs, setInputs] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchShrine(id).then((s) => { setShrine(s); if (s) setInputs(initialInputs(s)) }).catch(() => {})
  }, [id])

  const changes = useMemo(() => (shrine && inputs ? diff(shrine, inputs) : {}), [shrine, inputs])
  const changedCount = Object.keys(changes).length
  const set = (key) => (value) => setInputs((s) => ({ ...s, [key]: value }))

  const submit = async () => {
    if (!changedCount) { showToast('内容が変わっていません'); return }
    setSaving(true)
    try {
      await submitShrineEdits({ shrineId: shrine.id, userId: user.id, changes })
      showToast('ありがとうございます。反映しました')
      navigate(`/shrine/${shrine.id}`, { replace: true })
    } catch (e) {
      showToast(isBannedError(e) ? 'このアカウントからの情報提供は受け付けていません' : '送信に失敗しました。電波の届く場所でお試しください')
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <TopBar back title="情報の追加・訂正" />
      <div className="page-content">
        {!shrine || !inputs ? <div className="spinner" /> : (
          <>
            <div className="shrine-head">
              <h2 className="shrine-name">⛩ {shrine.name}</h2>
              <div className="muted small">{shrine.prefecture}{shrine.municipality && `・${shrine.municipality}`}</div>
            </div>

            {!user ? (
              <div className="login-panel">
                <p>情報の提供にはログインが必要です</p>
                <button className="btn-primary" onClick={signInWithGoogle}>Googleでログイン</button>
              </div>
            ) : (
              <>
                {SECTIONS.map(([title, keys]) => (
                  <section key={title}>
                    <div className="section-mini">{title}</div>
                    <dl className="info">
                      {keys.map((k) => (
                        <div key={k} className={`info-row edit-row ${k in changes ? 'changed' : ''}`}>
                          <dt>{FIELDS[k].label}</dt>
                          <dd>
                            <FieldInput field={FIELDS[k]} value={inputs[k]} onChange={set(k)} />
                            {(k === 'nearest_station' || k === 'nearest_bus_stop') && !(k in changes) && <AccessHint shrine={shrine} prefix={k} />}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}

                <p className="muted small mt16">変えた項目だけが送られ、すぐに反映されます。変更の履歴が残り、いたずらと判断した変更は管理者が元に戻します。</p>
                <div className="action-row">
                  <button className="btn-primary" onClick={submit} disabled={saving || !changedCount}>
                    {saving ? '送信中…' : changedCount ? `${changedCount}項目をまとめて送信する` : '変更はまだありません'}
                  </button>
                </div>

                <p className="mt24 small">
                  境内社・重複・現存しない神社など、一覧から外すべき場合は
                  <Link to={`/request?hide=${shrine.id}`} className="inline-link">こちらから報告</Link>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
