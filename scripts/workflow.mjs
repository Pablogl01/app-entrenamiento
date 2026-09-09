// Capturas numeradas de TODO el flujo de uso, en orden de recorrido, en
// shots/workflow/. Pensado para revisar la app de principio a fin de un vistazo.
//
//   SHOTS_URL=http://localhost:5175 node scripts/workflow.mjs
//
// Recorrido: primer arranque → (demo) Hoy → Rutinas → editor → Catálogo →
// detalle ejercicio → Ciclo → Calendario → Entrenar (previa) → Entrenando
// (serie completada, descanso) → Hoy en curso → Finalizar → Resumen (RPE) →
// sesión pasada → resumen de cargas → Progreso → Ajustes → Cuenta → Ayuda →
// Privacidad → Términos → 404.
import { chromium } from 'playwright'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5173'
const THEME = process.env.SHOTS_THEME ?? 'dark'
const WIDTH = Number(process.env.SHOTS_WIDTH ?? 380)
const outDir = fileURLToPath(new URL('../shots/workflow/', import.meta.url))
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const errors = []
let n = 0

function newPage(context) {
  const page = context.newPage()
  return page
}
function track(page) {
  page.on('console', (msg) => {
    // 401/502: refresh de sesión sin cuenta y API apagada; no son errores de la app.
    if (msg.type() === 'error' && !/401|502/.test(msg.text())) errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
}
async function shot(page, name, { full = true, wait = 900 } = {}) {
  await page.waitForTimeout(wait)
  n += 1
  const file = `${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: `${outDir}${file}`, fullPage: full })
  console.log('✓', file)
}
async function go(page, route) {
  const sep = route.includes('?') ? '&' : '?'
  await page.goto(`${BASE}${route}${sep}theme=${THEME}`)
}
async function clickIf(locator, label) {
  if ((await locator.count()) > 0) {
    await locator.first().click()
    return true
  }
  console.log('  (omitido: no se encontró', label + ')')
  return false
}

const viewport = { width: WIDTH, height: 800 }

// ---------- 1. Primer arranque (almacenamiento limpio, sin demo) ----------
{
  const ctx = await browser.newContext({ viewport, colorScheme: THEME })
  const page = await newPage(ctx)
  track(page)
  await go(page, '/')
  await shot(page, 'primer-arranque-hoy')
  await go(page, '/rutinas')
  await shot(page, 'primer-arranque-rutinas')
  await ctx.close()
}

// ---------- 2. Con datos demo: recorrido completo ----------
const ctx = await browser.newContext({ viewport, colorScheme: THEME })
const page = await newPage(ctx)
track(page)

// sembrar demo y dejar que se cree el borrador de hoy
await page.goto(`${BASE}/?demo=1&theme=${THEME}`)
await page.waitForTimeout(2500)
await page.reload()
await page.waitForTimeout(1200)
await shot(page, 'hoy')

// Rutinas y editor
await go(page, '/rutinas')
await shot(page, 'rutinas')
if (await clickIf(page.getByRole('link', { name: /opciones de la rutina|editar bloque|detalles/i }), 'editor de rutina')) {
  await shot(page, 'rutina-editor')
}

// Catálogo y detalle de ejercicio
await go(page, '/catalogo')
await shot(page, 'catalogo')
if (await clickIf(page.getByText('Press banca', { exact: false }), 'detalle de ejercicio')) {
  await shot(page, 'ejercicio-detalle')
}

// Ciclo y calendario
await go(page, '/ciclo')
await shot(page, 'ciclo')
await go(page, '/calendario')
await shot(page, 'calendario')

// Entrenar: previa → iniciar → completar serie (arranca descanso)
await go(page, '/entrenar')
await shot(page, 'entrenar-previa')
if (await clickIf(page.getByRole('button', { name: /iniciar sesión/i }), 'iniciar sesión')) {
  await page.waitForTimeout(900)
  await shot(page, 'entrenando-inicio', { full: false })
  await clickIf(page.getByRole('button', { name: /completar (serie|calentamiento)/i }), 'completar serie')
  await shot(page, 'entrenando-descanso', { full: false })
  await clickIf(page.getByRole('button', { name: /^saltar$/i }), 'saltar descanso')
  await clickIf(page.getByRole('button', { name: /completar (serie|calentamiento)/i }), 'completar 2ª serie')
  await shot(page, 'entrenando-series')

  // Hoy con la sesión en curso
  await go(page, '/')
  await shot(page, 'hoy-en-curso')

  // Finalizar → resumen
  await go(page, '/entrenar')
  await page.waitForTimeout(600)
  if (await clickIf(page.getByRole('button', { name: /finalizar entrenamiento/i }), 'finalizar')) {
    await shot(page, 'resumen-post-sesion')
    // RPE global 8 y guardar
    await clickIf(page.getByRole('button', { name: /^8$/ }), 'RPE 8')
    await shot(page, 'resumen-con-rpe')
    if (await clickIf(page.getByRole('button', { name: /guardar en calendario y cerrar/i }), 'guardar y cerrar')) {
      await shot(page, 'hoy-tras-finalizar')
    }
  }
}

// Sesión pasada y resumen de cargas desde el calendario
await go(page, '/calendario')
await page.waitForTimeout(700)
let ver = page.getByRole('link', { name: /ver resumen de cargas/i })
if ((await ver.count()) === 0) {
  await clickIf(page.getByRole('button', { name: /mes anterior/i }), 'mes anterior')
  await page.waitForTimeout(700)
  ver = page.getByRole('link', { name: /ver resumen de cargas/i })
}
if (await clickIf(ver, 'resumen de cargas')) {
  await shot(page, 'resumen-sesion-pasada')
  await page.goBack()
  await page.waitForTimeout(500)
  if (await clickIf(page.getByRole('link', { name: /ver series/i }), 'ver series')) {
    await shot(page, 'sesion-pasada-series')
  }
}

// Progreso
await go(page, '/progreso')
await shot(page, 'progreso')

// Ajustes, cuenta y páginas de texto
await go(page, '/ajustes')
await shot(page, 'ajustes')
await go(page, '/cuenta')
await shot(page, 'cuenta')
await go(page, '/ayuda')
await shot(page, 'ayuda')
await go(page, '/privacidad')
await shot(page, 'privacidad')
await go(page, '/terminos')
await shot(page, 'terminos')
await go(page, '/ruta-inexistente')
await shot(page, 'no-encontrado')

console.log(`\n${n} capturas en ${outDir}`)
console.log('errores de consola:', errors.length === 0 ? 'ninguno' : '')
for (const e of errors.slice(0, 12)) console.log('  -', e)
await browser.close()
