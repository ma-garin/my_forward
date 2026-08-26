import { describe, it, expect } from 'vitest'
import { parseCardNotification, cardIdFromText, normalizeText } from './parseCardNotification'

// 実機で届いた文面（全角混じり）をそのまま使う
const VPASS = {
  packageName: 'jp.co.smbc.vpass',
  postTime: new Date(2026, 7, 14, 12, 19).getTime(),
  title: 'ご利用のお知らせ',
  text: '◇ご利用カード：三井住友ゴールドＶＩＳＡ（ＮＬ）　◇日時：2026/08/14 12:12　◇利用先：KAITENSUSHIMISAKISHINJI　◇金額：1,320円',
}

const VPASS_JP = {
  ...VPASS,
  postTime: new Date(2026, 7, 14, 10, 54).getTime(),
  text: '◇ご利用カード：三井住友ゴールドＶＩＳＡ（ＮＬ）◇日時：2026/08/14 10:54　◇利用先：ユニクロ／ＮＦＣ　◇金額：2,990円',
}

const GPAY = {
  packageName: 'com.google.android.apps.walletnfcrel',
  postTime: new Date(2026, 7, 25, 20, 38).getTime(),
  title: 'Google Pay',
  text: 'JCB GOLD(ORIGINAL SERIES) ••1004 で ¥740',
}

describe('Vpass（三井住友カード）', () => {
  it('日時・利用先・金額・カードを読む', () => {
    expect(parseCardNotification(VPASS)).toEqual({
      source: 'vpass',
      cardId: 'smbc',
      amount: 1320,
      at: new Date(2026, 7, 14, 12, 12).getTime(),
      date: '2026-08-14',
      payee: 'KAITENSUSHIMISAKISHINJI',
    })
  })

  it('全角の店名（／入り）も読む', () => {
    const d = parseCardNotification(VPASS_JP)
    expect(d.payee).toBe('ユニクロ/NFC')
    expect(d.amount).toBe(2990)
  })

  it('通知が届いた時刻ではなく、文面の日時を使う', () => {
    // 12:19 に届いた通知でも、取引は 12:12
    expect(new Date(parseCardNotification(VPASS).at).getHours()).toBe(12)
    expect(new Date(parseCardNotification(VPASS).at).getMinutes()).toBe(12)
  })
})

describe('Google ウォレット', () => {
  it('金額とカードを読む（利用先は空）', () => {
    expect(parseCardNotification(GPAY)).toEqual({
      source: 'googlepay',
      cardId: 'jcb',
      amount: 740,
      at: GPAY.postTime,
      date: '2026-08-25',
      payee: '',
    })
  })

  it('カードが分からない支払いは落とす', () => {
    expect(parseCardNotification({ ...GPAY, text: 'Suica ••1004 で ¥740' })).toBe(null)
  })
})

describe('対象外の通知', () => {
  it('金額のないお知らせは落とす', () => {
    expect(parseCardNotification({
      packageName: 'jp.co.yahoo.android.ymail',
      title: 'JCB Webmaster',
      text: 'JCBカード／ショッピングご利用のお知らせ',
      postTime: Date.now(),
    })).toBe(null)
  })

  it('LINE の「カードご利用のお知らせ」も落とす', () => {
    expect(parseCardNotification({
      packageName: 'jp.naver.line.android',
      title: '三井住友カード',
      text: 'カードご利用のお知らせ',
      postTime: Date.now(),
    })).toBe(null)
  })

  it('空の通知は落とす', () => {
    expect(parseCardNotification({})).toBe(null)
    expect(parseCardNotification(null)).toBe(null)
  })
})

describe('カードの判定', () => {
  it('shortName で引く（カードを増やしてもパーサを触らない）', () => {
    expect(cardIdFromText('三井住友ゴールドVISA(NL)')).toBe('smbc')
    expect(cardIdFromText('JCB GOLD(ORIGINAL SERIES)')).toBe('jcb')
    expect(cardIdFromText('PayPay残高')).toBe('paypay')
    expect(cardIdFromText('楽天カード')).toBe(null)
  })
})

describe('文面の正規化', () => {
  it('全角を半角に寄せ、空白をまとめる', () => {
    expect(normalizeText('ＶＩＳＡ　（ＮＬ）')).toBe('VISA (NL)')
  })
})
