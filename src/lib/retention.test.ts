import { describe, expect, it } from 'vitest'
import { expiredKeys } from './retention'

describe('expiredKeys', () => {
  const oldest = '2026-06-08'

  it('garde les journées dans la fenêtre', () => {
    const keys = ['menu:2026-06-08', 'activities:2026-09-06', 'chat:2026-09-07']
    expect(expiredKeys(keys, oldest)).toEqual([])
  })

  it('supprime les journées antérieures à la fenêtre', () => {
    const keys = ['menu:2026-06-07', 'activities:2026-01-02', 'chat:2026-06-08']
    expect(expiredKeys(keys, oldest)).toEqual(['menu:2026-06-07', 'activities:2026-01-02'])
  })

  it('supprime les clés héritées sans date', () => {
    expect(expiredKeys(['activities:today', 'chat:messages'], oldest)).toEqual([
      'activities:today',
      'chat:messages',
    ])
  })

  it('ne touche pas aux clés étrangères aux journées', () => {
    const keys = ['profile', 'ai:settings', 'models:catalog', 'schedule']
    expect(expiredKeys(keys, oldest)).toEqual([])
  })
})
