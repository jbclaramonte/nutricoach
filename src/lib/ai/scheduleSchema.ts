import { ACTIVITY_TYPES } from '../activities'

const TYPE_IDS = ACTIVITY_TYPES.map((type) => type.id)

/**
 * Schéma transmis à OpenRouter en mode `structured_outputs`. Miroir exact de
 * RecurringActivity, à l'identifiant près : celui-ci est attribué localement.
 */
export const SCHEDULE_JSON_SCHEMA: { name: string; schema: object } = {
  name: 'weekly_schedule',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['activities'],
    properties: {
      activities: {
        type: 'array',
        description: 'Les activités récurrentes de la semaine, vide si le texte n’en mentionne aucune',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['weekdays', 'typeId', 'title', 'time', 'durationMin', 'distanceKm'],
          properties: {
            weekdays: {
              type: 'array',
              description: 'Jours concernés : 1 = lundi, 7 = dimanche',
              items: { type: 'integer', minimum: 1, maximum: 7 },
            },
            typeId: { type: 'string', enum: TYPE_IDS, description: 'Type d’activité le plus proche' },
            title: { type: 'string', description: 'Intitulé court, par ex. « Trajet bureau »' },
            time: { type: 'string', description: 'Heure de début au format HH:MM' },
            durationMin: { type: 'number', description: 'Durée en minutes, 0 si seule la distance est connue' },
            distanceKm: { type: 'number', description: 'Distance en kilomètres, 0 si non mentionnée' },
          },
        },
      },
    },
  },
}
