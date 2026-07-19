// iOS（設定アプリ）風デザインのトークン。apple モードでのみ使用する。
// classic モードには一切影響しない。

export const ios = {
  // 背景
  groupedBg: '#F2F2F7',            // systemGroupedBackground
  cardBg: '#FFFFFF',               // secondarySystemGroupedBackground
  // セパレータ（極細ハイライン）
  separator: 'rgba(60,60,67,0.29)',
  // ラベル
  label: '#1C1C1E',
  secondary: 'rgba(60,60,67,0.6)',
  tertiary: 'rgba(60,60,67,0.3)',
  // アクセント・意味色（iOS システムカラー）
  accent: '#007AFF',
  green: '#34C759',
  orange: '#FF9F0A',
  red: '#FF3B30',
  yellow: '#FFCC00',
  // 形状
  radius: 10,
  rowMinHeight: 44,
  insetX: 16,   // グループの左右インセット
}

// 消費分類（消費/投資/浪費）→ iOS システム色
export const SPEND_TYPE_IOS = {
  消費: '#007AFF',   // blue
  投資: '#34C759',   // green
  浪費: '#FF3B30',   // red
}

// カード（JCB / VISA(smbc)）→ iOS システム色
export const CARD_IOS = {
  jcb: '#3A3A3C',    // graphite
  smbc: '#34C759',   // green
}

// 生活費カテゴリ → iOS システム色（元 CAT_COLORS の置き換え）
export const CAT_IOS = {
  食費: '#34C759',
  日用品: '#5AC8FA',
  生活費: '#007AFF',
}

// 予算/利用率の状態色（元 #a5d6a7 / #ffe082 / #ef9a9a の置き換え）
export function statusColor(pct) {
  if (pct >= 90) return ios.red
  if (pct >= 70) return ios.orange
  return ios.green
}
