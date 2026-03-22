import { Box, Typography, Button, Divider, Stack } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'

const ALL_KEYS = [
  'salary_simulation',
  'salary_base_data',
  'salary_base_withholding',
  'salary_extra_data',
  'salary_extra_withholding',
  'cc_jcb',
  'cc_smbc',
  'cc_categories',
  'bank_accounts_v2',
  'bank_fixed_events',
  'bank_fixed_events_v1',
  'bank_events',
]

function exportAll() {
  const data = {}
  ALL_KEYS.forEach(k => {
    const v = localStorage.getItem(k)
    if (v) data[k] = JSON.parse(v)
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `myforward_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importAll(file, onDone) {
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

export default function Settings() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>設定</Typography>

      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
        データ管理
      </Typography>

      <Stack gap={1.5}>
        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>エクスポート</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            全データをJSONファイルとして保存します。機種変更・バックアップに使用してください。
          </Typography>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={exportAll}
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            fullWidth
          >
            データをエクスポート
          </Button>
        </Box>

        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>インポート</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            エクスポートしたJSONファイルを読み込みます。現在のデータは上書きされます。
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            component="label"
            fullWidth
          >
            データをインポート
            <input
              type="file"
              accept=".json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importAll(file)
                e.target.value = ''
              }}
            />
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}
