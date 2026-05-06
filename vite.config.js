import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'
import { existsSync, watch } from 'fs'
import path from 'path'

const SALARY_DIR = path.resolve(__dirname, '../salary')
const PARSE_SCRIPT = path.resolve(__dirname, 'scripts/parse_salary.py')

// 給与フォルダ監視プラグイン
function salaryWatchPlugin() {
  return {
    name: 'salary-watch',
    configureServer(server) {
      if (!existsSync(SALARY_DIR)) {
        console.log(`[salary-watch] ${SALARY_DIR} がないため監視をスキップします`)
        return
      }

      let debounce = null

      const runImport = () => {
        try {
          console.log('\n[salary-watch] PDFを検出しました。インポートを実行中...')
          execSync(`python3 "${PARSE_SCRIPT}"`, { stdio: 'inherit' })
          // HMR でブラウザを更新
          server.ws.send({ type: 'full-reload' })
          console.log('[salary-watch] インポート完了。ブラウザを更新しました。\n')
        } catch (e) {
          console.error('[salary-watch] エラー:', e.message)
        }
      }

      watch(SALARY_DIR, { recursive: true }, (event, filename) => {
        if (!filename?.endsWith('.pdf')) return
        clearTimeout(debounce)
        debounce = setTimeout(runImport, 1000)
      })

      console.log(`[salary-watch] ${SALARY_DIR} を監視中...`)
    },
  }
}

export default defineConfig({
  base: '/my_forward/',
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'resolve-prop-types-secret',
          resolveId(source, importer) {
            if (
              source === './lib/ReactPropTypesSecret' &&
              importer &&
              importer.includes('prop-types')
            ) {
              return '\0virtual:ReactPropTypesSecret'
            }
            return null
          },
          load(id) {
            if (id === '\0virtual:ReactPropTypesSecret') {
              return `
var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';
module.exports = ReactPropTypesSecret;
`
            }
            return null
          },
        },
      ],
    },
  },
  plugins: [
    react(),
    salaryWatchPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '資産管理',
        short_name: '資産管理',
        description: '個人資産管理アプリ',
        theme_color: '#263238',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/my_forward/',
        lang: 'ja',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico}'],
      },
    }),
  ],
})
