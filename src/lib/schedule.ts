import type { Activity } from './activities'
import { findActivityType } from './activities'

export interface RecurringActivity {
  id: string
  /** Jours concernés au format ISO : 1 = lundi … 7 = dimanche. */
  weekdays: number[]
  /** Identifiant dans ACTIVITY_TYPES. */
  typeId: string
  /** Titre libre ; à défaut, le libellé du type est affiché. */
  title: string
  /** Heure au format HH:MM. */
  time: string
  durationMin: number
  /** Distance déclarée, quand l'habitude se dit en kilomètres. */
  distanceKm?: number
  /** L'heure n'était pas dans le texte : elle a été supposée, à corriger. */
  timeAssumed?: boolean
}

/** Libellés courts indexés par jour ISO ; l'entrée 0 n'est jamais utilisée. */
export const WEEKDAY_LABELS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * Vitesses moyennes supposées, en km/h. C'est une hypothèse volontairement
 * grossière : l'utilisateur peut corriger la durée obtenue, et c'est cette
 * durée — pas la distance — que le calcul MET utilise ensuite.
 */
const AVERAGE_SPEED_KMH: Record<string, number> = {
  bike: 20,
  run: 10,
  walk: 5,
}

/** Convertit une distance en durée ; 0 pour les types où elle n'a pas de sens. */
export function durationFromDistance(typeId: string, distanceKm: number): number {
  const speed = AVERAGE_SPEED_KMH[typeId]
  if (!speed || !Number.isFinite(distanceKm) || distanceKm <= 0) return 0
  return Math.round((distanceKm / speed) * 60)
}

/**
 * Active les habitudes du jour demandé. Les identifiants sont déterministes
 * pour que l'application à la journée puisse les reconnaître et les dédoublonner.
 */
export function plannedActivitiesFor(date: Date, schedule: RecurringActivity[]): Activity[] {
  // getDay() renvoie 0 pour dimanche : la convention ISO le place en 7.
  const weekday = date.getDay() === 0 ? 7 : date.getDay()
  return schedule
    .filter((entry) => entry.weekdays.includes(weekday))
    .map((entry) => ({
      id: `planned-${entry.id}`,
      time: entry.time,
      typeId: entry.typeId,
      title: entry.title || findActivityType(entry.typeId).label,
      durationMin: entry.durationMin,
    }))
}

/**
 * Heure de repli quand le texte n'en donne aucune. Rejeter une habitude parce
 * que l'utilisateur n'a pas précisé d'heure serait absurde : « je vais au
 * travail en vélo le mardi » décrit bien une habitude exploitable. La valeur est
 * signalée comme supposée pour qu'il la corrige.
 */
export function assumedTimeFor(category: string): string {
  if (category === 'Déplacement actif') return '08:00'
  if (category === 'Récupération') return '19:00'
  return '18:00'
}
