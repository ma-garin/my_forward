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

  it('登録の無い支払い元は落とす', () => {
    // Suica は支払い元として登録したので、登録の無いブランドで見る
    expect(parseCardNotification({ ...GPAY, text: 'AMEX ••1004 で ¥740' })).toBe(null)
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

describe('決め打ちのキーに入らない通知', () => {
  it('allText からでも読める（InboxStyle などで title/text が空の通知）', () => {
    // MyJCB の利用通知が、title も text も空で記録されていた。
    // ネイティブ側が extras 全体から拾った文字（allText）を読む
    const d = parseCardNotification({
      packageName: 'jp.co.jcb.my',
      postTime: new Date(2026, 7, 27, 8, 19).getTime(),
      title: '',
      text: '',
      allText: 'JCBカード利用のお知らせ\nJCB GOLD ご利用金額 2,480円',
    })
    expect(d).toMatchObject({ cardId: 'jcb', amount: 2480 })
  })

  it('allText が空なら従来どおり落とす', () => {
    expect(parseCardNotification({
      packageName: 'jp.co.jcb.my', postTime: Date.now(), title: '', text: '', allText: '',
    })).toBe(null)
  })
})

describe('関係ない通知を拾わない', () => {
  const at = Date.now()
  const cases = [
    ['Amazon のセール', 'com.amazon.mShop.android.shopping', 'サマーBBQフェア 50%OFF', '週替わりで対象商品が50%OFF。牛バラカルビ、焼き鳥ねぎ串など'],
    ['Instagram', 'com.instagram.android', 'フォローリクエスト', 'Mai shiraishi からフォローリクエストがありました。'],
    ['LINE の雑談', 'jp.naver.line.android', 'いつメン相陽テニス部', '予約してくれたところ申し訳ないけど人数1人減らせるかな？'],
    ['メール到着の知らせ', 'jp.co.yahoo.android.ymail', 'JCB Webmaster', 'JCBカード／ショッピングご利用のお知らせ'],
    ['スポーツニュース', 'jp.co.yahoo.android.sports.sportsnavi', 'スポーツナビ', 'ドジャース佐々木が先発登板予定'],
  ]

  it.each(cases)('%s は下書きにしない', (_name, packageName, title, text) => {
    expect(parseCardNotification({ packageName, title, text, postTime: at })).toBe(null)
  })

  it('金額があってもカード名が無ければ拾わない', () => {
    expect(parseCardNotification({
      packageName: 'com.example.shop', title: 'セール', text: '本日限り ¥1,980', postTime: at,
    })).toBe(null)
  })
})

describe('PayPay（文面にカード名が入らない）', () => {
  const at = new Date(2026, 7, 20, 12, 34).getTime()
  const pkg = 'jp.ne.paypay.android.app'

  it('送り主から支払い元を決める', () => {
    const d = parseCardNotification({
      packageName: pkg, postTime: at,
      title: '支払いが完了しました', text: '1,200円をお支払いしました',
    })
    expect(d).toMatchObject({ cardId: 'paypay', amount: 1200, date: '2026-08-20' })
  })

  it('¥ 表記でも拾う', () => {
    expect(parseCardNotification({
      packageName: pkg, postTime: at, title: 'お支払い', text: '¥3,480',
    })).toMatchObject({ cardId: 'paypay', amount: 3480 })
  })

  it('金額が無ければ拾わない（キャンペーンの知らせ等）', () => {
    expect(parseCardNotification({
      packageName: pkg, postTime: at,
      title: 'PayPayからのお知らせ', text: 'クーポンが届いています',
    })).toBe(null)
  })

  it('文面にカード名があればそちらを優先する', () => {
    // PayPay アプリから JCB の利用通知が来ることは無いが、
    // 送り主より文面のほうが確かなので優先順を固定しておく
    expect(parseCardNotification({
      packageName: pkg, postTime: at, title: '', text: 'JCB ••1004 で ¥740',
    })).toMatchObject({ cardId: 'jcb' })
  })

  it('登録の無いアプリは送り主だけでは拾わない', () => {
    expect(parseCardNotification({
      packageName: 'com.example.pay', postTime: at, title: '支払い', text: '1,200円',
    })).toBe(null)
  })
})
