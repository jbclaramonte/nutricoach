import { ACTIVITY_TYPES } from '../activities'
import { assumedDurationFor, assumedTimeFor, durationFromDistance, mergeRecurring, type RecurringActivity } from '../schedule'

export type ScheduleParseResult =
  | { ok: true; activities: RecurringActivity[]; dropped: string[] }
  | { ok: false; reason: 'not-json' | 'wrong-shape' | 'empty' }

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

function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return value
}

/** Ne garde que des jours ISO valides, sans doublon. */
const WEEKDAY_NAMES: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
}

/**
 * Accepte le nom du jour, forme demandée au modèle, et l'entier ISO, que
 * d'anciens plannings enregistrés peuvent encore porter.
 */
function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const days = value
    .map((day) => {
      if (typeof day === 'number' && Number.isInteger(day)) return day
      if (typeof day !== 'string') return 0
      const normalised = day
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
      return WEEKDAY_NAMES[normalised] ?? 0
    })
    .filter((day) => day >= 1 && day <= 7)
    .sort((a, b) => a - b)
  return days.filter((day, index) => days.indexOf(day) === index)
}

/**
 * Identifiant dérivé du contenu, non de la position : après une nouvelle
 * extraction, un refus enregistré ne doit pas retomber sur une autre habitude.
 */
function recurringId(typeId: string, time: string, weekdays: number[], title: string): string {
  const slug = `${typeId}-${time.replace(':', '')}-${weekdays.join('')}-${title.toLowerCase()}`
  return `recurring-${slug.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`
}

function parseRecurring(value: unknown): RecurringActivity | null {
  if (!isRecord(value)) return null

  const typeId = text(value.typeId)
  if (!ACTIVITY_TYPES.some((type) => type.id === typeId)) return null

  // Une heure manquante ne disqualifie pas l'habitude : le texte de
  // l'utilisateur décrit rarement des horaires, on en suppose une et on le dit.
  const declaredTime = text(value.time)
  const timeAssumed = !TIME_PATTERN.test(declaredTime)
  const time = timeAssumed
    ? assumedTimeFor(ACTIVITY_TYPES.find((type) => type.id === typeId)?.category ?? '')
    : declaredTime

  const weekdays = parseWeekdays(value.weekdays)
  if (weekdays.length === 0) return null

  const distanceKm = positive(value.distanceKm)
  // La distance ne sert qu'à combler une durée manquante : c'est la durée qui
  // alimente ensuite le calcul MET. L'arrondi précède le rejet, sinon une durée
  // déduite d'une distance minime serait enregistrée à 0 min.
  const declaredDuration = Math.round(
    positive(value.durationMin) || durationFromDistance(typeId, distanceKm),
  )
  const durationAssumed = declaredDuration <= 0
  const durationMin = durationAssumed ? assumedDurationFor(typeId) : declaredDuration

  const title = text(value.title).trim()

  return {
    id: recurringId(typeId, time, weekdays, title),
    weekdays,
    typeId,
    title,
    time,
    durationMin,
    ...(timeAssumed ? { timeAssumed: true } : {}),
    ...(durationAssumed ? { durationAssumed: true } : {}),
    ...(distanceKm > 0 ? { distanceKm } : {}),
  }
}

/** Nomme une entrée écartée, pour l'expliquer à l'utilisateur. */
function describeDropped(value: unknown, index: number): string {
  if (isRecord(value)) {
    const label = text(value.title) || text(value.typeId)
    if (label) return label
  }
  return `Activité ${index + 1}`
}

/**
 * Convertit la réponse brute du modèle en habitudes exploitables. Ne lève
 * jamais : une sortie hors format est une situation nominale, pas un bug.
 */
export function parseSchedule(raw: string): ScheduleParseResult {
  let payload: unknown
  try {
    payload = JSON.parse(stripFences(raw))
  } catch {
    return { ok: false, reason: 'not-json' }
  }

  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.activities)
      ? payload.activities
      : null
  if (!list) return { ok: false, reason: 'wrong-shape' }
  if (list.length === 0) return { ok: false, reason: 'empty' }

  const activities: RecurringActivity[] = []
  const dropped: string[] = []
  list.forEach((entry, index) => {
    const activity = parseRecurring(entry)
    // Deux entrées strictement identiques produiraient le même identifiant :
    // on suffixe la seconde plutôt que de laisser un doublon.
    if (activity) {
      if (activities.some((existing) => existing.id === activity.id)) {
        activity.id = `${activity.id}-${index + 1}`
      }
      activities.push(activity)
    }
    else dropped.push(describeDropped(entry, index))
  })

  if (activities.length === 0) return { ok: false, reason: 'empty' }

  // Le modèle produit parfois une entrée par jour : la proposition doit être
  // déjà regroupée quand l'utilisateur la découvre.
  return { ok: true, activities: mergeRecurring(activities), dropped }
}
