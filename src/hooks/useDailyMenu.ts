import { useCallback, useEffect, useRef, useState } from 'react'
import { dbDelete, dbGet, dbKeys, dbSet } from '../lib/db'
import { findAllergyViolations } from '../lib/ai/allergies'
import { parseMenu } from '../lib/ai/menuParse'
import { toDashboardMeals } from '../lib/ai/menuMap'
import { MENU_JSON_SCHEMA, type GeneratedMenu } from '../lib/ai/menuSchema'
import { buildCoachSystemPrompt, buildMenuRequest } from '../lib/ai/prompts'
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
}

export type MenuState = 'idle' | 'loading' | 'ready' | 'error'

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
  const loaded = useRef(false)

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

        const next: StoredMenu = {
          generatedAt: Date.now(),
          modelId: settings.modelId,
          menu: parsed.menu,
        }
        loaded.current = true
        setStored(next)
        setDropped(parsed.dropped)
        setState('ready')

        await dbSet(todayKey(), next)
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
  }, [activities, models, profile, settings])

  // Dernier filet, évalué à chaque rendu : déclarer une allergie doit retirer
  // immédiatement un menu déjà affiché, sans attendre ni régénération ni
  // rechargement. Les contrôles faits à la génération et au chargement du cache
  // ne couvrent pas ce cas, l'allergie n'existant pas encore à ces instants.
  const liveViolations = stored ? findAllergyViolations(stored.menu, profile.allergies) : []
  const blocked = liveViolations.length > 0

  return {
    menu: blocked ? null : (stored?.menu ?? null),
    meals: blocked || !stored ? [] : toDashboardMeals(stored.menu),
    state: blocked ? 'error' : state,
    error: blocked
      ? `Menu masqué : il contient ${liveViolations[0].allergen} (${liveViolations[0].where}), déclaré comme allergie. Générez un nouveau menu.`
      : error,
    dropped: blocked ? [] : dropped,
    generatedAt: stored ? new Date(stored.generatedAt) : null,
    generate,
  }
}
