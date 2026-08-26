import { useState, useEffect, useCallback } from 'react'
import { getRecords, isCaptureAvailable } from './notificationCapture'
import { ingestNotifications, loadInbox, acceptDraft, dismissDraft } from './inbox'

/**
 * 通知から作った下書きの読み込み。
 *
 * 通知はアプリを閉じている間に届くので、開いたとき・戻ってきたときに
 * ネイティブ側から読み直す。Web 版では取り込み元が無いので何も起きない。
 */
export function useInbox() {
  const [drafts, setDrafts] = useState(loadInbox)

  const scan = useCallback(async () => {
    // Web 版には取り込み元が無い。受信箱が変わるのは承認・無視のときだけで、
    // そこでは下の accept / dismiss が state を更新している
    if (!isCaptureAvailable()) return
    const records = await getRecords()
    setDrafts(ingestNotifications(records).inbox)
  }, [])

  useEffect(() => {
    // 読み込みは非同期に逃がす。effect の中で同期に state を更新すると
    // 追加の描画が 1 回増える
    const timer = setTimeout(scan, 0)
    // 他のアプリから戻ったとき（＝買い物して通知が届いた直後）に拾う
    const onVisible = () => { if (document.visibilityState === 'visible') scan() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [scan])

  const accept = useCallback((id, overrides) => {
    const result = acceptDraft(id, overrides)
    setDrafts(loadInbox())
    return result
  }, [])

  const dismiss = useCallback((id) => setDrafts(dismissDraft(id)), [])

  return { drafts, accept, dismiss, reload: scan }
}
