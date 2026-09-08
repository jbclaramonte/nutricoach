import { useEffect } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDay, todayKey } from '../lib/day'
import type { AiSettings } from '../lib/ai/settings'
import type { GeneratedMenu } from '../lib/ai/menuSchema'
import { DEFAULT_PROFILE, type Profile } from '../lib/profile'
import { useDailyMenu, type UseDailyMenuResult } from './useDailyMenu'

vi.mock('../lib/openrouter/client', () => ({
  complete: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn(),
  dbDelete: vi.fn(),
}))

const { dbGet, dbSet } = await import('../lib/db')
const { complete } = await import('../lib/openrouter/client')
const get = vi.mocked(dbGet)
const set = vi.mocked(dbSet)
const ask = vi.mocked(complete)

const yesterday = shiftDay(todayKey(), -1)
const tomorrow = shiftDay(todayKey(), 1)

const settings: AiSettings = { apiKey: 'sk-test', modelId: 'test/model', updatedAt: 0 }
const profile: Profile = DEFAULT_PROFILE

/** Menu minimal enregistré, nommé pour être reconnaissable dans les rendus. */
function storedMenu(banner: string) {
  const menu: GeneratedMenu = {
    date: banner,
    banner,
    meals: [
      {
        slot: 'lunch',
        slotLabel: 'Déjeuner',
        time: '12:30',
        title: 'Poulet et riz',
        items: [{ name: 'Riz', quantity: '150g', calories: 200, protein: 4, fiber: 1 }],
        rationale: 'Repas simple.',
      },
    ],
  }
  return { generatedAt: Date.now(), modelId: settings.modelId, menu, eatenIds: [] }
}

function render(day: string, editable: boolean) {
  return renderHook(() => useDailyMenu(settings, profile, true, [], [], day, editable))
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(undefined)
  set.mockResolvedValue(undefined)
  // Le modèle répond toujours : sans cela, un appel non gardé échouerait de
  // lui-même et un test d'écriture passerait pour la mauvaise raison.
  ask.mockResolvedValue(JSON.stringify(storedMenu('Réponse du modèle').menu))
})

describe('useDailyMenu', () => {
  it("n'écrit rien quand le jour n'est pas éditable", async () => {
    get.mockResolvedValue(storedMenu('Hier'))
    const { result } = render(yesterday, false)
    await waitFor(() => expect(result.current.menu).not.toBeNull())

    await act(async () => {
      result.current.generate()
      result.current.toggleEaten(result.current.meals[0].id)
      await result.current.revise('plus de légumes')
    })
    expect(ask).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it('change d\'identifiant à chaque révision, même résumée pareil', async () => {
    get.mockResolvedValue(storedMenu("Aujourd'hui"))
    const { result } = render(todayKey(), true)
    await waitFor(() => expect(result.current.menu).not.toBeNull())

    await act(async () => {
      await result.current.revise('plus de légumes')
    })
    const first = result.current.reviseId
    expect(result.current.reviseNotice).not.toBe('')

    await act(async () => {
      await result.current.revise('plus de légumes')
    })

    expect(result.current.reviseNotice).not.toBe('')
    expect(result.current.reviseId).not.toBe(first)
  })

  it('ne coche pas un repas hors du jour vécu', async () => {
    get.mockResolvedValue(storedMenu('Demain'))
    // Le jour à venir est éditable — on y génère son menu — mais un repas
    // n'y est pas encore pris.
    const { result } = render(tomorrow, true)
    await waitFor(() => expect(result.current.menu).not.toBeNull())

    act(() => {
      result.current.toggleEaten(result.current.meals[0].id)
    })
    expect(set).not.toHaveBeenCalled()
    expect(result.current.meals[0].eaten).toBe(false)
  })

  it('lit le menu sous la clé du jour demandé', async () => {
    render(tomorrow, true)
    await waitFor(() => expect(get).toHaveBeenCalledWith(`menu:${tomorrow}`))
  })

  it("n'emporte pas le menu de la veille en changeant de jour", async () => {
    get.mockImplementation((key: string) =>
      key === `menu:${yesterday}`
        ? Promise.resolve(storedMenu('Hier'))
        : // La lecture du nouveau jour reste en vol : c'est la fenêtre où une
          // écriture porterait le menu d'hier sous la clé d'aujourd'hui.
          new Promise(() => {}),
    )
    // Seuls les rendus effectivement affichés comptent : c'est sur ceux-là que
    // l'utilisateur peut appuyer.
    const committed: UseDailyMenuResult[] = []
    const { result, rerender } = renderHook(
      ({ day, editable }) => {
        const store = useDailyMenu(settings, profile, true, [], [], day, editable)
        useEffect(() => {
          committed.push(store)
        })
        return store
      },
      { initialProps: { day: yesterday, editable: false } },
    )
    await waitFor(() => expect(result.current.menu).not.toBeNull())

    const mark = committed.length
    rerender({ day: todayKey(), editable: true })
    const afterSwitch = committed[mark]
    expect(afterSwitch.menu).toBeNull()
    expect(afterSwitch.meals).toEqual([])
    act(() => {
      afterSwitch.toggleEaten('repas-1')
    })
    expect(set).not.toHaveBeenCalled()
  })
  it("n'affiche pas une génération revenue après un changement de jour", async () => {
    // La réponse du modèle est retenue : c'est la fenêtre où le menu de demain
    // reviendrait sur la journée d'aujourd'hui, puis s'écrirait sous sa clé.
    let answer!: (raw: string) => void
    ask.mockImplementation(() => new Promise<string>((resolve) => (answer = resolve)))
    const { result, rerender } = renderHook(
      ({ day }) => useDailyMenu(settings, profile, true, [], [], day, true),
      { initialProps: { day: tomorrow } },
    )
    await waitFor(() => expect(get).toHaveBeenCalled())
    act(() => {
      result.current.generate()
    })
    await waitFor(() => expect(ask).toHaveBeenCalled())

    rerender({ day: todayKey() })
    await act(async () => {
      answer(JSON.stringify(storedMenu('Menu de DEMAIN').menu))
    })

    expect(result.current.menu).toBeNull()
    expect(result.current.state).toBe('idle')
    expect(set).not.toHaveBeenCalled()
  })

  it("n'affiche pas une révision revenue après un changement de jour", async () => {
    get.mockImplementation((key: string) =>
      key === `menu:${tomorrow}` ? Promise.resolve(storedMenu('Menu de DEMAIN')) : Promise.resolve(undefined),
    )
    let answer!: (raw: string) => void
    ask.mockImplementation(() => new Promise<string>((resolve) => (answer = resolve)))
    const { result, rerender } = renderHook(
      ({ day }) => useDailyMenu(settings, profile, true, [], [], day, true),
      { initialProps: { day: tomorrow } },
    )
    await waitFor(() => expect(result.current.menu).not.toBeNull())
    let revision!: Promise<void>
    act(() => {
      revision = result.current.revise('plus de légumes')
    })
    await waitFor(() => expect(ask).toHaveBeenCalled())

    rerender({ day: todayKey() })
    await act(async () => {
      answer(JSON.stringify(storedMenu('Menu RÉVISÉ de demain').menu))
      await revision
    })

    expect(result.current.menu).toBeNull()
    expect(result.current.reviseNotice).toBe('')
    expect(result.current.reviseState).toBe('idle')
    expect(set).not.toHaveBeenCalled()
  })
  it('garde les repas absents de la révision', async () => {
    const stored = storedMenu('Journée complète')
    stored.menu.meals.push({
      slot: 'dinner',
      slotLabel: 'Dîner',
      time: '19:30',
      title: 'Soupe',
      items: [{ name: 'Potiron', quantity: '300g', calories: 150, protein: 3, fiber: 5 }],
      rationale: '',
    })
    get.mockResolvedValue(stored)
    // Le modèle ne renvoie que le repas touché, malgré la consigne : le dîner
    // ne doit pas disparaître de la journée pour autant.
    ask.mockResolvedValue(
      JSON.stringify({
        date: 'Journée complète',
        banner: 'Journée complète',
        meals: [
          {
            slot: 'lunch',
            slotLabel: 'Déjeuner',
            time: '12:30',
            title: 'Poulet et quinoa',
            items: [{ name: 'Quinoa', quantity: '150g', calories: 200, protein: 6, fiber: 3 }],
            rationale: '',
          },
        ],
      }),
    )
    const { result } = render(todayKey(), true)
    await waitFor(() => expect(result.current.menu).not.toBeNull())

    await act(async () => {
      await result.current.revise("je n'ai pas de riz")
    })

    expect(result.current.menu?.meals.map((meal) => meal.title)).toEqual([
      'Poulet et quinoa',
      'Soupe',
    ])
  })
})
