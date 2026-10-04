// Overpass API から1都道府県分のデータを取得
//
// 混雑したサーバーに断られにくいよう、種類ごとの小さな問い合わせに分けて順に取得する。
// 失敗したら別のサーバー（ミラー）に切り替えてやり直す。取れた分は種類ごとにキャッシュする。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
export const DEFAULT_ENDPOINT = DEFAULT_ENDPOINTS[0]

// [名前, 表示名, 問い合わせ本体（.a = 都道府県の範囲）]
export const PARTS = [
  ['shrines', '神社', `(
  nwr["amenity"="place_of_worship"]["religion"="shinto"](area.a);
  nwr["historic"="wayside_shrine"]["religion"="shinto"](area.a);
);
out geom;`],
  ['stations', '駅', 'node["railway"="station"](area.a);\nout body;'],
  ['bus_stops', 'バス停', 'node["highway"="bus_stop"](area.a);\nout body;'],
  ['parking', '駐車場', 'nwr["amenity"="parking"](area.a);\nout center;'],
  ['places', '地名', 'node["place"~"^(city|town|village|suburb|quarter|neighbourhood|hamlet|isolated_dwelling)$"](area.a);\nout body;'],
  ['municipalities', '市区町村の境界', 'rel["boundary"="administrative"]["admin_level"="7"](area.a);\nout geom;'],
]

export function buildQuery(iso, body) {
  return `[out:json][timeout:300];
area["ISO3166-2"="${iso}"]["admin_level"="4"]->.a;
${body}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

async function writeJson(file, json) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(json))
}

async function request(endpoint, query, userAgent) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(360000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}`)
  const json = JSON.parse(text)
  // 時間切れなどはステータス200でも remark に書かれて返ってくる
  if (json.remark && /error/i.test(json.remark)) throw new Error(json.remark.slice(0, 150))
  return json
}

// 全サーバーを順に試し、だめなら少し待ってもう一巡（最大3巡）
async function fetchPart(iso, body, { endpoints, userAgent, log }) {
  let lastError
  for (let round = 0; round < 3; round++) {
    if (round) {
      log(`    すべてのサーバーが混雑しています。${30 * round}秒待ってやり直します`)
      await sleep(30000 * round)
    }
    for (const endpoint of endpoints) {
      try {
        const json = await request(endpoint, buildQuery(iso, body), userAgent)
        // つながったサーバーを次の問い合わせから先に使う
        endpoints.splice(endpoints.indexOf(endpoint), 1)
        endpoints.unshift(endpoint)
        return json
      } catch (e) {
        lastError = new Error(`Overpass ${new URL(endpoint).host}: ${e.message}`)
        log(`    ${lastError.message}`)
        await sleep(5000)
      }
    }
  }
  throw lastError
}

export async function fetchOverpass(iso, { endpoint, cacheFile = null, userAgent, log = () => {} } = {}) {
  if (cacheFile) {
    const cached = await readJson(cacheFile)
    if (cached) return cached
  }
  const endpoints = [...new Set([endpoint, ...DEFAULT_ENDPOINTS].filter(Boolean))]
  const elements = []
  for (const [key, label, body] of PARTS) {
    const partFile = cacheFile && cacheFile.replace(/\.json$/, `.${key}.json`)
    let json = partFile && await readJson(partFile)
    if (json) {
      log(`  ${label}: 保存済みのデータを使用（${json.elements.length}件）`)
    } else {
      log(`  ${label}を取得中…`)
      json = await fetchPart(iso, body, { endpoints, userAgent, log })
      log(`  ${label}: ${json.elements.length}件`)
      if (partFile) await writeJson(partFile, json)
    }
    elements.push(...json.elements)
  }
  const result = { elements }
  if (cacheFile) await writeJson(cacheFile, result)
  return result
}
