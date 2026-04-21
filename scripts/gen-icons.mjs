import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const svg = readFileSync(join(root, 'public/icon.svg'))

await sharp(svg).resize(192, 192).png().toFile(join(root, 'public/icon-192.png'))
console.log('icon-192.png done')

await sharp(svg).resize(512, 512).png().toFile(join(root, 'public/icon-512.png'))
console.log('icon-512.png done')
