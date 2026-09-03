// Genera los iconos de la PWA con sharp a partir de un SVG simple:
// barra con discos en trazo --volt sobre --bg (DESIGN.md v2).
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#121315"/>
  <g stroke="#C8F322" stroke-width="28" stroke-linecap="round">
    <line x1="104" y1="256" x2="408" y2="256"/>
    <line x1="152" y1="176" x2="152" y2="336"/>
    <line x1="200" y1="204" x2="200" y2="308"/>
    <line x1="360" y1="176" x2="360" y2="336"/>
    <line x1="312" y1="204" x2="312" y2="308"/>
  </g>
</svg>`)

const outDir = fileURLToPath(new URL('../public/', import.meta.url))
await mkdir(outDir, { recursive: true })

// iOS y Android aplican su propia máscara: los cuadrados van sin radio propio.
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(svg).resize(size).png().toFile(outDir + name)
}
console.log('iconos generados en public/')
