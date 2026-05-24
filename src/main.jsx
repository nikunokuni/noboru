import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib.js'
import { BottomNav, HomePage, RecordsPage, SearchPage, ShrinePage, ProfilePage } from './pages.jsx'

// ============================================================
// グローバルCSS（和紙テーマ）
// ============================================================
const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;600&family=Shippori+Mincho:wght@400;500;600&display=swap');

:root {
  --ink: #1a1208;
  --paper: #f5f0e8;
  --paper2: #ede7d9;
  --vermillion: #c0392b;
  --vermillion-bg: rgba(192,57,43,0.07);
  --gold: #b8960c;
  --gold-bg: rgba(184,150,12,0.08);
  --mist: #8b9ea8;
  --font-mincho: 'Shippori Mincho', serif;
  --font-body: 'Noto Serif JP', serif;
}
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html, body, #root { height:100%; }
body { background:#111008; font-family:var(--font-body); color:var(--ink); -webkit-font-smoothing:antialiased; }
#root { display:flex; justify-content:center; }
.app-shell { width:100%; max-width:430px; min-height:100vh; background:var(--paper); position:relative; }
.page-content { padding:16px 20px 100px; }

/* Top bar */
.top-bar { display:flex; align-items:center; justify-content:space-between; padding:12px 20px 10px; position:sticky; top:0; background:var(--paper); z-index:50; border-bottom:1px solid rgba(26,18,8,0.08); }
.app-logo { font-family:var(--font-mincho); font-size:22px; font-weight:600; letter-spacing:0.15em; }
.app-logo span { color:var(--vermillion); }
.page-title { font-family:var(--font-mincho); font-size:16px; letter-spacing:0.15em; }
.back-btn { font-size:22px; color:rgba(26,18,8,0.4); background:none; border:none; cursor:pointer; padding:4px 8px 4px 0; }

/* Bottom nav */
.bottom-nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; height:64px; background:var(--paper); border-top:1px solid rgba(26,18,8,0.1); display:flex; align-items:center; justify-content:space-around; z-index:100; }
.nav-item { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 16px; cursor:pointer; border:none; background:none; color:rgba(26,18,8,0.35); font-family:var(--font-mincho); font-size:9px; letter-spacing:0.12em; transition:color 0.2s; }
.nav-item.active { color:var(--vermillion); }

/* Form */
.field-wrap { margin-bottom:20px; }
.field-label { font-size:9px; letter-spacing:0.25em; color:var(--vermillion); margin-bottom:6px; opacity:0.85; display:block; }
.field-input { width:100%; background:transparent; border:none; border-bottom:1.5px solid rgba(26,18,8,0.2); padding:8px 0; font-family:var(--font-mincho); font-size:16px; color:var(--ink); letter-spacing:0.05em; outline:none; transition:border-color 0.2s; }
.field-input:focus { border-bottom-color:var(--vermillion); }
.field-input::placeholder { color:rgba(26,18,8,0.25); font-size:13px; }
.field-textarea { width:100%; background:transparent; border:none; border-bottom:1px solid rgba(26,18,8,0.1); padding:8px 0; font-family:var(--font-body); font-size:13px; line-height:2; color:var(--ink); resize:none; outline:none; min-height:100px; transition:border-color 0.2s; }
.field-textarea:focus { border-bottom-color:var(--vermillion); }
.field-textarea::placeholder { color:rgba(26,18,8,0.3); }

/* Tabs */
.tab-row { display:flex; border-bottom:1px solid rgba(26,18,8,0.1); margin-bottom:16px; }
.tab-btn { flex:1; text-align:center; padding:10px 0; font-family:var(--font-mincho); font-size:11px; letter-spacing:0.2em; color:rgba(26,18,8,0.35); background:none; border:none; cursor:pointer; position:relative; transition:color 0.2s; }
.tab-btn.active { color:var(--vermillion); }
.tab-btn.active::after { content:''; position:absolute; bottom:-1px; left:20%; right:20%; height:1.5px; background:var(--vermillion); border-radius:1px; }

/* Buttons */
.btn-primary { width:100%; padding:14px; background:var(--ink); color:var(--paper); border:none; border-radius:4px; font-family:var(--font-mincho); font-size:13px; letter-spacing:0.3em; cursor:pointer; position:relative; overflow:hidden; transition:opacity 0.2s; }
.btn-primary::before { content:''; position:absolute; left:0; top:0; width:3px; height:100%; background:var(--vermillion); }
.btn-primary:hover { opacity:0.85; }
.btn-primary:disabled { opacity:0.5; cursor:not-allowed; }

/* Misc */
.section-mini { font-size:9px; letter-spacing:0.25em; color:rgba(26,18,8,0.35); margin:16px 0 8px; }
.card { background:var(--paper2); border-radius:10px; padding:14px 16px; margin-bottom:10px; }
.pill { font-size:10px; padding:3px 10px; background:var(--vermillion-bg); color:var(--vermillion); border-radius:20px; border:1px solid rgba(192,57,43,0.15); display:inline-block; }
.spinner { width:20px; height:20px; border:2px solid rgba(26,18,8,0.1); border-top-color:var(--vermillion); border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto; }
@keyframes spin { to { transform:rotate(360deg); } }
.toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--ink); color:var(--paper); font-family:var(--font-mincho); font-size:12px; letter-spacing:0.12em; padding:10px 20px; border-radius:20px; z-index:200; animation:toastIn 0.3s ease; white-space:nowrap; }
@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
`

// CSSをheadに注入
const style = document.createElement('style')
style.textContent = css
document.head.appendChild(style)

// ============================================================
// ルーティング
// ============================================================
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<><HomePage    /><BottomNav /></>} />
          <Route path="/records"  element={<><RecordsPage /><BottomNav /></>} />
          <Route path="/search"   element={<><SearchPage  /><BottomNav /></>} />
          <Route path="/shrine/:id" element={<ShrinePage />} />
          <Route path="/profile"  element={<><ProfilePage /><BottomNav /></>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
