import { useState } from 'react'
import { Box, Typography, Button, Stack, Divider, Alert } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'

function isActiveKey(k) {
  return k === 'salary_simulation'
      || k === 'life_weekly_budget'
      || k.startsWith('salary_base_')
      || k.startsWith('salary_extra_')
      || k.startsWith('cc_')
}

function getAllKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

function downloadJson(keys, filename) {
  const data = {}
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
  return true
}

function importFile(file) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result)
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
      alert('インポート完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch {
      alert('ファイルの読み込みに失敗しました')
    }
  }
  reader.readAsText(file)
}

function DataRow({ label, exportFilename, filterKeys }) {
  const [saved, setSaved] = useState(false)
  const keys = filterKeys(getAllKeys())

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontSize={14} fontWeight={500}>{label}</Typography>
        <Stack direction="row" gap={1}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
            onClick={() => { setSaved(false); if (downloadJson(keys, exportFilename)) setSaved(true) }}
            sx={{ fontSize: 12 }}>
            出力
          </Button>
          <Button size="small" variant="outlined" startIcon={<UploadFileIcon />}
            component="label" sx={{ fontSize: 12 }}>
            読込
            <input type="file" accept="*/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Stack>
      {saved && <Alert severity="success" sx={{ py: 0.25, mt: 0.5, fontSize: 12 }}>ダウンロードしました</Alert>}
    </Box>
  )
}

export default function DataSettings() {
  const activeKeys = getAllKeys().filter(isActiveKey)
  const [bulkSaved, setBulkSaved] = useState(false)

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>

      <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>全データ一括</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          ダウンロードフォルダに JSON ファイルとして保存されます。
        </Typography>
        {bulkSaved && <Alert severity="success" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>ダウンロードしました</Alert>}
        <Stack direction="row" gap={1}>
          <Button variant="contained" startIcon={<DownloadIcon />} fullWidth
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            onClick={() => { setBulkSaved(false); if (downloadJson(activeKeys, 'myforward_backup')) setBulkSaved(true) }}>
            一括エクスポート
          </Button>
          <Button variant="contained" startIcon={<UploadFileIcon />} fullWidth component="label">
            一括インポート
            <input type="file" accept="*/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        個別データ
      </Typography>
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, px: 2 }}>
        <DataRow label="給与シミュレーション" exportFilename="myforward_salary"
          filterKeys={(keys) => keys.filter(k => k === 'salary_simulation')} />
        <Divider />
        <DataRow label="カード" exportFilename="myforward_card"
          filterKeys={(keys) => keys.filter(k => k.startsWith('cc_'))} />
        <Divider />
        <DataRow label="給与履歴" exportFilename="myforward_salary_history"
          filterKeys={(keys) => keys.filter(k => k.startsWith('salary_base_') || k.startsWith('salary_extra_'))} />
      </Box>
    </Box>
  )
}
