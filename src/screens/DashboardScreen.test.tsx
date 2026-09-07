import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const addTaste = vi.fn(() => Promise.resolve(true))
const revise = vi.fn()

/** État de révision du menu, à part : la plupart des tests le laissent au repos. */
interface Revision {
  revising?: boolean
  reviseError?: string
  reviseNotice?: string
  reviseId?: number
}

/** Menu du jour au repos ; `meals` vide fait apparaître la carte de génération. */
function menuStore(meals: Meal[], error = '', revision: Revision = {}): UseDailyMenuResult {
  return {
    menu: null,
    meals,
    state: error ? 'error' : 'idle',
    error,
    dropped: [],
    generatedAt: null,
    generate: vi.fn(),
    toggleEaten: vi.fn(),
    revise,
    reviseState: revision.revising ? 'revising' : 'idle',
    reviseError: revision.reviseError ?? '',
    reviseNotice: revision.reviseNotice ?? '',
    reviseId: revision.reviseId ?? 1,
  }
}

function screenOf(day: string, meals: Meal[] = [meal], error = '', revision: Revision = {}) {
  return (
    <DashboardScreen
      activities={activities}
      addTaste={addTaste}
      coachOpen={false}
      profileReadFailed={false}
      configured
      dailyMenu={menuStore(meals, error, revision)}
      day={day}
      onDayChange={vi.fn()}
      profile={DEFAULT_PROFILE}
      readOnly={day < todayKey()}
    />
  )
}

function renderDay(day: string, meals: Meal[] = [meal], error = '', revision: Revision = {}) {
  render(screenOf(day, meals, error, revision))
}

/** Ouvre la feuille d'actions sur le saumon du déjeuner. */
function openSheet() {
  fireEvent.click(screen.getByLabelText('Actions pour Saumon'))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  addTaste.mockResolvedValue(true)
})

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

    expect(screen.getByText('Générer le menu de demain')).toBeTruthy()
    expect(screen.getByText(/Aucun menu pour demain/)).toBeTruthy()
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

  it("ouvre la feuille d'actions sur l'aliment touché", () => {
    renderDay(todayKey())
    openSheet()

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('120 g — Déjeuner')).toBeTruthy()
  })

  it("enregistre un aliment apprécié puis referme la feuille", async () => {
    renderDay(todayKey())
    openSheet()
    fireEvent.click(screen.getByText("J'aime"))

    expect(addTaste).toHaveBeenCalledWith('favorites', 'Saumon')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it("enregistre un rejet et propose le remplacement sans refermer", async () => {
    renderDay(todayKey())
    openSheet()
    fireEvent.click(screen.getByText("Je n'aime pas"))

    expect(addTaste).toHaveBeenCalledWith('dislikes', 'Saumon')
    expect(await screen.findByText('Le remplacer maintenant')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(revise).not.toHaveBeenCalled()
  })

  it("demande le remplacement d'un aliment manquant", () => {
    renderDay(todayKey())
    openSheet()
    fireEvent.click(screen.getByText("Je n'en ai pas"))

    expect(revise).toHaveBeenCalledWith(
      "Je n'ai pas de Saumon pour le Déjeuner. Remplace-le ; si le plat ne tient plus sans lui, repropose ce repas. Garde les autres repas à l'identique.",
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("demande le remplacement depuis la proposition qui suit un rejet", async () => {
    renderDay(todayKey())
    openSheet()
    fireEvent.click(screen.getByText("Je n'aime pas"))
    fireEvent.click(await screen.findByText('Le remplacer maintenant'))

    expect(revise).toHaveBeenCalledWith(
      "Je n'ai pas de Saumon pour le Déjeuner. Remplace-le ; si le plat ne tient plus sans lui, repropose ce repas. Garde les autres repas à l'identique.",
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("n'ouvre la feuille ni pendant une révision ni sur un jour passé", () => {
    renderDay(todayKey(), [meal], '', { revising: true })
    expect(screen.queryByLabelText('Actions pour Saumon')).toBeNull()

    cleanup()
    renderDay(yesterday)
    expect(screen.queryByLabelText('Actions pour Saumon')).toBeNull()
  })

  it("offre les actions d'aliment sur demain, sans la coche", () => {
    renderDay(tomorrow)
    fireEvent.click(screen.getByLabelText('Actions pour Saumon'))
    fireEvent.click(screen.getByText("Je n'en ai pas"))

    expect(revise).toHaveBeenCalledWith(
      "Je n'ai pas de Saumon pour le Déjeuner. Remplace-le ; si le plat ne tient plus sans lui, repropose ce repas. Garde les autres repas à l'identique.",
    )
    expect(screen.queryByLabelText(/Marquer Déjeuner comme/)).toBeNull()
  })

  it("nettoie le nom de l'aliment dans la demande", () => {
    const spaced: Meal = { ...meal, items: [{ ...meal.items[0], name: '  Saumon  ' }] }
    renderDay(todayKey(), [spaced])
    fireEvent.click(screen.getByLabelText(/Actions pour/))
    fireEvent.click(screen.getByText("Je n'en ai pas"))

    expect(revise).toHaveBeenCalledWith(
      "Je n'ai pas de Saumon pour le Déjeuner. Remplace-le ; si le plat ne tient plus sans lui, repropose ce repas. Garde les autres repas à l'identique.",
    )
  })

  it("garde la feuille ouverte quand l'écriture du goût est refusée", async () => {
    addTaste.mockResolvedValue(false)
    renderDay(todayKey())
    openSheet()
    fireEvent.click(screen.getByText("J'aime"))

    expect(await screen.findByText("Ce choix n'a pas pu être enregistré. Réessayez.")).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByText("Je n'aime pas"))
    await waitFor(() => expect(addTaste).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Le remplacer maintenant')).toBeNull()
  })

  it("distingue un profil illisible d'une écriture refusée", async () => {
    addTaste.mockResolvedValue(false)
    render(
      <DashboardScreen
        activities={activities}
        addTaste={addTaste}
        coachOpen={false}
        configured
        dailyMenu={menuStore([meal])}
        day={todayKey()}
        onDayChange={vi.fn()}
        profile={DEFAULT_PROFILE}
        profileReadFailed
        readOnly={false}
      />,
    )
    openSheet()
    fireEvent.click(screen.getByText("J'aime"))

    expect(
      await screen.findByText("Votre profil n'a pas pu être lu, ce choix n'a pas été enregistré."),
    ).toBeTruthy()
  })

  it('masque le résultat de la révision sur demande', () => {
    renderDay(todayKey(), [meal], '', { reviseNotice: 'Déjeuner remplacé.', reviseId: 3 })

    fireEvent.click(screen.getByLabelText('Masquer le résultat de la révision'))

    expect(screen.queryByText('Déjeuner remplacé.')).toBeNull()
  })

  it('réaffiche une révision suivante résumée par la même phrase', () => {
    const notice = 'Menu mis à jour — déjeuner recomposé.'
    const { rerender } = render(screenOf(todayKey(), [meal], '', { reviseNotice: notice, reviseId: 3 }))
    fireEvent.click(screen.getByLabelText('Masquer le résultat de la révision'))
    expect(screen.queryByText(notice)).toBeNull()

    rerender(screenOf(todayKey(), [meal], '', { reviseNotice: notice, reviseId: 4 }))

    expect(screen.getByText(notice)).toBeTruthy()
  })

  it('oublie le masquage du résultat au changement de jour', () => {
    const notice = 'Menu mis à jour — déjeuner recomposé.'
    const { rerender } = render(screenOf(todayKey(), [meal], '', { reviseNotice: notice, reviseId: 3 }))
    fireEvent.click(screen.getByLabelText('Masquer le résultat de la révision'))

    rerender(screenOf(tomorrow, [meal], '', { reviseNotice: notice, reviseId: 3 }))
    rerender(screenOf(todayKey(), [meal], '', { reviseNotice: notice, reviseId: 3 }))

    expect(screen.getByText(notice)).toBeTruthy()
  })

  it('laisse le résultat de la révision au volet coach quand il est ouvert', () => {
    render(
      <DashboardScreen
        activities={activities}
        addTaste={addTaste}
        coachOpen
        configured
        dailyMenu={menuStore([meal], '', { reviseNotice: 'Déjeuner remplacé.' })}
        day={todayKey()}
        onDayChange={vi.fn()}
        profile={DEFAULT_PROFILE}
        profileReadFailed={false}
        readOnly={false}
      />,
    )

    expect(screen.queryByText('Déjeuner remplacé.')).toBeNull()
  })

  it("affiche le résultat et l'erreur d'une révision", () => {
    renderDay(todayKey(), [meal], '', { reviseNotice: 'Déjeuner remplacé.' })
    expect(screen.getByText('Déjeuner remplacé.')).toBeTruthy()

    cleanup()
    renderDay(todayKey(), [meal], '', { reviseError: 'Le modèle n\'a pas répondu.' })
    expect(screen.getByText("Le modèle n'a pas répondu.")).toBeTruthy()
  })
})
