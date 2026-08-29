import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * 画像から文字を読む（端末内で完結する）。
 *
 * 読み取りは Google Play 開発者サービスが持つ日本語モデルで行う。画像は
 * 外に出ない。アプリ版だけの機能で、ブラウザでは使えない。
 */

const Ocr = registerPlugin('Ocr')

export const isOcrAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Ocr')

/**
 * 画像を読む。
 * @param {string} dataUrl data URL（画面側で縮めてから渡す）
 * @returns {Promise<{ text: string, x: number, y: number }[]>} 上から下の順
 */
export async function recognizeLines(dataUrl) {
  const { lines } = await Ocr.recognize({ image: dataUrl })
  return Array.isArray(lines) ? lines : []
}

/**
 * 読み取りに渡す前に画像を縮める。
 *
 * スクリーンショットはそのままだと数 MB あり、ネイティブへ渡すだけで
 * 待たされる。文字が潰れない幅までは落としてよい。
 */
export function shrinkImage(file, maxWidth = 1440) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像を開けませんでした'))
    }
    img.src = url
  })
}
