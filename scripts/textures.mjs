// Descarga las 4 texturas de material desde Wikimedia Commons (CC0/dominio
// público, ver src/assets/textures/SOURCES.md) y les aplica el tratamiento
// idéntico que exige DESIGN.md §2: mismo recorte, misma escala, mismo ajuste.
// La capa de oscurecido rgba(20,16,12,.42) va en CSS, no horneada aquí.
// Presupuesto: ~80 KB por textura en WebP.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const SOURCES = [
  { key: 'stone', title: 'Tan rough slightly worn marked seamless concrete building wall texture.jpg' },
  { key: 'iron', title: 'Taupe heavily rusted stained discolored grungy old leaking seamless metal steel texture.jpg' },
  { key: 'sand', title: 'Smooth clean beach shore sand seamless ground texture.jpg' },
  { key: 'neutral', title: 'Sawn limestone texture.jpg' },
]

const OUT = new URL('../src/assets/textures/', import.meta.url)
await mkdir(OUT, { recursive: true })

for (const { key, title } of SOURCES) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=1600`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`)
  const input = Buffer.from(await res.arrayBuffer())
  // Tratamiento uniforme: 1200×900 cover, oscurecido y desaturado leve para
  // que las cuatro sean "oscuras y sucias" e intercambiables.
  const base = sharp(input)
    .resize(1200, 900, { fit: 'cover', position: 'centre' })
    .blur(0.7) // mata el grano de alta frecuencia; invisible bajo el scrim
    .modulate({ brightness: 0.78, saturation: 0.8 })
  let quality = 64
  let out = await base.clone().webp({ quality }).toBuffer()
  while (out.length > 80 * 1024 && quality > 24) {
    quality -= 8
    out = await base.clone().webp({ quality }).toBuffer()
  }
  await writeFile(new URL(`${key}.webp`, OUT), out)
  console.log(`${key}.webp — ${Math.round(out.length / 1024)} KB (q${quality})`)
}
