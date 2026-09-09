import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box, Typography, Button, Stack, Chip, Divider, Alert, TextField,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  isCaptureAvailable, isPermissionGranted, openPermissionSettings,
  getRecords, clearRecords, getAllowedPackages, setAllowedPackages,
} from '../utils/notificationCapture'
import ExpenseDialog from '../components/ExpenseDialog'
import {
  CARDS, upsertVarItem, billingYmForCard,
  loadRegisteredNotifications, addRegisteredNotification,
} from '../utils/ccStorage'
import { loadCategories, newId, fmt, currentBillingYm } from '../utils/finance'
import { parseCardNotification, notificationKey } from '../utils/parseCardNotification'

// 通知から支出を作るときの既定カード。ここで決め打ちにせず、
// 確認ダイアログで選び直せるようにしている。
const DEFAULT_CARD = 'jcb'

const fmtTime = (ms) => {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 1 件の通知から、実際に文字が入っているものだけを拾って並べる
const bodyLines = (r) => [r.text, r.bigText, r.subText, r.infoText, r.ticker]
  .map((v) => (v ?? '').trim())
  .filter((v, i, a) => v && a.indexOf(v) === i)

/**
 * 通知 1 件の表示。読み取れた金額を見せ、「登録」で確認ダイアログを開く。
 * ここでは保存しない（押し間違いでデータが増えないようにするため）。
 */
function CaptureRow({ record, done, onRegister }) {
  const parsed = parseCardNotification(record)
  return (
    <Box sx={{ py: 1, borderBottom: '1px solid #f0f0f0' }}>
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography sx={{ fontSize: 10, color: 'text.disabled', wordBreak: 'break-all' }}>
          {record.packageName}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.disabled', whiteSpace: 'nowrap' }}>
          {fmtTime(record.postTime)}
        </Typography>
      </Stack>
      {record.title && <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{record.title}</Typography>}
      {bodyLines(record).map((line, j) => (
        <Typography key={j} sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
          {line}
        </Typography>
      ))}
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 0.75 }}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
          {parsed.hasAmount ? (
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>¥{fmt(parsed.amount)}</Typography>
          ) : (
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>金額を読み取れませんでした</Typography>
          )}
          {done && (
            <Chip size="small" label="登録済み" color="success" variant="outlined"
              sx={{ fontSize: 10, height: 20 }} />
          )}
        </Stack>
        <Button size="small" variant={done ? 'text' : 'outlined'}
          onClick={() => onRegister(record)} sx={{ flexShrink: 0 }}>
          {done ? '再登録' : '登録'}
        </Button>
      </Stack>
    </Box>
  )
}

export default function NotificationCaptureSettings() {
  const available = isCaptureAvailable()
  const [granted, setGranted] = useState(false)
  const [records, setRecords] = useState([])
  const [allowed, setAllowed] = useState([])
  const [query, setQuery] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // 「登録」を押した通知の下書き。ここに値が入っている間だけ確認ダイアログを出す。
  // ボタン押下では保存せず、ダイアログで保存を押して初めて書き込む。
  const [draft, setDraft] = useState(null)
  const [registered, setRegistered] = useState(() => loadRegisteredNotifications())
  const [snack, setSnack] = useState(null)
  const categories = useMemo(() => loadCategories(), [])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // 通知はアプリが閉じている間に溜まるので、画面を開くたびにネイティブから読み直す
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [g, r, a] = await Promise.all([
        isPermissionGranted(), getRecords(), getAllowedPackages(),
      ])
      if (!alive) return
      setGranted(g)
      setRecords(r)
      setAllowed(a)
    })()
    return () => { alive = false }
  }, [reloadKey])

  // 送信元ごとの件数。どのアプリが通知しているかを掴んで絞り込みに使う。
  const senders = useMemo(() => {
    const map = {}
    records.forEach((r) => { map[r.packageName] = (map[r.packageName] ?? 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [records])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) =>
      [r.packageName, r.title, ...bodyLines(r)].some((v) => (v ?? '').toLowerCase().includes(q)))
  }, [records, query])

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(shown, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  const toggleSender = async (pkg) => {
    const next = allowed.includes(pkg) ? allowed.filter((p) => p !== pkg) : [...allowed, pkg]
    setAllowed(next)
    await setAllowedPackages(next)
  }

  // 通知 → 支出の下書きを作って確認ダイアログを開く。この時点では保存しない。
  const openDraft = useCallback((r) => {
    const parsed = parseCardNotification(r)
    setDraft({
      key: notificationKey(r),
      initial: {
        name: parsed.payee || (r.title ?? '').trim(),
        payee: parsed.payee,
        amount: parsed.amount || '',
        date: parsed.date,
        spendType: '消費',
      },
    })
  }, [])

  // ダイアログの保存を押したときだけ変動費に書き込む。
  const saveDraft = (v) => {
    try {
      const fallbackYm = currentBillingYm(CARDS[v.cardId]?.cutoffDay ?? 0)
      const ym = billingYmForCard(v.date, v.cardId, fallbackYm)
      upsertVarItem({
        item: {
          id: newId(),
          name: v.name, payee: v.payee, amount: v.amount,
          category: v.category, spendType: v.spendType, date: v.date,
        },
        fromCard: v.cardId, fromYm: ym, toCard: v.cardId,
      })
      setRegistered(addRegisteredNotification(draft.key))
      setSnack({ severity: 'success', message: `変動費に登録しました（${ym.replace('-', '年')}月分）` })
    } catch {
      setSnack({ severity: 'error', message: '登録に失敗しました' })
    }
  }

  if (!available) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>通知の取り込み</Typography>
        <Alert severity="info" sx={{ fontSize: 13 }}>
          この機能は Android アプリ版でのみ使えます。ブラウザからは他アプリの通知を読めないため、
          Web 版（GitHub Pages）では動きません。
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>通知の取り込み</Typography>
        <IconButton size="small" aria-label="再読み込み" onClick={reload}><RefreshIcon /></IconButton>
      </Stack>

      {granted ? (
        <Alert severity="success" sx={{ mb: 2, fontSize: 13 }}>
          通知へのアクセスは許可されています。クレカアプリの通知が届くとここに溜まります。
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 13 }}
          action={<Button size="small" onClick={openPermissionSettings}>設定を開く</Button>}>
          通知へのアクセスが未許可です。端末の設定で、このアプリに通知へのアクセスを許可してください。
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
        通知は<b>記録するだけ</b>で、そのままでは支出になりません。
        「登録」を押すと読み取った金額を入れた確認画面が開くので、
        内容を確かめて保存したものだけが変動費になります。
      </Alert>

      {senders.length > 0 && (
        <>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.75 }}>
            送信元（タップで記録対象を絞り込み / 未選択なら全部記録）
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mb: 2 }}>
            {senders.map(([pkg, count]) => (
              <Chip
                key={pkg} size="small" label={`${pkg}（${count}）`}
                onClick={() => toggleSender(pkg)}
                color={allowed.includes(pkg) ? 'primary' : 'default'}
                variant={allowed.includes(pkg) ? 'filled' : 'outlined'}
                sx={{ fontSize: 10, maxWidth: '100%' }}
              />
            ))}
          </Stack>
        </>
      )}

      <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
        <TextField
          size="small" fullWidth placeholder="絞り込み（送信元・本文）"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyAll} disabled={shown.length === 0}>
          {copied ? 'コピー済' : 'コピー'}
        </Button>
        <IconButton size="small" aria-label="全部消す" onClick={() => setClearOpen(true)}
          disabled={records.length === 0} sx={{ color: 'error.light' }}>
          <DeleteOutlineIcon />
        </IconButton>
      </Stack>

      <Typography sx={{ fontSize: 11, color: 'text.disabled', mb: 1 }}>
        {records.length === 0 ? '記録はまだありません' : `${shown.length} / ${records.length} 件（新しい順・最大300件）`}
      </Typography>

      {shown.map((r, i) => (
        <CaptureRow
          key={`${r.postTime}-${i}`}
          record={r}
          done={registered.includes(notificationKey(r))}
          onRegister={openDraft}
        />
      ))}

      <Dialog open={clearOpen} onClose={() => setClearOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, pb: 1 }}>記録を消しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">記録した通知をすべて削除します。元に戻せません。</Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setClearOpen(false)}>キャンセル</Button>
          <Button size="small" color="error" variant="contained"
            onClick={async () => { await clearRecords(); setClearOpen(false); reload() }}>
            削除
          </Button>
        </DialogActions>
      </Dialog>
      {draft && (
        <ExpenseDialog
          open
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          initial={draft.initial}
          title="通知から支出を登録"
          categories={categories}
          cardId={DEFAULT_CARD}
        />
      )}

      <Snackbar
        open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} variant="filled" sx={{ fontSize: 13 }}
            onClose={() => setSnack(null)}>
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>

      <Divider sx={{ mt: 2 }} />
    </Box>
  )
}
