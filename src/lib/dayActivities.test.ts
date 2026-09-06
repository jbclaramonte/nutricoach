import { describe, expect, it } from 'vitest'
import { dateOfKey } from './dayActivities'
import { plannedActivitiesFor } from './schedule'

describe('dateOfKey', () => {
  it('rend une date locale à midi, pour ce jour-là', () => {
    const date = dateOfKey('2026-09-07')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(7)
  })

  it('donne au planning le bon jour de la semaine', () => {
    // Le 7 septembre 2026 est un lundi : ISO 1.
    const schedule = [
      {
        id: 'velo',
        typeId: 'cycling',
        title: 'Vélo au travail',
        time: '08:00',
        durationMin: 50,
        weekdays: [1],
      },
    ]
    const monday = plannedActivitiesFor(dateOfKey('2026-09-07'), schedule)
    const tuesday = plannedActivitiesFor(dateOfKey('2026-09-08'), schedule)
    expect(monday).toHaveLength(1)
    expect(monday[0].durationMin).toBe(50)
    expect(tuesday).toHaveLength(0)
  })
})
