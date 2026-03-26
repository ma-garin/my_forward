import { Box, Typography, Button, Stack, Divider } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'

// ─── キー定義 ────────────────────────────────────────────────
const KEY_GROUPS = {
  salary: {
    label: '給与',
    keys: (keys) => keys.filter(k => k.startsWith('salary_')),
  },
  card: {
    label: 'カード',
    keys: (keys) => keys.filter(k => k.startsWith('cc_')),
  },
  account: {
    label: '口座',
    keys: (keys) => keys.filter(k => k.startsWith('bank_')),
  },
  salaryHistory: {
    label: '給与履歴',
    keys: (keys) => keys.filter(k => k.startsWith('salary_base_') || k.startsWith('salary_extra_')),
  },
}

function getAllKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

function exportKeys(keys, filename) {
  const data = {}
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importFile(file, onDone) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result)
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, JSON.stringify(v))
      })
      alert('インポート完了しました。アプリを再読み込みします。')
      window.location.reload()
    } catch {
      alert('ファイルの読み込みに失敗しました')
    }
  }
  reader.readAsText(file)
}

// ─── 汎用行コンポーネント ────────────────────────────────────
function DataRow({ label, exportFilename, exportKeys: getExportKeys }) {
  const allKeys = getAllKeys()
  const keys = getExportKeys(allKeys)

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
      <Typography fontSize={14} fontWeight={500}>{label}</Typography>
      <Stack direction="row" gap={1}>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
          onClick={() => exportKeys(keys, exportFilename)}
          sx={{ fontSize: 12 }}>
          出力
        </Button>
        <Button size="small" variant="outlined" startIcon={<UploadFileIcon />}
          component="label" sx={{ fontSize: 12 }}>
          読込
          <input type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
        </Button>
      </Stack>
    </Stack>
  )
}

// ─── メイン ─────────────────────────────────────────────────
export default function DataSettings() {
  const allKeys = getAllKeys()

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>

      {/* 全データ */}
      <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>全データ一括</Typography>
        <Stack direction="row" gap={1}>
          <Button variant="contained" startIcon={<DownloadIcon />} fullWidth
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            onClick={() => exportKeys(allKeys, 'myforward_backup')}>
            一括エクスポート
          </Button>
          <Button variant="contained" startIcon={<UploadFileIcon />} fullWidth component="label">
            一括インポート
            <input type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
          </Button>
        </Stack>
      </Box>

      {/* 個別 */}
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        個別データ
      </Typography>
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, px: 2 }}>
        <DataRow label="給与シミュレーション" exportFilename="myforward_salary"
          exportKeys={(keys) => keys.filter(k => k === 'salary_simulation')} />
        <Divider />
        <DataRow label="カード" exportFilename="myforward_card"
          exportKeys={(keys) => keys.filter(k => k.startsWith('cc_'))} />
        <Divider />
        <DataRow label="口座" exportFilename="myforward_account"
          exportKeys={(keys) => keys.filter(k => k.startsWith('bank_'))} />
        <Divider />
        <DataRow label="給与履歴" exportFilename="myforward_salary_history"
          exportKeys={(keys) => keys.filter(k => k.startsWith('salary_base_') || k.startsWith('salary_extra_'))} />
      </Box>
    </Box>
  )
}
