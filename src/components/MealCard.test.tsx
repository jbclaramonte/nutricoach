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

  it("n'offre aucune action d'aliment quand elles sont fermées", () => {
    render(
      <MealCard canPickFood={false} meal={meal} onPickFood={vi.fn()} onToggleEaten={vi.fn()} />,
    )

    expect(screen.queryByLabelText('Actions pour Poulet')).toBeNull()
    expect(screen.getByText('Poulet')).toBeTruthy()
  })

  it('sépare la coche des actions d\'aliment', () => {
    render(
      <MealCard canCheckEaten={false} meal={meal} onPickFood={vi.fn()} onToggleEaten={vi.fn()} />,
    )

    expect(screen.queryByLabelText(/Marquer Déjeuner comme/)).toBeNull()
    expect(screen.getByLabelText('Actions pour Poulet')).toBeTruthy()
  })
})
