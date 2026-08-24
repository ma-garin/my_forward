import { useState } from 'react'
import { Box, Typography, Divider, Stack, Chip, Button, Alert, CircularProgress } from '@mui/material'
import { Capacitor } from '@capacitor/core'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import StorageIcon from '@mui/icons-material/Storage'
import LockIcon from '@mui/icons-material/Lock'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate'
import { checkForUpdate, buildNumber, APK_URL } from '../utils/appUpdate'

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

/**
 * 更新の確認。
 * ストア配布ではないので自動更新が来ない。GitHub の最新リリースと今のビルド番号を
 * 比べて、新しければ APK を開く（外部リンクなのでシステムブラウザが受け取る）。
 */
function UpdateSection() {
  const [state, setState] = useState(null) // { loading } | { error } | 結果
  const result = state && !state.loading && !state.error ? state : null

  const run = async () => {
    setState({ loading: true })
    try {
      setState(await checkForUpdate())
    } catch (e) {
      setState({ error: e.message })
    }
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>更新</Typography>

      <Button
        variant="outlined" size="small" fullWidth
        onClick={run} disabled={!!state?.loading}
        startIcon={state?.loading ? <CircularProgress size={14} /> : <SystemUpdateIcon />}
      >
        {state?.loading ? '確認中…' : '更新を確認'}
      </Button>

      {state?.error && (
        <Alert severity="error" sx={{ mt: 1, fontSize: 12 }}>{state.error}</Alert>
      )}

      {result?.hasUpdate && (
        <Alert severity="info" sx={{ mt: 1, fontSize: 12 }}
          action={
            <Button size="small" component="a" href={APK_URL} target="_blank" rel="noreferrer">
              取得
            </Button>
          }>
          ビルド {result.latest} が公開されています（現在 {result.current}）。
        </Alert>
      )}

      {result && !result.hasUpdate && !result.unknown && (
        <Alert severity="success" sx={{ mt: 1, fontSize: 12 }}>最新版です（ビルド {result.current}）。</Alert>
      )}

      {result?.unknown && (
        <Alert severity="warning" sx={{ mt: 1, fontSize: 12 }}
          action={
            <Button size="small" component="a" href={APK_URL} target="_blank" rel="noreferrer">
              取得
            </Button>
          }>
          ビルド番号を判定できませんでした（最新: {result.tag || '不明'}）。手元でビルドした版の可能性があります。
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: 11 }}>
        取得すると APK がダウンロードされます。ファイルを開くと上書きインストールされ、データはそのまま残ります。
      </Typography>

      <Divider sx={{ mt: 2 }} />
    </Box>
  )
}

export default function AppInfo() {
  return (
    <Box sx={{ p: 2, pb: 6 }}>

      {/* ヘッダー */}
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <SmartphoneIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" fontWeight={700}>my_forward</Typography>
        <Typography variant="caption" color="text.secondary">
          バージョン {APP_VERSION}{buildNumber() != null && `（ビルド ${buildNumber()}）`}
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* 更新（アプリ版のみ。Web版はリロードで最新になる） */}
      {Capacitor.isNativePlatform() && <UpdateSection />}

      {/* アプリ概要 */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>アプリ概要</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
        クレジットカードの固定費・変動費と給与をまとめて管理する個人向け家計アプリです。
        すべてのデータは端末内にのみ保存されます。家計のデータを外部へ送ることはありません。
      </Typography>

      {/* データの取り扱い */}
      <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 2, p: 2, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>データの取り扱い</Typography>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <WifiOffIcon sx={{ fontSize: 18, color: '#2e7d32', mt: 0.25 }} />
            <Box>
              <Typography variant="body2" fontWeight={600} fontSize={13}>オフラインで動作</Typography>
              <Typography variant="caption" color="text.secondary">インターネット接続なしで完全動作します。通信するのは更新を確認したときだけで、送信する情報はありません。</Typography>
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
