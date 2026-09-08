import { useEffect, useState } from 'react'
import type { Activity } from '../lib/activities'
import { dateOfKey, isToday } from '../lib/day'
import { dbDelete, dbGet, dbSet } from '../lib/db'
import { plannedActivitiesFor, type RecurringActivity } from '../lib/schedule'
import { defaultActivities } from '../data/dashboard'

const KEY_PREFIX = 'activities:'
/** Ancien journal unique, antérieur au découpage par jour. */
const LEGACY_KEY = 'activities:today'

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
  /** Déplace une activité dans la journée, sans toucher à sa durée. */
  setTime: (activityId: string, time: string) => void
}

export function useActivities(
  schedule: RecurringActivity[],
  scheduleLoaded: boolean,
  day: string,
  editable: boolean,
): UseActivitiesResult {
  const [stored, setStored] = useState<StoredDay | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [shownDay, setShownDay] = useState(day)
  const key = `${KEY_PREFIX}${day}`

  // Le jour a changé : la remise à zéro se fait pendant le rendu, pas dans
  // l'effet. Différée d'une frame, une écriture partie entre-temps porterait
  // la journée précédente sous la clé du nouveau jour.
  if (shownDay !== day) {
    setShownDay(day)
    setStored(null)
    setLoaded(false)
  }

  useEffect(() => {
    let cancelled = false
    dbGet<StoredDay>(key)
      .then((existing) => {
        if (cancelled) return
        if (existing) {
          setStored(existing)
          return
        }
        // « activities:today » est l'ancien journal unique : il ne peut être
        // repris que sous la clé d'aujourd'hui, puis supprimé enchainé après
        // pour éviter la race avec le ménage global qui pourrait le supprimer
        // avant qu'on le lise.
        if (!isToday(day)) return
        return dbGet<unknown>(LEGACY_KEY).then((legacy) => {
          if (cancelled || !Array.isArray(legacy)) return
          const migrated: StoredDay = {
            activities: legacy as Activity[],
            dismissedPlannedIds: [],
          }
          setStored(migrated)
          return dbSet(key, migrated).then(() => dbDelete(LEGACY_KEY))
        })
      })
      .catch((error) => console.error('[activities] lecture impossible', error))
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [day, key])

  function persist(next: StoredDay) {
    // Tant que la lecture initiale n'a pas répondu, écrire écraserait des
    // données existantes avec une journée vide.
    if (!loaded) return
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
    ? (stored?.activities ??
      (isToday(day) && schedule.length === 0 ? defaultActivities : []))
    : []
  const dismissed = ready ? (stored?.dismissedPlannedIds ?? []) : []

  const planned = (ready ? plannedActivitiesFor(dateOfKey(day), schedule) : [])
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
    add: (activity) => {
      // Un jour archivé ou seulement prévu ne s'édite pas : une commande restée
      // en vol après un changement de jour écrirait dans la mauvaise journée.
      if (!editable) return
      persist({ ...current(), activities: [...saved, activity] })
    },
    remove: (activityId) => {
      // Un jour archivé ou seulement prévu ne s'édite pas : une commande restée
      // en vol après un changement de jour écrirait dans la mauvaise journée.
      if (!editable) return
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
      // Un jour archivé ou seulement prévu ne s'édite pas : une commande restée
      // en vol après un changement de jour écrirait dans la mauvaise journée.
      if (!editable) return
      const proposal = planned.find((entry) => entry.id === activityId)
      if (!proposal) return
      persist({ ...current(), activities: [...saved, { ...proposal, planned: false }] })
    },
    setTime: (activityId, time) => {
      // Un jour archivé ou seulement prévu ne s'édite pas : une commande restée
      // en vol après un changement de jour écrirait dans la mauvaise journée.
      if (!editable) return
      const entry = saved.find((activity) => activity.id === activityId)
      if (entry) {
        persist({
          ...current(),
          activities: saved.map((activity) =>
            activity.id === activityId ? { ...activity, time } : activity,
          ),
        })
        return
      }
      // Déplacer une proposition, c'est décider de la faire : elle n'est pas
      // dans le journal, l'y écrire à sa nouvelle heure vaut confirmation.
      const proposal = planned.find((activity) => activity.id === activityId)
      if (!proposal) return
      persist({ ...current(), activities: [...saved, { ...proposal, time, planned: false }] })
    },
  }
}
