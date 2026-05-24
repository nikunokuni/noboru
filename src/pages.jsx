// ============================================================
// pages.jsx — ノボル 全画面 + 共通コンポーネント
// BottomNav / EmotionSlider / OmikujiModal / GodMessage
// HomePage / RecordsPage / SearchPage / ShrinePage / ProfilePage
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  supabase, compressImage,
  getGodMessage, interpretOmikuji, readOmikujiFromImage,
  useAuth, useToast,
} from './lib.js'

// ─── 令和日付 ────────────────────────────────────────────────
const reiwaToday = () => {
  const d = new Date()
  const y = d.getFullYear() - 2018
  const months = ['一','二','三','四','五','六','七','八','九','十','十一','十二']
  return `令和${y}年　${months[d.getMonth()]}月${d.getDate()}日`
}

const formatDate = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`
}

// ─── BottomNav ───────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/', label: '記録', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/records', label: '一覧', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/search', label: '神社', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/profile', label: 'マイページ', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ path, label, icon }) => (
        <button key={path} className={`nav-item ${pathname === path ? 'active' : ''}`} onClick={() => navigate(path)}>
          {icon}{label}
        </button>
      ))}
    </nav>
  )
}

// ─── EmotionSlider ───────────────────────────────────────────
function EmotionSlider({ value, onChange }) {
  const color = value >= 75 ? '#c0392b' : value >= 45 ? '#b8960c' : 'rgba(26,18,8,0.3)'
  const label = value >= 80 ? '魂が震えた' : value >= 60 ? '深く感動した' : value >= 40 ? 'とても良かった' : value >= 20 ? '穏やかな気持ち' : '静かな気づき'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mincho)', fontSize: 13, color, letterSpacing: '0.08em', transition: 'color 0.3s' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--mist)' }}>{value}</span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left:0, right:0, height:4, background:'var(--paper2)', borderRadius:2 }} />
        <div style={{ position:'absolute', left:0, width:`${value}%`, height:4, background:`linear-gradient(90deg,#e8c4b8,${color})`, borderRadius:2, transition:'width 0.1s,background 0.3s' }} />
        <input type="range" min="0" max="100" value={value} onChange={e => onChange(+e.target.value)}
          style={{ position:'absolute', left:0, right:0, width:'100%', opacity:0, height:20, cursor:'pointer', margin:0 }} />
        <div style={{ position:'absolute', left:`calc(${value}% - 8px)`, width:16, height:16, background:color, border:'2.5px solid var(--paper)', borderRadius:'50%', boxShadow:'0 2px 6px rgba(192,57,43,0.3)', transition:'left 0.1s,background 0.3s', pointerEvents:'none' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
        <span style={{ fontSize:8, color:'rgba(26,18,8,0.3)', letterSpacing:'0.1em' }}>静かな気づき</span>
        <span style={{ fontSize:8, color:'rgba(26,18,8,0.3)', letterSpacing:'0.1em' }}>魂が震えた</span>
      </div>
    </div>
  )
}

// ─── OmikujiModal ────────────────────────────────────────────
function OmikujiModal({ onClose }) {
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [imgData, setImgData] = useState(null)
  const [imgMime, setImgMime] = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const onImage = (e) => {
    const f = e.target.files[0]; if (!f) return
    setImgMime(f.type)
    const r = new FileReader()
    r.onload = (ev) => { setImgPreview(ev.target.result); setImgData(ev.target.result.split(',')[1]) }
    r.readAsDataURL(f)
  }

  const submit = async () => {
    setLoading(true); setResult('')
    try {
      setResult(mode === 'image' && imgData
        ? await readOmikujiFromImage(imgData, imgMime)
        : await interpretOmikuji(text))
    } catch { setResult('読み取りに失敗しました。もう一度お試しください。') }
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(26,18,8,0.7)', display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'var(--paper)', borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontFamily:'var(--font-mincho)', fontSize:16, letterSpacing:'0.15em' }}>🎴 おみくじAI</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'rgba(26,18,8,0.4)', cursor:'pointer' }}>✕</button>
        </div>
        <div className="tab-row">
          <button className={`tab-btn ${mode==='text'?'active':''}`} onClick={() => setMode('text')}>テキスト入力</button>
          <button className={`tab-btn ${mode==='image'?'active':''}`} onClick={() => setMode('image')}>写真で読む</button>
        </div>
        {mode === 'text'
          ? <textarea className="field-textarea" placeholder="おみくじの内容を入力..." value={text} onChange={e => setText(e.target.value)} style={{ minHeight:120 }} />
          : imgPreview
            ? <div style={{ marginBottom:12, textAlign:'center' }}>
                <img src={imgPreview} alt="" style={{ maxWidth:'100%', maxHeight:200, borderRadius:8, objectFit:'contain' }} />
                <button onClick={() => { setImgPreview(null); setImgData(null) }} style={{ display:'block', margin:'8px auto 0', fontSize:11, color:'var(--mist)', background:'none', border:'none', cursor:'pointer' }}>画像を変更</button>
              </div>
            : <div onClick={() => fileRef.current.click()} style={{ border:'1.5px dashed rgba(26,18,8,0.2)', borderRadius:10, padding:'32px 20px', textAlign:'center', cursor:'pointer', marginBottom:12 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📷</div>
                <div style={{ fontSize:12, color:'var(--mist)', fontFamily:'var(--font-mincho)', letterSpacing:'0.1em' }}>おみくじの写真を選択</div>
              </div>
        }
        <input type="file" accept="image/*" ref={fileRef} onChange={onImage} style={{ display:'none' }} />
        <button className="btn-primary" onClick={submit} disabled={loading || (mode==='text'?!text.trim():!imgData)} style={{ marginTop:12 }}>
          {loading ? '読み取り中...' : 'AIに読んでもらう'}
        </button>
        {result && (
          <div style={{ marginTop:20, padding:16, background:'var(--gold-bg)', borderRadius:10, border:'1px solid rgba(184,150,12,0.15)' }}>
            <div style={{ fontSize:9, letterSpacing:'0.2em', color:'var(--gold)', marginBottom:8 }}>AIの解釈</div>
            <div style={{ fontSize:13, lineHeight:1.9, color:'var(--ink)' }}>{result}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── GodMessage ──────────────────────────────────────────────
function GodMessage({ shrineName, emotionLevel, memo }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const fetch_ = async () => {
    if (!shrineName) return
    setLoading(true)
    try { setMessage(await getGodMessage(shrineName, emotionLevel, memo)) }
    catch { setMessage('メッセージを受け取れませんでした') }
    setLoading(false)
  }

  if (message) return (
    <div style={{ padding:16, background:'linear-gradient(135deg,rgba(184,150,12,0.06),rgba(192,57,43,0.04))', borderRadius:10, border:'1px solid rgba(184,150,12,0.15)', marginBottom:20, textAlign:'center' }}>
      <div style={{ fontSize:9, letterSpacing:'0.25em', color:'var(--gold)', marginBottom:10 }}>神様からのことば</div>
      <div style={{ fontSize:15, lineHeight:1.9, fontFamily:'var(--font-mincho)', letterSpacing:'0.08em' }}>{message}</div>
      <button onClick={() => setMessage('')} style={{ marginTop:12, fontSize:10, color:'var(--mist)', background:'none', border:'none', cursor:'pointer', letterSpacing:'0.1em' }}>もう一度受け取る</button>
    </div>
  )

  return (
    <button onClick={fetch_} disabled={loading || !shrineName} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'linear-gradient(135deg,rgba(184,150,12,0.07),rgba(192,57,43,0.05))', borderRadius:8, border:'1px solid rgba(184,150,12,0.18)', marginBottom:16, cursor:shrineName?'pointer':'not-allowed', textAlign:'left', opacity:shrineName?1:0.5 }}>
      <span style={{ fontSize:20 }}>✨</span>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:'var(--font-mincho)', fontSize:12, color:'var(--ink)', letterSpacing:'0.08em', marginBottom:2 }}>{loading?'神様に問いかけています...':'神様からのことばを受け取る'}</div>
        <div style={{ fontSize:9, color:'var(--mist)' }}>{shrineName?`${shrineName}の神様より`:'神社名を入力してください'}</div>
      </div>
      {loading ? <div className="spinner" style={{ width:16, height:16 }} /> : <span style={{ fontSize:14, color:'var(--gold)' }}>›</span>}
    </button>
  )
}

// ─── HomePage（①入力） ──────────────────────────────────────
export function HomePage() {
  const { user } = useAuth()
  const { toast, showToast } = useToast()
  const [shrineName, setShrineName] = useState('')
  const [emotion, setEmotion] = useState(50)
  const [tab, setTab] = useState('public')
  const [publicMemo, setPublicMemo] = useState('')
  const [privateMemo, setPrivateMemo] = useState('')
  const [nextMemo, setNextMemo] = useState('')
  const [photos, setPhotos] = useState([])
  const [showOmikuji, setShowOmikuji] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const onPhotoSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (photos.length + files.length > 5) { showToast('写真は最大5枚まで'); return }
    for (const f of files) {
      try {
        const compressed = await compressImage(f, 100)
        setPhotos(prev => [...prev, { file: compressed, preview: URL.createObjectURL(compressed) }])
      } catch { showToast('画像の処理に失敗しました') }
    }
    e.target.value = ''
  }

  const save = async () => {
    if (!shrineName.trim()) { showToast('神社名を入力してください'); return }
    if (!user) { showToast('ログインが必要です'); return }
    setSaving(true)
    try {
      const { data: shrine } = await supabase.from('shrines').upsert({ name: shrineName.trim() }, { onConflict: 'name' }).select().single()
      const { data: record, error } = await supabase.from('records').insert({
        user_id: user.id, shrine_name: shrineName.trim(), shrine_id: shrine?.id ?? null,
        emotion_level: emotion, public_memo: publicMemo, private_memo: privateMemo,
        next_memo: nextMemo, is_public: true, visited_at: new Date().toISOString(),
      }).select().single()
      if (error) throw error
      for (const p of photos) {
        const path = `${user.id}/${record.id}/${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, p.file, { contentType: 'image/jpeg' })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
          await supabase.from('photos').insert({ record_id: record.id, user_id: user.id, url: publicUrl, path })
        }
      }
      showToast('記録しました　⛩')
      setShrineName(''); setEmotion(50); setPublicMemo(''); setPrivateMemo(''); setNextMemo(''); setPhotos([])
    } catch { showToast('保存に失敗しました') }
    setSaving(false)
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="app-logo">ノ<span>ボ</span>ル</div>
        <div style={{ fontSize:11, color:'var(--mist)', letterSpacing:'0.15em' }}>{reiwaToday()}</div>
      </div>
      <div className="page-content">
        <div className="field-wrap">
          <label className="field-label">神社名</label>
          <input className="field-input" placeholder="神社の名前を入力..." value={shrineName} onChange={e => setShrineName(e.target.value)} />
        </div>
        <div className="field-wrap">
          <label className="field-label">感動の温度</label>
          <EmotionSlider value={emotion} onChange={setEmotion} />
        </div>
        <GodMessage shrineName={shrineName} emotionLevel={emotion} memo={publicMemo} />
        <button onClick={() => setShowOmikuji(true)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'var(--gold-bg)', borderRadius:8, border:'1px solid rgba(184,150,12,0.18)', marginBottom:20, cursor:'pointer', textAlign:'left' }}>
          <span style={{ fontSize:20 }}>🎴</span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-mincho)', fontSize:12, color:'var(--ink)', letterSpacing:'0.08em', marginBottom:2 }}>おみくじをAIに読んでもらう</div>
            <div style={{ fontSize:9, color:'var(--mist)' }}>写真かテキストで入力</div>
          </div>
          <span style={{ fontSize:14, color:'var(--gold)' }}>›</span>
        </button>
        <div className="tab-row">
          <button className={`tab-btn ${tab==='public'?'active':''}`} onClick={() => setTab('public')}>公開</button>
          <button className={`tab-btn ${tab==='private'?'active':''}`} onClick={() => setTab('private')}>非公開</button>
        </div>
        {tab === 'public'
          ? <textarea className="field-textarea" placeholder="感想・口コミ・穴場情報（みんなに公開されます）" value={publicMemo} onChange={e => setPublicMemo(e.target.value)} />
          : <textarea className="field-textarea" placeholder="個人的な気づき・深い内省（自分だけが見えます）" value={privateMemo} onChange={e => setPrivateMemo(e.target.value)} />
        }
        <div className="field-wrap" style={{ marginTop:12 }}>
          <label className="field-label">次回へのメモ</label>
          <input className="field-input" placeholder="次回また来たいときのために..." value={nextMemo} onChange={e => setNextMemo(e.target.value)} />
        </div>
        <div className="section-mini">写真（最大5枚）</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position:'relative' }}>
              <img src={p.preview} alt="" style={{ width:72, height:72, objectFit:'cover', borderRadius:8 }} />
              <button onClick={() => setPhotos(prev => prev.filter((_,j) => j!==i))} style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'var(--ink)', color:'var(--paper)', border:'none', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
          ))}
          {photos.length < 5 && (
            <div onClick={() => fileRef.current.click()} style={{ width:72, height:72, borderRadius:8, background:'var(--paper2)', border:'1.5px dashed rgba(26,18,8,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'rgba(26,18,8,0.2)', cursor:'pointer' }}>＋</div>
          )}
          <input type="file" accept="image/*" multiple ref={fileRef} onChange={onPhotoSelect} style={{ display:'none' }} />
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '記録中...' : '記　録　す　る'}</button>
      </div>
      {showOmikuji && <OmikujiModal onClose={() => setShowOmikuji(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ─── RecordsPage（②一覧） ───────────────────────────────────
const FILTERS = [
  { key:'all', label:'すべて' }, { key:'high', label:'感動大' },
  { key:'photo', label:'写真あり' }, { key:'public', label:'公開済み' }, { key:'private', label:'非公開' },
]

export function RecordsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase.from('records').select('*, photos(url)').eq('user_id', user.id).order('visited_at', { ascending:false })
      .then(({ data }) => { setRecords(data||[]); setLoading(false) })
  }, [user])

  const filtered = records.filter(r =>
    filter==='high' ? r.emotion_level>=75 :
    filter==='photo' ? r.photos?.length>0 :
    filter==='public' ? r.is_public :
    filter==='private' ? !r.is_public : true
  )

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div style={{ width:24 }} /><div className="page-title">記録の一覧</div><div style={{ width:24 }} />
      </div>
      <div className="page-content">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ fontSize:10, padding:'4px 12px', borderRadius:20, background:filter===f.key?'rgba(192,57,43,0.08)':'var(--paper2)', color:filter===f.key?'var(--vermillion)':'rgba(26,18,8,0.5)', border:filter===f.key?'1px solid rgba(192,57,43,0.2)':'1px solid transparent', cursor:'pointer', fontFamily:'var(--font-mincho)', letterSpacing:'0.1em' }}>{f.label}</button>
          ))}
        </div>
        {loading ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>
          : filtered.length===0 ? <div style={{ textAlign:'center', padding:60, color:'var(--mist)', fontFamily:'var(--font-mincho)', fontSize:13, letterSpacing:'0.12em' }}>まだ記録がありません</div>
          : filtered.map(r => {
            const color = r.emotion_level>=75?'var(--vermillion)':r.emotion_level>=45?'var(--gold)':'rgba(26,18,8,0.2)'
            const marks = r.emotion_level>=75?'▲▲▲':r.emotion_level>=45?'▲▲':'▲'
            const thumb = r.photos?.[0]?.url
            return (
              <div key={r.id} className="card" style={{ borderLeft:`3px solid ${color}`, cursor:'pointer', display:'flex', gap:10 }} onClick={() => navigate(`/shrine/${r.shrine_id||'unknown'}`)}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color, marginBottom:4 }}>{marks}</div>
                  <div style={{ fontFamily:'var(--font-mincho)', fontSize:16, letterSpacing:'0.08em', marginBottom:3 }}>{r.shrine_name}</div>
                  <div style={{ fontSize:10, color:'var(--mist)', marginBottom:6 }}>{formatDate(r.visited_at)}</div>
                  {r.public_memo && <div style={{ fontSize:11, color:'rgba(26,18,8,0.55)', lineHeight:1.6, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{r.public_memo}</div>}
                </div>
                {thumb && <img src={thumb} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:6, flexShrink:0 }} />}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ─── SearchPage（③神社検索） ─────────────────────────────────
export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [popular, setPopular] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('shrines').select('*').order('created_at', { ascending:false }).limit(10)
      .then(({ data }) => setPopular(data||[]))
  }, [])

  const search = async (q) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase.from('shrines').select('*').ilike('name', `%${q}%`).limit(20)
    setResults(data||[]); setLoading(false)
  }

  const list = query ? results : popular

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div style={{ width:24 }} /><div className="page-title">神社を探す</div><div style={{ width:24 }} />
      </div>
      <div className="page-content">
        <div style={{ position:'relative', marginBottom:20 }}>
          <input className="field-input" placeholder="神社名で検索..." value={query} onChange={e => search(e.target.value)} style={{ paddingRight:32 }} />
          <span style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--mist)' }}>🔍</span>
        </div>
        {!query && <div className="section-mini">みんなが記録した神社</div>}
        {loading ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>
          : list.length===0 ? <div style={{ textAlign:'center', padding:40, color:'var(--mist)', fontFamily:'var(--font-mincho)', fontSize:13 }}>{query?'見つかりませんでした':'まだ登録された神社がありません'}</div>
          : list.map(s => (
            <div key={s.id} className="card" style={{ cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }} onClick={() => navigate(`/shrine/${s.id}`)}>
              <div>
                <div style={{ fontFamily:'var(--font-mincho)', fontSize:15, letterSpacing:'0.08em', marginBottom:3 }}>⛩️ {s.name}</div>
                {s.location && <div style={{ fontSize:10, color:'var(--mist)' }}>{s.location}</div>}
              </div>
              <span style={{ fontSize:18, color:'rgba(26,18,8,0.25)' }}>›</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── ShrinePage（③神社詳細） ─────────────────────────────────
export function ShrinePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shrine, setShrine] = useState(null)
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState({ count:0, avg:'—', photos:0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('shrines').select('*').eq('id', id).single(),
      supabase.from('records').select('*, photos(url)').eq('shrine_id', id).eq('is_public', true).order('visited_at', { ascending:false }).limit(20),
    ]).then(([{ data:s }, { data:recs }]) => {
      setShrine(s)
      setRecords(recs||[])
      if (recs?.length) {
        const avg = recs.reduce((a,r) => a+r.emotion_level, 0) / recs.length
        const photos = recs.reduce((a,r) => a+(r.photos?.length||0), 0)
        setStats({ count:recs.length, avg:(avg/20).toFixed(1), photos })
      }
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="app-shell" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><div className="spinner" /></div>

  return (
    <div className="app-shell">
      <div style={{ height:120, background:'linear-gradient(180deg,#d4c4a8,#c4b090)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52 }}>⛩️</div>
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--paper)', padding:'8px 20px', borderBottom:'1px solid rgba(26,18,8,0.08)', display:'flex', alignItems:'center' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
      </div>
      <div className="page-content" style={{ paddingTop:16 }}>
        <div style={{ fontFamily:'var(--font-mincho)', fontSize:22, letterSpacing:'0.1em', marginBottom:4 }}>{shrine?.name}</div>
        {shrine?.location && <div style={{ fontSize:11, color:'var(--mist)', marginBottom:12 }}>{shrine.location}</div>}
        {shrine?.tags?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
            {shrine.tags.map((t,i) => <span key={i} className="pill">{t}</span>)}
          </div>
        )}
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {[['記録数', stats.count],['感動平均', stats.avg],['写真', stats.photos]].map(([label, num]) => (
            <div key={label} style={{ flex:1, textAlign:'center', background:'var(--paper2)', borderRadius:8, padding:'10px 4px' }}>
              <div style={{ fontFamily:'var(--font-mincho)', fontSize:20 }}>{num}</div>
              <div style={{ fontSize:9, color:'var(--mist)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div className="section-mini">みんなの記録</div>
        {records.length===0
          ? <div style={{ textAlign:'center', padding:32, color:'var(--mist)', fontSize:12, fontFamily:'var(--font-mincho)' }}>まだ記録がありません</div>
          : records.map(r => (
            <div key={r.id} style={{ padding:'12px 0', borderBottom:'1px solid rgba(26,18,8,0.07)' }}>
              <div style={{ fontSize:10, color:'var(--mist)', marginBottom:4 }}>{r.user_id?.slice(0,6)}…　{formatDate(r.visited_at)}</div>
              {r.public_memo && <div style={{ fontSize:12, color:'rgba(26,18,8,0.65)', lineHeight:1.7 }}>{r.public_memo}</div>}
              {r.photos?.length>0 && (
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  {r.photos.slice(0,3).map((p,i) => <img key={i} src={p.url} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:6 }} />)}
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── ProfilePage（⑤マイページ） ─────────────────────────────
const BADGES = [
  { id:'first',  icon:'⛩️', name:'初参拝',   ok: s => s.total>=1 },
  { id:'ten',    icon:'🌟', name:'10社達成',  ok: s => s.total>=10 },
  { id:'spring', icon:'🌸', name:'春の参拝',  ok: s => s.total>=1 },
  { id:'mountain',icon:'🗻',name:'山岳神社',  ok: s => s.total>=3 },
  { id:'sea',    icon:'🌊', name:'海の神社',  ok: s => s.total>=5 },
  { id:'fifty',  icon:'🎌', name:'50社達成',  ok: s => s.total>=50 },
]

const TITLES = [
  [0,'参拝初心者'],[5,'氏子'],[15,'神主見習い'],[30,'神主'],[50,'大神主'],[100,'神域の訪人'],
]

export function ProfilePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [stats, setStats] = useState({ total:0, avgEmotion:0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('records').select('emotion_level').eq('user_id', user.id).then(({ data }) => {
      const total = data?.length||0
      const avg = total>0 ? (data.reduce((s,r) => s+r.emotion_level, 0)/total/20).toFixed(1) : 0
      setStats({ total, avgEmotion:avg })
      setLoading(false)
    })
  }, [user])

  if (!user) return (
    <div className="app-shell">
      <div className="top-bar"><div style={{ width:24 }} /><div className="page-title">マイページ</div><div style={{ width:24 }} /></div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 40px', gap:20 }}>
        <div style={{ fontSize:48 }}>⛩️</div>
        <div style={{ fontFamily:'var(--font-mincho)', fontSize:16, letterSpacing:'0.12em', textAlign:'center', lineHeight:1.8 }}>記録を残すには<br />ログインが必要です</div>
        <button className="btn-primary" onClick={signInWithGoogle} style={{ maxWidth:240 }}>Googleでログイン</button>
      </div>
    </div>
  )

  const title = TITLES.reduce((t,[min,label]) => stats.total>=min?label:t, TITLES[0][1])

  return (
    <div className="app-shell">
      <div className="top-bar"><div style={{ width:24 }} /><div className="page-title">マイページ</div><div style={{ width:24 }} /></div>
      <div className="page-content">
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(192,57,43,0.08)', border:'1.5px solid rgba(192,57,43,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 10px' }}>🌿</div>
          <div style={{ fontFamily:'var(--font-mincho)', fontSize:16, letterSpacing:'0.1em', marginBottom:6 }}>{user.email?.split('@')[0]}</div>
          <div style={{ display:'inline-block', fontSize:11, color:'var(--gold)', background:'var(--gold-bg)', border:'1px solid rgba(184,150,12,0.2)', borderRadius:20, padding:'3px 14px', letterSpacing:'0.1em', fontFamily:'var(--font-mincho)' }}>⛩ {title}</div>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {[['参拝記録', stats.total],['感動平均', stats.avgEmotion]].map(([label,num]) => (
            <div key={label} style={{ flex:1, textAlign:'center', background:'var(--paper2)', borderRadius:8, padding:'10px 4px' }}>
              <div style={{ fontFamily:'var(--font-mincho)', fontSize:22 }}>{num}</div>
              <div style={{ fontSize:9, color:'var(--mist)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div className="section-mini">バッジ</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:24 }}>
          {BADGES.map(b => {
            const earned = b.ok(stats)
            return (
              <div key={b.id} style={{ textAlign:'center', width:56 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:earned?'rgba(192,57,43,0.08)':'var(--paper2)', border:`1.5px solid ${earned?'rgba(192,57,43,0.15)':'rgba(26,18,8,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, margin:'0 auto 4px', opacity:earned?1:0.35 }}>{b.icon}</div>
                <div style={{ fontSize:8, color:earned?'rgba(26,18,8,0.6)':'rgba(26,18,8,0.3)', lineHeight:1.3 }}>{b.name}</div>
              </div>
            )
          })}
        </div>
        <div style={{ borderTop:'1px solid rgba(26,18,8,0.08)', paddingTop:20 }}>
          <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--mist)', fontFamily:'var(--font-mincho)', letterSpacing:'0.12em', padding:'8px 0' }}>ログアウト</button>
        </div>
      </div>
    </div>
  )
}
