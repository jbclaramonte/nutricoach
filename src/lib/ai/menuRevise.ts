import type { GeneratedMeal, GeneratedMenu } from './menuSchema'

/** Identifiant d'un repas dans un menu, aligné sur celui du tableau de bord. */
export function mealId(index: number, meal: GeneratedMeal): string {
  return `${index}-${meal.slot}`
}

/** Calories d'un repas, recalculées depuis ses aliments. */
export function mealCalories(meal: GeneratedMeal): number {
  return meal.items.reduce((total, item) => total + item.calories, 0)
}

/** Somme des calories des repas déjà pris. */
export function consumedCalories(menu: GeneratedMenu, eatenIds: string[]): number {
  return menu.meals.reduce(
    (total, meal, index) => (eatenIds.includes(mealId(index, meal)) ? total + mealCalories(meal) : total),
    0,
  )
}

function sameItems(left: GeneratedMeal, right: GeneratedMeal): boolean {
  return JSON.stringify(left.items) === JSON.stringify(right.items)
}

export interface RestoreResult {
  menu: GeneratedMenu
  /** Repas gelés que le modèle avait modifiés, remis dans leur état d'origine. */
  restored: string[]
}

/**
 * Un repas déjà pris ne peut plus changer : il est déjà mangé. Plutôt que de
 * rejeter toute la révision quand le modèle y touche, le repas d'origine est
 * remis en place et l'utilisateur en est informé.
 */
export function restoreFrozenMeals(
  current: GeneratedMenu,
  revised: GeneratedMenu,
  frozenIds: string[],
): RestoreResult {
  const meals = [...revised.meals]
  const restored: string[] = []
  const claimed = new Set<number>()

  current.meals.forEach((meal, index) => {
    if (!frozenIds.includes(mealId(index, meal))) return

    const match = meals.findIndex(
      (candidate, position) => candidate.slot === meal.slot && !claimed.has(position),
    )
    if (match === -1) {
      // Le modèle a purement supprimé le repas gelé : il est réinséré à sa place.
      meals.splice(Math.min(index, meals.length), 0, meal)
      restored.push(meal.slotLabel)
      return
    }

    claimed.add(match)
    if (sameItems(meals[match], meal)) return
    meals[match] = meal
    restored.push(meal.slotLabel)
  })

  return { menu: { ...revised, meals }, restored }
}

/** Résumé français des repas recomposés, obtenu en comparant les titres. */
export function summariseChanges(before: GeneratedMenu, after: GeneratedMenu): string {
  const changed: string[] = []

  after.meals.forEach((meal, index) => {
    const previous = before.meals[index]
    if (!previous || previous.title !== meal.title) changed.push(meal.slotLabel.toLowerCase())
  })

  if (changed.length === 0) return 'Menu mis à jour — aucun repas renommé.'
  if (changed.length === 1) return `Menu mis à jour — ${changed[0]} recomposé.`
  const last = changed[changed.length - 1]
  return `Menu mis à jour — ${changed.slice(0, -1).join(', ')} et ${last} recomposés.`
}
