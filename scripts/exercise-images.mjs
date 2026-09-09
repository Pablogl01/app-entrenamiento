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
  // ampliación: gimnasio, casa, barra y calistenia
  // fotos equivalentes: mismo gesto con otro implemento o nombre en free-exercise-db
  'Fondos en barra recta': 'Parallel_Bar_Dip',
  'Flexiones arqueras': 'Push-Up_Wide',
  'Flexiones en anillas': 'Suspended_Push-Up',
  'Colgado en barra': 'One_Handed_Hang',
  'Aperturas invertidas en máquina': 'Reverse_Machine_Flyes',
  'Pino contra la pared': 'Handstand_Push-Ups',
  'Flexiones diamante': 'Push-Ups_-_Close_Triceps_Position',
  'Sentadilla pistol': 'Kettlebell_Pistol_Squat',
  'Peso muerto a una pierna con mancuerna': 'Kettlebell_One-Legged_Deadlift',
  'Curl femoral con deslizadores': 'Platform_Hamstring_Slides',
  'Hip thrust con mancuerna': 'Barbell_Hip_Thrust',
  'Hip thrust a una pierna': 'Single_Leg_Glute_Bridge',
  'Zancada lateral': 'Barbell_Side_Split_Squat',
  'Elevación de talones a una pierna': 'Calf_Raise_On_A_Dumbbell',
  'Toes to bar': 'Hanging_Pike',
  'Press declinado con mancuernas': 'Decline_Dumbbell_Bench_Press',
  'Aperturas en polea baja': 'Low_Cable_Crossover',
  'Press de suelo con mancuernas': 'Dumbbell_Floor_Press',
  'Fondos en anillas': 'Ring_Dips',
  'Flexiones inclinadas': 'Incline_Push-Up',
  'Flexiones declinadas': 'Decline_Push-Up',
  'Flexiones abiertas': 'Push-Up_Wide',
  'Flexiones con lastre': 'Pushups',
  'Flexiones pliométricas': 'Plyo_Push-up',
  'Dominadas supinas': 'Chin-Up',
  'Dominadas agarre neutro': 'V-Bar_Pullup',
  'Dominadas agarre ancho': 'Wide-Grip_Rear_Pull-Up',
  'Dominadas asistidas con goma': 'Band_Assisted_Pull-Up',
  'Dominadas negativas': 'Pullups',
  'Dominadas escapulares': 'Scapular_Pull-Up',
  'Muscle-up': 'Muscle_Up',
  'Remo invertido': 'Inverted_Row',
  'Remo invertido en anillas': 'Inverted_Row_with_Straps',
  'Remo con mancuernas a dos manos': 'Bent_Over_Two-Dumbbell_Row',
  'Remo renegado': 'Alternating_Renegade_Row',
  'Remo iso-lateral en máquina': 'Leverage_Iso_Row',
  'Jalón unilateral': 'One_Arm_Lat_Pulldown',
  'Peso muerto con trap bar': 'Trap_Bar_Deadlift',
  'Push press': 'Push_Press',
  'Encogimientos con barra': 'Barbell_Shrug',
  'Pájaros en polea': 'Cable_Rear_Delt_Fly',
  'Remo al mentón con mancuernas': 'Standing_Dumbbell_Upright_Row',
  'Flexiones en pino': 'Handstand_Push-Ups',
  'Curl Zottman': 'Zottman_Curl',
  'Curl inverso con barra': 'Reverse_Barbell_Curl',
  'Curl inverso con mancuernas': 'Standing_Dumbbell_Reverse_Curl',
  'Curl predicador con mancuerna': 'One_Arm_Dumbbell_Preacher_Curl',
  'Fondos en máquina': 'Dip_Machine',
  'Fondos en paralelas (tríceps)': 'Dips_-_Triceps_Version',
  'Extensión de tríceps con mancuerna a dos manos': 'Seated_Triceps_Press',
  'Extensión de tríceps con mancuerna a una mano': 'Dumbbell_One-Arm_Triceps_Extension',
  'Press francés con barra Z': 'EZ-Bar_Skullcrusher',
  'Sentadilla sin peso': 'Bodyweight_Squat',
  'Sentadilla con salto': 'Freehand_Jump_Squat',
  'Sentadilla sissy': 'Weighted_Sissy_Squat',
  'Sentadilla con mancuernas': 'Dumbbell_Squat',
  'Sentadilla Zercher': 'Zercher_Squats',
  'Sentadilla en caja': 'Box_Squat',
  'Zancadas con barra': 'Barbell_Lunge',
  'Zancada inversa': 'Dumbbell_Rear_Lunge',
  'Zancadas sin peso': 'Bodyweight_Walking_Lunge',
  'Zancadas con salto': 'Split_Jump',
  'Step-up con mancuernas': 'Dumbbell_Step_Ups',
  'Step-up': 'Step-up_with_Knee_Raise',
  'Salto al cajón': 'Front_Box_Jump',
  'Peso muerto piernas rígidas': 'Stiff-Legged_Barbell_Deadlift',
  'Peso muerto con mancuernas': 'Stiff-Legged_Dumbbell_Deadlift',
  'Curl femoral de pie': 'Standing_Leg_Curl',
  'Curl femoral con fitball': 'Ball_Leg_Curl',
  'Glute ham raise': 'Glute_Ham_Raise',
  'Swing con kettlebell': 'One-Arm_Kettlebell_Swings',
  'Peso muerto sumo': 'Sumo_Deadlift',
  'Sentadilla sumo con mancuerna': 'Plie_Dumbbell_Squat',
  'Puente de glúteo sin peso': 'Butt_Lift_Bridge',
  'Puente de glúteo a una pierna': 'Single_Leg_Glute_Bridge',
  'Patada de glúteo': 'Glute_Kickback',
  'Aductores en polea': 'Cable_Hip_Adduction',
  'Elevación de talones con mancuerna': 'Standing_Dumbbell_Calf_Raise',
  'Elevación de talones con barra': 'Standing_Barbell_Calf_Raise',
  'Gemelo burro': 'Donkey_Calf_Raises',
  'Crunch': 'Crunches',
  'Crunch inverso': 'Reverse_Crunch',
  'Crunch bicicleta': 'Air_Bike',
  'Sit-up': 'Sit-Up',
  'Elevaciones de piernas colgado': 'Hanging_Leg_Raise',
  'Rodillas al pecho colgado': 'Hanging_Leg_Raise',
  'Dead bug': 'Dead_Bug',
  'Superman': 'Superman',
  'Giro ruso': 'Russian_Twist',
  'Flexión lateral con mancuerna': 'Dumbbell_Side_Bend',
  'Patadas de tijera': 'Flutter_Kicks',
  'Escaladores': 'Mountain_Climbers',
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
