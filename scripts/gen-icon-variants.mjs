/**
 * アプリアイコンの色違いを作る。
 *
 * 元のアイコンは「角丸の地 + カード + 財布」で、地の色が #263238。
 * その地の色だけを差し替えて色違いを作る（ロゴは共通なので、並んでいても
 * 同じアプリだと分かる）。
 *
 * 出力先は Android の mipmap。variants の定義に 1 行足せば増える。
 *   node scripts/gen-icon-variants.mjs
 *
 * 元画像を差し替えたら、このスクリプトを流し直す。
 * 「どの色があるか」の唯一の出どころは VARIANTS で、画面の一覧
 * （src/utils/appIcon.js）と AndroidManifest の alias もこの並びに合わせる。
 */
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'

const RES = 'android/app/src/main/res'

// 元の地の色。ここから離れた色（カード・財布）は触らない
const BASE = [0x26, 0x32, 0x38]

// 色の差し替え範囲。境界のぼかしを残すため、距離に応じて混ぜる
const TOLERANCE = 70

// 変える色。default は元のままなので生成しない
export const VARIANTS = [
  { id: 'midnight', color: [0x0f, 0x14, 0x17] },
  { id: 'indigo',   color: [0x1a, 0x23, 0x7e] },
  { id: 'wine',     color: [0x5d, 0x2b, 0x31] },
]

// 密度ごとの実寸（既存ファイルに合わせる）
const DENSITIES = [
  { dir: 'ldpi',    legacy: 36,  fg: 81  },
  { dir: 'mdpi',    legacy: 48,  fg: 108 },
  { dir: 'hdpi',    legacy: 72,  fg: 162 },
  { dir: 'xhdpi',   legacy: 96,  fg: 216 },
  { dir: 'xxhdpi',  legacy: 144, fg: 324 },
  { dir: 'xxxhdpi', legacy: 192, fg: 432 },
]

/** 地の色に近い画素を target に寄せる。近いほど強く寄せて、境界を残す */
async function recolor(srcPath, target) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 0) continue
    const d = Math.hypot(data[i] - BASE[0], data[i + 1] - BASE[1], data[i + 2] - BASE[2])
    if (d > TOLERANCE) continue
    const w = 1 - d / TOLERANCE
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.round(data[i + c] * (1 - w) + target[c] * w)
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
}

const adaptiveXml = (id) => `<?xml version="1.0" encoding="utf-8"?>
<!-- 自動生成: scripts/gen-icon-variants.mjs -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background>
        <inset android:drawable="@mipmap/ic_launcher_background" android:inset="16.7%" />
    </background>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_${id}_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
`

async function main() {
  // 一番大きいものを元にして、各密度へ縮小する
  const masterFg = `${RES}/mipmap-xxxhdpi/ic_launcher_foreground.png`
  const masterLegacy = `${RES}/mipmap-xxxhdpi/ic_launcher.png`
  const masterRound = `${RES}/mipmap-xxxhdpi/ic_launcher_round.png`
  for (const p of [masterFg, masterLegacy, masterRound]) {
    if (!existsSync(p)) throw new Error(`元画像が見つかりません: ${p}`)
  }

  const anydpi = `${RES}/mipmap-anydpi-v26`
  mkdirSync(anydpi, { recursive: true })

  for (const v of VARIANTS) {
    const fg = await recolor(masterFg, v.color)
    const legacy = await recolor(masterLegacy, v.color)
    const round = await recolor(masterRound, v.color)

    for (const d of DENSITIES) {
      const dir = `${RES}/mipmap-${d.dir}`
      mkdirSync(dir, { recursive: true })
      await fg.clone().resize(d.fg, d.fg)
        .toFile(path.join(dir, `ic_launcher_${v.id}_foreground.png`))
      await legacy.clone().resize(d.legacy, d.legacy)
        .toFile(path.join(dir, `ic_launcher_${v.id}.png`))
      await round.clone().resize(d.legacy, d.legacy)
        .toFile(path.join(dir, `ic_launcher_${v.id}_round.png`))
    }

    // API 26 以降はこの XML が使われ、上の legacy PNG は 24〜25 用に残る
    const { writeFileSync } = await import('fs')
    writeFileSync(path.join(anydpi, `ic_launcher_${v.id}.xml`), adaptiveXml(v.id))
    writeFileSync(path.join(anydpi, `ic_launcher_${v.id}_round.xml`), adaptiveXml(v.id))

    console.log(`${v.id}: ${DENSITIES.length} 密度 × 3 枚 + adaptive 2 枚`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
