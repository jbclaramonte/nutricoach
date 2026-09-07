import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseActivitiesResult } from '../hooks/useActivities'
import type { UseDailyMenuResult } from '../hooks/useDailyMenu'
import { oldestKey, shiftDay, todayKey } from '../lib/day'
import { DEFAULT_PROFILE } from '../lib/profile'
import type { Meal } from '../types'
import { DashboardScreen } from './DashboardScreen'

const tomorrow = shiftDay(todayKey(), 1)
const yesterday = shiftDay(todayKey(), -1)

const meal: Meal = {
  id: 'lunch',
  slot: 'lunch',
  slotLabel: 'Déjeuner',
  title: 'Saumon et lentilles',
  time: '12:30',
  imageUrl: 'https://example.test/lunch.jpg',
  imageAlt: 'Assiette de saumon',
  eaten: false,
  items: [{ name: 'Saumon', quantity: '120 g', calories: 250, protein: 25, fiber: 0 }],
}

const activities: UseActivitiesResult = {
  activities: [
    {
      id: 'velo',
      time: '08:00',
      typeId: 'bike',
      title: 'Vélo au travail',
      durationMin: 30,
      planned: true,
    },
  ],
  add: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
}

/** Menu du jour au repos ; `meals` vide fait apparaître la carte de génération. */
function menuStore(meals: Meal[], error = ''): UseDailyMenuResult {
  return {
    menu: null,
    meals,
    state: error ? 'error' : 'idle',
    error,
    dropped: [],
    generatedAt: null,
    generate: vi.fn(),
    toggleEaten: vi.fn(),
    revise: vi.fn(),
    reviseState: 'idle',
    reviseError: '',
    reviseNotice: '',
  }
}

function screenOf(day: string, meals: Meal[] = [meal], error = '') {
  return (
    <DashboardScreen
      activities={activities}
      configured
      dailyMenu={menuStore(meals, error)}
      day={day}
      onDayChange={vi.fn()}
      profile={DEFAULT_PROFILE}
      readOnly={day < todayKey()}
    />
  )
}

function renderDay(day: string, meals: Meal[] = [meal], error = '') {
  render(screenOf(day, meals, error))
}

afterEach(cleanup)

describe('DashboardScreen', () => {
  it('borne le sélecteur à demain', () => {
    renderDay(tomorrow)

    expect(screen.getByLabelText<HTMLButtonElement>(/Jour suivant/).disabled).toBe(true)
    expect(screen.getByLabelText<HTMLButtonElement>(/Jour précédent/).disabled).toBe(false)
  })

  it('borne le sélecteur à la rétention', () => {
    renderDay(oldestKey())

    expect(screen.getByLabelText<HTMLButtonElement>(/Jour précédent/).disabled).toBe(true)
    expect(screen.getByLabelText<HTMLButtonElement>(/Jour suivant/).disabled).toBe(false)
  })

  it("annonce la consultation seule sur un jour passé et n'y rend aucune commande", () => {
    renderDay(yesterday, [])

    expect(screen.getByText(/Journée archivée/)).toBeTruthy()
    expect(screen.queryByText('Intercaler une activité')).toBeNull()
    expect(screen.queryByText('Générer mon menu')).toBeNull()
    expect(screen.queryByText('Confirmer')).toBeNull()
    expect(screen.queryByLabelText(/Écarter Vélo au travail/)).toBeNull()
  })

  it('permet la génération de demain sans proposer les coches de repas', () => {
    renderDay(tomorrow, [])

    expect(screen.getByText('Générer mon menu')).toBeTruthy()
    expect(screen.queryByText(/Journée archivée/)).toBeNull()

    cleanup()
    renderDay(tomorrow)
    expect(screen.queryByLabelText(/Marquer Déjeuner comme/)).toBeNull()
  })

  it("titre l'écran avec le jour affiché", () => {
    renderDay(tomorrow)

    expect(screen.getByText(/Votre menu — demain/)).toBeTruthy()
  })

  it("explique un menu archivé vidé par une erreur, faute de carte d'état", () => {
    renderDay(yesterday, [], 'Ce menu contient un allergène déclaré depuis.')

    expect(screen.getByText('Ce menu contient un allergène déclaré depuis.')).toBeTruthy()
  })

  it("referme le formulaire d'ajout au changement de jour", () => {
    const { rerender } = render(screenOf(todayKey()))
    fireEvent.click(screen.getByText('Intercaler une activité'))
    expect(screen.getByLabelText('Annuler')).toBeTruthy()

    rerender(screenOf(tomorrow))
    rerender(screenOf(todayKey()))

    expect(screen.queryByLabelText('Annuler')).toBeNull()
    expect(screen.getByText('Intercaler une activité')).toBeTruthy()
  })

  it('rend les coches et les commandes le jour même', () => {
    renderDay(todayKey())

    expect(screen.getByLabelText('Marquer Déjeuner comme pris')).toBeTruthy()
    expect(screen.getByText('Intercaler une activité')).toBeTruthy()
    expect(screen.getByText('Confirmer')).toBeTruthy()
  })
})
