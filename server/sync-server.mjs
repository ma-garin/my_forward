#!/usr/bin/env node
/**
 * 宅内同期サーバー。
 *
 * localStorage のキーと値をそのまま預かるだけで、中身は解釈しない。
 * 依存パッケージは無し（置いた先で npm install を要らなくするため）。
 *
 *   node sync-server.mjs
 *
 * 環境変数
 *   SYNC_PORT   待ち受けポート（既定 8787）
 *   SYNC_TOKEN  合言葉。設定すると X-Sync-Token が一致しない要求を弾く
 *   SYNC_DATA   保存先ファイル（既定 ./sync-data.json）
 *
 * 宅内からしか触れない前提で作ってある。インターネットに出さないこと。
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const ENV = process.env
const PORT = Number(ENV.SYNC_PORT || 8787)
const TOKEN = ENV.SYNC_TOKEN || ''
const DATA_FILE = path.resolve(ENV.SYNC_DATA || './sync-data.json')
const MAX_BODY = 12 * 1024 * 1024

/** 預かっている内容。`{ key: { v, t } }` で、`v === null` は「消した」印 */
let state = {}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.entries) state = parsed.entries
    log(`読み込み ${Object.keys(state).length} 件 ${DATA_FILE}`)
  } catch (e) {
    if (e.code !== 'ENOENT') log(`読み込み失敗: ${e.message}`)
    state = {}
  }
}

/**
 * 一時ファイルに書いてから置き換える。
 * 直接上書きすると、書いている途中で電源が落ちたときに全部読めなくなる。
 */
function save() {
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: Date.now(), entries: state }))
  fs.renameSync(tmp, DATA_FILE)
}

/**
 * 送られてきた内容と突き合わせる。新しいほうを残す。
 * 同じ時刻なら今あるほうを残す（端末側も同着はサーバーを採るので揃う）。
 */
function mergeIncoming(entries) {
  let changed = 0
  for (const [k, e] of Object.entries(entries)) {
    if (!e || typeof e !== 'object') continue
    const t = Number(e.t)
    if (!Number.isFinite(t)) continue
    const cur = state[k]
    if (cur && cur.t >= t) continue
    state[k] = { v: e.v === null ? null : String(e.v), t }
    changed++
  }
  return changed
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  // WebView は https://localhost から来るので、X-Sync-Token を付けた要求の前に
  // OPTIONS が飛ぶ。ここを返さないと本体の要求自体が出ない
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Token',
      'Access-Control-Max-Age': '86400',
    })
    res.end()
    return
  }

  if (TOKEN && req.headers['x-sync-token'] !== TOKEN) {
    sendJson(res, 401, { error: 'unauthorized' })
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, name: 'my_forward sync', count: Object.keys(state).length })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    sendJson(res, 200, { entries: state })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/state') {
    try {
      const parsed = JSON.parse(await readBody(req))
      const entries = parsed && parsed.entries
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        sendJson(res, 400, { error: 'entries required' })
        return
      }
      const changed = mergeIncoming(entries)
      if (changed > 0) save()
      log(`受信 ${Object.keys(entries).length} 件 / 更新 ${changed} 件`)
      sendJson(res, 200, { ok: true, changed, count: Object.keys(state).length })
    } catch (e) {
      sendJson(res, 400, { error: e.message })
    }
    return
  }

  sendJson(res, 404, { error: 'not found' })
})

load()
server.listen(PORT, '0.0.0.0', () => {
  log(`待ち受け 0.0.0.0:${PORT}${TOKEN ? '（合言葉あり）' : '（合言葉なし）'}`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('終了します')
    server.close(() => process.exit(0))
  })
}
