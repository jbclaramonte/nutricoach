import { useEffect } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultActivities } from '../data/dashboard'
import { dateOfKey, shiftDay, todayKey } from '../lib/day'
import type { RecurringActivity } from '../lib/schedule'
import { useActivities, type UseActivitiesResult } from './useActivities'

vi.mock('../lib/db', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn(),
  dbDelete: vi.fn(),
}))

const { dbGet, dbSet } = await import('../lib/db')
const get = vi.mocked(dbGet)
const set = vi.mocked(dbSet)

const yesterday = shiftDay(todayKey(), -1)
const tomorrow = shiftDay(todayKey(), 1)

/** Une habitude tombant sur le jour visé, pour peupler les propositions. */
function scheduleOn(day: string): RecurringActivity[] {
  const weekday = dateOfKey(day).getDay() || 7
  return [
    {
      id: 'velo',
      typeId: 'bike',
      title: 'Vélo au travail',
      time: '08:00',
      durationMin: 50,
      weekdays: [weekday],
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(undefined)
  set.mockResolvedValue(undefined)
})

describe('useActivities', () => {
  it("n'écrit rien quand le jour n'est pas éditable", async () => {
    get.mockResolvedValue({
      activities: [{ id: 'course', time: '18:00', typeId: 'run', title: 'Course', durationMin: 30 }],
      dismissedPlannedIds: [],
    })
    const { result } = renderHook(() => useActivities(scheduleOn(yesterday), true, yesterday, false))
    await waitFor(() => expect(result.current.activities.length).toBeGreaterThan(0))

    act(() => {
      result.current.add({ id: 'x', time: '19:00', typeId: 'run', title: 'Ajout', durationMin: 10 })
      result.current.remove('course')
      result.current.confirm(result.current.activities[1].id)
    })
    expect(set).not.toHaveBeenCalled()
  })

  it("n'affiche la démo qu'aujourd'hui", async () => {
    const { result } = renderHook(() => useActivities([], true, yesterday, false))
    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(result.current.activities).toEqual([])

    const today = renderHook(() => useActivities([], true, todayKey(), true))
    await waitFor(() => expect(today.result.current.activities).toHaveLength(defaultActivities.length))
  })

  it('rend les propositions du planning pour un jour futur, sans rien écrire', async () => {
    const { result } = renderHook(() => useActivities(scheduleOn(tomorrow), true, tomorrow, false))
    await waitFor(() => expect(result.current.activities).toHaveLength(1))
    expect(result.current.activities[0].planned).toBe(true)
    expect(set).not.toHaveBeenCalled()
  })

  it('ne propose rien tant que la journée est en cours de lecture', () => {
    // Sinon une habitude déjà confirmée ce jour-là repasserait en proposition
    // le temps de la lecture, et un appui dans cet intervalle la doublerait.
    get.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useActivities(scheduleOn(tomorrow), true, tomorrow, false))
    expect(result.current.activities).toEqual([])
  })

  it("n'emporte pas la journée précédente en changeant de jour", async () => {
    const hier = {
      activities: [{ id: 'course', time: '18:00', typeId: 'run', title: 'Course', durationMin: 30 }],
      dismissedPlannedIds: [],
    }
    get.mockImplementation((key: string) =>
      key === `activities:${yesterday}`
        ? Promise.resolve(hier)
        : // La lecture du nouveau jour reste en vol : c'est la fenêtre où une
          // écriture porterait les données d'hier sous la clé d'aujourd'hui.
          new Promise(() => {}),
    )
    // Seuls les rendus effectivement affichés comptent : c'est sur ceux-là que
    // l'utilisateur peut appuyer.
    const committed: UseActivitiesResult[] = []
    const { result, rerender } = renderHook(
      ({ day, editable }) => {
        const store = useActivities([], true, day, editable)
        useEffect(() => {
          committed.push(store)
        })
        return store
      },
      { initialProps: { day: yesterday, editable: false } },
    )
    await waitFor(() => expect(result.current.activities).toHaveLength(1))

    const mark = committed.length
    rerender({ day: todayKey(), editable: true })
    const afterSwitch = committed[mark]
    expect(afterSwitch.activities).toEqual([])
    act(() => {
      afterSwitch.add({ id: 'x', time: '19:00', typeId: 'run', title: 'Ajout', durationMin: 10 })
    })
    expect(set).not.toHaveBeenCalled()
  })
})
