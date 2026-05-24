const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

/**
 * 神様からのメッセージを生成する
 * @param {string} shrineName - 神社名
 * @param {number} emotionLevel - 感動レベル 0〜100
 * @param {string} memo - 参拝メモ
 */
export async function getGodMessage(shrineName, emotionLevel, memo) {
  const prompt = `あなたは${shrineName}に宿る神様です。
参拝者がこの神社を訪れ、感動レベル${emotionLevel}/100で以下のような体験をしました。

「${memo || 'ただ静かに参拝しました。'}」

この参拝者に向けて、神様として一言〜二行のメッセージを日本語で送ってください。
条件：
- 短く、詩的に、力強く
- この神社の祭神や神話にまつわる言葉を自然に織り交ぜる
- 押しつけがましくなく、余韻を残す
- 「〜でしょう」「〜ください」のような説明的な言い回しは避ける
- 回答はメッセージ本文のみ（前置き・説明不要）`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 150, temperature: 0.9 },
    }),
  })

  if (!response.ok) throw new Error('Gemini APIエラー')
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

/**
 * おみくじをAIに解釈してもらう
 * @param {string} omikujiText - おみくじのテキスト（写真OCRまたは手入力）
 */
export async function interpretOmikuji(omikujiText) {
  const prompt = `以下はおみくじの内容です。古語や難しい表現を含む場合もあります。

「${omikujiText}」

これを現代語でわかりやすく解釈・解説してください。
条件：
- 300字以内
- 箇条書きではなく自然な文章で
- 前向きで温かみのある表現で
- おみくじの種類（大吉・吉など）があれば最初に触れる`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
    }),
  })

  if (!response.ok) throw new Error('Gemini APIエラー')
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

/**
 * 写真からおみくじのテキストを読み取る（画像入力）
 * @param {string} base64Image - base64エンコードされた画像
 * @param {string} mimeType - 画像のMIMEタイプ
 */
export async function readOmikujiFromImage(base64Image, mimeType) {
  const prompt = `この画像はおみくじの写真です。
写っているテキストをすべて読み取り、その内容を現代語でわかりやすく解釈・解説してください。
条件：
- 300字以内
- 箇条書きではなく自然な文章で
- 前向きで温かみのある表現で
- おみくじの種類（大吉・吉など）があれば最初に触れる`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Image } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
    }),
  })

  if (!response.ok) throw new Error('Gemini APIエラー')
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}
