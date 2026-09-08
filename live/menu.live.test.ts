import { describe, expect, it } from 'vitest'
import { apiKey, LIVE_MODEL } from './env'
import { complete } from '../src/lib/openrouter/client'
import { parseMenu } from '../src/lib/ai/menuParse'
import { mergeRevision, restoreFrozenMeals } from '../src/lib/ai/menuRevise'
import { MENU_JSON_SCHEMA, type GeneratedMenu } from '../src/lib/ai/menuSchema'
import { buildCoachSystemPrompt, buildMenuRequest, buildRevisionRequest } from '../src/lib/ai/prompts'
import { DEFAULT_PROFILE } from '../src/lib/profile'
import type { ORMessage } from '../src/lib/openrouter/types'

const profile = { ...DEFAULT_PROFILE, allergies: ['arachide'] }
const day = 'lundi 8 septembre'

function ask(messages: ORMessage[]): Promise<string> {
  return complete({
    apiKey: apiKey(),
    model: LIVE_MODEL,
    messages,
    jsonSchema: MENU_JSON_SCHEMA,
    temperature: 0.4,
    maxTokens: 6000,
    reasoningEffort: 'low',
  })
}

async function generateMenu(): Promise<GeneratedMenu> {
  const raw = await ask([
    { role: 'system', content: buildCoachSystemPrompt(profile, [], day) },
    { role: 'user', content: buildMenuRequest(day, true) },
  ])
  const parsed = parseMenu(raw)
  if (!parsed.ok) throw new Error(`${parsed.reason} — réponse brute : ${raw.slice(0, 400)}`)
  return parsed.menu
}

/**
 * Menu court écrit à la main : la révision se juge sur ce que le modèle renvoie,
 * pas sur la richesse de l'entrée, et un menu généré rallonge l'appel au point
 * que le fournisseur l'abandonne.
 */
const FIXED_MENU: GeneratedMenu = {
  date: day,
  banner: 'Journée équilibrée',
  meals: [
    {
      slot: 'breakfast',
      slotLabel: 'Petit-déjeuner',
      time: '08:00',
      title: 'Porridge avoine',
      items: [{ name: 'Flocons d’avoine', quantity: '60 g', calories: 220, protein: 8, fiber: 6 }],
      rationale: '',
    },
    {
      slot: 'lunch',
      slotLabel: 'Déjeuner',
      time: '12:30',
      title: 'Poulet et riz',
      items: [{ name: 'Riz basmati', quantity: '150 g', calories: 200, protein: 4, fiber: 1 }],
      rationale: '',
    },
    {
      slot: 'dinner',
      slotLabel: 'Dîner',
      time: '19:30',
      title: 'Soupe de courgettes',
      items: [{ name: 'Courgette', quantity: '300 g', calories: 60, protein: 3, fiber: 4 }],
      rationale: '',
    },
  ],
}

describe('parcours menu contre le vrai modèle', () => {
  it('génère un menu exploitable', async () => {
    const menu = await generateMenu()
    console.log('repas générés :', menu.meals.map((meal) => `${meal.slotLabel} — ${meal.title}`))
    expect(menu.meals.length).toBeGreaterThanOrEqual(3)
  })

  it("ne perd aucun repas quand on demande à changer un ingrédient", async () => {
    const menu = FIXED_MENU
    const target = menu.meals[1] ?? menu.meals[0]
    const food = target.items[0].name

    const raw = await ask([
      { role: 'system', content: buildCoachSystemPrompt(profile, [], day, menu) },
      {
        role: 'user',
        content: buildRevisionRequest(
          menu,
          [],
          0,
          2000,
          `Je n'ai pas de ${food} pour le ${target.slotLabel}. Remplace-le ; si le plat ne tient plus sans lui, repropose ce repas. Garde les autres repas à l'identique.`,
          true,
        ),
      },
    ])
    const parsed = parseMenu(raw)
    if (!parsed.ok) throw new Error(`${parsed.reason} — réponse brute : ${raw.slice(0, 400)}`)

    // Ce que le modèle a réellement renvoyé : c'est la mesure qui a motivé la
    // fusion, un menu partiel étant fréquent malgré la consigne inverse.
    console.log(
      `révision : ${parsed.menu.meals.length} repas renvoyés pour ${menu.meals.length} au menu`,
    )

    const { menu: full, kept } = mergeRevision(menu, parsed.menu)
    const { menu: guarded } = restoreFrozenMeals(menu, full, [])
    console.log('repas conservés faute de réponse :', kept)

    expect(guarded.meals.length).toBeGreaterThanOrEqual(menu.meals.length)
    for (const meal of menu.meals) {
      expect(guarded.meals.some((entry) => entry.slot === meal.slot)).toBe(true)
    }
  })
})
