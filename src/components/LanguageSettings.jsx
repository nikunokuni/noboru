// マイページ：言語の設定（参拝の手引きの図解が、選んだ言語のものになる）
import React from 'react'
import { LANGS, setLanguage, useLanguage } from '../hooks/useLanguage'

export default function LanguageSettings() {
  const lang = useLanguage()
  return (
    <section className="mt24">
      <div className="section-mini">言語 / Language</div>
      <div className="tab-row lang-row" role="radiogroup" aria-label="言語">
        {LANGS.map((l) => (
          <button key={l.key} type="button" role="radio" aria-checked={lang === l.key}
            className={`tab-btn${lang === l.key ? ' active' : ''}`} onClick={() => setLanguage(l.key)}>
            {l.label}
          </button>
        ))}
      </div>
    </section>
  )
}
