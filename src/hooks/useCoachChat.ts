import { useCallback, useEffect, useRef, useState } from 'react'
import { dayLabel } from '../lib/day'
import { dbGet, dbSet } from '../lib/db'
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
  day: string,
  editable: boolean,
): UseCoachChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [state, setState] = useState<ChatState>('idle')
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const controller = useRef<AbortController | null>(null)
  // Miroir synchrone des messages : pendant un flux, l'updater de setMessages
  // est différé et lire son résultat tout de suite donnerait un historique vide.
  const messagesRef = useRef<ChatMessage[]>([])
  const [shownDay, setShownDay] = useState(day)
  // Miroir synchrone du jour affiché : un flux dure, et sa fin doit savoir hors
  // rendu si elle concerne encore la conversation à l'écran.
  const dayRef = useRef(day)

  const key = `${KEY_PREFIX}${day}`

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

  // Le jour a changé : la remise à zéro se fait pendant le rendu, pas dans un
  // effet. Différée d'une frame, la conversation de la veille resterait à
  // l'écran sous le nouveau jour, et une écriture partie entre-temps la porterait
  // sous sa clé.
  if (shownDay !== day) {
    setShownDay(day)
    // Écriture d'un miroir, idempotente et dérivée de la seule prop `day`, dans
    // le bloc d'ajustement d'état pendant le rendu : rien n'en dépend à
    // l'affichage, seuls les appels différés la relisent.
    // oxlint-disable-next-line react/refs
    dayRef.current = day
    // Le flux en cours est coupé par le nettoyage de l'effet de chargement, un
    // instant plus tard : ce qu'il rapporterait entre-temps est écarté par
    // `stale()`, pas par l'interruption.
    // La conversation du jour précédent ne fait plus autorité : celle du nouveau
    // jour doit pouvoir être relue du magasin. Même nature que ci-dessus :
    // valeur constante, réécrite à l'identique si le rendu est rejoué.
    // oxlint-disable-next-line react/refs
    loaded.current = false
    // `applyMessages` ne fait que remettre le miroir et l'état à la même valeur
    // vide : sûr à rejouer, et l'état affiché passe bien par `setMessages`.
    // oxlint-disable-next-line react/refs
    applyMessages([])
    setState('idle')
    setError('')
  }

  useEffect(() => {
    let cancelled = false
    dbGet<ChatMessage[]>(key)
      .then((stored) => {
        if (!cancelled && stored) applyMessages(stored)
      })
      .catch((readError) => console.error('[chat] lecture impossible', readError))
      .finally(() => {
        // Sans `cancelled`, la lecture du jour quitté relâcherait le verrou
        // alors que celle du nouveau jour est encore en vol : la première
        // écriture qui suit remplacerait la conversation enregistrée de ce jour.
        if (!cancelled) loaded.current = true
      })
    return () => {
      cancelled = true
      controller.current?.abort()
    }
  }, [applyMessages, key])

  const persist = useCallback(
    (next: ChatMessage[]) => {
      // Tant que la lecture initiale n'a pas répondu, écrire effacerait
      // l'historique déjà enregistré.
      if (!loaded.current) return
      dbSet(key, next).catch((writeError) => console.error('[chat] écriture impossible', writeError))
    },
    // Sans `key`, un envoi parti avant un changement de jour écrirait sa
    // conversation sous la clé de l'ancien jour.
    [key],
  )

  const send = useCallback(
    (text: string, photo: File | null) => {
      // Un jour archivé ou seulement consulté ne se modifie pas.
      if (!editable) return
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

      // Le flux dure : si le jour change entre temps, cette réponse ne concerne
      // plus la conversation à l'écran et ne doit ni s'afficher, ni s'écrire
      // sous la clé du nouveau jour. Couper le flux ne suffit pas, sa promesse
      // se résout tout de même sur ce qui est déjà arrivé.
      const stale = () => dayRef.current !== day

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
          if (stale()) return
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
              buildCoachSystemPrompt(profile, activities, dayLabel(day), todaysMenu ?? undefined),
              [userMessage],
            ),
            temperature: 0.6,
            maxTokens: 4000,
            signal: abort.signal,
            onDelta: (delta) => {
              if (stale()) return
              applyMessages((current) =>
                current.map((message) =>
                  message.id === replyId ? { ...message, text: message.text + delta } : message,
                ),
              )
            },
          }).then(({ finishReason }) => {
            if (stale()) return
            // Une fin non annoncée signale une coupure côté fournisseur : la
            // réponse est incomplète et doit être présentée comme telle plutôt
            // que de passer pour terminée.
            const cut = finishReason === null || finishReason === 'length'
            if (cut) {
              setError(
                finishReason === 'length'
                  ? 'Réponse coupée : la limite de longueur a été atteinte.'
                  : 'Réponse interrompue par le fournisseur avant la fin. Renvoyez votre question.',
              )
            }
            setState(cut ? 'error' : 'idle')
            persist(
              applyMessages((current) =>
                capped(
                  current.map((message) =>
                    cut && message.id === replyId ? { ...message, interrupted: true } : message,
                  ),
                ),
              ),
            )
          })
        })
        .catch((sendError) => {
          console.error('[chat] envoi impossible', sendError)
          if (stale()) return
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
          // Après un changement de jour, `controller` peut déjà porter le flux
          // de la nouvelle journée : l'effacer priverait `stop` de sa prise.
          if (stale()) return
          controller.current = null
        })
    },
    [activities, applyMessages, day, editable, models, persist, profile, settings, state, todaysMenu],
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
    // Un jour archivé ou seulement consulté ne se modifie pas.
    if (!editable) return
    controller.current?.abort()
    controller.current = null
    setState('idle')
    setError('')
    applyMessages([])
    persist([])
  }, [applyMessages, editable, persist])

  return { messages, state, error, send, stop, clear }
}
