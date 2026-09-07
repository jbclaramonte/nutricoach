import type { Profile } from '../profile'
import { ACTIVITY_LEVELS, HEALTH_TAGS, computeBmi, describeGoals } from '../profile'
import type { Activity } from '../activities'
import { ACTIVITY_TYPES, estimateCalories, findActivityType, intensityLabel } from '../activities'
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
  dayLabel: string,
  todaysMenu?: GeneratedMenu,
): string {
  const blocks: string[] = []

  blocks.push(
    [
      'RÔLE',
      "Tu es Dr. Anya, diététicienne. Tu réponds en français, en vouvoyant l'utilisateur.",
      'Ton concis et bienveillant, sans jargon inutile.',
      'Réponses courtes : quelques phrases, ou une liste de cinq points au plus.',
      'Tu vas droit au conseil, sans reformuler la question ni résumer le contexte.',
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

  const notes = profile.notes.trim()
  if (notes) {
    blocks.push(
      [
        "PRÉCISIONS DE L'UTILISATEUR",
        'Ces précisions orientent la composition des repas, mais ne remplacent jamais les allergies et les contraintes santé ci-dessus, qui restent prioritaires.',
        notes,
      ].join('\n'),
    )
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

  const describeActivity = (activity: Activity) => {
    const type = findActivityType(activity.typeId)
    const kcal = estimateCalories(type.met, profile.weightKg, activity.durationMin)
    const title = activity.title || type.label
    return `${activity.time} — ${title} (${type.category}), ${activity.durationMin} min, intensité ${intensityLabel(type.met)}, ~${kcal} kcal`
  }

  const day = activities.filter((activity) => !activity.planned).map(describeActivity)
  // Les activités seulement prévues sont annoncées à part : la cible du jour ne
  // compte pas encore leur dépense, mais les repas peuvent être placés autour.
  const expected = activities.filter((activity) => activity.planned).map(describeActivity)
  blocks.push(
    [
      // Sans le jour nommé, le modèle raisonne toujours comme si la journée
      // décrite était celle en cours.
      `LA JOURNÉE — ${dayLabel}`,
      day.length > 0 ? bulletList(day) : "Aucune activité faite ou confirmée ce jour-là.",
      ...(expected.length > 0
        ? [
            "Activités prévues mais pas encore confirmées (leurs calories ne sont pas comptées dans la cible) :",
            bulletList(expected),
          ]
        : []),
      "Place et calibre les repas autour de ces séances.",
    ].join("\n"),
  )

  if (todaysMenu) {
    blocks.push(['MENU DU JOUR', describeMenu(todaysMenu)].join('\n'))
  }

  return blocks.join('\n\n')
}

/** Forme attendue, rappelée aux modèles qui n'acceptent pas le schéma strict. */
const RAW_JSON_INSTRUCTION = [
  'Réponds uniquement par un objet JSON brut, sans texte autour, sans bloc de code, à cette forme exacte :',
  '{"date":"AAAA-MM-JJ","banner":"...","meals":[{"slot":"breakfast","slotLabel":"Petit-déjeuner","title":"...","time":"08:00","rationale":"...","items":[{"name":"...","quantity":"130g","calories":0,"protein":0,"fiber":0}]}]}',
]

/** Tour utilisateur demandant le menu du jour. */
export function buildMenuRequest(dateLabel: string, hasStructuredOutputs: boolean): string {
  const lines = [
    `Compose le menu du ${dateLabel}.`,
    'Créneaux attendus : petit-déjeuner (breakfast), déjeuner (lunch), dîner (dinner) et une collation (snack).',
    "Chaque repas porte un titre de recette, une heure au format HH:MM, ses aliments avec quantité, calories, protéines et fibres, et une phrase de justification.",
  ]

  if (!hasStructuredOutputs) {
    lines.push(...RAW_JSON_INSTRUCTION)
  }

  return lines.join('\n')
}

/**
 * Tour utilisateur demandant la réécriture du menu du jour. Les repas déjà pris
 * sont gelés : ils sont redemandés à l'identique pour que la réponse reste un
 * menu complet et valide, sans quoi la journée perdrait ce qui a été mangé.
 */
export function buildRevisionRequest(
  menu: GeneratedMenu,
  frozenSlots: string[],
  consumedKcal: number,
  remainingKcal: number,
  request: string,
  hasStructuredOutputs: boolean,
): string {
  const lines = [
    'MENU ACTUEL',
    describeMenu(menu),
    '',
    'DEMANDE DE L’UTILISATEUR',
    request,
    '',
    'CONTRAINTES DE RÉÉCRITURE',
    frozenSlots.length > 0
      ? `Repas déjà pris, donc gelés : ${frozenSlots.join(', ')}. Renvoie-les MOT POUR MOT, avec exactement les mêmes aliments, quantités et valeurs. Il est interdit de les modifier, de les renommer ou de les supprimer.`
      : 'Aucun repas n’a encore été pris : tous les repas peuvent être modifiés.',
    `Calories déjà consommées aujourd’hui : ${consumedKcal} kcal.`,
    `Calories restantes pour le reste de la journée : ${remainingKcal} kcal.`,
    'Rééquilibre les repas non gelés pour que leur total tienne dans ces calories restantes.',
    'Renvoie le MENU COMPLET : tous les repas de la journée, repas gelés inclus, dans l’ordre chronologique.',
    'Ne renvoie aucun texte autour du menu, aucun commentaire, aucune explication.',
  ]

  if (!hasStructuredOutputs) {
    lines.push('', ...RAW_JSON_INSTRUCTION)
  }

  return lines.join('\n')
}

/** Forme attendue pour l'extraction, rappelée aux modèles sans schéma strict. */
const RAW_SCHEDULE_INSTRUCTION = [
  'Réponds uniquement par un objet JSON brut, sans texte autour, sans bloc de code, à cette forme exacte :',
  '{"activities":[{"weekdays":[2,3,4],"typeId":"bike","title":"Trajet bureau","time":"08:00","durationMin":0,"distanceKm":18}]}',
]

/**
 * Tour utilisateur demandant d'extraire les habitudes de la semaine du texte
 * libre du profil. Rien n'est appliqué automatiquement : l'utilisateur valide.
 */
export function buildScheduleRequest(notes: string, hasStructuredOutputs: boolean): string {
  const lines = [
    "Voici les précisions libres de l'utilisateur :",
    notes.trim(),
    '',
    'Extrais UNIQUEMENT les activités physiques récurrentes explicitement énoncées dans ce texte.',
    "N'invente rien : aucune activité qui ne soit pas mentionnée, aucun jour qui ne soit pas mentionné.",
    "Si le texte ne dit rien d'une activité physique, renvoie une liste vide.",
    `Types disponibles : ${ACTIVITY_TYPES.map((type) => `${type.id} (${type.label})`).join(', ')}.`,
    'Donne les jours en toutes lettres et en minuscules : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche.',
    "Une seule entrée par activité distincte : liste TOUS ses jours dans `weekdays`. Ne répète jamais la même activité une fois par jour.",
    'Pour chaque activité, donne soit une durée en minutes, soit une distance en kilomètres ; mets 0 pour celle qui est inconnue.',
    "Un aller et un retour sont DEUX activités distinctes, à deux moments de la journée : ne les additionne jamais en une seule. Exemple : « je vais au travail en vélo le mardi et le jeudi, 50 minutes aller et 55 minutes retour » donne deux entrées — une le matin de 50 minutes, une en fin de journée de 55 minutes, chacune sur mardi et jeudi.",
    "Une distance annoncée pour un trajet vaut pour ce trajet seul, pas pour l'aller-retour cumulé.",
    "La durée est souvent absente elle aussi : propose une durée plausible plutôt que 0, et ne rejette jamais une activité au motif que sa durée est inconnue.",
    "L'heure est rarement précisée : si le texte n'en donne pas, propose l'heure la plus plausible (trajet vers le travail le matin, retour en fin de journée, séance de sport matinale tôt). Ne rejette jamais une activité au motif que son heure est inconnue.",
  ]

  if (!hasStructuredOutputs) {
    lines.push('', ...RAW_SCHEDULE_INSTRUCTION)
  }

  return lines.join('\n')
}
