import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * ファイルの書き出し。
 *
 * Web はリンクのダウンロードで済むが、アプリ版はこれが効かない。Capacitor の
 * WebView は DownloadListener を持たず、<a download> を押しても無反応になる。
 * つまりアプリ版ではバックアップが取れていなかった。
 *
 * アプリ版は一旦キャッシュに書いてから共有シートに渡す。保存先（ドライブ・
 * ファイル・メールなど）はユーザーが選ぶ。キャッシュは FileProvider の対象。
 */

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('ファイルの作成に失敗しました'))
  // data:...;base64,xxxx から本体だけ取り出す
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
  reader.readAsDataURL(blob)
})

function downloadInBrowser(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * 保存する。結果は 'saved'（Web のダウンロード）・'shared'（共有した）・
 * 'cancelled'（共有をやめた）のいずれか。
 */
export async function saveFile(blob, fileName) {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(blob, fileName)
    return 'saved'
  }

  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  })

  try {
    await Share.share({ title: fileName, url: uri })
    return 'shared'
  } catch (e) {
    // 共有シートを閉じただけならエラー扱いにしない
    if (/cancel/i.test(e?.message ?? '')) return 'cancelled'
    throw e
  }
}
