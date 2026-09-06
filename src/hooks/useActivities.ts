import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../lib/activities'
import { dbGet, dbSet } from '../lib/db'
import { plannedActivitiesFor, type RecurringActivity } from '../lib/schedule'
import { defaultActivities } from '../data/dashboard'

const KEY_PREFIX = 'activities:'
/** Ancien journal unique, antérieur au découpage par jour. */
const LEGACY_KEY = 'activities:today'

/** Clé du jour : un journal par date, au format AAAA-MM-JJ. */
function todayKey(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${KEY_PREFIX}${now.getFullYear()}-${month}-${day}`
}

interface StoredDay {
  activities: Activity[]
  /** Activités du planning écartées pour la journée : elles ne reviennent pas. */
  dismissedPlannedIds: string[]
}

export interface UseActivitiesResult {
  activities: Activity[]
  add: (activity: Activity) => void
  remove: (activityId: string) => void
  /** Transforme une proposition du planning en activité réellement faite. */
  confirm: (activityId: string) => void
}

export function useActivities(
  schedule: RecurringActivity[],
  scheduleLoaded: boolean,
): UseActivitiesResult {
  const [stored, setStored] = useState<StoredDay | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Une session ouverte à cheval sur minuit écrirait le journal d'hier sous la
  // clé d'aujourd'hui : on retient le jour lu, pour comparer à l'écriture.
  const dayKey = useRef(todayKey())

  useEffect(() => {
    let cancelled = false
    const key = todayKey()
    dayKey.current = key
    dbGet<StoredDay>(key)
      .then((day) => {
        if (cancelled) return
        if (day) {
          setStored(day)
          return
        }
        // « activities:today » est l'ancien journal unique : il est repris sous
        // la clé du jour avant que le ménage ne l'efface.
        return dbGet<unknown>(LEGACY_KEY).then((legacy) => {
          if (cancelled || !Array.isArray(legacy)) return
          const migrated: StoredDay = {
            activities: legacy as Activity[],
            dismissedPlannedIds: [],
          }
          setStored(migrated)
          return dbSet(key, migrated)
        })
      })
      .catch((error) => console.error('[activities] lecture impossible', error))
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function persist(next: StoredDay) {
    // Tant que la lecture initiale n'a pas répondu, écrire écraserait des
    // données existantes avec une journée vide.
    if (!loaded) return
    const key = todayKey()
    if (key !== dayKey.current) {
      // Le jour a changé depuis le chargement : on repart d'une journée vierge
      // et l'effet de lecture reprend la main pour la nouvelle date.
      setStored(null)
      setLoaded(false)
      return
    }
    setStored(next)
    dbSet(key, next).catch((error) =>
      console.error('[activities] écriture impossible', error),
    )
  }

  // Le jeu de démonstration ne sert qu'à une app encore vierge : dès qu'un
  // planning existe, ou qu'une activité a été saisie, il n'a plus lieu d'être.
  // Avant que les deux lectures aient répondu, rien n'est affiché : sinon la
  // démo apparaîtrait brièvement à un utilisateur qui a un planning.
  const ready = loaded && scheduleLoaded
  const saved = ready
    ? (stored?.activities ?? (schedule.length === 0 ? defaultActivities : []))
    : []
  const dismissed = ready ? (stored?.dismissedPlannedIds ?? []) : []

  const planned = plannedActivitiesFor(new Date(), schedule)
    .filter(
      (activity) =>
        !dismissed.includes(activity.id) && !saved.some((entry) => entry.id === activity.id),
    )
    .map((activity): Activity => ({ ...activity, planned: true }))

  const activities = [...saved, ...planned]

  function current(): StoredDay {
    return { activities: saved, dismissedPlannedIds: dismissed }
  }

  return {
    activities,
    add: (activity) => persist({ ...current(), activities: [...saved, activity] }),
    remove: (activityId) => {
      // Une proposition n'est pas dans le journal : sans mémoire du refus, elle
      // réapparaîtrait au rendu suivant. Une proposition confirmée n'est plus
      // dans « planned » : c'est l'identifiant, seul, qui la désigne.
      const isProposal = activityId.startsWith('planned-')
      persist({
        activities: saved.filter((entry) => entry.id !== activityId),
        dismissedPlannedIds:
          isProposal && !dismissed.includes(activityId)
            ? [...dismissed, activityId]
            : dismissed,
      })
    },
    confirm: (activityId) => {
      const proposal = planned.find((entry) => entry.id === activityId)
      if (!proposal) return
      persist({ ...current(), activities: [...saved, { ...proposal, planned: false }] })
    },
  }
}
