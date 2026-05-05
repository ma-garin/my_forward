import { Box, Typography, Divider, Stack, Chip } from '@mui/material'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import StorageIcon from '@mui/icons-material/Storage'
import LockIcon from '@mui/icons-material/Lock'
import WifiOffIcon from '@mui/icons-material/WifiOff'

const APP_VERSION = '1.4.0'

const CHANGELOG = [
  {
    version: '1.4',
    date: '2026-05',
    items: [
      'デバイス間転送用の暗号化バックアップ（AES-256-GCM）',
      'Androidエクスポートに共有シート（Google Drive等）対応',
      '週予算のエクスポート漏れを修正',
    ],
  },
  {
    version: '1.3',
    date: '2026-05',
    items: [
      '家計タブにSMBC（三井住友VISAゴールド）対応',
      '家計タブに収支サマリー（手取り/支出/差額/貯蓄率）追加',
      '生活費週集計をカード締め日基準の請求月で正確に集計',
      'デフォルト表示月をJCB締め日（15日）基準に変更',
      '支出追加ダイアログの日付デフォルトを当日に変更',
      'カテゴリ別集計に前月比較の差分表示を追加',
    ],
  },
  {
    version: '1.2',
    date: '2026-04',
    items: [
      '家計タブのカテゴリ別集計にタップで内訳・編集機能を追加',
      '家計タブの固定費集計を当該月のみに修正',
      '給与タブの支給・控除項目にCRUD追加',
      '固定費に繰り返しパターン（毎月/N ヶ月ごと/特定月）を追加',
    ],
  },
  {
    version: '1.1',
    date: '2026-03',
    items: [
      '消費・投資・浪費の支出分類を追加',
      '日別支出バーグラフをリデザイン',
      '家計タブを新設（カードタブから家計機能を分離）',
      '生活費カード（今週・今月の週予算管理）を追加',
    ],
  },
  {
    version: '1.0',
    date: '2026-01',
    items: [
      '初回リリース',
      'クレカ固定費・変動費の管理（JCB）',
      '給与シミュレーション（手取り自動計算）',
      '2枚合計サマリーカード',
      'データのエクスポート・インポート',
      'PWA対応（ホーム画面追加・オフライン動作）',
    ],
  },
]

const TECH_STACK = [
  { label: 'React 19', color: '#e3f2fd' },
  { label: 'Vite 8',   color: '#e8f5e9' },
  { label: 'MUI v6',   color: '#fce4ec' },
  { label: 'WebCrypto API', color: '#fff3e0' },
  { label: 'PWA',      color: '#f3e5f5' },
]

export default function AppInfo() {
  return (
    <Box sx={{ p: 2, pb: 6 }}>

      {/* ヘッダー */}
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <SmartphoneIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" fontWeight={700}>my_forward</Typography>
        <Typography variant="caption" color="text.secondary">バージョン {APP_VERSION}</Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* アプリ概要 */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>アプリ概要</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
        クレジットカードの固定費・変動費と給与をまとめて管理する個人向け家計アプリです。
        すべてのデータは端末内にのみ保存され、外部サーバーへの通信は一切行いません。
      </Typography>

      {/* データの取り扱い */}
      <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 2, p: 2, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>データの取り扱い</Typography>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <WifiOffIcon sx={{ fontSize: 18, color: '#2e7d32', mt: 0.25 }} />
            <Box>
              <Typography variant="body2" fontWeight={600} fontSize={13}>外部通信なし</Typography>
              <Typography variant="caption" color="text.secondary">インターネット接続なしで完全動作します。</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <StorageIcon sx={{ fontSize: 18, color: '#2e7d32', mt: 0.25 }} />
            <Box>
              <Typography variant="body2" fontWeight={600} fontSize={13}>端末内 localStorage のみ使用</Typography>
              <Typography variant="caption" color="text.secondary">データはブラウザの localStorage に保存されます。ブラウザのデータ消去で失われるためバックアップを推奨します。</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <LockIcon sx={{ fontSize: 18, color: '#2e7d32', mt: 0.25 }} />
            <Box>
              <Typography variant="body2" fontWeight={600} fontSize={13}>暗号化バックアップ対応</Typography>
              <Typography variant="caption" color="text.secondary">設定 → データ管理から AES-256-GCM 暗号化ファイルとしてエクスポートできます。iCloud Drive / Google Drive 経由でデバイス間転送が可能です。</Typography>
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* 技術情報 */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>使用技術</Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 2 }}>
        {TECH_STACK.map(t => (
          <Chip key={t.label} label={t.label} size="small"
            sx={{ bgcolor: t.color, fontSize: 11, height: 24 }} />
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* 変更履歴 */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>変更履歴</Typography>
      {CHANGELOG.map((release, ri) => (
        <Box key={release.version} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="caption" fontWeight={700}
              sx={{ bgcolor: ri === 0 ? 'primary.main' : '#e0e0e0',
                    color: ri === 0 ? '#fff' : 'text.primary',
                    px: 1, py: 0.25, borderRadius: 1, fontSize: 11 }}>
              v{release.version}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize={10}>{release.date}</Typography>
          </Stack>
          <Box sx={{ pl: 1.5, borderLeft: '2px solid #e0e0e0' }}>
            {release.items.map((item, i) => (
              <Typography key={i} variant="caption" color="text.secondary"
                sx={{ display: 'block', lineHeight: 1.8, fontSize: 12 }}>
                · {item}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}

      <Divider sx={{ mb: 2 }} />

      {/* ライセンス・著作権 */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>ライセンス</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        MIT License
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Copyright © 2026 Y.F
      </Typography>
    </Box>
  )
}
