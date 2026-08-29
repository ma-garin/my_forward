import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * モバイルSuica の利用履歴を画面から読み取って取り込む流れを、
 * 読み取り部分だけ差し替えて通しで見る。
 *
 * 見たいのは「読み取った行が支出になって受信箱に入るか」。
 * 文字認識そのものはネイティブ（ML Kit）の仕事なので、ここでは持たない。
 */

// 画面の読み取り結果（実機と同じ形）。使った額は出ず、残額だけが並ぶ
const LINES = [
  '08/20 物販 3,460',
  '08/20 出 渋谷 4,000',
  '08/20 入 新宿 4,168',
  '08/19 オート 4,168',
  '08/18 出 東京 1,168',
].map((text, i) => ({ text, x: 0, y: i * 40 }))

vi.mock('../utils/ocr', () => ({
  isOcrAvailable: () => true,
  recognizeLines: async () => LINES,
  shrinkImage: async () => 'data:image/jpeg;base64,AAAA',
}))

const { default: SuicaImport } = await import('./SuicaImport')
const { loadInbox } = await import('../utils/inbox')

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

const render = () => act(() => root.render(<SuicaImport />))
const text = () => container.textContent
const pickFile = async () => {
  const input = container.querySelector('input[type="file"]')
  const file = new File(['x'], 'suica.png', { type: 'image/png' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
  })
}
const clickButton = async (label) => {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(label))
  await act(async () => { btn.click(); await Promise.resolve() })
  return btn
}

describe('Suica 利用履歴の読み取り', () => {
  it('画面に出る', () => {
    render()
    expect(text()).toContain('モバイルSuica の利用履歴を読み取る')
  })

  it('読み取ると利用が出る（残額の差から額を出す）', async () => {
    render()
    await pickFile()
    expect(text()).toContain('利用 2 件')
    expect(text()).toContain('物販')
    expect(text()).toContain('540')
  })

  it('チャージと入場は除外したと出す', async () => {
    render()
    await pickFile()
    expect(text()).toContain('チャージ 1 件は除外')
    expect(text()).toContain('残額が動かない 1 件')
  })

  it('受信箱に入る', async () => {
    render()
    await pickFile()
    await clickButton('未確定の支出に入れる')
    const inbox = loadInbox()
    expect(inbox).toHaveLength(2)
    expect(inbox.every((d) => d.cardId === 'suica')).toBe(true)
    expect(inbox.map((d) => d.amount).sort((a, b) => a - b)).toEqual([168, 540])
  })

  it('二度読み込んでも増えない', async () => {
    render()
    await pickFile()
    await clickButton('未確定の支出に入れる')
    await pickFile()
    await clickButton('未確定の支出に入れる')
    expect(loadInbox()).toHaveLength(2)
    expect(text()).toContain('新しい利用はありませんでした')
  })

  it('チャージは支出として入れない', async () => {
    render()
    await pickFile()
    await clickButton('未確定の支出に入れる')
    expect(loadInbox().some((d) => d.amount === 3000)).toBe(false)
  })
})
