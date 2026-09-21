import { describe, it, expect, beforeEach } from 'vitest'
import {
  isSyncKey, normalizeUrl, hashValue,
  collectLocal, mergeEntries, applyEntries, buildBase,
  loadSyncConfig, saveSyncConfig, loadBase, saveBase, isFirstSync,
} from './sync'

beforeEach(() => localStorage.clear())

describe('同期するキー', () => {
  it('家計・給与のキーは同期する', () => {
    ;['cc_var_jcb_2026-08', 'cc_cards', 'salary_simulation'].forEach((k) => {
      expect(isSyncKey(k)).toBe(true)
    })
  })

  it('端末ごとの状態は同期しない（片方の外観を変えて両方が変わらないように）', () => {
    ;['cc_sync_config', 'cc_sync_base', 'cc_theme_bg', 'cc_auto_backup_at'].forEach((k) => {
      expect(isSyncKey(k)).toBe(false)
    })
  })
})

describe('アドレスの整形', () => {
  it('scheme が無ければ http を補い、末尾の / を落とす', () => {
    expect(normalizeUrl('192.168.40.61:8787/')).toBe('http://192.168.40.61:8787')
    expect(normalizeUrl(' http://pc:8787// ')).toBe('http://pc:8787')
  })

  it('空なら空のまま', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl(undefined)).toBe('')
  })
})

describe('指紋', () => {
  it('同じ文字列は同じ、違えば違う', () => {
    expect(hashValue('abc')).toBe(hashValue('abc'))
    expect(hashValue('abc')).not.toBe(hashValue('abd'))
  })

  it('長さが違えば必ず違う（短い衝突を潰すため長さを混ぜている）', () => {
    expect(hashValue('a').split('.')[1]).not.toBe(hashValue('aa').split('.')[1])
  })
})

describe('端末側の状態を集める', () => {
  it('控えと指紋が一致すれば前回の時刻を保つ', () => {
    localStorage.setItem('cc_cards', '[]')
    const base = { cc_cards: { h: hashValue('[]'), t: 1000 } }
    expect(collectLocal(base, 9999).cc_cards).toEqual({ v: '[]', t: 1000 })
  })

  it('中身が変わっていれば今の時刻になる', () => {
    localStorage.setItem('cc_cards', '[1]')
    const base = { cc_cards: { h: hashValue('[]'), t: 1000 } }
    expect(collectLocal(base, 9999).cc_cards).toEqual({ v: '[1]', t: 9999 })
  })

  it('控えにあって今は無いキーは「消した」印になる', () => {
    const base = { cc_fixed_old: { h: hashValue('[]'), t: 1000 } }
    expect(collectLocal(base, 9999).cc_fixed_old).toEqual({ v: null, t: 9999 })
  })

  it('すでに「消した」印なら時刻を進めない（毎回送り直さない）', () => {
    const base = { cc_fixed_old: { h: null, t: 1000 } }
    expect(collectLocal(base, 9999).cc_fixed_old).toEqual({ v: null, t: 1000 })
  })
})

describe('突き合わせ', () => {
  it('新しいほうが勝つ', () => {
    const local = { a: { v: 'L', t: 200 }, b: { v: 'L', t: 100 } }
    const remote = { a: { v: 'R', t: 100 }, b: { v: 'R', t: 200 } }
    const { apply, push } = mergeEntries(local, remote)
    expect(push).toEqual({ a: { v: 'L', t: 200 } })
    expect(apply).toEqual({ b: { v: 'R', t: 200 } })
  })

  it('中身が同じなら時刻が違っても何もしない', () => {
    const { apply, push } = mergeEntries({ a: { v: 'X', t: 1 } }, { a: { v: 'X', t: 9 } })
    expect(apply).toEqual({})
    expect(push).toEqual({})
  })

  it('同着はサーバー側を採る（2台が互いを上書きし合って収束しなくなるため）', () => {
    const { apply, push } = mergeEntries({ a: { v: 'L', t: 5 } }, { a: { v: 'R', t: 5 } })
    expect(apply).toEqual({ a: { v: 'R', t: 5 } })
    expect(push).toEqual({})
  })

  it('片方にしか無いキーはそのまま行き来する', () => {
    const { apply, push } = mergeEntries({ a: { v: 'L', t: 1 } }, { b: { v: 'R', t: 1 } })
    expect(push).toEqual({ a: { v: 'L', t: 1 } })
    expect(apply).toEqual({ b: { v: 'R', t: 1 } })
  })

  it('消した印が新しければ相手側でも消える', () => {
    const { apply } = mergeEntries({ a: { v: 'L', t: 1 } }, { a: { v: null, t: 2 } })
    expect(apply).toEqual({ a: { v: null, t: 2 } })
  })

  it('同じ結果に落ち着く（2台から見た向きを入れ替えても内容が一致する）', () => {
    const x = { a: { v: 'A', t: 3 }, b: { v: 'B1', t: 1 } }
    const y = { a: { v: 'A2', t: 2 }, b: { v: 'B2', t: 5 } }
    const fromX = mergeEntries(x, y)
    const fromY = mergeEntries(y, x)
    const settled = (local, r) => ({ ...local, ...r.apply })
    expect(settled(x, fromX)).toEqual(settled(y, fromY))
  })
})

describe('書き戻し', () => {
  it('値を入れ、null のキーは消す', () => {
    localStorage.setItem('cc_cards', 'old')
    const n = applyEntries({
      cc_cards: { v: null, t: 2 },
      cc_var_jcb_2026_08: { v: '[]', t: 2 },
    })
    expect(n).toBe(2)
    expect(localStorage.getItem('cc_cards')).toBeNull()
    expect(localStorage.getItem('cc_var_jcb_2026_08')).toBe('[]')
  })

  it('何も無ければ何もしない', () => {
    expect(applyEntries({})).toBe(0)
  })
})

describe('控えの作り直し', () => {
  it('合意した中身の指紋と時刻を持つ', () => {
    const base = buildBase({ a: { v: 'L', t: 1 } }, { b: { v: 'R', t: 2 } })
    expect(base).toEqual({
      a: { h: hashValue('L'), t: 1 },
      b: { h: hashValue('R'), t: 2 },
    })
  })

  it('消したキーは指紋を持たない', () => {
    expect(buildBase({}, { a: { v: null, t: 2 } })).toEqual({ a: { h: null, t: 2 } })
  })

  it('書き戻したぶんがローカルより優先される', () => {
    const base = buildBase({ a: { v: 'L', t: 1 } }, { a: { v: 'R', t: 2 } })
    expect(base.a).toEqual({ h: hashValue('R'), t: 2 })
  })
})

describe('設定と初回判定', () => {
  it('保存して読み戻せる', () => {
    saveSyncConfig({ url: 'http://pc:8787', token: 'x', auto: true })
    expect(loadSyncConfig()).toEqual({ url: 'http://pc:8787', token: 'x', auto: true })
  })

  it('壊れていても既定に落ちる', () => {
    localStorage.setItem('cc_sync_config', '{')
    expect(loadSyncConfig()).toEqual({ url: '', token: '', auto: false })
  })

  it('控えが無いうちは初回', () => {
    expect(isFirstSync()).toBe(true)
    saveBase({ a: { h: 'x', t: 1 } })
    expect(isFirstSync()).toBe(false)
    expect(loadBase()).toEqual({ a: { h: 'x', t: 1 } })
  })
})
