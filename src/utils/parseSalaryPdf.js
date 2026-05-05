/**
 * ブラウザ内 PDF 給与明細パーサー
 * 座標ベースの行単位マッチングで wkhtmltopdf 等のテーブル形式PDFに対応
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// ─── PDF → テキストアイテム抽出 ──────────────────────────────
async function extractPage(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  const viewport = page.getViewport({ scale: 1.0 })

  const items = content.items
    .filter(i => i.str.trim())
    .map(i => {
      const [,, , , tx, ty] = i.transform
      return { text: i.str.trim(), x0: tx, top: viewport.height - ty }
    })

  // テキスト連結（正規表現フォールバック用）
  const fullText = content.items.map(i => i.str).join(' ')

  return { items, fullText }
}

// ─── 座標ベースの行グループ化 ────────────────────────────────
// 同じ行（Y座標が近い）のアイテムをグループ化し、行内はX順にソート
function buildRows(items) {
  const rows = []
  for (const item of items) {
    const row = rows.find(r => Math.abs(r.top - item.top) < 6)
    if (row) row.items.push(item)
    else rows.push({ top: item.top, items: [item] })
  }
  rows.forEach(r => r.items.sort((a, b) => a.x0 - b.x0))
  rows.sort((a, b) => a.top - b.top)
  return rows
}

// 行のテキストを結合（スペースなし）
function rowText(row) {
  return row.items.map(i => i.text).join('')
}

// 行内の数値を抽出（カンマ区切り数字）
function rowNumbers(row) {
  return row.items
    .filter(i => /^[\d,]+$/.test(i.text.replace(/,/g, '')))
    .map(i => parseInt(i.text.replace(/,/g, ''), 10))
    .filter(n => n > 0)
}

// ラベルに対応する値を行から探す（複数ラベル候補を順に試す）
function findValue(rows, ...labels) {
  for (const label of labels) {
    for (const row of rows) {
      if (rowText(row).includes(label)) {
        const nums = rowNumbers(row)
        if (nums.length > 0) return nums[0]
      }
    }
  }
  return null
}

// ─── 二重文字の正規化（フォールバック用） ────────────────────
function dedup(text) {
  const result = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c.charCodeAt(0) < 256 || c === ' ' || c === '\n') {
      result.push(c); i++
    } else {
      if (i + 1 < text.length && text[i + 1] === c) {
        result.push(c); i += 2
      } else {
        result.push(c); i++
      }
    }
  }
  return result.join('')
}

// テキスト連結版のフォールバック検索
function getTextFallback(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = text.match(new RegExp(escaped + '\\s*([\\d,]+)'))
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null
}

// ─── 給与明細・賞与明細パーサー ──────────────────────────────
function parseSalaryText(fullText, rows, fileName) {
  const t = dedup(fullText)
  const isBonus = fileName.includes('賞与')

  // 年月: ファイル名優先、次にPDFテキストから
  const yM = fileName.match(/(\d{4})年/) || t.match(/(\d{4})年/)
  const mM = fileName.match(/(\d+)月/)   || t.match(/(\d{1,2})月/)

  // 時間外勤務時間: 行内の小数を探す
  const otRow = rows.find(r => rowText(r).includes('時間外勤務'))
  const otH = otRow
    ? otRow.items.find(i => /^[\d.]+$/.test(i.text) && i.text.includes('.'))?.text
    : t.match(/時間外勤務\s*([\d.]+)/)?.[1]

  const get = (...labels) =>
    findValue(rows, ...labels) ?? getTextFallback(t, labels[0])

  return {
    year:          yM ? parseInt(yM[1], 10) : null,
    month:         mM ? parseInt(mM[1], 10) : null,
    type:          isBonus ? 'bonus' : 'salary',
    takeHome:      get('差引支給額', '差引支給', '差引'),
    totalPay:      get('支給額合計', '支給合計'),
    totalDed:      get('控除額合計', '控除合計'),
    overtime:      get('時間外手当', '時間外'),
    overtimeHours: otH ? parseFloat(otH) : null,
    basePay:       get('基本給', '職能給', '基本'),
    health:        get('健康保険'),
    pension:       get('厚生年金保険', '厚生年金'),
    employment:    get('雇用保険'),
    income:        get('所得税'),
    resident:      get('住民税'),
    union:         get('組合費'),
    workDays:      get('勤務日数'),
  }
}

// ─── 源泉徴収票パーサー（座標ベース）────────────────────────
function parseWithholdingData(fullText, items, fileName) {
  const t = dedup(fullText)

  const reiwa = t.match(/令和(\d+)年/)
  let year = reiwa ? 2018 + parseInt(reiwa[1], 10) : null
  if (!year) {
    const yM = fileName.match(/(\d{4})年/) || t.match(/(\d{4})年/)
    year = yM ? parseInt(yM[1], 10) : null
  }

  const numRe = /^[\d,]+$/
  const pickRow = (minTop, maxTop) =>
    items
      .filter(w => w.top >= minTop && w.top <= maxTop && numRe.test(w.text.replace(/,/g, '')))
      .sort((a, b) => a.x0 - b.x0)
      .map(w => parseInt(w.text.replace(/,/g, ''), 10))

  const vals187 = pickRow(180, 200)
  const vals287 = pickRow(278, 300)

  return {
    year,
    totalPay:        vals187[0] ?? null,
    afterDeduction:  vals187[1] ?? null,
    deductionTotal:  vals187[2] ?? null,
    incomeTax:       vals187[3] ?? null,
    socialInsurance: vals287[0] ?? null,
  }
}

// ─── 公開 API ─────────────────────────────────────────────
export async function parseSalaryPdf(file) {
  const buf = await file.arrayBuffer()
  const { items, fullText } = await extractPage(buf)
  const name = file.name

  if (name.includes('源泉徴収票')) {
    return { type: 'withholding', data: parseWithholdingData(fullText, items, name) }
  }

  const rows = buildRows(items)
  return { type: 'salary', data: parseSalaryText(fullText, rows, name) }
}

export async function parseMultiplePdfs(files) {
  const salaries = []
  const withholding = []
  const errors = []

  for (const file of files) {
    try {
      const result = await parseSalaryPdf(file)
      if (result.type === 'withholding') {
        withholding.push(result.data)
      } else {
        salaries.push(result.data)
      }
    } catch (e) {
      errors.push(`${file.name}: ${e.message}`)
    }
  }

  salaries.sort((a, b) => (a.year || 0) - (b.year || 0) || (a.month || 0) - (b.month || 0))
  withholding.sort((a, b) => (a.year || 0) - (b.year || 0))

  return { salaries, withholding, errors }
}
