import type { MacroRing, Meal } from '../../types'
import { sumMeal } from '../nutrition'
import { SLOT_IMAGES } from '../../data/dashboard'
import type { GeneratedMenu } from './menuSchema'

/**
 * La cible protéique se rapporte au poids corporel, pas aux calories : c'est la
 * référence usuelle en nutrition et elle reste juste quand la cible calorique
 * change. 30 g de fibres correspondent à la recommandation ANSES pour l'adulte.
 */
const PROTEIN_TARGET_G_PER_KG = 1.6
const FIBER_TARGET_G = 30

function ratio(value: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

/**
 * Complète le menu généré avec ce que le modèle ne produit pas : identifiant
 * stable, illustration déterministe par créneau, état « pris ».
 */
export function toDashboardMeals(menu: GeneratedMenu): Meal[] {
  return menu.meals.map((meal, index) => {
    const image = SLOT_IMAGES[meal.slot]
    return {
      // Le créneau ne suffit pas : deux collations partageraient le même
      // identifiant, donc la même clé React et le même état « pris ».
      id: `${index}-${meal.slot}`,
      slot: meal.slot,
      slotLabel: meal.slotLabel,
      title: meal.title,
      time: meal.time,
      imageUrl: image.url,
      imageAlt: image.alt,
      badge: meal.rationale || undefined,
      items: meal.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        calories: item.calories,
        protein: item.protein,
        fiber: item.fiber,
      })),
      eaten: false,
    }
  })
}

/**
 * Les macros affichées sont toujours recalculées à partir des aliments : les
 * totaux annoncés par le modèle ne font jamais foi.
 */
export function toMacroRings(meals: Meal[], target: number, weightKg: number): MacroRing[] {
  const totals = meals.reduce(
    (sum, meal) => {
      const mealTotals = sumMeal(meal.items)
      return {
        calories: sum.calories + mealTotals.calories,
        protein: sum.protein + mealTotals.protein,
        fiber: sum.fiber + mealTotals.fiber,
      }
    },
    { calories: 0, protein: 0, fiber: 0 },
  )

  const proteinTarget = Math.round(weightKg * PROTEIN_TARGET_G_PER_KG)

  return [
    {
      key: 'calories',
      label: 'Calories',
      display: `${(Math.round(totals.calories) / 1000).toFixed(1)}k`,
      percent: ratio(totals.calories, target),
      strokeClass: 'stroke-tertiary-container',
    },
    {
      key: 'protein',
      label: 'Protéines',
      display: `${Math.round(totals.protein)}g`,
      percent: ratio(totals.protein, proteinTarget),
      strokeClass: 'stroke-primary',
    },
    {
      key: 'fiber',
      label: 'Fibres',
      display: `${Math.round(totals.fiber)}g`,
      percent: ratio(totals.fiber, FIBER_TARGET_G),
      strokeClass: 'stroke-primary',
    },
    // Aucune saisie d'hydratation n'existe encore. Afficher un chiffre inventé
    // à côté de macros réelles le ferait passer pour une mesure : l'anneau reste
    // vide jusqu'à ce que la saisie d'eau soit implémentée.
    { key: 'water', label: 'Eau', display: '—', percent: 0, strokeClass: 'stroke-secondary' },
  ]
}
