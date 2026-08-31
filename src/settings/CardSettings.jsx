import { useState } from 'react'
import {
  Box, Typography, Stack, Button, TextField, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Switch, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { newId } from '../utils/finance'
import { loadCards, saveCards, cardHasRecords } from '../utils/ccStorage'
import { paymentCardKey, loadHiddenCards, setCardVisible } from '../utils/cardVisibility'
import { cutoffLabel, paymentLabel } from '../utils/billingCycle'

const COLORS = ['#37474f', '#1b5e20', '#1a237e', '#4a148c', '#b71c1c', '#e65100']

function CardDialog({ initial, onSave, onClose }) {
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [shortName,   setShortName]   = useState(initial?.shortName   ?? '')
  const [cutoffDay,   setCutoffDay]   = useState(initial?.cutoffDay   ?? 15)
  const [paymentDay,  setPaymentDay]  = useState(initial?.paymentDay  ?? 10)
  const [color,       setColor]       = useState(initial?.color       ?? COLORS[0])
  // 残高払い（現金・PayPay・Suica）は締め日も支払日も持たない。
  // クレジットカードと同じ扱いにすると、来ない支払日の通知が出る
  const [noBilling,   setNoBilling]   = useState(initial?.noBilling   ?? false)

  const valid = name.trim() && shortName.trim()

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? 'カードを編集' : 'カードを追加'}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <TextField label="カード名" value={name} onChange={e => setName(e.target.value)} size="small" fullWidth />
          <TextField label="略称（タブ表示名）" value={shortName} onChange={e => setShortName(e.target.value)} size="small" fullWidth />
          <FormControlLabel
            control={<Switch size="small" checked={noBilling}
              onChange={(e) => setNoBilling(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2">残高払い・現金</Typography>
                <Typography variant="caption" color="text.secondary">
                  電子マネー（PayPay・Suica）や現金。締め日と支払日を持たない
                </Typography>
              </Box>
            }
          />
          {!noBilling && (
            <Stack direction="row" gap={1}>
              <TextField
                label="締め日" type="number" size="small" fullWidth
                value={cutoffDay} onChange={e => setCutoffDay(Number(e.target.value))}
                helperText="0=月末"
                inputProps={{ min: 0, max: 31 }}
              />
              <TextField
                label="支払い日" type="number" size="small" fullWidth
                value={paymentDay} onChange={e => setPaymentDay(Number(e.target.value))}
                inputProps={{ min: 1, max: 31 }}
              />
            </Stack>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">カラー</Typography>
            <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
              {COLORS.map(c => (
                <Box key={c} onClick={() => setColor(c)}
                  sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                    border: color === c ? '3px solid #000' : '3px solid transparent' }} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" disabled={!valid}
          onClick={() => onSave({
            name: name.trim(), shortName: shortName.trim(), color,
            cutoffDay:  noBilling ? 0 : cutoffDay,
            paymentDay: noBilling ? 0 : paymentDay,
            ...(noBilling ? { noBilling: true } : {}),
          })}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function CardSettings() {
  const [cards, setCards] = useState(loadCards)
  const [dlg, setDlg] = useState(null) // null | { mode: 'add' | 'edit', initial? }
  const [confirm, setConfirm] = useState(null) // 記録があるカードを消す前の確認
  // 隠しているものの一覧。消すのと違い、隠すだけなら合計は変わらない
  const [hidden, setHidden] = useState(loadHiddenCards)

  const toggleVisible = (id, visible) => {
    setCardVisible(paymentCardKey(id), visible)
    setHidden(loadHiddenCards())
  }

  const handleSave = (data) => {
    let next
    if (dlg.mode === 'add') {
      next = [...cards, { id: newId(), ...data }]
    } else {
      next = cards.map(c => c.id === dlg.initial.id ? { ...c, ...data } : c)
    }
    setCards(next)
    saveCards(next)
    setDlg(null)
  }

  // 記録のある支払い元を消すと、その固定費・変動費が読めなくなる。
  // 確かめてから消す
  const handleDelete = (card) => {
    if (cardHasRecords(card.id)) { setConfirm(card); return }
    remove(card.id)
  }

  const remove = (id) => {
    const next = cards.filter(c => c.id !== id)
    setCards(next)
    saveCards(next)
    setConfirm(null)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>カード設定</Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        クレジットカードのほか、現金・電子マネー（PayPay・Suica）も支払い元として
        足せます。ここで足したものは支出の入力・集計・グラフすべてに出ます。
        使わないものはスイッチで隠せます（合計は変わりません）。
      </Typography>

      {cards.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          支払い元がありません。追加してください。
        </Typography>
      )}

      <Stack gap={1} sx={{ mb: 2 }}>
        {cards.map(card => (
          <Box key={card.id} sx={{ p: 1.5, border: '1px solid var(--divider)', borderRadius: 2,
            borderLeft: `4px solid ${card.color}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Typography fontWeight={600} fontSize={14} noWrap>{card.name}</Typography>
                  <Chip label={card.shortName} size="small"
                    sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: card.color, color: '#fff' }} />
                </Stack>
                {/* 残高払いに締め日・支払日は無い。0 日払いと出すと嘘になる */}
                <Typography variant="caption" color="text.secondary">
                  {card.noBilling
                    ? '残高払い・現金（締め日なし）'
                    : `${cutoffLabel(card)} ${paymentLabel(card)}`}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center">
                {/* 隠すのは並びだけ。合計や家計タブの合算からは外さない */}
                <Switch
                  size="small"
                  checked={!hidden.includes(paymentCardKey(card.id))}
                  onChange={(e) => toggleVisible(card.id, e.target.checked)}
                  slotProps={{ input: { 'aria-label': `${card.name} を表示` } }}
                />
                <IconButton size="small" aria-label="カードを編集" onClick={() => setDlg({ mode: 'edit', initial: card })}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="カードを削除" onClick={() => handleDelete(card)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Button variant="outlined" startIcon={<AddIcon />} fullWidth onClick={() => setDlg({ mode: 'add' })}>
        カードを追加
      </Button>

      {dlg && <CardDialog initial={dlg.initial} onSave={handleSave} onClose={() => setDlg(null)} />}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 15 }}>{confirm?.name} を削除しますか</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ fontSize: 12 }}>
            この支払い元には記録があります。削除すると、その固定費・変動費は
            どの画面にも出なくなります（データ自体は消えません）。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} size="small">キャンセル</Button>
          <Button onClick={() => remove(confirm.id)} color="error" variant="contained" size="small">
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
