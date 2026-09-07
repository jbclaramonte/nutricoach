import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROFILE, type Profile } from '../lib/profile'
import { useProfile } from './useProfile'

vi.mock('../lib/db', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn(),
  dbDelete: vi.fn(),
}))

const { dbGet, dbSet } = await import('../lib/db')
const get = vi.mocked(dbGet)
const set = vi.mocked(dbSet)

const stored: Profile = {
  ...DEFAULT_PROFILE,
  favorites: ['Saumon'],
  dislikes: ['Coriandre'],
}

/** Dernier profil réellement écrit dans le magasin. */
function written(): Profile {
  return set.mock.calls[set.mock.calls.length - 1][1] as Profile
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(stored)
  set.mockResolvedValue(undefined)
})

describe('useProfile.addTaste', () => {
  it('ajoute un aliment aux favoris et enregistre le profil obtenu', async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Avocat'))

    expect(result.current.profile.favorites).toEqual(['Saumon', 'Avocat'])
    expect(written().favorites).toEqual(['Saumon', 'Avocat'])
    await waitFor(() => expect(result.current.saveState).toBe('saved'))
  })

  it('ajoute un aliment aux aliments rejetés et enregistre le profil obtenu', async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('dislikes', 'Céleri'))

    expect(result.current.profile.dislikes).toEqual(['Coriandre', 'Céleri'])
    expect(written().dislikes).toEqual(['Coriandre', 'Céleri'])
  })

  it('ignore un aliment déjà présent, même écrit autrement', async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Saumon'))
    act(() => result.current.addTaste('favorites', '  saumon '))

    expect(result.current.profile.favorites).toEqual(['Saumon'])
    expect(set).not.toHaveBeenCalled()
  })

  it("retire l'aliment de la liste opposée", async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'coriandre'))

    expect(result.current.profile.favorites).toEqual(['Saumon', 'coriandre'])
    expect(result.current.profile.dislikes).toEqual([])
    expect(written().dislikes).toEqual([])
  })

  it("n'écrit rien tant que la lecture initiale n'a pas répondu", () => {
    // Sinon le profil enregistré serait écrasé par les valeurs par défaut.
    get.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useProfile())

    act(() => result.current.addTaste('favorites', 'Betterave'))

    expect(set).not.toHaveBeenCalled()
    expect(result.current.profile.favorites).toEqual(DEFAULT_PROFILE.favorites)
  })

  it('passe en erreur quand le magasin refuse l’écriture', async () => {
    set.mockRejectedValue(new Error('quota'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Avocat'))

    await waitFor(() => expect(result.current.saveState).toBe('error'))
  })

  it("stocke l'aliment sans ses espaces de bord", async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', '  Avocat '))

    expect(result.current.profile.favorites).toEqual(['Saumon', 'Avocat'])
    expect(written().favorites).toEqual(['Saumon', 'Avocat'])
  })

  it("n'affiche pas d'erreur quand une écriture doublée échoue après la bonne", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let failFirst: (reason: Error) => void = () => {}
    set.mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)))
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Avocat'))
    act(() => result.current.addTaste('dislikes', 'Céleri'))
    await waitFor(() => expect(result.current.saveState).toBe('saved'))

    await act(async () => {
      failFirst(new Error('quota'))
    })
    expect(result.current.saveState).toBe('saved')
  })
})

describe('useProfile.save', () => {
  it('écrit les deux modifications enchaînées avant la sauvegarde', async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.update({ age: 31 })
      result.current.update({ weightKg: 70 })
      result.current.save()
    })

    expect(written().age).toBe(31)
    expect(written().weightKg).toBe(70)
  })
})
