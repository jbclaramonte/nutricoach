import { useCallback, useEffect, useRef, useState } from 'react'
import { dbDelete, dbGet, dbKeys, dbSet } from '../lib/db'
import { findAllergyViolations } from '../lib/ai/allergies'
import { parseMenu } from '../lib/ai/menuParse'
import { toDashboardMeals } from '../lib/ai/menuMap'
import { MENU_JSON_SCHEMA, type GeneratedMenu } from '../lib/ai/menuSchema'
import { buildCoachSystemPrompt, buildMenuRequest, buildRevisionRequest } from '../lib/ai/prompts'
import {
  consumedCalories,
  mealId,
  restoreFrozenMeals,
  summariseChanges,
} from '../lib/ai/menuRevise'
import { dailyTarget } from '../lib/energy'
import { isConfigured } from '../lib/ai/settings'
import type { AiSettings } from '../lib/ai/settings'
import type { Activity } from '../lib/activities'
import type { Profile } from '../lib/profile'
import { complete } from '../lib/openrouter/client'
import { describeError } from '../lib/openrouter/errors'
import type { ORMessage, ORModel } from '../lib/openrouter/types'
import type { Meal } from '../types'
import { dashboardData } from '../data/dashboard'

interface StoredMenu {
  generatedAt: number
  modelId: string
  menu: GeneratedMenu
  /** Identifiants des repas déjà pris, portés par le menu du jour lui-même. */
  eatenIds?: string[]
}

export type MenuState = 'idle' | 'loading' | 'ready' | 'error'

export type ReviseState = 'idle' | 'revising' | 'error'

export interface UseDailyMenuResult {
  menu: GeneratedMenu | null
  meals: Meal[]
  state: MenuState
  /** Phrase française expliquant le dernier échec. */
  error: string
  /** Repas écartés au parsing, nommés pour l'utilisateur. */
  dropped: string[]
  generatedAt: Date | null
  generate: () => void
  /** Bascule l'état « pris » d'un repas, enregistré avec le menu du jour. */
  toggleEaten: (mealId: string) => void
  /** Réécrit le menu du jour à partir d'une demande en langage naturel. */
  revise: (request: string) => Promise<void>
  reviseState: ReviseState
  /** Phrase française expliquant le dernier échec de révision. */
  reviseError: string
  /** Phrase française résumant la dernière révision réussie. */
  reviseNotice: string
}

const KEY_PREFIX = 'menu:'

/** Clé du jour : un menu par date, au format AAAA-MM-JJ. */
function todayKey(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${KEY_PREFIX}${now.getFullYear()}-${month}-${day}`
}

/**
 * Sans ménage, le magasin accumulerait un menu par jour indéfiniment : les
 * entrées antérieures à celle du jour sont supprimées au chargement.
 */
function purgeOldMenus(currentKey: string): Promise<void> {
  return dbKeys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(KEY_PREFIX) && key < currentKey)
          .map((key) => dbDelete(key)),
      ),
    )
    .then(() => undefined)
    .catch((purgeError) => console.error('[menu] purge impossible', purgeError))
}

const PARSE_MESSAGES: Record<'not-json' | 'wrong-shape' | 'no-valid-meal', string> = {
  'not-json': "Le modèle n'a pas répondu en JSON : réessayez, ou choisissez un autre modèle.",
  'wrong-shape': "La réponse du modèle n'a pas la forme attendue : réessayez.",
  'no-valid-meal': 'Aucun repas exploitable dans la réponse du modèle : réessayez.',
}

/**
 * Menu du jour, servi depuis IndexedDB puis régénéré à la demande seulement :
 * un appel au modèle est payant, il ne part jamais tout seul au montage.
 */
export function useDailyMenu(
  settings: AiSettings,
  profile: Profile,
  profileLoaded: boolean,
  activities: Activity[],
  models: ORModel[],
): UseDailyMenuResult {
  const [stored, setStored] = useState<StoredMenu | null>(null)
  const [state, setState] = useState<MenuState>('idle')
  const [error, setError] = useState('')
  const [dropped, setDropped] = useState<string[]>([])
  const [reviseState, setReviseState] = useState<ReviseState>('idle')
  const [reviseError, setReviseError] = useState('')
  const [reviseNotice, setReviseNotice] = useState('')
  const loaded = useRef(false)
  // Miroir synchrone du menu enregistré : la révision lit l'état courant hors
  // rendu, où `stored` serait celui capturé à la création du callback.
  const storedRef = useRef<StoredMenu | null>(null)

  /** Unique point d'écriture du menu : garde le miroir et le magasin à jour. */
  const applyStored = useCallback((next: StoredMenu) => {
    storedRef.current = next
    setStored(next)
    return dbSet(todayKey(), next)
  }, [])

  useEffect(() => {
    // Les allergies sont relues du menu en cache : tant que le profil enregistré
    // n'a pas répondu, la liste serait celle du profil par défaut, donc vide.
    if (!profileLoaded) return
    let cancelled = false
    const key = todayKey()
    dbGet<StoredMenu>(key)
      .then((cached) => {
        // Une génération plus récente a déjà pris la main : elle fait autorité.
        if (cancelled || loaded.current || !cached) return
        // Un menu enregistré avant la déclaration d'une allergie ne doit pas
        // s'afficher tel quel après un rechargement.
        const violations = findAllergyViolations(cached.menu, profile.allergies)
        if (violations.length > 0) {
          setError(
            `Menu enregistré écarté : il contient ${violations[0].allergen} (${violations[0].where}), déclaré comme allergie. Générez un nouveau menu.`,
          )
          setState('error')
          return
        }
        storedRef.current = cached
        setStored(cached)
        setState('ready')
      })
      .catch((readError) => console.error('[menu] lecture impossible', readError))
      .finally(() => {
        if (!cancelled) void purgeOldMenus(key)
      })
    return () => {
      cancelled = true
    }
    // La relecture ne se fait qu'au premier profil chargé : les modifications
    // ultérieures d'allergies sont couvertes par la génération.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded])

  const generate = useCallback(() => {
    if (!isConfigured(settings)) return

    // Le schéma strict n'est envoyé qu'aux modèles qui l'annoncent : un modèle
    // inconnu du catalogue le refuserait par une erreur 400.
    const model = models.find((entry) => entry.id === settings.modelId)
    const jsonSchema = model?.supportsStructuredOutputs ? MENU_JSON_SCHEMA : undefined

    const messages: ORMessage[] = [
      { role: 'system', content: buildCoachSystemPrompt(profile, activities) },
      { role: 'user', content: buildMenuRequest(dashboardData.dateLabel, jsonSchema !== undefined) },
    ]

    setState('loading')
    setError('')

    const ask = () =>
      complete({
        apiKey: settings.apiKey.trim(),
        model: settings.modelId,
        messages,
        jsonSchema,
        temperature: 0.4,
        maxTokens: 2500,
      })

    ask()
      .then(async (raw) => {
        let parsed = parseMenu(raw)
        if (!parsed.ok) throw new Error(PARSE_MESSAGES[parsed.reason])

        let violations = findAllergyViolations(parsed.menu, profile.allergies)
        if (violations.length > 0) {
          // Une seule reprise : au-delà, le modèle ne respectera pas davantage
          // la contrainte et le menu est rejeté plutôt qu'affiché.
          messages.push({ role: 'assistant', content: raw })
          messages.push({
            role: 'user',
            content: [
              `Ce menu contient ${violations[0].allergen} (${violations[0].where}), un allergène strictement interdit.`,
              "Remplace l'ingrédient fautif par une alternative sûre et renvoie le menu complet, au même format.",
            ].join('\n'),
          })
          const retry = await ask()
          parsed = parseMenu(retry)
          if (!parsed.ok) throw new Error(PARSE_MESSAGES[parsed.reason])
          violations = findAllergyViolations(parsed.menu, profile.allergies)
        }

        if (violations.length > 0) {
          throw new Error(
            `Menu rejeté : le modèle continue de proposer ${violations[0].allergen}, déclaré comme allergie. Changez de modèle avant de réessayer.`,
          )
        }

        // Un menu neuf remet la journée à zéro : les repas pris étaient ceux
        // du menu précédent.
        const next: StoredMenu = {
          generatedAt: Date.now(),
          modelId: settings.modelId,
          menu: parsed.menu,
          eatenIds: [],
        }
        loaded.current = true
        setDropped(parsed.dropped)
        setReviseError('')
        setReviseNotice('')
        setState('ready')

        await applyStored(next)
      })
      .catch((generateError) => {
        // Le menu déjà enregistré reste à l'écran : un échec n'efface rien.
        console.error('[menu] génération impossible', generateError)
        setError(
          generateError instanceof Error && !('kind' in generateError)
            ? generateError.message
            : describeError(generateError),
        )
        setState('error')
      })
  }, [activities, applyStored, models, profile, settings])

  const toggleEaten = useCallback(
    (id: string) => {
      const current = storedRef.current
      if (!current) return
      const eatenIds = current.eatenIds ?? []
      const next: StoredMenu = {
        ...current,
        eatenIds: eatenIds.includes(id)
          ? eatenIds.filter((entry) => entry !== id)
          : [...eatenIds, id],
      }
      applyStored(next).catch((writeError) =>
        console.error('[menu] écriture impossible', writeError),
      )
    },
    [applyStored],
  )

  const revise = useCallback(
    async (request: string) => {
      const current = storedRef.current
      if (!current || !isConfigured(settings) || !request.trim()) return

      const model = models.find((entry) => entry.id === settings.modelId)
      const jsonSchema = model?.supportsStructuredOutputs ? MENU_JSON_SCHEMA : undefined

      const eatenIds = current.eatenIds ?? []
      const frozenSlots = current.menu.meals
        .filter((meal, index) => eatenIds.includes(mealId(index, meal)))
        .map((meal) => meal.slotLabel)
      const consumedKcal = Math.round(consumedCalories(current.menu, eatenIds))
      const remainingKcal = Math.max(0, dailyTarget(profile, activities) - consumedKcal)

      const messages: ORMessage[] = [
        { role: 'system', content: buildCoachSystemPrompt(profile, activities) },
        {
          role: 'user',
          content: buildRevisionRequest(
            current.menu,
            frozenSlots,
            consumedKcal,
            remainingKcal,
            request,
            jsonSchema !== undefined,
          ),
        },
      ]

      setReviseState('revising')
      setReviseError('')
      setReviseNotice('')

      const ask = () =>
        complete({
          apiKey: settings.apiKey.trim(),
          model: settings.modelId,
          messages,
          jsonSchema,
          temperature: 0.4,
          maxTokens: 2500,
        })

      try {
        const raw = await ask()
        let parsed = parseMenu(raw)
        if (!parsed.ok) throw new Error(PARSE_MESSAGES[parsed.reason])

        let violations = findAllergyViolations(parsed.menu, profile.allergies)
        if (violations.length > 0) {
          // Même règle qu'à la génération : une révision ne doit pas devenir un
          // contournement du contrôle d'allergies.
          messages.push({ role: 'assistant', content: raw })
          messages.push({
            role: 'user',
            content: [
              `Ce menu contient ${violations[0].allergen} (${violations[0].where}), un allergène strictement interdit.`,
              "Remplace l'ingrédient fautif par une alternative sûre et renvoie le menu complet, au même format.",
            ].join('\n'),
          })
          const retry = await ask()
          parsed = parseMenu(retry)
          if (!parsed.ok) throw new Error(PARSE_MESSAGES[parsed.reason])
          violations = findAllergyViolations(parsed.menu, profile.allergies)
        }

        if (violations.length > 0) {
          throw new Error(
            `Révision rejetée : le modèle continue de proposer ${violations[0].allergen}, déclaré comme allergie. Changez de modèle avant de réessayer.`,
          )
        }

        const { menu: guarded, restored } = restoreFrozenMeals(current.menu, parsed.menu, eatenIds)

        const next: StoredMenu = {
          ...current,
          generatedAt: Date.now(),
          modelId: settings.modelId,
          menu: guarded,
        }
        setDropped([
          ...parsed.dropped,
          ...restored.map((slotLabel) => `${slotLabel} (déjà pris, laissé inchangé)`),
        ])
        setReviseNotice(summariseChanges(current.menu, guarded))
        setReviseState('idle')
        setState('ready')

        await applyStored(next)
      } catch (reviseFailure) {
        // Le menu enregistré reste à l'écran : un échec de révision n'efface rien.
        console.error('[menu] révision impossible', reviseFailure)
        setReviseError(
          reviseFailure instanceof Error && !('kind' in reviseFailure)
            ? reviseFailure.message
            : describeError(reviseFailure),
        )
        setReviseState('error')
      }
    },
    [activities, applyStored, models, profile, settings],
  )

  // Dernier filet, évalué à chaque rendu : déclarer une allergie doit retirer
  // immédiatement un menu déjà affiché, sans attendre ni régénération ni
  // rechargement. Les contrôles faits à la génération et au chargement du cache
  // ne couvrent pas ce cas, l'allergie n'existant pas encore à ces instants.
  const liveViolations = stored ? findAllergyViolations(stored.menu, profile.allergies) : []
  const blocked = liveViolations.length > 0

  return {
    menu: blocked ? null : (stored?.menu ?? null),
    meals: blocked || !stored ? [] : toDashboardMeals(stored.menu, stored.eatenIds ?? []),
    state: blocked ? 'error' : state,
    error: blocked
      ? `Menu masqué : il contient ${liveViolations[0].allergen} (${liveViolations[0].where}), déclaré comme allergie. Générez un nouveau menu.`
      : error,
    dropped: blocked ? [] : dropped,
    generatedAt: stored ? new Date(stored.generatedAt) : null,
    generate,
    toggleEaten,
    revise,
    reviseState,
    reviseError,
    reviseNotice: blocked ? '' : reviseNotice,
  }
}
