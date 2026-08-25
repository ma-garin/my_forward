import { describe, it, expect, beforeEach } from 'vitest'
import { buildSchedule, loadRemindersEnabled, saveRemindersEnabled } from './reminders'

beforeEach(() => localStorage.clear())

// 2026-08-24（月）を基準にする。この時点で
//   JCB (15日締め/翌月10日払い): 2026-08 請求 → 締め 9/15、支払 10/12
//   VISA(月末締め/翌月26日払い): 2026-08 請求 → 締め 8/31、支払 9/28
const NOW = new Date(2026, 7, 24, 12, 0, 0)

const put = (cardId, ym, list) =>
  localStorage.setItem(`cc_var_${cardId}_${ym}`, JSON.stringify(list))

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}時`

describe('予定の組み立て', () => {
  it('早い順に並ぶ', () => {
    const times = buildSchedule(NOW).map((n) => n.at.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('過去の予定は含まない', () => {
    expect(buildSchedule(NOW).every((n) => n.at > NOW)).toBe(true)
  })

  it('締め日は当日の朝、支払日は前日の夜', () => {
    const list = buildSchedule(NOW)
    const visaCutoff = list.find((n) => n.title.includes('VISA') && n.title.includes('締め日'))
    // 2026-08 請求ぶん: 締め 8/31 → 支払 9/28。その前日が 9/27
    const visaPay = list.find((n) => n.title.includes('VISA') && n.body.includes('9/28'))
    expect(iso(visaCutoff.at)).toBe('2026-08-31 09時')
    expect(iso(visaPay.at)).toBe('2026-09-27 20時')
  })

  it('締めが済んだ前月ぶんの支払いも残す', () => {
    // VISA の 2026-07 請求は 7/31 に締め済みだが、支払いは 8/26。
    // 8/24 の時点ではまだ先なので、その前日 8/25 に通知が要る
    const visaPast = buildSchedule(NOW)
      .find((n) => n.title.includes('VISA') && n.body.includes('8/26'))
    expect(iso(visaPast.at)).toBe('2026-08-25 20時')
  })

  it('金額は請求月の合計を出す', () => {
    put('jcb', '2026-08', [{ id: 'a', amount: 12000, date: '2026-08-20' }])
    const jcbCutoff = buildSchedule(NOW).find((n) => n.title.includes('JCB') && n.title.includes('締め日'))
    expect(jcbCutoff.body).toContain('¥12,000')
  })

  it('返金（sign=1）は差し引く', () => {
    put('jcb', '2026-08', [
      { id: 'a', amount: 12000, date: '2026-08-20' },
      { id: 'b', amount: 2000, date: '2026-08-21', sign: 1 },
    ])
    const jcbCutoff = buildSchedule(NOW).find((n) => n.title.includes('JCB') && n.title.includes('締め日'))
    expect(jcbCutoff.body).toContain('¥10,000')
  })

  it('ID が重複しない（重複すると予定が上書きされて消える）', () => {
    const ids = buildSchedule(NOW).map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('同じ時刻・同じカードなら ID が変わらない（組み直しても二重にならない）', () => {
    const before = buildSchedule(NOW).map((n) => n.id)
    put('jcb', '2026-08', [{ id: 'a', amount: 999, date: '2026-08-20' }])
    expect(buildSchedule(NOW).map((n) => n.id)).toEqual(before)
  })

  it('前月ぶんの支払いが残っていれば拾う', () => {
    // 9/16（JCB の 2026-09 請求が始まった直後）でも、2026-08 請求の
    // 支払い 10/12 はまだ先なので予定に残っている必要がある
    const list = buildSchedule(new Date(2026, 8, 16, 12, 0, 0))
    const pays = list.filter((n) => n.title.includes('JCB') && n.title.includes('引き落とし'))
    expect(pays.some((n) => n.body.includes('10/12'))).toBe(true)
  })
})

describe('現金', () => {
  it('現金の締め日・支払日は予定に入れない（請求サイクルが無い）', () => {
    const titles = buildSchedule(NOW).map((n) => n.title)
    expect(titles.some((t) => t.includes('現金'))).toBe(false)
    // カードぶんはちゃんと入っている
    expect(titles.some((t) => t.includes('JCB'))).toBe(true)
  })
})

describe('有効・無効の保存', () => {
  it('既定は無効（勝手に通知しない）', () => {
    expect(loadRemindersEnabled()).toBe(false)
  })

  it('往復する', () => {
    saveRemindersEnabled(true)
    expect(loadRemindersEnabled()).toBe(true)
    saveRemindersEnabled(false)
    expect(loadRemindersEnabled()).toBe(false)
  })
})
