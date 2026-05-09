import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function patchFile(filePath, transform) {
  const fullPath = path.join(root, filePath)
  const before = fs.readFileSync(fullPath, 'utf8')
  const after = transform(before)
  if (after !== before) {
    fs.writeFileSync(fullPath, after, 'utf8')
    console.log(`patched: ${filePath}`)
  } else {
    console.log(`unchanged: ${filePath}`)
  }
}

patchFile('src/main.jsx', (src) => {
  if (src.includes('./services/localStorageChangeTracker') || src.includes("./services/localStorageChangeTracker")) return src
  return `import './services/localStorageChangeTracker'\n${src}`
})

patchFile('src/settings/DataSettings.jsx', (src) => {
  let next = src

  if (!next.includes("DriveSyncPanel")) {
    next = next.replace(
      "import UploadFileIcon from '@mui/icons-material/UploadFile'\n",
      "import UploadFileIcon from '@mui/icons-material/UploadFile'\nimport DriveSyncPanel from '../components/DriveSyncPanel'\n",
    )
  }

  if (!next.includes('<DriveSyncPanel />')) {
    next = next.replace(
      '<Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>\n',
      '<Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>データ管理</Typography>\n\n      <DriveSyncPanel />\n',
    )
  }

  return next
})
