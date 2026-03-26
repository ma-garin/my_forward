/**
 * ブラウザ内 PDF 給与明細パーサー
 * parse_salary.py のロジックを JavaScript / pdf.js で再実装
 */
import * as pdfjsLib from 'pdfjs-dist'

// pdf.js ワーカーを CDN から読み込み（Vite 環境用）
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── PDF → テキスト抽出 ─────────────────────────────────

async function extractPage(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()

  // テキスト全体
  const fullText = content.items.map(i => i.str).join(' ')

  // 座標付きワード一覧（源泉徴収票用）
  const viewport = page.getViewport({ scale: 1.0 })
  const words = content.items
    .filter(i => i.str.trim())
    .map(i => {
      const [,, , , tx, ty] = i.transform
      const top = viewport.height - ty
      return { text: i.str.trim(), x0: tx, top }
    })

  return { fullText, words }
}

// ─── 二重文字の正規化（PDF アーティファクト除去）────────

function dedup(text) {
  const result = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c.charCodeAt(0) < 256 || c === ' ' || c === '\n') {
      result.push(c)
      i++
    } else {
      if (i + 1 < text.length && text[i + 1] === c) {
        result.push(c)
        i += 2
      } else {
        result.push(c)
        i++
      }
    }
  }
  return result.join('')
}

// ─── テキストからラベル付き数値を抽出 ──────────────────

function getText(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = text.match(new RegExp(escaped + '\\s*([\\d,]+)'))
  if (!m) return null
  return parseInt(m[1].replace(/,/g, ''), 10)
}

// ─── 給与明細・賞与明細パーサー ──────────────────────────

function parseSalaryText(text, fileName) {
  const t = dedup(text)
  const isBonus = fileName.includes('賞与')

  const yM = fileName.match(/(\d{4})年/)
  const mM = fileName.match(/(\d+)月/)

  const otH = t.match(/時間外勤務\s*([\d.]+)/)

  return {
    year:          yM ? parseInt(yM[1], 10) : null,
    month:         mM ? parseInt(mM[1], 10) : null,
    type:          isBonus ? 'bonus' : 'salary',
    takeHome:      getText(t, '差引支給額'),
    totalPay:      getText(t, '支給額合計'),
    totalDed:      getText(t, '控除額合計'),
    overtime:      getText(t, '時間外手当'),
    overtimeHours: otH ? parseFloat(otH[1]) : null,
    basePay:       getText(t, '基本給') ?? getText(t, '職能給'),
    health:        getText(t, '健康保険'),
    pension:       getText(t, '厚生年金保険'),
    employment:    getText(t, '雇用保険'),
    income:        getText(t, '所得税'),
    resident:      getText(t, '住民税'),
    union:         getText(t, '組合費'),
    workDays:      getText(t, '勤務日数'),
  }
}

// ─── 源泉徴収票パーサー（座標ベース）──────────────────

function parseWithholdingData(text, words, fileName) {
  const t = dedup(text)

  // 令和N年 → 西暦
  const reiwa = t.match(/令和(\d+)年/)
  let year = reiwa ? 2018 + parseInt(reiwa[1], 10) : null
  if (!year) {
    const yM = fileName.match(/(\d{4})年/)
    year = yM ? parseInt(yM[1], 10) : null
  }

  const numRe = /^[\d,]+$/
  const pickRow = (minTop, maxTop) =>
    words
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

// ─── 公開 API: File → パース結果 ────────────────────────

export async function parseSalaryPdf(file) {
  const buf = await file.arrayBuffer()
  const { fullText, words } = await extractPage(buf)
  const name = file.name

  if (name.includes('源泉徴収票')) {
    return { type: 'withholding', data: parseWithholdingData(fullText, words, name) }
  }
  return { type: 'salary', data: parseSalaryText(fullText, name) }
}

/**
 * 複数ファイルを一括パース
 * @param {File[]} files
 * @returns {Promise<{ salaries: object[], withholding: object[], errors: string[] }>}
 */
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
