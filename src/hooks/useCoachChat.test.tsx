import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shiftDay, todayKey } from '../lib/day'
import type { AiSettings } from '../lib/ai/settings'
import { DEFAULT_PROFILE, type Profile } from '../lib/profile'
import type { ChatMessage } from '../lib/chat'
import { useCoachChat } from './useCoachChat'

vi.mock('../lib/openrouter/client', () => ({
  streamComplete: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn(),
  dbDelete: vi.fn(),
}))

const { dbGet, dbSet } = await import('../lib/db')
const { streamComplete } = await import('../lib/openrouter/client')
const get = vi.mocked(dbGet)
const set = vi.mocked(dbSet)
const stream = vi.mocked(streamComplete)

const yesterday = shiftDay(todayKey(), -1)
const tomorrow = shiftDay(todayKey(), 1)

const settings: AiSettings = { apiKey: 'sk-test', modelId: 'test/model', updatedAt: 0 }
const profile: Profile = DEFAULT_PROFILE

/** Conversation minimale enregistrée, nommée pour être reconnaissable. */
function storedChat(text: string): ChatMessage[] {
  return [{ id: 'msg-1', role: 'user', text, at: 0 }]
}

function render(day: string, editable: boolean) {
  return renderHook(() => useCoachChat(settings, profile, [], null, [], day, editable))
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(undefined)
  set.mockResolvedValue(undefined)
  // Le modèle répond toujours : sans cela, un envoi non gardé échouerait de
  // lui-même et un test d'écriture passerait pour la mauvaise raison.
  stream.mockResolvedValue({ text: 'Bonjour', finishReason: 'stop' })
})

describe('useCoachChat', () => {
  it("n'écrit ni n'envoie rien quand le jour n'est pas éditable", async () => {
    get.mockResolvedValue(storedChat('Hier'))
    const { result } = render(yesterday, false)
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    await act(async () => {
      result.current.send('et aujourd’hui ?', null)
      result.current.clear()
    })
    expect(stream).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(1)
  })

  it("n'emporte pas la conversation de la veille en changeant de jour", async () => {
    get.mockImplementation((key: string) =>
      key === `chat:${yesterday}`
        ? Promise.resolve(storedChat('Question d’hier'))
        : // La lecture du nouveau jour reste en vol : c'est la fenêtre où une
          // écriture porterait la conversation d'hier sous la clé d'aujourd'hui.
          new Promise(() => {}),
    )
    const { result, rerender } = renderHook(
      ({ day }) => useCoachChat(settings, profile, [], null, [], day, true),
      { initialProps: { day: yesterday } },
    )
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    rerender({ day: todayKey() })
    expect(result.current.messages).toEqual([])
    expect(set).not.toHaveBeenCalled()
  })

  it("n'affiche pas un flux revenu après un changement de jour", async () => {
    // La réponse du modèle est retenue : c'est la fenêtre où la réponse de
    // demain reviendrait sur la journée d'aujourd'hui, puis s'écrirait sous sa clé.
    let answer!: () => void
    stream.mockImplementation(
      ({ onDelta }) =>
        new Promise((resolve) => {
          answer = () => {
            onDelta('Réponse de DEMAIN')
            resolve({ text: 'Réponse de DEMAIN', finishReason: 'stop' })
          }
        }),
    )
    const { result, rerender } = renderHook(
      ({ day }) => useCoachChat(settings, profile, [], null, [], day, true),
      { initialProps: { day: tomorrow } },
    )
    await waitFor(() => expect(get).toHaveBeenCalledWith(`chat:${tomorrow}`))
    act(() => {
      result.current.send('quel dîner ?', null)
    })
    await waitFor(() => expect(stream).toHaveBeenCalled())

    rerender({ day: todayKey() })
    // La lecture du nouveau jour a répondu : l'écriture n'est plus retenue par
    // le verrou de chargement, seule la garde de jour protège encore.
    await act(async () => {})
    await act(async () => {
      answer()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.state).toBe('idle')
    // Aucune écriture du tout : sous la clé de demain, ce flux coupé passerait
    // pour la conversation complète de la journée.
    expect(set).not.toHaveBeenCalled()
  })
})
