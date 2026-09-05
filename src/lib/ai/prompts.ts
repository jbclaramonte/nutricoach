import type { Profile } from '../profile'
import { ACTIVITY_LEVELS, HEALTH_TAGS, computeBmi, describeGoals } from '../profile'
import type { Activity } from '../activities'
import { estimateCalories, findActivityType, intensityLabel } from '../activities'
import { dailyTarget } from '../energy'
import type { GeneratedMenu } from './menuSchema'

/**
 * Traduction des sensibilités déclarées en règles culinaires. C'est de la
 * connaissance de prompt et non du domaine profil : elle vit donc ici.
 */
const HEALTH_RULES: Record<string, string> = {
  gerd: "pas d'acidité forte ni de repas lourd le soir, privilégie les cuissons douces",
  ibs: 'faible en FODMAP, évite oignon, ail et légumineuses en excès',
  'diabetes-2': 'index glycémique bas, glucides répartis sur la journée, aucun sucre ajouté',
  hypertension: 'sel réduit, ni charcuterie ni plat industriel',
  lactose: 'aucun produit laitier non délactosé',
}

function labelOf(list: { id: string; label: string }[], id: string): string {
  return list.find((entry) => entry.id === id)?.label ?? id
}

function bulletList(values: string[]): string {
  return values.map((value) => `- ${value}`).join('\n')
}

/** Restitution compacte du menu du jour, pour que le coach puisse en parler. */
function describeMenu(menu: GeneratedMenu): string {
  return menu.meals
    .map((meal) => {
      const items = meal.items.map((item) => `${item.name} (${item.quantity})`).join(', ')
      return `- ${meal.slotLabel} ${meal.time} — ${meal.title} : ${items}`
    })
    .join('\n')
}

/** Prompt système partagé entre le chat et la génération de menu. */
export function buildCoachSystemPrompt(
  profile: Profile,
  activities: Activity[],
  todaysMenu?: GeneratedMenu,
): string {
  const blocks: string[] = []

  blocks.push(
    [
      'RÔLE',
      "Tu es Dr. Anya, diététicienne. Tu réponds en français, en vouvoyant l'utilisateur.",
      'Ton concis et bienveillant, sans jargon inutile.',
      'Tu ne poses jamais de diagnostic médical et tu ne contredis jamais un professionnel de santé ;',
      "dans ce cas, tu invites à en parler avec lui.",
    ].join('\n'),
  )

  const bmi = computeBmi(profile.heightCm, profile.weightKg)
  blocks.push(
    [
      'BIOMÉTRIE',
      `- Âge : ${profile.age} ans`,
      `- Sexe : ${profile.sex === 'male' ? 'Homme' : 'Femme'}`,
      `- Taille : ${profile.heightCm} cm`,
      `- Poids : ${profile.weightKg} kg`,
      bmi ? `- IMC : ${bmi.value} (${bmi.label})` : '- IMC : non calculable',
      `- Rythme habituel : ${labelOf(ACTIVITY_LEVELS, profile.activityLevel)}`,
    ].join('\n'),
  )

  blocks.push(
    [
      'CIBLE ÉNERGÉTIQUE',
      `Cible du jour : ${dailyTarget(profile, activities)} kcal.`,
      'Ce chiffre est déjà calculé et fait autorité : ne le recalcule pas, ne le discute pas.',
    ].join('\n'),
  )

  blocks.push(['OBJECTIFS', describeGoals(profile.goals)].join('\n'))

  if (profile.allergies.length > 0) {
    blocks.push(
      [
        'ALLERGIES — INTERDICTION ABSOLUE',
        bulletList(profile.allergies),
        'Aucun de ces ingrédients, ni aucun de leurs dérivés, ne doit apparaître.',
        "En cas de doute sur un ingrédient composé, choisis un autre ingrédient.",
      ].join('\n'),
    )
  }

  const rules = profile.healthTags.map(
    (tag) => `${labelOf(HEALTH_TAGS, tag)} : ${HEALTH_RULES[tag] ?? 'adapte les recettes en conséquence'}`,
  )
  if (rules.length > 0) {
    blocks.push(['CONTRAINTES SANTÉ', bulletList(rules)].join('\n'))
  }

  const tastes: string[] = []
  if (profile.favorites.length > 0) {
    tastes.push(`À privilégier quand c'est cohérent avec la cible : ${profile.favorites.join(', ')}.`)
  }
  if (profile.dislikes.length > 0) {
    tastes.push(`À remplacer d'office, sans le commenter : ${profile.dislikes.join(', ')}.`)
  }
  if (tastes.length > 0) {
    blocks.push(['GOÛTS', ...tastes].join('\n'))
  }

  const day = activities.map((activity) => {
    const type = findActivityType(activity.typeId)
    const kcal = estimateCalories(type.met, profile.weightKg, activity.durationMin)
    const title = activity.title || type.label
    return `${activity.time} — ${title} (${type.category}), ${activity.durationMin} min, intensité ${intensityLabel(type.met)}, ~${kcal} kcal`
  })
  blocks.push(
    [
      'LA JOURNÉE',
      day.length > 0 ? bulletList(day) : 'Aucune activité saisie aujourd’hui.',
      'Place et calibre les repas autour de ces séances.',
    ].join('\n'),
  )

  if (todaysMenu) {
    blocks.push(['MENU DU JOUR', describeMenu(todaysMenu)].join('\n'))
  }

  return blocks.join('\n\n')
}

/** Tour utilisateur demandant le menu du jour. */
export function buildMenuRequest(dateLabel: string, hasStructuredOutputs: boolean): string {
  const lines = [
    `Compose le menu du ${dateLabel}.`,
    'Créneaux attendus : petit-déjeuner (breakfast), déjeuner (lunch), dîner (dinner) et une collation (snack).',
    "Chaque repas porte un titre de recette, une heure au format HH:MM, ses aliments avec quantité, calories, protéines et fibres, et une phrase de justification.",
  ]

  if (!hasStructuredOutputs) {
    lines.push(
      'Réponds uniquement par un objet JSON brut, sans texte autour, sans bloc de code, à cette forme exacte :',
      '{"date":"AAAA-MM-JJ","banner":"...","meals":[{"slot":"breakfast","slotLabel":"Petit-déjeuner","title":"...","time":"08:00","rationale":"...","items":[{"name":"...","quantity":"130g","calories":0,"protein":0,"fiber":0}]}]}',
    )
  }

  return lines.join('\n')
}
