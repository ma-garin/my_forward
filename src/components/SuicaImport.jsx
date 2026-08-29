import { useState } from 'react'
import { Box, Typography, Button, Stack, Alert, CircularProgress, Divider } from '@mui/material'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import { CARD_LIST } from '../utils/ccStorage'
import { fmt } from '../utils/finance'
import { isOcrAvailable, recognizeLines, shrinkImage } from '../utils/ocr'
import { parseSuicaHistory } from '../utils/parseSuicaHistory'
import { toDrafts } from '../utils/parseStatementCsv'
import { ingestDrafts } from '../utils/inbox'

/**
 * モバイルSuica の利用履歴を、アプリの画面から読み取って取り込む。
 *
 * JR 東日本は個人向けの利用履歴 API を出しておらず、モバイルSuica 自体に
 * CSV 書き出しも無い。会員サイトを読みに行く方法は ID・パスワードと画像認証が
 * 要り、「外と通信しない」という前提を壊す。
 *
 * そこで、利用履歴の画面をそのまま読む。読み取りは端末内で終わるので、
 * 画像もデータも外へ出ない。
 */

// Suica の支払い元。設定で消されていることもある
const suicaCard = () =>
  CARD_LIST.find((c) => c.id === 'suica')
  ?? CARD_LIST.find((c) => /suica/i.test(c.shortName) || /suica/i.test(c.name))

export default function SuicaImport() {
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState(null)
  const [done, setDone]     = useState('')
  const [error, setError]   = useState('')

  const card = suicaCard()
  if (!isOcrAvailable() || !card) return null

  const handleFile = async (file) => {
    setError(''); setDone(''); setResult(null); setBusy(true)
    try {
      const lines = await recognizeLines(await shrinkImage(file))
      setResult(parseSuicaHistory(lines))
    } catch (e) {
      setError(`読み取れませんでした: ${e.message ?? ''}`)
    } finally {
      setBusy(false)
    }
  }

  const handleImport = () => {
    const { added, duplicate } = ingestDrafts(toDrafts(result.rows, card.id))
    setDone(
      added === 0
        ? `新しい利用はありませんでした（取り込み済み ${duplicate} 件）`
        : `${added} 件を受信箱に入れました${duplicate ? `（取り込み済み ${duplicate} 件は除く）` : ''}`,
    )
    setResult(null)
  }

  return (
    <Box sx={{ p: 2, border: '1px solid var(--divider)', borderRadius: 2, mb: 2 }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
        モバイルSuica の利用履歴を読み取る
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        モバイルSuica アプリの利用履歴を画面ごと撮って選んでください。読み取りは
        この端末の中で終わります（画像もデータも外へ出ません）。
        画面には使った額が出ないので、残額の差から出します。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{error}</Alert>}
      {done  && <Alert severity="success" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{done}</Alert>}

      <Button variant="outlined" size="small" fullWidth component="label" disabled={busy}
        startIcon={busy ? <CircularProgress size={14} /> : <PhotoLibraryIcon />}>
        {busy ? '読み取っています…' : '利用履歴のスクリーンショットを選ぶ'}
        <input type="file" accept="image/*" hidden disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </Button>

      {result && (
        <Box sx={{ mt: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
            利用 {result.rows.length} 件
            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
              {result.charges > 0 && ` ／ チャージ ${result.charges} 件は除外`}
              {result.noChange > 0 && ` ／ 入場など残額が動かない ${result.noChange} 件`}
              {result.lastRow > 0 && ' ／ いちばん古い 1 件は差が出せず除外'}
            </Typography>
          </Typography>

          {result.rows.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: 12 }}>
              利用が読み取れませんでした（{result.read} 行を認識）。
              残額の列まで入るように撮り直してください
            </Alert>
          ) : (
            <>
              <Box sx={{ mt: 0.75, bgcolor: 'var(--surface-subtle)', borderRadius: 1, px: 1, py: 0.5 }}>
                {result.rows.slice(0, 6).map((r, i) => (
                  <Stack key={i} direction="row" alignItems="center" gap={1} sx={{ py: 0.2 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', width: 42, flexShrink: 0 }}>
                      {r.date.slice(5)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, flex: 1, minWidth: 0 }} noWrap>
                      {r.payee || '（利用場所なし）'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 700 }}>¥{fmt(r.amount)}</Typography>
                  </Stack>
                ))}
                {result.rows.length > 6 && (
                  <Typography sx={{ fontSize: 10, color: 'text.disabled', pt: 0.3 }}>
                    ほか {result.rows.length - 6} 件
                  </Typography>
                )}
              </Box>

              <Typography variant="caption" color="text.secondary"
                sx={{ display: 'block', fontSize: 10, mt: 0.75 }}>
                チャージは取り込みません。チャージした側（カード・現金）で
                すでに家計から出ているためです。
              </Typography>

              <Button variant="contained" size="small" fullWidth sx={{ mt: 1 }} onClick={handleImport}>
                {result.rows.length} 件を未確定の支出に入れる
              </Button>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
