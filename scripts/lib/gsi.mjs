// 国土地理院の逆ジオコーダーで、緯度経度から「市区町村＋町字」を引く（住所が空の神社だけ）
//   https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=..&lon=..
//   → {"results":{"muniCd":"13112","lv01Nm":"上町"}}
// 市区町村コードの名前は地理院地図の muni.js（'13,東京都,13112,世田谷区' の形の行）から取る
// 1件ずつ問い合わせるので、結果は scripts/.cache/ に保存してやり直しのときは使い回す
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const API = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress'
const MUNI_URL = 'https://maps.gsi.go.jp/js/muni.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// muni.js → Map(市区町村コード（数値）→ 名前)。政令市の区は「さいたま市西区」のようにつなぐ
export function parseMuniJs(text) {
  const map = new Map()
  for (const m of text.matchAll(/'(\d+),([^,']+),(\d+),([^']*)'/g)) {
    map.set(Number(m[3]), m[4].replace(/[\s　]/g, ''))
  }
  return map
}

// 町字の名前。ないときは '-' や '－' が返る
export const cleanTownName = (s) => {
  const t = (s || '').trim()
  return t && !/^[-－ー]+$/.test(t) ? t : null
}

// 逆ジオコーダーの結果から住所（都道府県＋市区町村＋町字）と町字を作る
export function gsiAddress(result, prefecture, munis) {
  const muni = result?.muniCd ? munis.get(Number(result.muniCd)) : null
  const town = cleanTownName(result?.lv01Nm)
  if (!muni) return null
  return { address: `${prefecture}${muni}${town || ''}`, town }
}

async function getJson(url, userAgent) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(3000 * attempt)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(20000) })
      if (res.status === 429 || res.status >= 500) continue
      if (!res.ok) throw new Error(`${res.status}`)
      return await res.json()
    } catch (e) {
      if (attempt === 3) throw e
    }
  }
  throw new Error('取得に失敗しました')
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return null }
}

// rows のうち address が空のものに住所を入れる。町字は locality（近くの地名）にも使う
export async function enrichWithGsi(rows, { userAgent, cacheFile = null, log = () => {} }) {
  const res = await fetch(MUNI_URL, { headers: { 'User-Agent': userAgent } })
  if (!res.ok) throw new Error(`市区町村の一覧（${MUNI_URL}）を取得できませんでした: ${res.status}`)
  const munis = parseMuniJs(await res.text())
  if (!munis.size) throw new Error('市区町村の一覧の形式が変わったようです（muni.js）')

  const cache = (cacheFile && await readJson(cacheFile)) || {}
  const targets = rows.filter((r) => !r.address)
  log(`  住所（国土地理院）: ${targets.length}件を確認（保存済み ${targets.filter((r) => r.osm_ref in cache).length}件）`)

  let fetched = 0
  let failed = 0
  let filled = 0
  for (const r of targets) {
    if (!(r.osm_ref in cache)) {
      try {
        const json = await getJson(`${API}?lat=${r.lat}&lon=${r.lng}`, userAgent)
        cache[r.osm_ref] = json?.results ?? null
      } catch {
        failed++
        continue
      }
      fetched++
      if (fetched % 200 === 0) {
        log(`    ${fetched}件取得…`)
        if (cacheFile) await writeFile(cacheFile, JSON.stringify(cache))
      }
      await sleep(200) // サーバーへの配慮
    }
    const a = gsiAddress(cache[r.osm_ref], r.prefecture, munis)
    if (!a) continue
    r.address = a.address
    if (a.town) r.locality = a.town
    filled++
  }

  if (cacheFile) {
    await mkdir(dirname(cacheFile), { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache))
  }
  log(`  住所（国土地理院）: ${filled}件に住所を入れました${failed ? `（取得できなかった ${failed}件は次回やり直します）` : ''}`)
  return rows
}
