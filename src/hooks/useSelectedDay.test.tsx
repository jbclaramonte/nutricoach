import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shiftDay, todayKey } from '../lib/day'
import { useSelectedDay } from './useSelectedDay'

/** Fait passer minuit : le jour réel avance d'un cran. */
function advanceOneDay() {
  vi.setSystemTime(new Date(shiftDay(todayKey(), 1) + 'T09:00:00'))
}

/** Revient au premier plan, seul déclencheur du suivi. */
function returnToForeground() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useSelectedDay', () => {
  it("ouvre sur aujourd'hui", () => {
    const { result } = renderHook(() => useSelectedDay())

    expect(result.current[0]).toBe(todayKey())
  })

  it("renomme la sélection qui valait « aujourd'hui » quand le jour a tourné", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSelectedDay())
    const opened = result.current[0]

    advanceOneDay()
    returnToForeground()

    expect(result.current[0]).not.toBe(opened)
    expect(result.current[0]).toBe(todayKey())
  })

  it('laisse en place un jour passé choisi à la main', () => {
    const { result } = renderHook(() => useSelectedDay())
    const yesterday = shiftDay(todayKey(), -1)
    act(() => {
      result.current[1](yesterday)
    })

    returnToForeground()

    expect(result.current[0]).toBe(yesterday)
  })

  it("laisse en place hier choisi à la main, même après le passage d'un jour", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSelectedDay())
    const chosen = shiftDay(todayKey(), -1)
    act(() => {
      result.current[1](chosen)
    })

    advanceOneDay()
    returnToForeground()

    expect(result.current[0]).toBe(chosen)
  })
})
