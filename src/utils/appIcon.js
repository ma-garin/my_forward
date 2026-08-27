import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * ホーム画面のアイコンの切り替え。
 *
 * Android はインストール済みアプリのアイコンを任意の画像に差し替えられない。
 * できるのは、アイコンだけ違う入口（activity-alias）を用意しておいて、
 * 有効なものを 1 つに切り替えること。だから候補は作り置きになる。
 *
 * 「今どれか」は端末（PackageManager）が覚えている。ここで localStorage に
 * 控えると、入れ直しや復元で食い違う持ち主が 2 人になる。読むときは必ず
 * ネイティブに聞く。
 */

const AppIcon = registerPlugin('AppIcon')

/**
 * 候補。id は AndroidManifest の activity-alias 名と一致させる。
 * 画像は scripts/gen-icon-variants.mjs が color から作る（色の定義もそこ）。
 */
export const APP_ICONS = [
  { id: 'IconDefault',  label: '標準',           color: '#263238' },
  { id: 'IconMidnight', label: 'ミッドナイト',   color: '#0f1417' },
  { id: 'IconIndigo',   label: 'インディゴ',     color: '#1a237e' },
  { id: 'IconWine',     label: 'ワイン',         color: '#5d2b31' },
]

export const DEFAULT_ICON_ID = APP_ICONS[0].id

/** アイコンを変えられる環境か（Web 版は変えられない） */
export const isAppIconAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AppIcon')

/** 今ホーム画面に出ているアイコン。分からなければ標準として扱う */
export async function getAppIcon() {
  if (!isAppIconAvailable()) return DEFAULT_ICON_ID
  try {
    const { id } = await AppIcon.get()
    return APP_ICONS.some((i) => i.id === id) ? id : DEFAULT_ICON_ID
  } catch {
    return DEFAULT_ICON_ID
  }
}

/**
 * アイコンを切り替える。
 * @returns {Promise<string|null>} 切り替わった id。失敗したら null
 */
export async function setAppIcon(id) {
  if (!isAppIconAvailable()) return null
  if (!APP_ICONS.some((i) => i.id === id)) return null
  try {
    const res = await AppIcon.set({ id })
    return res?.id ?? id
  } catch (e) {
    console.warn('setAppIcon failed', e)
    return null
  }
}
