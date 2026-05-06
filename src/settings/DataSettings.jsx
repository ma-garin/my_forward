import { useState } from 'react'
import { Box, Typography, Button, Stack, Divider, Alert } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import ShareIcon from '@mui/icons-material/Share'
import UploadFileIcon from '@mui/icons-material/UploadFile'

function isActiveKey(k) {
  return k === 'salary_simulation'
      || k === 'salary_simulation_monthly'
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

function createJsonExport(keys, filename) {
  const data = {}
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
  })
  const fileName = `${filename}_${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const file = typeof File === 'function'
    ? new File([blob], fileName, { type: 'application/json' })
    : null

  return { blob, file, fileName }
}

function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function downloadJson(keys, filename) {
  const { blob, fileName } = createJsonExport(keys, filename)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
  return true
}

async function shareJson(keys, filename) {
  const { file } = createJsonExport(keys, filename)
  const canShareFile = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && file
    && navigator.canShare({ files: [file] })

  if (!canShareFile) {
    alert('この端末またはブラウザではファイル共有に対応していません。ダウンロードを使用してください。')
    return false
  }

  try {
    await navigator.share({
      files: [file],
      title: 'MyForwardバックアップ',
      text: 'MyForwardのバックアップデータです。',
    })
    return true
  } catch (err) {
    if (err?.name !== 'AbortError') {
      alert('共有に失敗しました。ダウンロードを使用してください。')
    }
    return false
  }
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
  const [message, setMessage] = useState('')
  const keys = filterKeys(getAllKeys())
  const android = isAndroid()

  const handleExport = async () => {
    setMessage('')
    if (android && await shareJson(keys, exportFilename)) {
      setMessage('共有しました')
      return
    }
    if (downloadJson(keys, exportFilename)) setMessage('ダウンロードしました')
  }

  const handleShare = async () => {
    setMessage('')
    if (await shareJson(keys, exportFilename)) setMessage('共有しました')
  }

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography fontSize={14} fontWeight={500} sx={{ flex: '1 1 120px' }}>{label}</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
            onClick={handleExport}
            sx={{ fontSize: 12 }}>
            {android ? '保存' : '出力'}
          </Button>
          <Button size="small" variant="outlined" startIcon={<ShareIcon />}
            onClick={handleShare}
            sx={{ fontSize: 12 }}>
            共有
          </Button>
          <Button size="small" variant="outlined" startIcon={<UploadFileIcon />}
            component="label" sx={{ fontSize: 12 }}>
            読込
            <input type="file" accept="*/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Stack>
      {message && <Alert severity="success" sx={{ py: 0.25, mt: 0.5, fontSize: 12 }}>{message}</Alert>}
    </Box>
  )
}

export default function DataSettings() {
  const activeKeys = getAllKeys().filter(isActiveKey)
  const [bulkMessage, setBulkMessage] = useState('')
  const android = isAndroid()

  const handleBulkExport = async () => {
    setBulkMessage('')
    if (android && await shareJson(activeKeys, 'myforward_backup')) {
      setBulkMessage('共有しました')
      return
    }
    if (downloadJson(activeKeys, 'myforward_backup')) setBulkMessage('ダウンロードしました')
  }

  const handleBulkShare = async () => {
    setBulkMessage('')
    if (await shareJson(activeKeys, 'myforward_backup')) setBulkMessage('共有しました')
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>

      <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>全データ一括</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {android
            ? 'Androidでは保存先を選べる共有シートを優先して開きます。'
            : 'ダウンロードまたは共有で JSON ファイルとして保存できます。'}
        </Typography>
        {bulkMessage && <Alert severity="success" sx={{ mb: 1, py: 0.5, fontSize: 12 }}>{bulkMessage}</Alert>}
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<DownloadIcon />}
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' }, flex: '1 1 150px' }}
            onClick={handleBulkExport}>
            {android ? '保存先を選択' : '一括エクスポート'}
          </Button>
          <Button variant="outlined" startIcon={<ShareIcon />}
            sx={{ flex: '1 1 120px' }}
            onClick={handleBulkShare}>
            共有
          </Button>
          <Button variant="contained" startIcon={<UploadFileIcon />} component="label"
            sx={{ flex: '1 1 150px' }}>
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
          filterKeys={(keys) => keys.filter(k => k === 'salary_simulation' || k === 'salary_simulation_monthly')} />
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
