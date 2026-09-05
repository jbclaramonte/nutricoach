import type { Meal } from '../types'
import type { Activity } from './activities'

export type TimelineEntry =
  | { kind: 'meal'; time: string; meal: Meal }
  | { kind: 'activity'; time: string; activity: Activity }

/** Fusionne repas et activités en une seule chronologie ordonnée par heure. */
export function buildTimeline(meals: Meal[], activities: Activity[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...meals.map((meal): TimelineEntry => ({ kind: 'meal', time: meal.time, meal })),
    ...activities.map((activity): TimelineEntry => ({
      kind: 'activity',
      time: activity.time,
      activity,
    })),
  ]
  return entries.sort((a, b) => a.time.localeCompare(b.time))
}
