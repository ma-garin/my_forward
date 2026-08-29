import { useState, useRef } from 'react'
import { Box, Typography, Divider, Stack, Chip, Button, Alert, CircularProgress, LinearProgress, Link } from '@mui/material'
import { Capacitor } from '@capacitor/core'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import StorageIcon from '@mui/icons-material/Storage'
import LockIcon from '@mui/icons-material/Lock'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate'
import { checkForUpdate, buildNumber, APK_URL, downloadApk, installApk, canInstall, openInstallSettings } from '../utils/appUpdate'
// 変更履歴は git の履歴から作る（scripts/gen-changelog.mjs）。
// 手書きすると書き忘れて止まる（実際に 1.4 で止まっていた）
import CHANGELOG from '../changelog.json'

// バージョンの出どころは package.json（vite.config.js が注入する）
const APP_VERSION = __APP_VERSION__


const TECH_STACK = [
  { label: 'React 19', color: 'var(--tint-blue)' },
  { label: 'Vite 8',   color: 'var(--tint-green)' },
  { label: 'MUI v6',   color: '#fce4ec' },
  { label: 'WebCrypto API', color: 'var(--tint-orange)' },
  { label: 'PWA',      color: 'var(--tint-purple)' },
]

/**
 * 更新の確認と適用。
 *
 * ストア配布ではないので自動更新が来ない。GitHub の最新リリースと今のビルド番号を
 * 比べ、新しければアプリ内で APK を取得してインストーラに渡すところまで行う。
 * 上書きするかどうかはインストーラの画面でユーザーが決める（データは残る）。
 */
function UpdateSection() {
  const [state, setState] = useState(null)     // { loading } | { error } | 確認結果
  const [phase, setPhase] = useState('idle')   // idle | downloading | needPermission | installing
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  // 取得済みの APK。許可を取り直した後の再実行で 13MB を落とし直さない
  const apkRef = useRef('')

  const result = state && !state.loading && !state.error ? state : null
  const busy = phase === 'downloading' || phase === 'installing'

  const check = async () => {
    setState({ loading: true })
    setError('')
    setPhase('idle')
    // 確認し直したら取得済みの APK は捨てる（その間に更に新しい版が出ていることがある）
    apkRef.current = ''
    try {
      setState(await checkForUpdate())
    } catch (e) {
      setState({ error: e.message })
    }
  }

  const update = async () => {
    setError('')
    try {
      if (!apkRef.current) {
        setPhase('downloading')
        setProgress(0)
        apkRef.current = await downloadApk(setProgress)
      }
      // 許可が無いとインストーラは何も出さずに戻る。先に確かめて設定へ誘導する
      if (!(await canInstall())) {
        setPhase('needPermission')
        return
      }
      setPhase('installing')
      await installApk(apkRef.current)
    } catch (e) {
      setError(e.message ?? '更新できませんでした')
      setPhase('idle')
    }
  }

  // 更新できる（新しい版がある／ビルド番号が判定できない）ときに出すボタン
  const updateButton = (
    <Button size="small" onClick={update} disabled={busy}>
      {phase === 'downloading' ? `${Math.round(progress * 100)}%` : '更新'}
    </Button>
  )

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>更新</Typography>

      <Button
        variant="outlined" size="small" fullWidth
        onClick={check} disabled={!!state?.loading || busy}
        startIcon={state?.loading ? <CircularProgress size={14} /> : <SystemUpdateIcon />}
      >
        {state?.loading ? '確認中…' : '更新を確認'}
      </Button>

      {state?.error && (
        <Alert severity="error" sx={{ mt: 1, fontSize: 12 }}>{state.error}</Alert>
      )}

      {result?.hasUpdate && (
        <Alert severity="info" sx={{ mt: 1, fontSize: 12 }} action={updateButton}>
          ビルド {result.latest} が公開されています（現在 {result.current}）。
        </Alert>
      )}

      {result && !result.hasUpdate && !result.unknown && (
        <Alert severity="success" sx={{ mt: 1, fontSize: 12 }}>最新版です（ビルド {result.current}）。</Alert>
      )}

      {result?.unknown && (
        <Alert severity="warning" sx={{ mt: 1, fontSize: 12 }} action={updateButton}>
          ビルド番号を判定できませんでした（最新: {result.tag || '不明'}）。手元でビルドした版の可能性があります。
        </Alert>
      )}

      {phase === 'downloading' && (
        <LinearProgress variant="determinate" value={progress * 100} sx={{ mt: 1, borderRadius: 1 }} />
      )}

      {phase === 'needPermission' && (
        <Alert severity="warning" sx={{ mt: 1, fontSize: 12 }}
          action={<Button size="small" onClick={openInstallSettings}>設定</Button>}>
          このアプリからのインストールが許可されていません。設定で許可してから、もう一度「更新」を押してください。
        </Alert>
      )}

      {phase === 'installing' && (
        <Alert severity="success" sx={{ mt: 1, fontSize: 12 }}>
          インストーラを開きました。画面の指示に従ってください。
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mt: 1, fontSize: 12 }}>{error}</Alert>}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: 11 }}>
        上書きインストールされ、データはそのまま残ります。
        うまくいかないときは <Link href={APK_URL} target="_blank" rel="noreferrer">APK を直接ダウンロード</Link> できます。
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
      <Box sx={{ bgcolor: 'var(--tint-green)', borderRadius: 2, p: 2, mb: 2 }}>
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
        <Box key={release.label} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="caption" fontWeight={700}
              sx={{ bgcolor: ri === 0 ? 'var(--surface-header)' : 'var(--divider)',
                    color: ri === 0 ? '#fff' : 'text.primary',
                    px: 1, py: 0.25, borderRadius: 1, fontSize: 11 }}>
              {release.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize={10}>
              {release.date} · {release.items.length}件
            </Typography>
          </Stack>
          <Box sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
            {release.items.map((item, i) => (
              <Typography key={i} variant="caption" color="text.secondary"
                sx={{ display: 'block', lineHeight: 1.8, fontSize: 12 }}>
                <Box component="span" sx={{ color: 'text.disabled', mr: 0.5 }}>{item.kind}</Box>
                {item.text}
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
