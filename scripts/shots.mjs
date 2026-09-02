// Capturas de verificación visual (CLAUDE.md paso 5) a 380px y 320px.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5173'
const outDir = fileURLToPath(new URL('../shots/', import.meta.url))
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 380, height: 800 } })
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
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
]

for (const width of [380, 320]) {
  await page.setViewportSize({ width, height: 800 })
  for (const [name, route] of routes) {
    await page.goto(`${BASE}${route}`)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${outDir}${name}-${width}.png`, fullPage: true })
  }
  // editor: primera rutina
  await page.goto(`${BASE}/rutinas`)
  await page.waitForTimeout(700)
  const row = page.locator('.rut-row').first()
  if ((await row.count()) > 0) {
    await row.click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${outDir}editor-${width}.png`, fullPage: true })
  }
}

console.log('errores de consola:', errors.length === 0 ? 'ninguno' : '')
for (const e of errors.slice(0, 12)) console.log('  -', e)
await browser.close()
