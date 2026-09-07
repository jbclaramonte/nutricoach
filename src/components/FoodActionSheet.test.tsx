import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FoodItem } from '../types'
import { FoodActionSheet } from './FoodActionSheet'

const food: FoodItem = {
  name: 'Quinoa',
  quantity: '80g',
  calories: 120,
  protein: 4,
  fiber: 3,
}

function renderSheet(overrides: Partial<Parameters<typeof FoodActionSheet>[0]> = {}) {
  const props = {
    food,
    mealLabel: 'Déjeuner',
    onLike: vi.fn(),
    onDislike: vi.fn(),
    onMissing: vi.fn(),
    onClose: vi.fn(),
    replaceOffered: false,
    onReplace: vi.fn(),
    ...overrides,
  }
  render(<FoodActionSheet {...props} />)
  return props
}

afterEach(cleanup)

describe('FoodActionSheet', () => {
  it("annonce la conséquence de chaque action", () => {
    renderSheet()

    expect(screen.getByText('proposé plus souvent dans vos prochains menus')).toBeTruthy()
    expect(screen.getByText('ne reviendra plus dans vos menus')).toBeTruthy()
    expect(screen.getByText('remplacé dans ce repas')).toBeTruthy()
    expect(screen.getByText('Annuler')).toBeTruthy()
  })

  it('appelle le rappel de chaque action', () => {
    const props = renderSheet()

    fireEvent.click(screen.getByText("J'aime"))
    fireEvent.click(screen.getByText("Je n'aime pas"))
    fireEvent.click(screen.getByText("Je n'en ai pas"))

    expect(props.onLike).toHaveBeenCalledOnce()
    expect(props.onDislike).toHaveBeenCalledOnce()
    expect(props.onMissing).toHaveBeenCalledOnce()
  })

  it('propose le remplacement après un rejet', () => {
    const props = renderSheet({ replaceOffered: true })

    expect(screen.getByText("Quinoa n'apparaîtra plus dans vos menus.")).toBeTruthy()
    expect(screen.queryByText("Je n'aime pas")).toBeNull()

    fireEvent.click(screen.getByText('Le remplacer maintenant'))
    expect(props.onReplace).toHaveBeenCalledOnce()
  })

  it('donne le focus à la feuille', () => {
    renderSheet()

    expect(document.activeElement).toBe(screen.getByText("J'aime").closest('button'))
  })

  it('ferme au voile et à la touche Échap', () => {
    const props = renderSheet()

    fireEvent.click(screen.getByLabelText('Fermer les actions'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(props.onClose).toHaveBeenCalledTimes(2)
  })
})
