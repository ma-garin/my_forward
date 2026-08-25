import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { getDataVersion } from './ccStorage'
import { buildSchedule, isReminderId, loadRemindersEnabled, saveRemindersEnabled } from './reminders'

/**
 * 締め日・支払日のリマインダーを端末に登録する。
 *
 * 予定の中身は reminders.js が組み立てる（そちらは通知を触らないので、
 * 設定画面のプレビューとテストから同じものを使える）。ここは端末への
 * 登録だけを受け持つ。
 *
 * 登録し直すのは、金額が変わるため。手で支出を入れた直後に前の金額のまま
 * 届くと信用できない通知になる。
 */

export const isRemindersAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')

/** 端末の通知許可。まだ聞いていなければ聞く */
export async function ensurePermission() {
  if (!isRemindersAvailable()) return false
  try {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true
    if (current.display === 'denied') return false
    const asked = await LocalNotifications.requestPermissions()
    return asked.display === 'granted'
  } catch {
    return false
  }
}

/** 登録済みの予定を消してから、今の内容で入れ直す */
export async function syncReminders() {
  if (!isRemindersAvailable()) return 0

  try {
    // 消すのは自分が入れた予定だけ。全部消すと、あとで別の用途の通知を
    // 足したときにそれまで巻き添えにする
    const stale = (await LocalNotifications.getPending()).notifications
      .filter((n) => isReminderId(Number(n.id)))
    if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale })

    if (!loadRemindersEnabled()) return 0
    if (!(await ensurePermission())) return 0

    const schedule = buildSchedule()
    if (schedule.length === 0) return 0

    // allowWhileIdle は「省電力中でも届ける」指定。厳密な時刻の指定
    // （SCHEDULE_EXACT_ALARM）は求めない。9 時・20 時の知らせに秒単位の正確さは
    // 要らず、Android 13 以降その許可は既定で下りないため。
    await LocalNotifications.schedule({
      notifications: schedule.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
      })),
    })
    return schedule.length
  } catch {
    // 通知が登録できなくても家計簿としては動くので、画面は止めない
    return 0
  }
}

/**
 * アプリを開いている間、データが変わるたびに予定を組み直す。
 * 保存のたびに走らせると重いので、版数を見て変わったときだけにする。
 */
export function useReminderSync() {
  useEffect(() => {
    if (!isRemindersAvailable()) return
    let seen = -1
    const tick = () => {
      const version = getDataVersion()
      if (version === seen) return
      seen = version
      syncReminders()
    }
    tick()
    const timer = setInterval(tick, 30_000)
    return () => clearInterval(timer)
  }, [])
}

/** 設定画面用。有効・無効と、次に届く予定を扱う */
export function useReminderSettings() {
  const [enabled, setEnabled] = useState(loadRemindersEnabled)
  const [granted, setGranted] = useState(true)
  // 初回ぶんはここで組む。効果の中で入れると 1 回よけいに描き直しになる
  const [schedule, setSchedule] = useState(() => (loadRemindersEnabled() ? buildSchedule() : []))

  const refresh = useCallback(() => {
    setSchedule(loadRemindersEnabled() ? buildSchedule() : [])
  }, [])

  const toggle = useCallback(async (next) => {
    setEnabled(next)
    saveRemindersEnabled(next)
    if (next) {
      const ok = await ensurePermission()
      setGranted(ok)
      if (!ok) {
        setEnabled(false)
        saveRemindersEnabled(false)
        setSchedule([])
        return
      }
    }
    await syncReminders()
    refresh()
  }, [refresh])

  return { enabled, granted, schedule, toggle }
}
