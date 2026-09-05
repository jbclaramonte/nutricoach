import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../lib/activities'
import { dbGet, dbSet } from '../lib/db'
import { defaultActivities } from '../data/dashboard'

// Une seule journée est gérée pour l'instant ; la clé portera la date quand le
// journal couvrira plusieurs jours.
const KEY = 'activities:today'

export interface UseActivitiesResult {
  activities: Activity[]
  add: (activity: Activity) => void
  remove: (activityId: string) => void
}

export function useActivities(): UseActivitiesResult {
  const [activities, setActivities] = useState<Activity[]>(defaultActivities)
  const loaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    dbGet<Activity[]>(KEY)
      .then((stored) => {
        if (!cancelled && stored) setActivities(stored)
      })
      .catch((error) => console.error('[activities] lecture impossible', error))
      .finally(() => {
        loaded.current = true
      })
    return () => {
      cancelled = true
    }
  }, [])

  function persist(next: Activity[]) {
    setActivities(next)
    // Tant que la lecture initiale n'a pas répondu, écrire écraserait des
    // données existantes avec le jeu par défaut.
    if (!loaded.current) return
    dbSet(KEY, next).catch((error) => console.error('[activities] écriture impossible', error))
  }

  return {
    activities,
    add: (activity) => persist([...activities, activity]),
    remove: (activityId) => persist(activities.filter((entry) => entry.id !== activityId)),
  }
}
