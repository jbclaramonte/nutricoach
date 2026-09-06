/**
 * Date correspondant à une clé de jour, fixée à midi : le planning ne lit que
 * le jour de la semaine, et midi met la journée hors d'atteinte des sauts
 * d'heure.
 */
export function dateOfKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
