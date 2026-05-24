/**
 * 画像を100KB以下に自動圧縮する
 * Canvas APIを使ってJPEGとして再エンコード
 */
export async function compressImage(file, maxKB = 100) {
  return new Promise((resolve, reject) => {
    const maxBytes = maxKB * 1024
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')

        // 長辺を1200px以内にリサイズ
        let { width, height } = img
        const maxDim = 1200
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 品質を下げながら100KB以下になるまでループ
        let quality = 0.85
        const compress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('圧縮に失敗しました'))
                return
              }
              if (blob.size <= maxBytes || quality <= 0.1) {
                // Blobを File に変換して返す
                const compressed = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                })
                resolve(compressed)
              } else {
                quality = Math.max(quality - 0.1, 0.1)
                compress()
              }
            },
            'image/jpeg',
            quality
          )
        }
        compress()
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}
