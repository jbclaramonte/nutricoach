export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface FoodItem {
  /** Nom affiché de l'aliment. */
  name: string
  /** Quantité en unité libre : « 130g », « 3 », « 1 c.s. ». */
  quantity: string
  calories: number
  /** Grammes de protéines ; null quand la valeur est négligeable. */
  protein: number | null
  /** Grammes de fibres ; null quand la valeur est négligeable. */
  fiber: number | null
}

export interface Meal {
  id: string
  slot: MealSlot
  /** Libellé du créneau : « Petit-déjeuner ». */
  slotLabel: string
  /** Nom de la recette proposée. */
  title: string
  /** Heure prévue au format HH:MM, utilisée pour ordonner la chronologie. */
  time: string
  imageUrl: string
  imageAlt: string
  /** Badge posé sur la photo, par ex. « Suggestion Modifiée ». */
  badge?: string
  items: FoodItem[]
  eaten: boolean
}

export interface MacroRing {
  key: string
  label: string
  /** Valeur affichée au centre de l'anneau : « 1.8k », « 85g ». */
  display: string
  /** Progression 0–100. */
  percent: number
  /** Classe Tailwind de couleur du tracé, par ex. « stroke-primary ». */
  strokeClass: string
}

export interface MicroNutrient {
  key: string
  label: string
  percent: number
}

export interface DashboardData {
  /** Date du menu, déjà formatée en français. */
  dateLabel: string
  micros: MicroNutrient[]
  user: { name: string; avatarUrl: string }
  coach: { name: string }
  logoUrl: string
}
