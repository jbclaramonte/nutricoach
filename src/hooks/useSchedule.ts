import { useCallback, useEffect, useRef, useState } from 'react'
import { dbGet, dbSet } from '../lib/db'
import { parseSchedule } from '../lib/ai/scheduleParse'
import { SCHEDULE_JSON_SCHEMA } from '../lib/ai/scheduleSchema'
import { buildScheduleRequest } from '../lib/ai/prompts'
import { isConfigured, type AiSettings } from '../lib/ai/settings'
import { complete } from '../lib/openrouter/client'
import { describeError } from '../lib/openrouter/errors'
import type { ORModel } from '../lib/openrouter/types'
import type { RecurringActivity } from '../lib/schedule'

const KEY = 'schedule:weekly'

export type ExtractState = 'idle' | 'extracting' | 'error'

const PARSE_MESSAGES: Record<'not-json' | 'wrong-shape' | 'empty', string> = {
  'not-json': "Le modèle n'a pas répondu en JSON : réessayez, ou choisissez un autre modèle.",
  'wrong-shape': "La réponse du modèle n'a pas la forme attendue : réessayez.",
  empty: "Aucune habitude exploitable n'a été trouvée dans vos précisions.",
}

export interface UseScheduleResult {
  schedule: RecurringActivity[]
  /** false tant que la lecture IndexedDB n'a pas répondu. */
  loaded: boolean
  setAll: (activities: RecurringActivity[]) => void
  add: (activity: RecurringActivity) => void
  update: (activityId: string, patch: Partial<RecurringActivity>) => void
  remove: (activityId: string) => void
  /**
   * Propose des habitudes déduites du texte libre. N'écrit rien : la
   * proposition revient à l'appelant, qui décide de l'appliquer ou non.
   */
  extract: (notes: string) => Promise<RecurringActivity[] | null>
  extractState: ExtractState
  /** Phrase française expliquant le dernier échec d'extraction. */
  extractError: string
}

export function useSchedule(settings: AiSettings, models: ORModel[]): UseScheduleResult {
  const [schedule, setSchedule] = useState<RecurringActivity[]>([])
  const [loaded, setLoaded] = useState(false)
  const [extractState, setExtractState] = useState<ExtractState>('idle')
  const [extractError, setExtractError] = useState('')
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    dbGet<RecurringActivity[]>(KEY)
      .then((stored) => {
        if (!cancelled && stored) setSchedule(stored)
      })
      .catch((error) => console.error('[schedule] lecture impossible', error))
      .finally(() => {
        loadedRef.current = true
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function persist(next: RecurringActivity[]) {
    setSchedule(next)
    // Tant que la lecture initiale n'a pas répondu, écrire écraserait des
    // données existantes avec une liste vide.
    if (!loadedRef.current) return
    dbSet(KEY, next).catch((error) => console.error('[schedule] écriture impossible', error))
  }

  const extract = useCallback(
    async (notes: string): Promise<RecurringActivity[] | null> => {
      if (!isConfigured(settings) || !notes.trim()) return null

      // Le schéma strict n'est envoyé qu'aux modèles qui l'annoncent : un modèle
      // inconnu du catalogue le refuserait par une erreur 400.
      const model = models.find((entry) => entry.id === settings.modelId)
      const jsonSchema = model?.supportsStructuredOutputs ? SCHEDULE_JSON_SCHEMA : undefined

      setExtractState('extracting')
      setExtractError('')

      try {
        const raw = await complete({
          apiKey: settings.apiKey.trim(),
          model: settings.modelId,
          messages: [
            { role: 'user', content: buildScheduleRequest(notes, jsonSchema !== undefined) },
          ],
          jsonSchema,
          temperature: 0.2,
          maxTokens: 1200,
        })

        const parsed = parseSchedule(raw)
        if (!parsed.ok) throw new Error(PARSE_MESSAGES[parsed.reason])

        setExtractState('idle')
        return parsed.activities
      } catch (error) {
        console.error('[schedule] extraction impossible', error)
        setExtractError(
          error instanceof Error && !('kind' in error) ? error.message : describeError(error),
        )
        setExtractState('error')
        return null
      }
    },
    [models, settings],
  )

  return {
    schedule,
    loaded,
    setAll: persist,
    add: (activity) => persist([...schedule, activity]),
    update: (activityId, patch) =>
      persist(schedule.map((entry) => (entry.id === activityId ? { ...entry, ...patch } : entry))),
    remove: (activityId) => persist(schedule.filter((entry) => entry.id !== activityId)),
    extract,
    extractState,
    extractError,
  }
}
