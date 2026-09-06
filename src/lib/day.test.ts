import { describe, expect, it, vi } from 'vitest'
import { dayKey, dayLabel, isPast, isTomorrow, oldestKey, shiftDay, todayKey } from './day'

/** Fige l'horloge sur une date locale, pour que « aujourd'hui » soit connu. */
function at(iso: string, run: () => void) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
  try {
    run()
  } finally {
    vi.useRealTimers()
  }
}

describe('dayKey', () => {
  it("formate en AAAA-MM-JJ local, avec zéros de tête", () => {
    expect(dayKey(new Date(2026, 8, 6, 23, 30))).toBe('2026-09-06')
    expect(dayKey(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('shiftDay', () => {
  it("avance et recule d'un jour", () => {
    expect(shiftDay('2026-09-06', 1)).toBe('2026-09-07')
    expect(shiftDay('2026-09-06', -1)).toBe('2026-09-05')
  })

  it("franchit les mois et les années", () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })

  it("reste juste au passage à l'heure d'hiver", () => {
    // Nuit du 25 au 26 octobre 2026 en Europe : 25 heures dans la journée.
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftDay('2026-10-26', -1)).toBe('2026-10-25')
  })

  it("recule de 90 jours sans dérive", () => {
    expect(shiftDay('2026-09-06', -90)).toBe('2026-06-08')
  })
})

describe('bornes', () => {
  it("place la borne basse 90 jours avant aujourd'hui", () => {
    at('2026-09-06T12:00:00', () => {
      expect(todayKey()).toBe('2026-09-06')
      expect(oldestKey()).toBe('2026-06-08')
    })
  })

  it("reconnaît hier, aujourd'hui et demain", () => {
    at('2026-09-06T12:00:00', () => {
      expect(isPast('2026-09-05')).toBe(true)
      expect(isPast('2026-09-06')).toBe(false)
      expect(isTomorrow('2026-09-07')).toBe(true)
      expect(isTomorrow('2026-09-08')).toBe(false)
    })
  })
})

describe('dayLabel', () => {
  it("nomme les jours proches, date complète au-delà", () => {
    at('2026-09-06T12:00:00', () => {
      expect(dayLabel('2026-09-06')).toBe("Aujourd'hui")
      expect(dayLabel('2026-09-07')).toBe('Demain')
      expect(dayLabel('2026-09-01')).toBe('mardi 1 septembre')
    })
  })
})
