/**
 * cc-sdd 進捗ダッシュボード（インタラクティブ版）
 * 実行: node dashboard.js
 * ブラウザで http://localhost:4000 を開く
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPECS_DIR = path.join(__dirname, '.kiro', 'specs')
const PORT = 4000

// ─── データ読み書き ────────────────────────────────────────
function loadSpecs() {
  if (!fs.existsSync(SPECS_DIR)) return []
  return fs.readdirSync(SPECS_DIR).flatMap((name) => {
    const dir = path.join(SPECS_DIR, name)
    if (!fs.statSync(dir).isDirectory()) return []
    const jsonPath = path.join(dir, 'spec.json')
    if (!fs.existsSync(jsonPath)) return []
    const spec = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const files = {}
    for (const f of ['requirements.md', 'design.md', 'tasks.md']) {
      const fp = path.join(dir, f)
      files[f] = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null
    }
    return [{ name, dir, spec, files }]
  })
}

function saveSpec(dir, spec) {
  spec.updated_at = new Date().toISOString()
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2))
}

// フェーズの自動更新
function recalcPhase(spec) {
  const ap = spec.approvals
  if (spec.ready_for_implementation) { spec.phase = 'implementation'; return }
  if (ap.tasks.approved)             { spec.phase = 'implementation'; return }
  if (ap.tasks.generated)            { spec.phase = 'tasks'; return }
  if (ap.design.approved)            { spec.phase = 'tasks'; return }
  if (ap.design.generated)           { spec.phase = 'design'; return }
  if (ap.requirements.approved)      { spec.phase = 'design'; return }
  if (ap.requirements.generated)     { spec.phase = 'requirements'; return }
  spec.phase = 'initialized'
}

// ─── APIハンドラー ─────────────────────────────────────────
function handleApprove(specName, field, value) {
  const specs = loadSpecs()
  const entry = specs.find((s) => s.name === specName)
  if (!entry) return false

  const [section, key] = field.split('.')   // e.g. "requirements.approved"
  if (section === 'ready_for_implementation') {
    entry.spec.ready_for_implementation = value
  } else if (entry.spec.approvals[section] && key in entry.spec.approvals[section]) {
    entry.spec.approvals[section][key] = value
  } else {
    return false
  }

  recalcPhase(entry.spec)
  saveSpec(entry.dir, entry.spec)
  return true
}

// ─── HTML ────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function approvalRow(label, specName, section, spec) {
  const ap = spec.approvals[section]
  const genChecked  = ap.generated ? 'checked' : ''
  const apprChecked = ap.approved  ? 'checked' : ''
  return `
  <div class="approval-row">
    <span class="row-label">${label}</span>
    <label class="toggle ${ap.generated ? 'on' : ''}">
      <input type="checkbox" ${genChecked}
        onchange="approve('${esc(specName)}','${section}.generated',this.checked)">
      生成済み
    </label>
    <label class="toggle ${ap.approved ? 'on' : ''}">
      <input type="checkbox" ${apprChecked}
        onchange="approve('${esc(specName)}','${section}.approved',this.checked)">
      承認
    </label>
  </div>`
}

const PHASE_ORDER = ['initialized','requirements','design','tasks','implementation','completed']
const PHASE_LABEL = {
  initialized:'初期化済み', requirements:'要件定義中', design:'設計中',
  tasks:'タスク分解中', implementation:'実装中', completed:'完了',
}
const STEP_LABELS = ['初期化','要件定義','設計','タスク分解','実装','完了']

function specCard({ name, spec, files }) {
  const idx = PHASE_ORDER.indexOf(spec.phase)

  const steps = STEP_LABELS.map((label, i) => {
    const cls = i < idx ? 'step done' : i === idx ? 'step active' : 'step'
    return `<div class="${cls}"><span class="dot"></span><span class="step-label">${label}</span></div>`
  }).join('')

  const readyChecked = spec.ready_for_implementation ? 'checked' : ''

  const previews = ['requirements.md','design.md','tasks.md'].map((f) => {
    if (!files[f]) return `<p class="no-file">${f} はまだ生成されていません</p>`
    const preview = files[f].split('\n').slice(0,25).join('\n')
    const more = files[f].split('\n').length > 25 ? '\n…（省略）' : ''
    return `<details><summary>${f}</summary><pre>${esc(preview+more)}</pre></details>`
  }).join('')

  return `
<div class="card" id="card-${esc(name)}">
  <div class="card-header">
    <h2>${esc(name)}</h2>
    <span class="phase-badge">${PHASE_LABEL[spec.phase] ?? spec.phase}</span>
  </div>

  <div class="stepper">${steps}</div>

  <div class="section-title">承認状況</div>
  <div class="approvals">
    ${approvalRow('要件定義', name, 'requirements', spec)}
    ${approvalRow('設計',     name, 'design',        spec)}
    ${approvalRow('タスク分解',name,'tasks',          spec)}
    <div class="approval-row">
      <span class="row-label">実装準備完了</span>
      <label class="toggle ready ${spec.ready_for_implementation ? 'on' : ''}">
        <input type="checkbox" ${readyChecked}
          onchange="approve('${esc(name)}','ready_for_implementation',this.checked)">
        実装OK
      </label>
    </div>
  </div>

  <div class="section-title">ファイルプレビュー</div>
  <div class="previews">${previews}</div>
</div>`
}

function renderHTML(specs) {
  const cards = specs.length
    ? specs.map(specCard).join('')
    : `<div class="empty-state">仕様がまだありません。<br>
       Claude Code で <code>/kiro:spec-init &lt;機能名&gt;</code> を実行してください。</div>`

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cc-sdd ダッシュボード</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:"Noto Sans JP","Helvetica Neue",Arial,sans-serif;
  background:#eceff1;color:#263238;
  padding:20px 16px 60px;
}
header{
  max-width:740px;margin:0 auto 20px;
  display:flex;align-items:center;justify-content:space-between;
}
header h1{font-size:17px;font-weight:600;color:#37474f}
.header-right{display:flex;align-items:center;gap:10px}
.refresh{
  font-size:12px;color:#78909c;background:#fff;
  border:1px solid #cfd8dc;border-radius:20px;
  padding:4px 12px;cursor:pointer;text-decoration:none;
}
.refresh:hover{background:#f5f5f5}
.status-msg{
  font-size:12px;color:#fff;background:#43a047;
  border-radius:20px;padding:3px 12px;
  opacity:0;transition:opacity .3s;
}
.status-msg.show{opacity:1}

.card{
  background:#fff;border-radius:12px;
  box-shadow:0 1px 4px rgba(0,0,0,.08);
  max-width:740px;margin:0 auto 20px;overflow:hidden;
}
.card-header{
  background:#37474f;color:#fff;
  padding:14px 20px;
  display:flex;align-items:center;justify-content:space-between;
}
.card-header h2{font-size:15px;font-weight:600}
.phase-badge{
  font-size:11px;background:rgba(255,255,255,.2);
  border-radius:20px;padding:3px 10px;
}

/* ステッパー */
.stepper{
  display:flex;padding:18px 20px 14px;
  overflow-x:auto;
}
.step{
  display:flex;flex-direction:column;align-items:center;
  flex:1;min-width:56px;position:relative;
}
.step+.step::before{
  content:'';position:absolute;
  top:8px;left:calc(-50%);width:100%;height:2px;
  background:#cfd8dc;
}
.step.done+.step::before,.step.active+.step::before{background:#37474f}
.dot{
  width:16px;height:16px;border-radius:50%;
  background:#cfd8dc;border:2px solid #cfd8dc;z-index:1;
}
.step.done .dot{background:#37474f;border-color:#37474f}
.step.active .dot{background:#fff;border:3px solid #37474f}
.step-label{font-size:10px;color:#90a4ae;margin-top:4px;text-align:center}
.step.done .step-label,.step.active .step-label{color:#37474f;font-weight:500}

/* セクションタイトル */
.section-title{
  font-size:11px;font-weight:600;color:#78909c;
  letter-spacing:.5px;text-transform:uppercase;
  padding:10px 20px 4px;border-top:1px solid #f0f0f0;
}

/* 承認行 */
.approvals{padding:4px 20px 12px}
.approval-row{
  display:flex;align-items:center;gap:10px;
  padding:8px 0;border-bottom:1px solid #f5f5f5;
  flex-wrap:wrap;
}
.approval-row:last-child{border-bottom:none}
.row-label{font-size:13px;flex:1;min-width:80px}

/* トグルスイッチ風チェックボックス */
.toggle{
  display:inline-flex;align-items:center;gap:6px;
  font-size:12px;color:#90a4ae;cursor:pointer;
  background:#f5f7f8;border:1px solid #e0e0e0;
  border-radius:20px;padding:4px 12px;
  transition:all .2s;user-select:none;
}
.toggle input{display:none}
.toggle.on{
  background:#e8f5e9;border-color:#a5d6a7;color:#2e7d32;font-weight:500;
}
.toggle.ready.on{
  background:#e3f2fd;border-color:#90caf9;color:#1565c0;
}
.toggle:hover{border-color:#90a4ae}

/* プレビュー */
.previews{padding:4px 20px 16px}
details{margin-bottom:6px}
summary{
  cursor:pointer;font-size:12px;color:#546e7a;
  padding:5px 0;user-select:none;
}
summary:hover{color:#37474f}
pre{
  font-size:11px;background:#f5f7f8;border-radius:6px;
  padding:10px 12px;overflow-x:auto;margin-top:6px;
  line-height:1.65;color:#455a64;
  white-space:pre-wrap;word-break:break-word;
}
.no-file{font-size:12px;color:#b0bec5;padding:4px 0}

.empty-state{
  text-align:center;padding:48px 20px;
  color:#90a4ae;font-size:14px;line-height:2.2;
  max-width:740px;margin:0 auto;
}
.empty-state code{
  background:#eceff1;padding:2px 8px;
  border-radius:4px;font-size:13px;color:#37474f;
}
.updated{
  font-size:11px;color:#90a4ae;
  text-align:center;margin-top:8px;
}
</style>
</head>
<body>
<header>
  <h1>📋 cc-sdd ダッシュボード</h1>
  <div class="header-right">
    <span class="status-msg" id="msg"></span>
    <a class="refresh" href="/">↻ 更新</a>
  </div>
</header>

${cards}

<p class="updated">最終更新: ${new Date().toLocaleString('ja-JP')}</p>

<script>
async function approve(specName, field, value) {
  // ラベルのUIを即時更新
  const label = event.target.closest('label')
  if (label) {
    label.classList.toggle('on', value)
  }

  try {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: specName, field, value }),
    })
    const data = await res.json()
    if (data.ok) {
      showMsg('保存しました ✅')
      // フェーズバッジとステッパーを更新するためページリロード（軽量）
      setTimeout(() => location.reload(), 800)
    } else {
      showMsg('エラー: ' + data.error)
    }
  } catch(e) {
    showMsg('通信エラー')
  }
}

function showMsg(text) {
  const el = document.getElementById('msg')
  el.textContent = text
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}
</script>
</body>
</html>`
}

// ─── HTTP サーバー ─────────────────────────────────────────
const server = http.createServer((req, res) => {
  // POST /api/approve
  if (req.method === 'POST' && req.url === '/api/approve') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { spec, field, value } = JSON.parse(body)
        const ok = handleApprove(spec, field, value)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(ok ? { ok: true } : { ok: false, error: 'Not found' }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: e.message }))
      }
    })
    return
  }

  // GET / → ダッシュボード
  const specs = loadSpecs()
  const html = renderHTML(specs)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
})

server.listen(PORT, () => {
  console.log(`✅ ダッシュボード起動中 → http://localhost:${PORT}`)
  console.log('   停止: Ctrl + C')
})
