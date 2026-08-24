/**
 * バックアップの読み書き。
 *
 * localStorage の値はすべて文字列。以前は書き出すときに JSON.parse していたため、
 * テーマ（app_theme）や並び順（cc_var_sort）のような素の文字列が「解釈できない」
 * として黙って捨てられ、復元しても戻らなかった。生の文字列のまま扱う。
 */

/** バックアップに含めるキー */
export function isBackupKey(k) {
  return k === 'salary_simulation'
      || k === 'salary_simulation_monthly'
      || k === 'life_weekly_budget'
      || k === 'app_theme'
      || k.startsWith('salary_base_')
      || k.startsWith('salary_extra_')
      || k.startsWith('cc_')
}

export function getAllKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

/** 指定キーを生の文字列のまま取り出す */
export function createExportData(keys) {
  const data = {}
  keys.forEach((k) => {
    const v = localStorage.getItem(k)
    if (v !== null) data[k] = v
  })
  return data
}

/**
 * 書き戻す。復元した件数を返す。
 *
 * 旧形式のファイルは値が JSON.parse 済み（配列・オブジェクト・数値）で入っている。
 * 文字列かどうかで見分けて、旧形式は文字列に戻してから保存する。
 */
export function restoreExportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('バックアップの形式ではありません')
  }
  const entries = Object.entries(data)
  entries.forEach(([k, v]) => {
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  })
  return entries.length
}
