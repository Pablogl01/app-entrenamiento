// Fotos de ejercicio desde free-exercise-db (dominio público, Unlicense):
// https://github.com/yuhonas/free-exercise-db
// Toma la posición inicial (0.jpg) de cada ejercicio mapeado, la recorta a 3:2,
// la reduce a 360×240 y la guarda en WebP. Uso:
//   node scripts/exercise-images.mjs <ruta-al-repo-clonado>
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** Nombre del catálogo (seed.ts) → id de free-exercise-db. */
export const MAP = {
  'Press banca': 'Barbell_Bench_Press_-_Medium_Grip',
  'Press inclinado en máquina': 'Leverage_Incline_Chest_Press',
  'Aperturas en máquina': 'Butterfly',
  'Press declinado': 'Decline_Barbell_Bench_Press',
  'Pullover con mancuerna': 'Bent-Arm_Dumbbell_Pullover',
  'Press banca inclinado': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'Press con mancuernas': 'Dumbbell_Bench_Press',
  'Press inclinado con mancuernas': 'Incline_Dumbbell_Press',
  'Aperturas con mancuernas': 'Dumbbell_Flyes',
  'Cruce de poleas': 'Cable_Crossover',
  'Press en máquina': 'Leverage_Chest_Press',
  'Fondos en paralelas': 'Dips_-_Chest_Version',
  'Flexiones': 'Pushups',
  'Dominadas': 'Pullups',
  'Jalón al pecho': 'Wide-Grip_Lat_Pulldown',
  'Remo con barra': 'Bent_Over_Barbell_Row',
  'Remo con mancuerna': 'One-Arm_Dumbbell_Row',
  'Remo en máquina': 'Leverage_Iso_Row',
  'Remo en polea baja': 'Seated_Cable_Rows',
  'Pullover en polea': 'Straight-Arm_Pulldown',
  'Peso muerto': 'Barbell_Deadlift',
  'Rack pull': 'Rack_Pulls',
  'Jalón agarre estrecho': 'Close-Grip_Front_Lat_Pulldown',
  'Remo T': 'T-Bar_Row_with_Handle',
  'Remo Pendlay': 'Bent_Over_Two-Arm_Long_Bar_Row',
  'Remo unilateral en polea': 'Seated_One-arm_Cable_Pulley_Rows',
  'Press militar': 'Standing_Military_Press',
  'Press militar sentado': 'Seated_Barbell_Military_Press',
  'Press de hombro con mancuernas': 'Dumbbell_Shoulder_Press',
  'Elevaciones laterales': 'Side_Lateral_Raise',
  'Elevaciones laterales en polea': 'Cable_Seated_Lateral_Raise',
  'Pájaros': 'Seated_Bent-Over_Rear_Delt_Raise',
  'Face pull': 'Face_Pull',
  'Encogimientos': 'Dumbbell_Shrug',
  'Press Arnold': 'Arnold_Dumbbell_Press',
  'Remo al mentón': 'Upright_Barbell_Row',
  'Elevación frontal': 'Front_Dumbbell_Raise',
  'Press de hombro en máquina': 'Leverage_Shoulder_Press',
  'Curl con barra': 'Barbell_Curl',
  'Curl con barra Z': 'EZ-Bar_Curl',
  'Curl con mancuernas': 'Dumbbell_Bicep_Curl',
  'Curl martillo': 'Hammer_Curls',
  'Curl en polea': 'Standing_Biceps_Cable_Curl',
  'Curl inclinado': 'Incline_Dumbbell_Curl',
  'Curl predicador': 'Machine_Preacher_Curls',
  'Curl concentrado': 'Concentration_Curls',
  'Curl araña': 'Spider_Curl',
  'Curl en máquina': 'Machine_Bicep_Curl',
  'Press francés': 'Lying_Triceps_Press',
  'Extensión de tríceps en polea': 'Triceps_Pushdown',
  'Extensión sobre la cabeza': 'Cable_Rope_Overhead_Triceps_Extension',
  'Press cerrado': 'Close-Grip_Barbell_Bench_Press',
  'Patada de tríceps': 'Tricep_Dumbbell_Kickback',
  'Tríceps unilateral en polea': 'Cable_One_Arm_Tricep_Extension',
  'Extensión con cuerda': 'Triceps_Pushdown_-_Rope_Attachment',
  'Tríceps en máquina': 'Machine_Triceps_Extension',
  'Fondos entre bancos': 'Bench_Dips',
  'Sentadilla': 'Barbell_Squat',
  'Sentadilla frontal': 'Front_Barbell_Squat',
  'Prensa': 'Leg_Press',
  'Extensión de cuádriceps': 'Leg_Extensions',
  'Zancadas': 'Dumbbell_Lunges',
  'Sentadilla búlgara': 'Split_Squat_with_Dumbbells',
  'Hack squat': 'Hack_Squat',
  'Prensa inclinada': 'Leg_Press',
  'Sentadilla en multipower': 'Smith_Machine_Squat',
  'Sentadilla goblet': 'Goblet_Squat',
  'Zancadas caminando': 'Bodyweight_Walking_Lunge',
  'Peso muerto rumano': 'Romanian_Deadlift',
  'Curl femoral tumbado': 'Lying_Leg_Curls',
  'Curl femoral sentado': 'Seated_Leg_Curl',
  'Buenos días': 'Good_Morning',
  'Hiperextensiones': 'Hyperextensions_Back_Extensions',
  'Curl femoral unilateral': 'Lying_Leg_Curls',
  'Peso muerto rumano con mancuernas': 'Stiff-Legged_Dumbbell_Deadlift',
  'Curl nórdico': 'Natural_Glute_Ham_Raise',
  'Hip thrust': 'Barbell_Hip_Thrust',
  'Puente de glúteo': 'Barbell_Glute_Bridge',
  'Abducción en máquina': 'Thigh_Abductor',
  'Aductores en máquina': 'Thigh_Adductor',
  'Patada de glúteo en polea': 'One-Legged_Cable_Kickback',
  'Hip thrust en máquina': 'Barbell_Hip_Thrust',
  'Elevación de talones de pie': 'Standing_Calf_Raises',
  'Elevación de talones sentado': 'Seated_Calf_Raise',
  'Gemelo en prensa': 'Calf_Press_On_The_Leg_Press_Machine',
  'Elevación de talones en multipower': 'Smith_Machine_Calf_Raise',
  'Plancha': 'Plank',
  'Crunch en polea': 'Cable_Crunch',
  'Elevaciones de piernas': 'Hanging_Leg_Raise',
  'Rueda abdominal': 'Ab_Roller',
  'Crunch en máquina': 'Ab_Crunch_Machine',
  'Plancha lateral': 'Side_Bridge',
  'Press Pallof': 'Pallof_Press',
  'Crunch declinado': 'Decline_Crunch',
}

/** Clave del asset a partir del id: minúsculas y sin caracteres raros. */
export function keyFor(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const repo = process.argv[2]
if (!repo) {
  console.error('uso: node scripts/exercise-images.mjs <ruta-al-repo free-exercise-db>')
  process.exit(1)
}
const outDir = fileURLToPath(new URL('../src/assets/exercises/', import.meta.url))
await mkdir(outDir, { recursive: true })

const done = new Set()
let total = 0
for (const id of new Set(Object.values(MAP))) {
  const src = path.join(repo, 'exercises', id, '0.jpg')
  if (!existsSync(src)) {
    console.error('falta', id)
    continue
  }
  const key = keyFor(id)
  const buf = await sharp(src).resize(360, 240, { fit: 'cover', position: 'centre' }).webp({ quality: 78 }).toBuffer()
  await writeFile(path.join(outDir, `${key}.webp`), buf)
  total += buf.length
  done.add(key)
}

// mapa nombre de catálogo → clave, para seed.ts
const seedMap = Object.fromEntries(Object.entries(MAP).map(([name, id]) => [name, keyFor(id)]))
await writeFile(path.join(outDir, 'map.json'), JSON.stringify(seedMap, null, 2) + '\n')
await writeFile(
  path.join(outDir, 'SOURCES.md'),
  `# Fotos de ejercicio\n\nOrigen: free-exercise-db (https://github.com/yuhonas/free-exercise-db), dominio público (Unlicense).\nPosición inicial (0.jpg) de cada ejercicio, recortada a 3:2 y reducida a 360×240 en WebP con \`scripts/exercise-images.mjs\`.\n${done.size} imágenes, ${Math.round(total / 1024)} KB en total. El mapa nombre → clave está en \`map.json\`.\n`,
)
console.log(`${done.size} imágenes · ${Math.round(total / 1024)} KB`)
