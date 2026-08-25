import { useCallback, useEffect, useState } from 'react'
import { hasNoData, isAutoBackupAvailable, listBackups, runAutoBackup } from './autoBackup'

/**
 * 起動時に控えを取り、データが空なら復元を勧める。
 *
 * 「消えてから気づく」のが一番困るので、気づける場所を起動時に置く。
 * 空でなければ何も出さない。
 */
export function useAutoBackup() {
  // 復元を勧める控え。null なら何も出さない
  const [offer, setOffer] = useState(null)

  useEffect(() => {
    if (!isAutoBackupAvailable()) return
    let cancelled = false

    const run = async () => {
      // データが消えている状態で控えを取ると、空の控えで世代を潰してしまう。
      // runAutoBackup 側でも弾いているが、先に見て復元を勧める
      if (hasNoData()) {
        const [newest] = await listBackups()
        if (!cancelled && newest) setOffer(newest)
        return
      }
      await runAutoBackup()
    }
    run()

    return () => { cancelled = true }
  }, [])

  const dismiss = useCallback(() => setOffer(null), [])
  return { offer, dismiss }
}
