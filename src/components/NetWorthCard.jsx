import { useMemo, useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Divider, IconButton, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CardHeaderBar from './CardHeaderBar'
import AmountField, { parseAmount } from './AmountField'
import { fmt, getCCTotal, newId } from '../utils/finance'
import { CARD_LIST } from '../utils/ccStorage'
import { loadAccounts, saveAccounts, totalBalance, recordNetWorth, loadNetWorthHistory } from '../utils/accounts'
import NetWorthTrend from './NetWorthTrend'

/**
 * 口座残高と純資産。
 *
 * 銀行とはつながらないので残高は手入力。行をタップして更新する。
 * 純資産 = 口座残高の合計 − カードの未払い（表示中の請求月の利用合計）。
 * 現金は「口座」として残高を持たせる（現金支出はカード側の集計に入るので、
 * ここで二重には引かない）。
 */
export default function NetWorthCard({ billingYm, isCurrentMonth = false }) {
  const [accounts, setAccounts] = useState(loadAccounts)
  const [dlg, setDlg] = useState(null)   // null | { id?, name, balance }

  // 未払い = 請求サイクルを持つカードの、表示中請求月の利用合計
  const unpaid = useMemo(
    () => CARD_LIST.filter((c) => !c.noBilling)
      .reduce((s, c) => s + getCCTotal(c.id, billingYm).total, 0),
    [billingYm],
  )

  const balance = totalBalance(accounts)
  const netWorth = balance - unpaid

  // 今月ぶんの純資産を記録して推移にする。
  // 過去の月を開いているときは未払いがその月のものになるので記録しない
  // （振り返っただけで履歴が書き換わってしまう）。
  const [history, setHistory] = useState(loadNetWorthHistory)
  useEffect(() => {
    if (!isCurrentMonth || accounts.length === 0) return
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setHistory(recordNetWorth(netWorth, ym))
  }, [isCurrentMonth, netWorth, accounts.length])

  const commit = (next) => {
    setAccounts(next)
    saveAccounts(next)
  }

  const handleSave = () => {
    const amount = parseAmount(dlg.balance)
    if (!dlg.name.trim()) return
    if (dlg.id) commit(accounts.map((a) => (a.id === dlg.id ? { ...a, name: dlg.name.trim(), balance: amount } : a)))
    else commit([...accounts, { id: newId(), name: dlg.name.trim(), balance: amount }])
    setDlg(null)
  }

  const handleDelete = () => {
    commit(accounts.filter((a) => a.id !== dlg.id))
    setDlg(null)
  }

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardHeaderBar
        title="資産"
        right={
          <IconButton size="small" aria-label="口座を追加"
            onClick={() => setDlg({ name: '', balance: '' })} sx={{ p: 0.5, color: '#fff' }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        }
      />
      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {accounts.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 1, textAlign: 'center' }}>
            右上の + から口座（銀行・現金）の残高を登録すると、純資産が出ます
          </Typography>
        ) : (
          <>
            {accounts.map((a) => (
              <Stack key={a.id} direction="row" justifyContent="space-between" alignItems="center"
                onClick={() => setDlg({ id: a.id, name: a.name, balance: String(a.balance) })}
                sx={{ py: 0.6, cursor: 'pointer', '&:active': { opacity: 0.6 } }}>
                <Typography fontSize={13}>{a.name}</Typography>
                <Typography fontSize={13} fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  ¥{fmt(a.balance)}
                </Typography>
              </Stack>
            ))}
            <Divider sx={{ my: 0.75 }} />
            <Stack direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
              <Typography fontSize={12} color="text.secondary">口座残高 合計</Typography>
              <Typography fontSize={12} color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                ¥{fmt(balance)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
              <Typography fontSize={12} color="text.secondary">カード未払い（{billingYm} 請求）</Typography>
              <Typography fontSize={12} color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                −¥{fmt(unpaid)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ pt: 0.6 }}>
              <Typography fontSize={13} fontWeight={700}>純資産</Typography>
              <Typography fontSize={18} fontWeight={700}
                sx={{ fontVariantNumeric: 'tabular-nums', color: netWorth < 0 ? 'error.main' : 'inherit' }}>
                ¥{fmt(netWorth)}
              </Typography>
            </Stack>

            <NetWorthTrend history={history} />
          </>
        )}
      </CardContent>

      {dlg && (
        <Dialog open onClose={() => setDlg(null)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ pb: 1, fontSize: 15 }}>{dlg.id ? '残高を更新' : '口座を追加'}</DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack gap={2}>
              <TextField label="名前" size="small" fullWidth placeholder="例: ゆうちょ / 現金"
                value={dlg.name} onChange={(e) => setDlg({ ...dlg, name: e.target.value })} />
              <AmountField label="残高" value={dlg.balance}
                onChange={(v) => setDlg((prev) => ({ ...prev, balance: v }))} allowZero />
            </Stack>
          </DialogContent>
          <DialogActions>
            {dlg.id && (
              <IconButton size="small" aria-label="口座を削除" onClick={handleDelete}
                sx={{ mr: 'auto', color: 'error.main' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
            <Button onClick={() => setDlg(null)} color="inherit" size="small">キャンセル</Button>
            <Button onClick={handleSave} variant="contained" size="small" disabled={!dlg.name.trim()}>
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Card>
  )
}
