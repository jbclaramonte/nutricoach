import { useCallback, useEffect, useRef, useState } from 'react'
import { dbDelete, dbGet, dbKeys, dbSet } from '../lib/db'
import { fileToDataUrl } from '../lib/ai/images'
import { buildCoachSystemPrompt } from '../lib/ai/prompts'
import type { GeneratedMenu } from '../lib/ai/menuSchema'
import { isConfigured } from '../lib/ai/settings'
import type { AiSettings } from '../lib/ai/settings'
import type { Activity } from '../lib/activities'
import type { Profile } from '../lib/profile'
import { toOrMessages, type ChatAttachment, type ChatMessage } from '../lib/chat'
import { streamComplete } from '../lib/openrouter/client'
import { describeError } from '../lib/openrouter/errors'
import type { ORModel } from '../lib/openrouter/types'

const KEY_PREFIX = 'chat:'
// Chaque question part seule au modèle : le plafond ne borne donc que la place
// prise dans IndexedDB par l'historique affiché.
const MAX_MESSAGES = 100

/** Clé du jour : une conversation par date, au format AAAA-MM-JJ. */
function todayKey(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${KEY_PREFIX}${now.getFullYear()}-${month}-${day}`
}

/**
 * Sans ménage, le magasin accumulerait une conversation par jour indéfiniment :
 * les entrées antérieures à celle du jour sont supprimées au chargement.
 */
function purgeOldChats(currentKey: string): Promise<void> {
  return dbKeys()
    .then((keys) =>
      Promise.all(
        keys
          // « chat:messages » est l'ancien fil unique, antérieur au découpage par
          // jour. Il trie après les clés datées et échapperait à la comparaison.
          .filter(
            (key) =>
              key.startsWith(KEY_PREFIX) && (key < currentKey || key === 'chat:messages'),
          )
          .map((key) => dbDelete(key)),
      ),
    )
    .then(() => undefined)
    .catch((purgeError) => console.error('[chat] purge impossible', purgeError))
}

export type ChatState = 'idle' | 'streaming' | 'error'

export interface UseCoachChatResult {
  messages: ChatMessage[]
  state: ChatState
  /** Phrase française expliquant le dernier échec. */
  error: string
  send: (text: string, photo: File | null) => void
  stop: () => void
  clear: () => void
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Ne garde que les messages les plus récents, les plus anciens sont perdus. */
function capped(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > MAX_MESSAGES ? messages.slice(messages.length - MAX_MESSAGES) : messages
}

export function useCoachChat(
  settings: AiSettings,
  profile: Profile,
  activities: Activity[],
  todaysMenu: GeneratedMenu | null,
  models: ORModel[],
): UseCoachChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [state, setState] = useState<ChatState>('idle')
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const controller = useRef<AbortController | null>(null)
  // Miroir synchrone des messages : pendant un flux, l'updater de setMessages
  // est différé et lire son résultat tout de suite donnerait un historique vide.
  const messagesRef = useRef<ChatMessage[]>([])

  /** Unique point d'écriture des messages : garde le miroir à jour. */
  const applyMessages = useCallback(
    (next: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])) => {
      const value = typeof next === 'function' ? next(messagesRef.current) : next
      messagesRef.current = value
      setMessages(value)
      return value
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const key = todayKey()
    void purgeOldChats(key)
    dbGet<ChatMessage[]>(key)
      .then((stored) => {
        if (!cancelled && stored) applyMessages(stored)
      })
      .catch((readError) => console.error('[chat] lecture impossible', readError))
      .finally(() => {
        loaded.current = true
      })
    return () => {
      cancelled = true
      controller.current?.abort()
    }
  }, [applyMessages])

  const persist = useCallback((next: ChatMessage[]) => {
    // Tant que la lecture initiale n'a pas répondu, écrire effacerait
    // l'historique déjà enregistré.
    if (!loaded.current) return
    dbSet(todayKey(), next).catch((writeError) => console.error('[chat] écriture impossible', writeError))
  }, [])

  const send = useCallback(
    (text: string, photo: File | null) => {
      // Un second envoi pendant un flux mélangerait les deux réponses.
      if (state === 'streaming') return
      if (!isConfigured(settings)) {
        setError("Renseignez votre clé OpenRouter et un modèle dans Profil pour parler au coach.")
        setState('error')
        return
      }

      const model = models.find((entry) => entry.id === settings.modelId)
      if (photo && model && !model.supportsVision) {
        setError(
          `${model.name} ne sait pas lire les images : retirez la photo, ou choisissez un modèle vision dans Profil.`,
        )
        setState('error')
        return
      }

      setError('')
      setState('streaming')

      // Déclaré hors de la chaîne : le gestionnaire d'échec doit pouvoir
      // retrouver le tour du coach à marquer.
      const replyId = newId()

      const prepare: Promise<ChatAttachment | undefined> = photo
        ? fileToDataUrl(photo)
        : Promise.resolve(undefined)

      prepare
        .then((attachment) => {
          const userMessage: ChatMessage = {
            id: newId(),
            role: 'user',
            text,
            attachment,
            at: Date.now(),
          }
          const reply: ChatMessage = { id: replyId, role: 'assistant', text: '', at: Date.now() }

          // Chaque question est traitée seule : les tours précédents sont
          // conservés pour l'affichage mais ne repartent jamais au modèle. Le
          // prompt système porte déjà le profil, les activités et le menu du
          // jour, c'est-à-dire le contexte qui compte.
          applyMessages([...capped([...messagesRef.current, userMessage]), reply])

          const abort = new AbortController()
          controller.current = abort

          return streamComplete({
            apiKey: settings.apiKey.trim(),
            model: settings.modelId,
            messages: toOrMessages(
              buildCoachSystemPrompt(profile, activities, todaysMenu ?? undefined),
              [userMessage],
            ),
            temperature: 0.6,
            maxTokens: 1200,
            signal: abort.signal,
            onDelta: (delta) => {
              applyMessages((current) =>
                current.map((message) =>
                  message.id === replyId ? { ...message, text: message.text + delta } : message,
                ),
              )
            },
          }).then(() => {
            setState('idle')
            persist(applyMessages((current) => capped(current)))
          })
        })
        .catch((sendError) => {
          console.error('[chat] envoi impossible', sendError)
          // Le message de l'utilisateur reste à l'écran : seul le tour du coach
          // est marqué en échec.
          setError(
            sendError instanceof Error && !('kind' in sendError)
              ? sendError.message
              : describeError(sendError),
          )
          setState('error')
          persist(
            applyMessages((current) =>
              current.map((message) =>
                message.id === replyId ? { ...message, failed: true } : message,
              ),
            ),
          )
        })
        .finally(() => {
          controller.current = null
        })
    },
    [activities, applyMessages, models, persist, profile, settings, state, todaysMenu],
  )

  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setState('idle')
    persist(
      applyMessages((current) =>
        current.map((message, index) =>
          index === current.length - 1 && message.role === 'assistant'
            ? { ...message, interrupted: true }
            : message,
        ),
      ),
    )
  }, [applyMessages, persist])

  const clear = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setState('idle')
    setError('')
    applyMessages([])
    persist([])
  }, [applyMessages, persist])

  return { messages, state, error, send, stop, clear }
}
