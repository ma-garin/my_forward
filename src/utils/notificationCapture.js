import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * 通知取得ブリッジ。
 *
 * Android アプリとして動いているときだけ実体があり、GitHub Pages の Web 版では
 * 何も存在しない。呼び出し側で毎回分岐を書かずに済むよう、ここで吸収する。
 */
const NotificationCapture = registerPlugin('NotificationCapture')

/** ネイティブ（Android アプリ）として動いているか */
export const isNativeApp = () => Capacitor.isNativePlatform()

/** 通知取得が使える環境か（Web 版では常に false） */
export const isCaptureAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NotificationCapture')

export async function isPermissionGranted() {
  if (!isCaptureAvailable()) return false
  try {
    const { granted } = await NotificationCapture.isPermissionGranted()
    return !!granted
  } catch {
    return false
  }
}

export async function openPermissionSettings() {
  if (!isCaptureAvailable()) return
  try {
    await NotificationCapture.openPermissionSettings()
  } catch {
    // 設定画面が開けなくても、画面の案内は残るので握りつぶす
  }
}

/** 記録された通知を新しい順で返す */
export async function getRecords() {
  if (!isCaptureAvailable()) return []
  try {
    const { records } = await NotificationCapture.getRecords()
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

export async function clearRecords() {
  if (!isCaptureAvailable()) return
  try {
    await NotificationCapture.clearRecords()
  } catch {
    // 失敗しても画面側は再読み込みで整合が取れる
  }
}

/** 記録対象のパッケージ名（空配列＝すべて記録） */
export async function getAllowedPackages() {
  if (!isCaptureAvailable()) return []
  try {
    const { packages } = await NotificationCapture.getAllowedPackages()
    return Array.isArray(packages) ? packages : []
  } catch {
    return []
  }
}

export async function setAllowedPackages(packages) {
  if (!isCaptureAvailable()) return
  try {
    await NotificationCapture.setAllowedPackages({ packages })
  } catch {
    // 同上
  }
}
