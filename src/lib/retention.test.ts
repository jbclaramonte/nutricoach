import { describe, expect, it, vi, beforeEach } from 'vitest'
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
    expect(expiredKeys(['chat:messages'], '2026-06-08')).toEqual(['chat:messages'])
  })

  it('ne touche pas aux clés étrangères aux journées', () => {
    const keys = ['profile', 'ai:settings', 'models:catalog', 'schedule']
    expect(expiredKeys(keys, oldest)).toEqual([])
  })
})

vi.mock('./db')
vi.mock('./day')

describe('purgeExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supprime les clés expirées et ne touche ni aux clés étrangères ni à activities:today', async () => {
    const { dbKeys, dbDelete } = await import('./db')
    const { oldestKey } = await import('./day')
    const { purgeExpired } = await import('./retention')

    const mockKeys = [
      'menu:2026-06-07',
      'activities:2026-01-02',
      'chat:2026-06-08',
      'chat:messages',
      'profile',
      'ai:settings',
      'models:catalog',
      'schedule',
      'activities:today',
    ]

    const deletedKeys: string[] = []

    vi.mocked(dbKeys).mockResolvedValue(mockKeys)
    vi.mocked(dbDelete).mockImplementation((key: string) => {
      deletedKeys.push(key)
      return Promise.resolve()
    })
    vi.mocked(oldestKey).mockReturnValue('2026-06-08')

    await purgeExpired()

    // Seules les clés expirées et 'chat:messages' doivent être supprimées
    expect(deletedKeys).toEqual([
      'menu:2026-06-07',
      'activities:2026-01-02',
      'chat:messages',
    ])

    // Vérifier qu'aucune clé étrangère ni 'activities:today' n'a été supprimée
    expect(deletedKeys).not.toContain('profile')
    expect(deletedKeys).not.toContain('ai:settings')
    expect(deletedKeys).not.toContain('models:catalog')
    expect(deletedKeys).not.toContain('schedule')
    expect(deletedKeys).not.toContain('activities:today')
  })
})
