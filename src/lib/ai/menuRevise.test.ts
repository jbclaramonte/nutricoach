import { describe, expect, it } from 'vitest'
import { mergeRevision } from './menuRevise'
import type { GeneratedMeal, GeneratedMenu } from './menuSchema'

function meal(slot: GeneratedMeal['slot'], title: string, time: string): GeneratedMeal {
  return {
    slot,
    slotLabel: slot,
    title,
    time,
    items: [{ name: title, quantity: '1', calories: 100, protein: 5, fiber: 2 }],
    rationale: '',
  }
}

function menu(meals: GeneratedMeal[]): GeneratedMenu {
  return { date: '2026-09-08', banner: 'Journée', meals }
}

describe('mergeRevision', () => {
  const current = menu([
    meal('breakfast', 'Porridge', '08:00'),
    meal('lunch', 'Poulet riz', '12:30'),
    meal('dinner', 'Soupe', '19:30'),
  ])

  it('conserve les repas que la révision ne renvoie pas', () => {
    const revised = menu([meal('lunch', 'Poulet quinoa', '12:30')])

    const { menu: merged, kept } = mergeRevision(current, revised)

    expect(merged.meals.map((entry) => entry.title)).toEqual(['Porridge', 'Poulet quinoa', 'Soupe'])
    expect(kept).toEqual(['breakfast', 'dinner'])
  })

  it('remplace chaque repas renvoyé et ne signale rien quand le menu est complet', () => {
    const revised = menu([
      meal('breakfast', 'Flocons', '08:00'),
      meal('lunch', 'Poisson', '12:30'),
      meal('dinner', 'Salade', '19:30'),
    ])

    const { menu: merged, kept } = mergeRevision(current, revised)

    expect(merged.meals.map((entry) => entry.title)).toEqual(['Flocons', 'Poisson', 'Salade'])
    expect(kept).toEqual([])
  })

  it('ajoute un repas que la révision introduit', () => {
    const revised = menu([meal('snack', 'Amandes', '16:00')])

    const { menu: merged } = mergeRevision(current, revised)

    expect(merged.meals.map((entry) => entry.title)).toEqual([
      'Porridge',
      'Poulet riz',
      'Soupe',
      'Amandes',
    ])
  })

  it('apparie deux repas de même créneau dans leur ordre', () => {
    const twoSnacks = menu([meal('snack', 'Pomme', '10:00'), meal('snack', 'Yaourt', '16:00')])
    const revised = menu([meal('snack', 'Banane', '10:00')])

    const { menu: merged, kept } = mergeRevision(twoSnacks, revised)

    expect(merged.meals.map((entry) => entry.title)).toEqual(['Banane', 'Yaourt'])
    expect(kept).toEqual(['snack'])
  })

  it('garde la bannière et la date de la révision', () => {
    const revised = { ...menu([meal('lunch', 'Poulet quinoa', '12:30')]), banner: 'Révisé' }

    const { menu: merged } = mergeRevision(current, revised)

    expect(merged.banner).toBe('Révisé')
  })
})
