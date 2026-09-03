// Capturas de verificación visual (CLAUDE.md paso 5) a 380px y 320px,
// en modo oscuro y claro, incluida la sesión en vivo y el ciclo.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5173'
const outDir = fileURLToPath(new URL('../shots/', import.meta.url))
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 380, height: 800 }, colorScheme: 'dark' })
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('502')) errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

// sembrar demo y dejar que se cree el borrador de hoy
await page.goto(`${BASE}/?demo=1`)
await page.waitForTimeout(2500)
await page.reload()
await page.waitForTimeout(1200)

const routes = [
  ['hoy', '/'],
  ['calendario', '/calendario'],
  ['progreso', '/progreso'],
  ['rutinas', '/rutinas'],
  ['catalogo', '/catalogo'],
  ['ajustes', '/ajustes'],
  ['ciclo', '/ciclo'],
  ['entrenar-previa', '/entrenar'],
]

async function shot(name, width, theme) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}${name}-${width}${theme === 'light' ? '-light' : ''}.png`, fullPage: true })
}

for (const theme of ['dark', 'light']) {
  for (const width of [380, 320]) {
    if (theme === 'light' && width === 320) continue
    await page.setViewportSize({ width, height: 800 })
    for (const [name, route] of routes) {
      await page.goto(`${BASE}${route}?theme=${theme}`)
      await shot(name, width, theme)
    }
    // editor: primera rutina (botón ⋮ u «Opciones»)
    await page.goto(`${BASE}/rutinas?theme=${theme}`)
    await page.waitForTimeout(700)
    const edit = page.getByRole('link', { name: /opciones de la rutina|editar bloque|detalles/i }).first()
    if ((await edit.count()) > 0) {
      await edit.click()
      await shot('editor', width, theme)
    }
    // sesión pasada y resumen: desde el calendario del mes anterior si hace falta
    await page.goto(`${BASE}/calendario?theme=${theme}`)
    await page.waitForTimeout(700)
    let ver = page.getByRole('link', { name: /ver resumen de cargas/i }).first()
    if ((await ver.count()) === 0) {
      await page.getByRole('button', { name: /mes anterior/i }).click()
      await page.waitForTimeout(700)
      ver = page.getByRole('link', { name: /ver resumen de cargas/i }).first()
    }
    if ((await ver.count()) > 0) {
      await ver.click()
      await shot('resumen-pasado', width, theme)
      await page.goBack()
      await page.waitForTimeout(500)
      const series = page.getByRole('link', { name: /ver series/i }).first()
      if ((await series.count()) > 0) {
        await series.click()
        await shot('sesion', width, theme)
      }
    }
  }
}

// Sesión en vivo a 380 oscuro: iniciar desde Hoy, completar una serie (arranca
// el descanso), capturar a 380 y 320; después finalizar y capturar el resumen.
await page.setViewportSize({ width: 380, height: 800 })
await page.goto(`${BASE}/?theme=dark`)
await page.waitForTimeout(900)
const start = page.getByRole('button', { name: /iniciar sesión/i }).first()
if ((await start.count()) > 0) {
  await start.click()
  await page.waitForTimeout(900)
  const complete = page.getByRole('button', { name: /completar serie/i }).first()
  if ((await complete.count()) > 0) await complete.click()
  await shot('entrenando', 380, 'dark')
  await page.setViewportSize({ width: 320, height: 800 })
  await shot('entrenando', 320, 'dark')
  await page.setViewportSize({ width: 380, height: 800 })
  // Hoy con la sesión en curso
  await page.goto(`${BASE}/?theme=dark`)
  await shot('hoy-en-curso', 380, 'dark')
  await page.goto(`${BASE}/entrenar?theme=dark`)
  await page.waitForTimeout(600)
  const finish = page.getByRole('button', { name: /finalizar entrenamiento/i })
  if ((await finish.count()) > 0) {
    await finish.click()
    await shot('resumen', 380, 'dark')
  }
}

console.log('errores de consola:', errors.length === 0 ? 'ninguno' : '')
for (const e of errors.slice(0, 12)) console.log('  -', e)
await browser.close()
