import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { CardData } from './ExerciseCard'

/** Ejercicios de una sesión con sus series, reactivo a IndexedDB. */
export function useSessionCards(sessionId: string | undefined): CardData[] | undefined {
  return useLiveQuery(async () => {
    if (sessionId === undefined) return []
    const links = (await db.session_exercises.where('session_id').equals(sessionId).toArray()).sort(
      (a, b) => a.position - b.position,
    )
    const out: CardData[] = []
    for (const se of links) {
      const exercise = await db.exercises.get(se.exercise_id)
      if (!exercise) continue
      const sets = await db.sets.where('session_exercise_id').equals(se.id).toArray()
      out.push({ se, exercise, sets })
    }
    return out
  }, [sessionId])
}
