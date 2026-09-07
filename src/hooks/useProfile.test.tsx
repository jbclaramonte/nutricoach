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

    let accepted = true
    act(() => {
      accepted = result.current.addTaste('favorites', 'Betterave')
    })

    expect(accepted).toBe(false)
    expect(set).not.toHaveBeenCalled()
    expect(result.current.profile.favorites).toEqual(DEFAULT_PROFILE.favorites)
  })

  it("n'écrit rien après un échec de la lecture initiale", async () => {
    // Le profil affiché est celui par défaut : l'écrire remplacerait le poids,
    // les allergies et les objectifs enregistrés par ces valeurs-là.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    get.mockRejectedValue(new Error('IndexedDB indisponible'))
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.readFailed).toBe(true))

    let accepted = true
    act(() => {
      accepted = result.current.addTaste('favorites', 'Betterave')
    })

    expect(accepted).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it("ne persiste pas le brouillon non enregistré de l'écran Profil", async () => {
    // Un poids tapé puis abandonné ne doit pas partir en base parce que
    // l'utilisateur a touché un aliment depuis le menu.
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.update({ weightKg: 90 }))
    act(() => result.current.addTaste('favorites', 'Avocat'))

    expect(written().weightKg).toBe(stored.weightKg)
    expect(written().favorites).toEqual(['Saumon', 'Avocat'])
    // Le brouillon reste à l'écran, goût compris.
    expect(result.current.profile.weightKg).toBe(90)
    expect(result.current.profile.favorites).toEqual(['Saumon', 'Avocat'])
  })

  it("n'annule pas un enregistrement encore en vol", async () => {
    // Le goût part du profil que save() vient d'écrire, pas de celui d'avant :
    // sinon l'enregistrement explicite de l'utilisateur serait défait.
    let finishSave: () => void = () => {}
    set.mockImplementationOnce(() => new Promise((resolve) => (finishSave = () => resolve())))
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.update({ weightKg: 90 })
      result.current.save()
    })
    act(() => result.current.addTaste('favorites', 'Avocat'))
    await act(async () => {
      finishSave()
    })

    expect(written().weightKg).toBe(90)
    expect(written().favorites).toEqual(['Saumon', 'Avocat'])
  })

  it('ne perd pas le premier goût quand deux actions se suivent', async () => {
    let finishFirst: () => void = () => {}
    set.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = () => resolve())))
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Avocat'))
    act(() => result.current.addTaste('favorites', 'Kiwi'))
    await act(async () => {
      finishFirst()
    })

    expect(written().favorites).toEqual(['Saumon', 'Avocat', 'Kiwi'])
    expect(result.current.profile.favorites).toEqual(['Saumon', 'Avocat', 'Kiwi'])
  })

  it('revient au profil enregistré quand une écriture échoue', async () => {
    // Sinon le goût rejeté par la base servirait de base à l'action suivante,
    // qui l'écrirait alors qu'il n'a jamais été enregistré.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    set.mockRejectedValueOnce(new Error('quota'))
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Avocat'))
    await waitFor(() => expect(result.current.saveState).toBe('error'))
    act(() => result.current.addTaste('favorites', 'Kiwi'))

    expect(written().favorites).toEqual(['Saumon', 'Kiwi'])
  })

  it("ne recule pas le profil enregistré quand une écriture périmée échoue", async () => {
    // L'échec tardif de la première écriture ne dit rien de la base : la
    // seconde a réussi depuis, et c'est elle qui fait foi.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let failFirst: (reason: Error) => void = () => {}
    set.mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)))
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => result.current.addTaste('favorites', 'Avocat'))
    act(() => result.current.addTaste('favorites', 'Kiwi'))
    await act(async () => {
      failFirst(new Error('quota'))
    })
    act(() => result.current.addTaste('favorites', 'Mangue'))

    expect(written().favorites).toEqual(['Saumon', 'Avocat', 'Kiwi', 'Mangue'])
  })

  it('renvoie true quand le goût est pris en compte', async () => {
    const { result } = renderHook(() => useProfile())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    let added = false
    let duplicate = false
    act(() => {
      added = result.current.addTaste('favorites', 'Avocat')
      duplicate = result.current.addTaste('favorites', 'Saumon')
    })

    expect(added).toBe(true)
    expect(duplicate).toBe(true)
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
