import { afterEach } from 'vitest'

// 各テスト後に localStorage を初期化し、テスト間の状態リークを防ぐ
afterEach(() => {
  try { localStorage.clear() } catch { /* jsdom 未提供時は無視 */ }
})
