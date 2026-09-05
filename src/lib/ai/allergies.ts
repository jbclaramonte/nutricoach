import type { GeneratedMenu } from './menuSchema'

export interface AllergyViolation {
  allergen: string
  /** Repas et aliment fautifs : « Déjeuner — Beurre de cacahuète ». */
  where: string
}

/** Minuscules sans accents, pour comparer « Arachides » et « arachide ». */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Filet de sécurité côté client : l'interdiction posée dans le prompt ne suffit
 * pas, un menu contenant un allergène déclaré ne doit jamais être affiché.
 */
export function findAllergyViolations(menu: GeneratedMenu, allergies: string[]): AllergyViolation[] {
  const violations: AllergyViolation[] = []

  for (const allergen of allergies) {
    const needle = normalise(allergen)
    if (!needle) continue

    // La bannière et la justification sont affichées telles quelles : un
    // allergène qui n'apparaît que là doit être détecté comme dans un aliment.
    if (menu.banner && normalise(menu.banner).includes(needle)) {
      violations.push({ allergen, where: `Bannière — ${menu.banner}` })
    }

    for (const meal of menu.meals) {
      if (normalise(meal.title).includes(needle)) {
        violations.push({ allergen, where: `${meal.slotLabel} — ${meal.title}` })
      }
      if (meal.rationale && normalise(meal.rationale).includes(needle)) {
        violations.push({ allergen, where: `${meal.slotLabel} — ${meal.rationale}` })
      }
      for (const item of meal.items) {
        if (normalise(item.name).includes(needle)) {
          violations.push({ allergen, where: `${meal.slotLabel} — ${item.name}` })
        }
      }
    }
  }

  return violations
}
