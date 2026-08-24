import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

/**
 * キーボードを画面の上に重ねる（レイアウトを潰さない）。
 *
 * Android では、キーボードが出ると Capacitor が IME の高さ分だけ WebView に
 * 余白を足す。つまり WebView 自体が縮む。全画面のレイアウト（支出を追加）は
 * 縮んだ高さに合わせて組み直されるので、電卓のキーが潰れ、フォームも狭くなる。
 *
 * 縮んだ分を `--kb-inset` に入れておき、全画面の要素は
 * `height: calc(100% + var(--kb-inset))` で元の高さを保つ。
 * レイアウトは動かず、はみ出した下側にキーボードが重なる形になる。
 *
 * 高さはプラグインの通知値ではなく実測（縮む前との差）を使う。アニメーション
 * 中の resize ごとに測るので、開閉の途中でも合計の高さが変わらない。
 *
 * 「縮む前の高さ」は keyboardWillShow の時点では測れない。イベントが JS に
 * 届くのは非同期で、その前に WebView が縮んでいることがあるため（実機で
 * 効かなかった原因）。代わりに、これまでに見た最大の高さを覚えておく。
 * イベントの順序に関係なく必ず正しい差が出る。
 *
 * Web では何もしない（キーボードで縮まないため）。
 */

const VAR = '--kb-inset'
const isNative = () => Capacitor.isNativePlatform()

// 縮む前の高さ＝これまでに見た最大の高さ。幅が変わったら測り直す
let maxHeight = 0
let lastWidth = 0

function setInset(px) {
  document.documentElement.style.setProperty(VAR, `${px}px`)
}

function measure() {
  const h = window.innerHeight
  // 回転・分割画面は幅が変わる。キーボードと区別できるので基準を取り直す
  if (window.innerWidth !== lastWidth) {
    lastWidth = window.innerWidth
    maxHeight = h
  } else if (h > maxHeight) {
    maxHeight = h
  }
  setInset(Math.max(0, maxHeight - h))
}

/** 縦スクロールできる一番近い親 */
function scrollParent(el) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

/**
 * 入力中の欄がキーボードに隠れていたらスクロールして出す。
 * WebView が縮んでいるので、見えている下端はそのまま innerHeight。
 */
function ensureFocusVisible() {
  const el = document.activeElement
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return
  const over = el.getBoundingClientRect().bottom - window.innerHeight + 12
  if (over <= 0) return
  scrollParent(el)?.scrollBy(0, over)
}

export function useKeyboardInset() {
  useEffect(() => {
    if (!isNative()) return

    lastWidth = window.innerWidth
    maxHeight = window.innerHeight
    setInset(0)

    const handles = []
    let cancelled = false
    const add = (name, fn) => {
      Keyboard.addListener(name, fn).then((h) => (cancelled ? h.remove() : handles.push(h)))
    }

    // イベントは「測り直す合図」としてだけ使う。高さの基準は measure が持つ
    add('keyboardWillShow', measure)
    add('keyboardDidShow', () => { measure(); ensureFocusVisible() })
    add('keyboardWillHide', measure)
    add('keyboardDidHide', measure)

    const onResize = () => {
      measure()
      ensureFocusVisible()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      handles.forEach((h) => h.remove())
      window.removeEventListener('resize', onResize)
      setInset(0)
    }
  }, [])
}
