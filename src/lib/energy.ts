import type { Profile } from './profile'
import type { Activity } from './activities'
import { estimateCalories, findActivityType } from './activities'

/** Facteur multiplicateur appliqué au métabolisme de base selon le rythme habituel. */
const ACTIVITY_FACTORS: Record<Profile['activityLevel'], number> = {
  sedentary: 1.2,
  active: 1.55,
  'very-active': 1.725,
}

/** Métabolisme de base par la formule Mifflin-St Jeor, en kcal par jour. */
export function basalMetabolicRate(profile: Profile): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age
  return base + (profile.sex === 'male' ? 5 : -161)
}

/**
 * Cible énergétique du jour : métabolisme de base × rythme habituel, plus la
 * dépense des activités saisies, puis ajustement selon les objectifs.
 * Quand « perte de gras » et « prise de masse » sont tous deux cochés, les deux
 * ajustements se contredisent : on n'en applique aucun et la cible reste neutre.
 */
export function dailyTarget(profile: Profile, activities: Activity[]): number {
  const maintenance = basalMetabolicRate(profile) * ACTIVITY_FACTORS[profile.activityLevel]
  // Une activité seulement proposée par le planning n'a pas été faite : la
  // compter gonflerait la cible d'une dépense qui n'a peut-être pas eu lieu.
  const burned = activities
    .filter((activity) => !activity.planned)
    .reduce(
      (total, activity) =>
        total +
        estimateCalories(
          findActivityType(activity.typeId).met,
          profile.weightKg,
          activity.durationMin,
        ),
      0,
    )

  const fatLoss = profile.goals.includes('fat-loss')
  const muscle = profile.goals.includes('muscle')
  let factor = 1
  if (fatLoss && !muscle) factor = 0.85
  else if (muscle && !fatLoss) factor = 1.1

  return Math.round((maintenance + burned) * factor)
}
