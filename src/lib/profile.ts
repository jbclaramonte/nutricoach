export type ActivityLevel = 'sedentary' | 'active' | 'very-active'
export type Sex = 'male' | 'female'

export interface Profile {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  /** Identifiants des objectifs actifs, voir GOALS. */
  goals: string[]
  /** Identifiants des sensibilités déclarées, voir HEALTH_TAGS. */
  healthTags: string[]
  /** Allergies strictes, saisies librement. */
  allergies: string[]
  favorites: string[]
  dislikes: string[]
  /** Précisions libres, reprises telles quelles dans le prompt du coach. */
  notes: string
}

/**
 * Ce texte part dans chaque appel au modèle : sans plafond, un champ libre
 * gonflerait silencieusement le coût de toutes les requêtes.
 */
export const NOTES_MAX_LENGTH = 1500

export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; icon: string }[] = [
  { id: 'sedentary', label: 'Sédentaire', icon: 'chair' },
  { id: 'active', label: 'Actif', icon: 'directions_walk' },
  { id: 'very-active', label: 'Très actif', icon: 'sprint' },
]

export const GOALS: { id: string; label: string; icon: string }[] = [
  { id: 'fat-loss', label: 'Perte de gras / Poids', icon: 'local_fire_department' },
  { id: 'muscle', label: 'Prise de masse / Muscle', icon: 'fitness_center' },
  { id: 'maintenance', label: 'Maintien & Équilibre', icon: 'balance' },
  { id: 'energy', label: 'Énergie & Vitalité', icon: 'bolt' },
  { id: 'endurance', label: 'Performance & Endurance', icon: 'sprint' },
  { id: 'transit', label: 'Transit & Détox', icon: 'eco' },
]

export const HEALTH_TAGS: { id: string; label: string }[] = [
  { id: 'gerd', label: 'RGO (Reflux)' },
  { id: 'ibs', label: 'Côlon irritable (FODMAPs)' },
  { id: 'diabetes-2', label: 'Diabète type 2' },
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'lactose', label: 'Intolérance lactose' },
]

export const DEFAULT_PROFILE: Profile = {
  age: 32,
  sex: 'male',
  heightCm: 178,
  weightKg: 74.5,
  activityLevel: 'sedentary',
  goals: ['fat-loss', 'energy'],
  healthTags: ['gerd', 'ibs', 'lactose'],
  allergies: ['Arachides', 'Gluten / Maladie cœliaque', 'Crustacés'],
  favorites: ['Saumon', 'Avocat', 'Lentilles corail', "Flocons d'avoine", 'Baies & myrtilles', 'Épinards'],
  dislikes: ['Coriandre', 'Céleri branche', 'Poivron cuit', 'Choux de Bruxelles'],
  notes: '',
}

export interface BmiReading {
  value: number
  /** Interprétation OMS de la valeur. */
  label: string
}

/** Calcule l'IMC et son interprétation ; renvoie null si la taille est absurde. */
export function computeBmi(heightCm: number, weightKg: number): BmiReading | null {
  if (heightCm < 50 || weightKg <= 0) return null
  const value = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
  if (value < 18.5) return { value, label: 'Poids insuffisant' }
  if (value < 25) return { value, label: 'Poids santé normal' }
  if (value < 30) return { value, label: 'Surpoids' }
  return { value, label: 'Obésité' }
}

/** Résume les objectifs actifs pour l'encart d'explication. */
export function describeGoals(goals: string[]): string {
  const labels = GOALS.filter((goal) => goals.includes(goal.id)).map((goal) => goal.label)
  if (labels.length === 0) return 'Aucun objectif sélectionné — l’IA visera un équilibre standard.'
  return labels.join(' + ')
}

/** Ajoute une entrée à une liste en évitant les doublons et les libellés vides. */
export function addUnique(list: string[], raw: string): string[] {
  const value = raw.trim()
  if (!value) return list
  if (list.some((entry) => entry.toLowerCase() === value.toLowerCase())) return list
  return [...list, value]
}

/** Bascule un identifiant dans une liste de sélection. */
export function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]
}
