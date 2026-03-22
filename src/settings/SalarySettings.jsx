import { useState } from 'react'
import {
  Box, Typography, TextField, Divider, Stack, Button, InputAdornment,
} from '@mui/material'
import { DEFAULT_FIXED } from '../utils/finance'

const STORAGE_KEY = 'salary_simulation'

function load() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) {
      const p = JSON.parse(s)
      return { ...DEFAULT_FIXED, ...p.fixed }
    }
  } catch (_) {}
  return { ...DEFAULT_FIXED }
}

function save(fixed) {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    const current = s ? JSON.parse(s) : {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, fixed }))
  } catch (_) {}
}

const FIELDS = [
  { section: '支給項目' },
  { key: 'shokunokyuu',   label: '基本給（職能給）' },
  { key: 'jyuutakuteate', label: '住宅手当' },
  { key: 'tsuukinteate',  label: '通勤手当' },
  { key: 'shinyateate',   label: '深夜手当' },
  { key: 'tokumei',       label: '特命手当' },
  { section: '控除項目' },
  { key: 'kenkouhoken',   label: '健康保険' },
  { key: 'kouseinenkin',  label: '厚生年金' },
  { key: 'jyuuminzei',    label: '住民税' },
  { key: 'kumiaifi',      label: '組合費' },
  { key: 'shokuhi',       label: '食費控除' },
]

const OT_KEY = 'salary_simulation'

function loadOT() {
  try {
    const s = localStorage.getItem(OT_KEY)
    return s ? (JSON.parse(s).unitPrice ?? 0) : 0
  } catch { return 0 }
}

function saveOT(v) {
  try {
    const s = localStorage.getItem(OT_KEY)
    const current = s ? JSON.parse(s) : {}
    localStorage.setItem(OT_KEY, JSON.stringify({ ...current, unitPrice: v }))
  } catch (_) {}
}

export default function SalarySettings() {
  const [fixed, setFixed] = useState(load)
  const [saved, setSaved] = useState(false)

  const handleChange = (key, val) => {
    const n = parseInt(val.replace(/,/g, ''), 10)
    setFixed(prev => ({ ...prev, [key]: isNaN(n) ? 0 : n }))
    setSaved(false)
  }

  const handleSave = () => {
    save(fixed)
    setSaved(true)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>給与設定</Typography>

      {FIELDS.map((f, i) =>
        f.section ? (
          <Box key={i}>
            {i > 0 && <Divider sx={{ my: 2 }} />}
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
              {f.section}
            </Typography>
          </Box>
        ) : (
          <TextField
            key={f.key}
            label={f.label}
            value={fixed[f.key] === 0 ? '' : fixed[f.key].toLocaleString('ja-JP')}
            onChange={(e) => handleChange(f.key, e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 1.5 }}
            InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
          />
        )
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
        残業
      </Typography>
      <TextField
        label="残業単価（時給）"
        size="small"
        fullWidth
        sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
        defaultValue={loadOT() || ''}
        onChange={(e) => { saveOT(parseFloat(e.target.value) || 0); setSaved(false) }}
      />

      <Button variant="contained" fullWidth onClick={handleSave}>
        {saved ? '保存しました ✓' : '保存する'}
      </Button>
    </Box>
  )
}
