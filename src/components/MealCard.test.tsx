import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Meal } from '../types'
import { MealCard } from './MealCard'

const meal: Meal = {
  id: 'lunch',
  slot: 'lunch',
  slotLabel: 'Déjeuner',
  title: 'Poulet et quinoa',
  time: '12:30',
  imageUrl: 'https://example.test/plat.jpg',
  imageAlt: 'Une assiette',
  items: [
    { name: 'Poulet', quantity: '130g', calories: 200, protein: 30, fiber: null },
    { name: 'Quinoa', quantity: '80g', calories: 120, protein: 4, fiber: 3 },
  ],
  eaten: false,
}

afterEach(cleanup)

describe('MealCard', () => {
  it("remonte l'aliment touché", () => {
    const onPickFood = vi.fn()
    render(<MealCard meal={meal} onPickFood={onPickFood} onToggleEaten={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Actions pour Quinoa'))

    expect(onPickFood).toHaveBeenCalledWith(meal.items[1])
  })

  it("n'offre aucune action sur un jour passé", () => {
    render(<MealCard meal={meal} onPickFood={vi.fn()} onToggleEaten={vi.fn()} readOnly />)

    expect(screen.queryByLabelText('Actions pour Poulet')).toBeNull()
    expect(screen.getByText('Poulet')).toBeTruthy()
  })

  it("n'offre aucune action pendant une révision", () => {
    render(<MealCard busy meal={meal} onPickFood={vi.fn()} onToggleEaten={vi.fn()} />)

    expect(screen.queryByLabelText('Actions pour Poulet')).toBeNull()
  })
})
