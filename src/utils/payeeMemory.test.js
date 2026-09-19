import { describe, it, expect, beforeEach } from 'vitest'
import { payeeKey, suggestFromPayee } from './payeeMemory'
import { saveVar } from './ccStorage'
import { currentBillingYm, addMonth } from './finance'

beforeEach(() => localStorage.clear())

const NOW_YM = () => currentBillingYm()

const put = (ym, list) => saveVar('jcb', ym, list.map((x, i) => ({
  id: `v${i}`, amount: 1000, spendType: '消費', ...x,
})))

describe('支払先の表記を均す', () => {
  it('半角カナと全角英数を吸収する', () => {
    expect(payeeKey('ｾﾌﾞﾝ-ｲﾚﾌﾞﾝ')).toBe(payeeKey('セブンイレブン'))
    expect(payeeKey('ＡＭＡＺＯＮ')).toBe(payeeKey('amazon'))
  })

  it('空白と区切り記号を落とす', () => {
    expect(payeeKey(' スシロー　渋谷 ')).toBe(payeeKey('スシロー渋谷'))
    expect(payeeKey('AMAZON.CO.JP')).toBe(payeeKey('amazon co jp'))
  })

  it('長音は残す（語の一部なので消すと別物になる）', () => {
    expect(payeeKey('コーヒー')).not.toBe(payeeKey('コヒ'))
  })

  it('空のときは空を返す', () => {
    expect(payeeKey('')).toBe('')
    expect(payeeKey(undefined)).toBe('')
  })
})

describe('過去の登録から思い出す', () => {
  it('同じ支払先の項目名・分類・消費分類を返す', () => {
    put(NOW_YM(), [{ payee: 'スシロー', name: '昼食', category: '食費', spendType: '浪費', date: '2026-09-01' }])
    expect(suggestFromPayee('スシロー')).toMatchObject({
      name: '昼食', category: '食費', spendType: '浪費',
    })
  })

  it('通知の半角カナ表記でも当たる', () => {
    put(NOW_YM(), [{ payee: 'セブンイレブン', name: '昼食', category: '食費', date: '2026-09-01' }])
    expect(suggestFromPayee('ｾﾌﾞﾝ-ｲﾚﾌﾞﾝ')?.name).toBe('昼食')
  })

  it('過去に使った表記を返す（表記ゆれを揃えるため）', () => {
    put(NOW_YM(), [{ payee: 'セブンイレブン', name: '昼食', category: '食費', date: '2026-09-01' }])
    expect(suggestFromPayee('ｾﾌﾞﾝ-ｲﾚﾌﾞﾝ')?.payee).toBe('セブンイレブン')
  })

  it('いちばん新しい登録を採る', () => {
    put(NOW_YM(), [
      { payee: 'ローソン', name: '朝食', category: '食費', date: '2026-09-01' },
      { payee: 'ローソン', name: '日用品', category: '日用品', date: '2026-09-05' },
    ])
    expect(suggestFromPayee('ローソン')?.name).toBe('日用品')
  })

  it('店舗名が付いていても元の支払先に当てる', () => {
    put(NOW_YM(), [{ payee: 'ローソン', name: '朝食', category: '食費', date: '2026-09-01' }])
    expect(suggestFromPayee('ローソン渋谷店')?.category).toBe('食費')
  })

  it('前の月の登録も見る', () => {
    const prev = addMonth(NOW_YM(), -1)
    put(prev, [{ payee: 'ユニクロ', name: 'シャツ', category: '衣類', date: '2026-08-10' }])
    expect(suggestFromPayee('ユニクロ')?.category).toBe('衣類')
  })

  it('覚えが無ければ null', () => {
    expect(suggestFromPayee('はじめての店')).toBeNull()
  })

  it('支払先が空なら null（総当たりしない）', () => {
    put(NOW_YM(), [{ payee: 'スシロー', name: '昼食', category: '食費', date: '2026-09-01' }])
    expect(suggestFromPayee('')).toBeNull()
  })

  it('2文字以下は部分一致で拾わない（どこにでも含まれるため）', () => {
    put(NOW_YM(), [{ payee: 'ローソン', name: '朝食', category: '食費', date: '2026-09-01' }])
    expect(suggestFromPayee('ソン')).toBeNull()
  })
})
