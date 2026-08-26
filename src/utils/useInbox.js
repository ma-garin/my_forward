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
    if (!isCaptureAvailable()) {
      setDrafts(loadInbox())
      return
    }
    const records = await getRecords()
    setDrafts(ingestNotifications(records).inbox)
  }, [])

  useEffect(() => {
    scan()
    // 他のアプリから戻ったとき（＝買い物して通知が届いた直後）に拾う
    const onVisible = () => { if (document.visibilityState === 'visible') scan() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [scan])

  const accept = useCallback((id, overrides) => {
    const result = acceptDraft(id, overrides)
    setDrafts(loadInbox())
    return result
  }, [])

  const dismiss = useCallback((id) => setDrafts(dismissDraft(id)), [])

  return { drafts, accept, dismiss, reload: scan }
}
