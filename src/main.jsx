import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !import.meta.env[k])

if (missing.length) {
  // 設定がないまま起動すると真っ白になるので、原因を表示する
  root.render(
    <div className="app-shell">
      <div className="page-content">
        <h1 className="page-title mt24">設定が見つかりません</h1>
        <p className="memo mt16">次の環境変数が設定されていないため、ノボルを起動できません。</p>
        <ul className="memo">{missing.map((k) => <li key={k}><code>{k}</code></li>)}</ul>
        <p className="memo">設定してから、もう一度ビルド（公開サービスなら再デプロイ）してください。</p>
      </div>
    </div>,
  )
} else {
  import('./App').then(({ default: App }) => {
    root.render(<React.StrictMode><App /></React.StrictMode>)
  })
}
