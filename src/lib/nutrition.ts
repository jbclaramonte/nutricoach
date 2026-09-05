import type { FoodItem } from '../types'

export interface MealTotals {
  calories: number
  protein: number
  fiber: number
}

/** Somme les macros d'un repas ; les valeurs nulles comptent pour zéro. */
export function sumMeal(items: FoodItem[]): MealTotals {
  return items.reduce<MealTotals>(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      protein: totals.protein + (item.protein ?? 0),
      fiber: totals.fiber + (item.fiber ?? 0),
    }),
    { calories: 0, protein: 0, fiber: 0 },
  )
}

/** Affiche une macro en grammes, ou « - » quand elle est absente. */
export function formatGrams(value: number | null): string {
  if (value === null || value === 0) return '-'
  return `${Math.round(value * 10) / 10}g`
}
