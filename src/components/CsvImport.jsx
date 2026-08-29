import { useState } from 'react'
import {
  Box, Typography, Button, Stack, Alert, Chip,
  Select, MenuItem, FormControlLabel, Checkbox, Divider,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { CARD_LIST } from '../utils/ccStorage'
import { fmt } from '../utils/finance'
import { decodeCsv, parseStatementCsv, toDrafts } from '../utils/parseStatementCsv'
import { ingestDrafts } from '../utils/inbox'

/**
 * 明細 CSV の取り込み。
 *
 * PayPay は個人向けの API を出していないので、アプリが出す取引履歴 CSV を
 * 読む以外に自動で取り込む方法がない（マネーフォワードでも同じ）。
 * カード会社の「ご利用明細 CSV」も形は同じなので、ここに一本化する。
 *
 * 読んだものはそのまま家計に入れず、受信箱（未確定の支出）に置く。
 * カテゴリを付けるのも取り消すのも、通知から来たものと同じ画面でできる。
 */

const ROLES = [
  { key: 'date',   label: '日付',   required: true },
  { key: 'amount', label: '金額',   required: true },
  { key: 'payee',  label: '利用先', required: false },
]

export default function CsvImport() {
  const [cardId, setCardId] = useState(CARD_LIST[0]?.id ?? 'jcb')
  const [text, setText]     = useState('')
  const [columns, setColumns] = useState(null)
  const [negative, setNegative] = useState(null)
  const [result, setResult] = useState(null)
  const [done, setDone]     = useState('')
  const [error, setError]   = useState('')

  const analyze = (csv, cols, neg) => {
    const r = parseStatementCsv(csv, {
      ...(cols ? { columns: cols } : {}),
      ...(neg === null || neg === undefined ? {} : { expenseIsNegative: neg }),
    })
    setResult(r)
    setColumns(r.columns)
    setNegative(r.expenseIsNegative)
  }

  const handleFile = async (file) => {
    setError(''); setDone(''); setResult(null); setColumns(null); setNegative(null)
    try {
      const csv = decodeCsv(await file.arrayBuffer())
      setText(csv)
      analyze(csv, null, null)
    } catch (e) {
      setError(`読み込めませんでした: ${e.message ?? ''}`)
    }
  }

  const changeColumn = (key, value) => {
    const next = { ...columns, [key]: value === '' ? null : Number(value) }
    analyze(text, next, negative)
  }

  const changeSign = (value) => analyze(text, columns, value)

  const handleImport = () => {
    const { added, duplicate } = ingestDrafts(toDrafts(result.rows, cardId))
    setDone(
      added === 0
        ? `新しい支払いはありませんでした（取り込み済み ${duplicate} 件）`
        : `${added} 件を受信箱に入れました${duplicate ? `（取り込み済み ${duplicate} 件は除く）` : ''}`,
    )
    setResult(null); setText('')
  }

  const missing = result
    ? ROLES.filter((r) => r.required && result.columns[r.key] == null).map((r) => r.label)
    : []

  return (
    <Box sx={{ p: 2, border: '1px solid var(--divider)', borderRadius: 2, mb: 2 }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>明細CSVの取り込み</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        PayPay アプリの取引履歴や、カード会社のご利用明細の CSV を読み込みます。
        いったん「未確定の支出」に入るので、確認してから登録できます。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{error}</Alert>}
      {done  && <Alert severity="success" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{done}</Alert>}

      {/* 支払い元。CSV には「どのカードか」が書かれていないので選んでもらう */}
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary">支払い元</Typography>
        {CARD_LIST.map((c) => (
          <Chip
            key={c.id} label={c.shortName} size="small"
            onClick={() => setCardId(c.id)}
            sx={{
              height: 24, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              bgcolor: cardId === c.id ? c.color : 'var(--surface-muted)',
              color: cardId === c.id ? '#fff' : 'text.secondary',
              '&:hover': { bgcolor: cardId === c.id ? c.color : 'var(--surface-muted)' },
            }}
          />
        ))}
      </Stack>

      <Button variant="outlined" size="small" startIcon={<UploadFileIcon />} component="label" fullWidth>
        CSVファイルを選ぶ
        <input type="file" accept=".csv,text/csv" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </Button>

      {result && (
        <Box sx={{ mt: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />

          {/* どの列を何として読んだか。外れていたら選び直せる */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            列の対応（自動判定）
          </Typography>
          <Stack gap={0.75}>
            {ROLES.map((role) => (
              <Stack key={role.key} direction="row" alignItems="center" gap={1}>
                <Typography variant="caption" sx={{ width: 48, flexShrink: 0 }}>{role.label}</Typography>
                <Select
                  size="small" fullWidth
                  value={result.columns[role.key] ?? ''}
                  onChange={(e) => changeColumn(role.key, e.target.value)}
                  displayEmpty
                  sx={{ fontSize: 12, '& .MuiSelect-select': { py: 0.6 } }}
                >
                  <MenuItem value="" sx={{ fontSize: 12 }}>（使わない）</MenuItem>
                  {result.headers.map((h, i) => (
                    <MenuItem key={`${h}-${i}`} value={i} sx={{ fontSize: 12 }}>{h || `列 ${i + 1}`}</MenuItem>
                  ))}
                </Select>
              </Stack>
            ))}
          </Stack>

          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={
              <Checkbox size="small" checked={!!result.expenseIsNegative}
                onChange={(e) => changeSign(e.target.checked)} />
            }
            label={
              <Typography variant="caption">
                支出はマイナスで書かれている（チャージ・入金を除く）
              </Typography>
            }
          />

          {missing.length > 0 ? (
            <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: 12 }}>
              {missing.join('と')}の列が決まっていません。上で選んでください
            </Alert>
          ) : (
            <>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 700 }}>
                支払い {result.rows.length} 件
                <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                  {result.skipped.notExpense > 0 && ` ／ 入金・チャージ ${result.skipped.notExpense} 件は除外`}
                  {result.skipped.noDate > 0 && ` ／ 日付が読めない ${result.skipped.noDate} 件`}
                  {result.skipped.noAmount > 0 && ` ／ 金額が読めない ${result.skipped.noAmount} 件`}
                </Typography>
              </Typography>

              {result.rows.length > 0 && (
                <Box sx={{ mt: 0.75, bgcolor: 'var(--surface-subtle)', borderRadius: 1, px: 1, py: 0.5 }}>
                  {result.rows.slice(0, 5).map((r, i) => (
                    <Stack key={i} direction="row" alignItems="center" gap={1} sx={{ py: 0.2 }}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', width: 62, flexShrink: 0 }}>
                        {r.date.slice(5)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, flex: 1, minWidth: 0 }} noWrap>
                        {r.payee || '（利用先なし）'}
                      </Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 700 }}>¥{fmt(r.amount)}</Typography>
                    </Stack>
                  ))}
                  {result.rows.length > 5 && (
                    <Typography sx={{ fontSize: 10, color: 'text.disabled', pt: 0.3 }}>
                      ほか {result.rows.length - 5} 件
                    </Typography>
                  )}
                </Box>
              )}

              <Button
                variant="contained" size="small" fullWidth sx={{ mt: 1.5 }}
                disabled={result.rows.length === 0}
                onClick={handleImport}
              >
                {result.rows.length} 件を未確定の支出に入れる
              </Button>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
