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
 * Web では何もしない（キーボードで縮まないため）。
 */

const VAR = '--kb-inset'
const isNative = () => Capacitor.isNativePlatform()

// キーボードが出る前の高さ。0 は「キーボードが出ていない」を表す
let baseHeight = 0
let baseWidth = 0

function setInset(px) {
  document.documentElement.style.setProperty(VAR, `${px}px`)
}

function measure() {
  setInset(baseHeight ? Math.max(0, baseHeight - window.innerHeight) : 0)
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

    const handles = []
    let cancelled = false
    const add = (name, fn) => {
      Keyboard.addListener(name, fn).then((h) => (cancelled ? h.remove() : handles.push(h)))
    }

    // 出始めはまだ縮んでいないので、ここで測った高さが元の高さになる。
    // 欄から欄へ移ったときも呼ばれるため、すでに開いていれば measure だけ。
    add('keyboardWillShow', () => {
      if (!baseHeight) {
        baseHeight = window.innerHeight
        baseWidth = window.innerWidth
      }
      measure()
    })
    add('keyboardDidShow', () => { measure(); ensureFocusVisible() })
    // 閉じる途中は resize が戻し切るので、終わってから捨てる
    add('keyboardDidHide', () => { baseHeight = 0; setInset(0) })

    const onResize = () => {
      // 回転・分割画面は幅が変わる。キーボードと区別できるので測り直す
      if (baseHeight && window.innerWidth !== baseWidth) {
        baseHeight = window.innerHeight
        baseWidth = window.innerWidth
      }
      measure()
      if (baseHeight) ensureFocusVisible()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      handles.forEach((h) => h.remove())
      window.removeEventListener('resize', onResize)
      baseHeight = 0
      setInset(0)
    }
  }, [])
}
