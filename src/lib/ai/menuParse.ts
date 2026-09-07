import type { MealSlot } from '../../types'
import type { GeneratedFood, GeneratedMeal, GeneratedMenu } from './menuSchema'

export type MenuParseResult =
  | { ok: true; menu: GeneratedMenu; dropped: string[] }
  | { ok: false; reason: 'not-json' | 'wrong-shape' | 'no-valid-meal' }

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const TIME_PATTERN = /^\d{2}:\d{2}$/

/** Retire l'éventuel bloc de code entourant la réponse du modèle. */
function stripFences(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** Une macro absente, négative ou non finie vaut zéro plutôt que de tout perdre. */
function macro(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return value
}

function parseFood(value: unknown): GeneratedFood | null {
  if (!isRecord(value)) return null
  const name = text(value.name).trim()
  if (!name) return null
  return {
    name,
    quantity: text(value.quantity),
    calories: macro(value.calories),
    protein: macro(value.protein),
    fiber: macro(value.fiber),
  }
}

function parseMeal(value: unknown): GeneratedMeal | null {
  if (!isRecord(value)) return null

  const slot = text(value.slot) as MealSlot
  if (!MEAL_SLOTS.includes(slot)) return null

  const time = text(value.time)
  if (!TIME_PATTERN.test(time)) return null

  const rawItems = Array.isArray(value.items) ? value.items : []
  const items = rawItems.map(parseFood).filter((item): item is GeneratedFood => item !== null)
  if (items.length === 0) return null

  return {
    slot,
    slotLabel: text(value.slotLabel, slot),
    title: text(value.title, slot),
    time,
    items,
    rationale: text(value.rationale),
  }
}

/** Nomme un repas écarté, pour l'expliquer à l'utilisateur. */
function describeDropped(value: unknown, index: number): string {
  if (isRecord(value)) {
    const label = text(value.title) || text(value.slotLabel) || text(value.slot)
    if (label) return label
  }
  return `Repas ${index + 1}`
}

/**
 * Convertit la réponse brute du modèle en menu exploitable. Ne lève jamais :
 * une sortie hors format est une situation nominale, pas un bug.
 */
/**
 * Extrait l'objet JSON d'une réponse qui l'entoure de prose : sans schéma
 * strict, un modèle préfixe volontiers son menu d'une phrase d'introduction.
 */
function extractObject(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

export function parseMenu(raw: string): MenuParseResult {
  const cleaned = stripFences(raw)
  let payload: unknown
  try {
    payload = JSON.parse(cleaned)
  } catch {
    const inner = extractObject(cleaned)
    if (inner === null) return { ok: false, reason: 'not-json' }
    try {
      payload = JSON.parse(inner)
    } catch {
      return { ok: false, reason: 'not-json' }
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.meals)) return { ok: false, reason: 'wrong-shape' }

  const meals: GeneratedMeal[] = []
  const dropped: string[] = []
  payload.meals.forEach((entry, index) => {
    const meal = parseMeal(entry)
    if (meal) meals.push(meal)
    else dropped.push(describeDropped(entry, index))
  })

  if (meals.length === 0) return { ok: false, reason: 'no-valid-meal' }

  return {
    ok: true,
    menu: { date: text(payload.date), banner: text(payload.banner), meals },
    dropped,
  }
}
