import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useColorMode, resolveMode, loadThemeMode } from './useColorMode'

/**
 * 外観の切り替えは「変える画面」と「反映する画面」が別コンポーネントにある。
 * 設定 → 外観 で選んだ値を、テーマを組み立てる App 側が受け取れなければ
 * 画面の配色は変わらない。
 *
 * ここで見るのはその 1 点だけ。以前 useColorMode がフックの中に useState を
 * 持っていたため、呼び出しごとに別の state になり、設定画面の表示だけ変わって
 * 画面が変わらなかった（保存はできていたので、再起動すると直る＝気づきにくい）。
 */

let container
let root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

// 反映する側（App 役）。今の配色を書き出すだけ
function Consumer() {
  const { resolved } = useColorMode()
  return <span data-testid="applied">{resolved}</span>
}

// 変える側（設定画面役）。Consumer とは兄弟で、state を共有していない
function Switcher() {
  const { mode, setMode } = useColorMode()
  return (
    <>
      <span data-testid="selected">{mode}</span>
      <button onClick={() => setMode('dark')}>dark</button>
      <button onClick={() => setMode('light')}>light</button>
    </>
  )
}

const render = () => act(() => root.render(<><Consumer /><Switcher /></>))
const text = (id) => container.querySelector(`[data-testid="${id}"]`).textContent
const click = (label) => act(() => {
  ;[...container.querySelectorAll('button')]
    .find((b) => b.textContent === label)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})

describe('外観の切り替え', () => {
  it('切り替えた値が、別コンポーネントの表示に届く', () => {
    render()
    expect(text('applied')).toBe('light')

    click('dark')
    // 押した側だけでなく、反映する側も変わっていること
    expect(text('selected')).toBe('dark')
    expect(text('applied')).toBe('dark')

    click('light')
    expect(text('applied')).toBe('light')
  })

  it('選んだ値は保存される（次回起動でも同じ配色になる）', () => {
    render()
    click('dark')
    expect(loadThemeMode()).toBe('dark')
  })

  it('保存済みの値が起動時に効く', () => {
    localStorage.setItem('cc_theme_mode', 'dark')
    render()
    expect(text('applied')).toBe('dark')
  })
})

describe('端末追従の判定', () => {
  it('system は端末の設定で決まる', () => {
    expect(resolveMode('system', true)).toBe('dark')
    expect(resolveMode('system', false)).toBe('light')
  })

  it('明示的に選んだときは端末設定より優先する', () => {
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('dark', false)).toBe('dark')
  })

  it('壊れた値が入っていても落ちない', () => {
    localStorage.setItem('cc_theme_mode', 'sepia')
    expect(loadThemeMode()).toBe('system')
  })
})
