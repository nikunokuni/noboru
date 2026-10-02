// Overpass API から1都道府県分のデータを取得
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter'

// 神社・祠、駅、バス停、駐車場、地名、市区町村の境界を一度に取得
export function buildQuery(iso) {
  return `[out:json][timeout:900][maxsize:2000000000];
area["ISO3166-2"="${iso}"]["admin_level"="4"]->.a;
(
  nwr["amenity"="place_of_worship"]["religion"="shinto"](area.a);
  nwr["historic"="wayside_shrine"]["religion"="shinto"](area.a);
);
out geom;
node["railway"="station"](area.a);
out body;
node["highway"="bus_stop"](area.a);
out body;
nwr["amenity"="parking"](area.a);
out center;
node["place"~"^(city|town|village|suburb|quarter|neighbourhood|hamlet|isolated_dwelling)$"](area.a);
out body;
rel["boundary"="administrative"]["admin_level"="7"](area.a);
out geom;`
}

export async function fetchOverpass(iso, { endpoint = DEFAULT_ENDPOINT, cacheFile = null, userAgent } = {}) {
  if (cacheFile) {
    try {
      return JSON.parse(await readFile(cacheFile, 'utf8'))
    } catch { /* キャッシュなし */ }
  }
  let lastError
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 30000 * attempt))
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent },
        body: new URLSearchParams({ data: buildQuery(iso) }),
      })
      if (res.status === 429 || res.status === 504) { lastError = new Error(`Overpass ${res.status}`); continue }
      if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`)
      const json = await res.json()
      if (cacheFile) {
        await mkdir(dirname(cacheFile), { recursive: true })
        await writeFile(cacheFile, JSON.stringify(json))
      }
      return json
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}
