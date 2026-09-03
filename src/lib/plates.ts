/** Calculadora de discos: qué poner en cada lado de la barra para una carga. */
export interface PlateStack {
  perSide: number
  plates: { plate: number; count: number }[]
  /** Resto que no se puede montar con los discos disponibles. */
  remainder: number
}

export function platesPerSide(weight: number, barWeight: number, available: number[]): PlateStack | null {
  if (weight <= barWeight) return null
  let side = Math.round(((weight - barWeight) / 2) * 1000) / 1000
  const perSide = side
  const plates: { plate: number; count: number }[] = []
  for (const plate of [...available].sort((a, b) => b - a)) {
    const count = Math.floor(side / plate + 1e-9)
    if (count > 0) {
      plates.push({ plate, count })
      side = Math.round((side - count * plate) * 1000) / 1000
    }
  }
  return { perSide, plates, remainder: side }
}
