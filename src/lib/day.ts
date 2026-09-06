/** Nombre de jours d'historique conservés dans IndexedDB. */
export const RETENTION_DAYS = 90

/** Clé d'un jour, au format AAAA-MM-JJ, en heure locale. */
export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayKey(): string {
  return dayKey(new Date())
}

/**
 * Décale une clé de jour. Le calcul passe par une date fixée à midi : ajouter
 * des millisecondes ferait dériver la journée d'une heure au changement
 * d'heure, et un décalage négatif tomberait la veille.
 */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  return dayKey(new Date(year, month - 1, day + days, 12))
}

/** Borne basse du calendrier : au-delà, les journées sont purgées. */
export function oldestKey(): string {
  return shiftDay(todayKey(), -RETENTION_DAYS)
}

export function isToday(key: string): boolean {
  return key === todayKey()
}

export function isPast(key: string): boolean {
  return key < todayKey()
}

export function isTomorrow(key: string): boolean {
  return key === shiftDay(todayKey(), 1)
}

const FULL_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Libellé lisible : les deux jours proches sont nommés, les autres datés. */
export function dayLabel(key: string): string {
  if (isToday(key)) return "Aujourd'hui"
  if (isTomorrow(key)) return 'Demain'
  const [year, month, day] = key.split('-').map(Number)
  return FULL_DATE.format(new Date(year, month - 1, day, 12))
}
