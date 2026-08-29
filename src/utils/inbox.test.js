import { describe, it, expect, beforeEach } from 'vitest'
import { ingestNotifications, ingestDrafts, loadInbox, acceptDraft, dismissDraft } from './inbox'
import { loadVar } from './ccStorage'

beforeEach(() => localStorage.clear())

const at = (h, m) => new Date(2026, 7, 14, h, m).getTime()

const vpass = (amount, payee, hh, mm) => ({
  packageName: 'jp.co.smbc.vpass',
  postTime: at(hh, mm),
  title: 'ご利用のお知らせ',
  text: `◇ご利用カード：三井住友ゴールドＶＩＳＡ（ＮＬ）\u3000◇日時：2026/08/14 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}\u3000◇利用先：${payee}\u3000◇金額：${amount.toLocaleString()}円`,
})

const gpay = (amount, hh, mm, card = 'JCB GOLD(ORIGINAL SERIES)') => ({
  packageName: 'com.google.android.apps.walletnfcrel',
  postTime: at(hh, mm),
  title: 'Google Pay',
  text: `${card} ••1004 で ¥${amount.toLocaleString()}`,
})

const mail = () => ({
  packageName: 'jp.co.yahoo.android.ymail',
  postTime: at(12, 14),
  title: 'JCB Webmaster',
  text: 'JCBカード／ショッピングご利用のお知らせ',
})

describe('通知の取り込み', () => {
  it('金額のある通知だけ下書きになる', () => {
    const { added, inbox } = ingestNotifications([vpass(1320, 'スシロー', 12, 12), mail()])
    expect(added).toBe(1)
    expect(inbox[0]).toMatchObject({ cardId: 'smbc', amount: 1320, payee: 'スシロー' })
  })

  it('同じ買い物の二重通知はまとめる', () => {
    // Google ウォレットと Vpass が同じ決済で鳴る（3 分差）
    const { added } = ingestNotifications([
      vpass(2990, 'ユニクロ', 10, 54),
      gpay(2990, 10, 57, '三井住友ゴールドVISA(NL)'),
    ])
    expect(added).toBe(1)
  })

  it('二重通知のうち、店名が入っている方を残す', () => {
    // 店名を持たない Google ウォレットが先に処理されても、Vpass の店名で埋まる
    const { inbox } = ingestNotifications([
      gpay(2990, 10, 57, '三井住友ゴールドVISA(NL)'),
      vpass(2990, 'ユニクロ', 10, 54),
    ])
    expect(inbox).toHaveLength(1)
    expect(inbox[0].payee).toBe('ユニクロ')
  })

  it('同じ金額でも時間が離れていれば別の買い物として残す', () => {
    const { added } = ingestNotifications([vpass(500, 'コンビニ', 9, 0), vpass(500, 'コンビニ', 18, 0)])
    expect(added).toBe(2)
  })

  it('開き直しても同じ下書きが増えない', () => {
    const records = [vpass(1320, 'スシロー', 12, 12)]
    ingestNotifications(records)
    const second = ingestNotifications(records)
    expect(second.added).toBe(0)
    expect(loadInbox()).toHaveLength(1)
  })

  it('一度さばいた通知は復活しない', () => {
    const records = [vpass(1320, 'スシロー', 12, 12)]
    ingestNotifications(records)
    dismissDraft(loadInbox()[0].id)
    ingestNotifications(records)
    expect(loadInbox()).toHaveLength(0)
  })
})

describe('承認', () => {
  it('カードの請求月に変動費として入る', () => {
    // VISA は月末締め → 8/14 の利用は 2026-08 請求
    ingestNotifications([vpass(2990, 'ユニクロ', 10, 54)])
    const res = acceptDraft(loadInbox()[0].id, { category: '衣類' })
    expect(res.ym).toBe('2026-08')
    expect(loadVar('smbc', '2026-08')).toHaveLength(1)
    expect(loadVar('smbc', '2026-08')[0]).toMatchObject({
      payee: 'ユニクロ', amount: 2990, category: '衣類', spendType: '消費', date: '2026-08-14',
    })
  })

  it('JCB は締め日（15日）に従って前月請求になる', () => {
    // 8/14 は 15 日締めの内側なので 2026-07 請求
    ingestNotifications([gpay(740, 12, 0)])
    const res = acceptDraft(loadInbox()[0].id)
    expect(res.cardId).toBe('jcb')
    expect(res.ym).toBe('2026-07')
    expect(loadVar('jcb', '2026-07')).toHaveLength(1)
  })

  it('画面で直した内容が優先される', () => {
    ingestNotifications([vpass(1320, 'スシロー', 12, 12)])
    acceptDraft(loadInbox()[0].id, { name: '昼食', amount: 1300, spendType: '浪費' })
    expect(loadVar('smbc', '2026-08')[0]).toMatchObject({ name: '昼食', amount: 1300, spendType: '浪費' })
  })

  it('承認したら受信箱から消える', () => {
    ingestNotifications([vpass(1320, 'スシロー', 12, 12)])
    acceptDraft(loadInbox()[0].id)
    expect(loadInbox()).toHaveLength(0)
  })
})

describe('CSV からの取り込み', () => {
  const draft = (amount, date, payee = '') =>
    ({ source: 'csv', cardId: 'paypay', amount, date, payee,
      at: new Date(...date.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)), 12).getTime() })

  it('受信箱に足す', () => {
    const r = ingestDrafts([draft(540, '2026-08-20'), draft(1200, '2026-08-22')])
    expect(r.added).toBe(2)
    expect(loadInbox()).toHaveLength(2)
  })

  it('同じ日の同じ金額でも、ファイルの中では潰さない', () => {
    const r = ingestDrafts([draft(540, '2026-08-20'), draft(540, '2026-08-20')])
    expect(r.added).toBe(2)
  })

  it('二度取り込んでも増えない', () => {
    const rows = [draft(540, '2026-08-20'), draft(1200, '2026-08-22')]
    ingestDrafts(rows)
    const again = ingestDrafts(rows)
    expect(again.added).toBe(0)
    expect(again.duplicate).toBe(2)
    expect(loadInbox()).toHaveLength(2)
  })

  it('増えたぶんだけ足す', () => {
    ingestDrafts([draft(540, '2026-08-20')])
    const r = ingestDrafts([draft(540, '2026-08-20'), draft(540, '2026-08-20')])
    expect(r.added).toBe(1)
    expect(r.duplicate).toBe(1)
  })

  it('承認済みのものは戻ってこない', () => {
    ingestDrafts([draft(540, '2026-08-20')])
    acceptDraft(loadInbox()[0].id)
    expect(loadInbox()).toHaveLength(0)
    const r = ingestDrafts([draft(540, '2026-08-20')])
    expect(r.added).toBe(0)
    expect(loadInbox()).toHaveLength(0)
  })

  it('無視したものも戻ってこない', () => {
    ingestDrafts([draft(540, '2026-08-20')])
    dismissDraft(loadInbox()[0].id)
    expect(ingestDrafts([draft(540, '2026-08-20')]).added).toBe(0)
  })

  it('日が違えば別の買い物として足す', () => {
    ingestDrafts([draft(540, '2026-08-20')])
    expect(ingestDrafts([draft(540, '2026-08-21')]).added).toBe(1)
  })
})

describe('振替（チャージ）の判定', () => {
  const suicaCharge = () => ingestNotifications([{
    packageName: 'jp.co.smbc.vpass',
    postTime: at(12, 0),
    text: '◇ご利用カード：三井住友ゴールドＶＩＳＡ ◇日時：2026/08/14 12:00 ◇利用先：モバイルSuica ◇金額：3,000円',
  }])

  it('モバイルSuica へのチャージは振替として登録する', () => {
    suicaCharge()
    const { item } = acceptDraft(loadInbox()[0].id)
    expect(item.transfer).toBe(true)
  })

  it('ふつうの買い物には付けない', () => {
    ingestNotifications([{
      packageName: 'jp.co.smbc.vpass',
      postTime: at(12, 0),
      text: '◇ご利用カード：三井住友ゴールドＶＩＳＡ ◇日時：2026/08/14 12:00 ◇利用先：ユニクロ ◇金額：2,990円',
    }])
    const { item } = acceptDraft(loadInbox()[0].id)
    expect(item.transfer).toBeUndefined()
  })

  it('画面で外せる', () => {
    suicaCharge()
    const { item } = acceptDraft(loadInbox()[0].id, { transfer: false })
    expect(item.transfer).toBeUndefined()
  })
})
