// Flujo completo: confirmar series con un toque, finalizar, resumen y
// sesión pasada desde el calendario.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5173'
const outDir = fileURLToPath(new URL('../shots/', import.meta.url))
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 380, height: 800 } })
const errors = []
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(`${BASE}/?demo=1`)
await page.waitForTimeout(2500)
await page.reload()
await page.waitForTimeout(1200)

// empezar sesión
await page.click('button:has-text("Empezar sesión")')
await page.waitForTimeout(400)

// confirmar las tres series del ejercicio abierto con un toque cada una
for (let i = 0; i < 3; i++) {
  await page.locator('.xcard.open .set__confirm').nth(i).click()
  await page.waitForTimeout(350)
}
await page.screenshot({ path: `${outDir}entrenando-380.png` })

// al completar el primero, el segundo se abre solo: subir peso y confirmar
await page.locator('.xcard.open .set__plus').first().click()
await page.locator('.xcard.open .set__confirm').first().click()
await page.waitForTimeout(300)

// finalizar
await page.click('button:has-text("Finalizar sesión")')
await page.waitForTimeout(900)
await page.screenshot({ path: `${outDir}resumen-380.png`, fullPage: true })

// valorar y cerrar
await page.locator('.rate').nth(3).click()
await page.click('button:has-text("Cerrar")')
await page.waitForTimeout(600)

// sesión pasada desde el calendario
await page.goto(`${BASE}/calendario`)
await page.waitForTimeout(700)
await page.locator('a.row').first().click()
await page.waitForTimeout(900)
await page.screenshot({ path: `${outDir}sesion-380.png`, fullPage: true })

console.log('errores:', errors.length === 0 ? 'ninguno' : errors.slice(0, 8).join('\n'))
await browser.close()
