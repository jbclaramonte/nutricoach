import type { MealSlot } from '../../types'

/** Aliment tel que le modèle le renvoie, avant recalcul local des macros. */
export interface GeneratedFood {
  name: string
  /** Quantité en unité libre : « 130g », « 3 », « 1 c.s. ». */
  quantity: string
  calories: number
  protein: number
  fiber: number
}

export interface GeneratedMeal {
  slot: MealSlot
  /** Libellé du créneau : « Petit-déjeuner ». */
  slotLabel: string
  /** Nom de la recette proposée. */
  title: string
  /** Heure prévue au format HH:MM. */
  time: string
  items: GeneratedFood[]
  /** Une phrase expliquant le choix du repas au regard du profil. */
  rationale: string
}

export interface GeneratedMenu {
  /** Date du menu au format AAAA-MM-JJ. */
  date: string
  meals: GeneratedMeal[]
  /** Message d'accueil affiché en tête du tableau de bord. */
  banner: string
}

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * Schéma transmis à OpenRouter en mode `structured_outputs`. Il doit rester le
 * miroir exact de GeneratedMenu : tout écart se paie en erreur de parsing.
 */
export const MENU_JSON_SCHEMA: { name: string; schema: object } = {
  name: 'daily_menu',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['date', 'meals', 'banner'],
    properties: {
      date: { type: 'string', description: 'Date du menu au format AAAA-MM-JJ' },
      banner: { type: 'string', description: "Message d'accueil court, en français" },
      meals: {
        type: 'array',
        description: 'Les repas de la journée, dans l’ordre chronologique',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slot', 'slotLabel', 'title', 'time', 'items', 'rationale'],
          properties: {
            slot: { type: 'string', enum: MEAL_SLOTS, description: 'Créneau du repas' },
            slotLabel: { type: 'string', description: 'Libellé français du créneau, par ex. « Petit-déjeuner »' },
            title: { type: 'string', description: 'Nom de la recette proposée' },
            time: { type: 'string', description: 'Heure prévue au format HH:MM' },
            rationale: { type: 'string', description: 'Une phrase justifiant le repas au regard du profil' },
            items: {
              type: 'array',
              description: 'Aliments composant le repas',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'quantity', 'calories', 'protein', 'fiber'],
                properties: {
                  name: { type: 'string', description: "Nom de l'aliment" },
                  quantity: { type: 'string', description: 'Quantité en unité libre : « 130g », « 1 c.s. »' },
                  calories: { type: 'number', description: 'Calories estimées pour cette quantité' },
                  protein: { type: 'number', description: 'Grammes de protéines, 0 si négligeable' },
                  fiber: { type: 'number', description: 'Grammes de fibres, 0 si négligeable' },
                },
              },
            },
          },
        },
      },
    },
  },
}
