export interface ActivityType {
  id: string
  label: string
  icon: string
  /** Catégorie affichée à côté de l'heure. */
  category: string
  /** Équivalent métabolique, base du calcul de dépense. */
  met: number
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: 'gym', label: 'Gym & Renforcement', icon: 'fitness_center', category: 'Séance', met: 5 },
  { id: 'walk', label: 'Marche', icon: 'directions_walk', category: 'Déplacement actif', met: 3.5 },
  { id: 'bike', label: 'Vélo', icon: 'directions_bike', category: 'Déplacement actif', met: 6.8 },
  { id: 'run', label: 'Course à pied', icon: 'directions_run', category: 'Séance', met: 9.8 },
  { id: 'swim', label: 'Natation', icon: 'pool', category: 'Séance', met: 7 },
  { id: 'yoga', label: 'Yoga & Mobilité', icon: 'self_improvement', category: 'Récupération', met: 2.5 },
]

export interface Activity {
  id: string
  /** Heure au format HH:MM, utilisée pour ordonner la chronologie. */
  time: string
  /** Identifiant dans ACTIVITY_TYPES. */
  typeId: string
  /** Titre libre ; à défaut, le libellé du type est affiché. */
  title: string
  durationMin: number
  /** Note d'impact sur le repas suivant, rédigée par le coach. */
  impact?: string
  /** Proposée par le planning hebdomadaire, pas encore confirmée. */
  planned?: boolean
}

/**
 * Dépense estimée par la formule MET : kcal = MET × 3.5 × poids / 200 × minutes.
 * C'est une approximation, suffisante pour ajuster un menu.
 */
export function estimateCalories(met: number, weightKg: number, durationMin: number): number {
  return Math.round(((met * 3.5 * weightKg) / 200) * durationMin)
}

/** Qualifie l'effort à partir du MET, dans le vocabulaire de l'app. */
export function intensityLabel(met: number): string {
  if (met < 3) return 'Léger'
  if (met < 6) return 'Modéré'
  if (met < 8) return 'Aérobie'
  return 'Intense'
}

export function findActivityType(typeId: string): ActivityType {
  return ACTIVITY_TYPES.find((type) => type.id === typeId) ?? ACTIVITY_TYPES[0]
}
