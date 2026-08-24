import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkForUpdate, buildNumber } from './appUpdate'

// GitHub のレスポンスを模す
const release = (tag) => ({
  ok: true,
  json: async () => ({ tag_name: tag, published_at: '2026-08-23T23:37:03Z' }),
})

beforeEach(() => {
  vi.stubEnv('VITE_BUILD_NUMBER', '10')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('buildNumber', () => {
  it('CI が入れた番号を返す', () => {
    expect(buildNumber()).toBe(10)
  })

  it('番号が無ければ null（手元ビルド）', () => {
    vi.stubEnv('VITE_BUILD_NUMBER', '')
    expect(buildNumber()).toBeNull()
  })
})

describe('checkForUpdate', () => {
  it('新しいビルドがあれば hasUpdate になる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => release('android-12')))
    const r = await checkForUpdate()
    expect(r).toMatchObject({ current: 10, latest: 12, hasUpdate: true, unknown: false })
  })

  it('同じビルドなら更新なし', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => release('android-10')))
    const r = await checkForUpdate()
    expect(r.hasUpdate).toBe(false)
    expect(r.unknown).toBe(false)
  })

  it('古いビルドが返っても更新ありにしない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => release('android-3')))
    const r = await checkForUpdate()
    expect(r.hasUpdate).toBe(false)
  })

  it('タグの形式が違えば unknown にして断定しない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => release('v1.5.0')))
    const r = await checkForUpdate()
    expect(r).toMatchObject({ latest: null, hasUpdate: false, unknown: true })
  })

  it('自分のビルド番号が無ければ unknown', async () => {
    vi.stubEnv('VITE_BUILD_NUMBER', '')
    vi.stubGlobal('fetch', vi.fn(async () => release('android-12')))
    const r = await checkForUpdate()
    expect(r).toMatchObject({ current: null, hasUpdate: false, unknown: true })
  })

  it('通信できないときは案内できるメッセージにする', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(checkForUpdate()).rejects.toThrow('接続を確認してください')
  })

  it('エラー応答のときは状態コードを添えて投げる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    await expect(checkForUpdate()).rejects.toThrow('403')
  })
})
