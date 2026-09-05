import { useEffect, useRef } from 'react'
import { ChatBar } from '../ChatBar'
import { Icon } from '../Icon'
import type { ChatMessage } from '../../lib/chat'
import { MessageBubble } from './MessageBubble'

interface CoachSheetProps {
  coachName: string
  messages: ChatMessage[]
  streaming: boolean
  /** Phrase française du dernier échec, vide sinon. */
  error: string
  /** Désactive la saisie tant que la clé API n'est pas configurée. */
  configured: boolean
  /** Vrai tant que le navigateur se déclare en ligne. */
  online: boolean
  onSend: (message: string, photo: File | null) => void
  onStop: () => void
  onClear: () => void
  /** Vrai quand un menu du jour existe : sans lui, rien à réviser. */
  hasMenu: boolean
  /** Applique la dernière demande de l'utilisateur au menu du jour. */
  onApplyToMenu: (request: string) => void
  revising: boolean
  /** Phrase française du dernier échec de révision, vide sinon. */
  reviseError: string
  /** Phrase française résumant la dernière révision réussie, vide sinon. */
  reviseNotice: string
}

export function CoachSheet({
  coachName,
  messages,
  streaming,
  error,
  configured,
  online,
  onSend,
  onStop,
  onClear,
  hasMenu,
  onApplyToMenu,
  revising,
  reviseError,
  reviseNotice,
}: CoachSheetProps) {
  const bottom = useRef<HTMLDivElement>(null)

  // La révision part de ce que l'utilisateur a demandé, pas de la réponse du
  // coach : celle-ci n'est proposée que sous le dernier tour du coach.
  const last = messages[messages.length - 1]
  const lastRequest = [...messages].reverse().find((message) => message.role === 'user')?.text ?? ''
  const canApply =
    hasMenu &&
    !streaming &&
    last?.role === 'assistant' &&
    !last.failed &&
    lastRequest.trim().length > 0

  // Le flux arrive par petits morceaux : on suit le bas à chaque mise à jour.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-sm border-b border-surface-container px-margin-mobile">
        <div className="flex flex-col">
          <span className="font-headline-md text-body-md text-on-surface">{coachName}</span>
          <span className="font-caption text-caption text-on-surface-variant">
            {streaming ? 'Rédige une réponse…' : 'Votre coach nutrition'}
          </span>
        </div>
        <div className="flex items-center gap-xs">
          {messages.length > 0 && (
            <button
              aria-label="Effacer la conversation"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors active:bg-surface-container-highest"
              onClick={onClear}
              type="button"
            >
              <Icon name="delete_sweep" />
            </button>
          )}
          <button
            aria-label="Fermer la conversation"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors active:bg-surface-container-highest"
            onClick={() => {
              window.location.hash = '#/dashboard'
            }}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>

      {!online && (
        <p className="flex items-center gap-xs bg-secondary-container px-margin-mobile py-xs font-label-md text-caption text-on-secondary-container">
          <Icon className="text-body-md" name="cloud_off" />
          Hors ligne — l'historique reste lisible, l'envoi reprendra au retour du réseau.
        </p>
      )}

      <div className="flex flex-1 flex-col gap-md overflow-y-auto px-margin-mobile pb-40 pt-md">
        {messages.length === 0 && (
          <div className="m-auto flex max-w-xs flex-col items-center gap-sm text-center">
            <Icon className="text-[32px] text-primary" name="auto_awesome" />
            <p className="font-headline-md text-body-md text-on-surface">
              Posez votre première question à {coachName}
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Un doute sur un repas du jour, une envie à caser, ou la photo d'une assiette : tout
              part d'ici.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {canApply && (
          <div className="flex flex-col gap-xs self-start">
            <button
              className="flex items-center gap-xs rounded-full bg-surface-container px-md py-1 font-label-md text-caption text-primary transition-colors active:bg-surface-container-highest disabled:opacity-60"
              disabled={revising}
              onClick={() => onApplyToMenu(lastRequest)}
              type="button"
            >
              <Icon className="text-caption" name="restaurant_menu" />
              {revising ? 'Mise à jour du menu…' : 'Appliquer au menu'}
            </button>
            {reviseError && (
              <p className="font-body-md text-caption text-error">{reviseError}</p>
            )}
            {!reviseError && reviseNotice && (
              <p className="font-body-md text-caption text-on-surface-variant">{reviseNotice}</p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-error-container p-sm font-body-md text-body-md text-on-error-container">
            {error}
          </p>
        )}

        {streaming && (
          <button
            className="self-center rounded-full bg-surface-container px-md py-1 font-label-md text-caption text-on-surface-variant transition-colors active:bg-surface-container-highest"
            onClick={onStop}
            type="button"
          >
            <span className="flex items-center gap-xs">
              <Icon className="text-caption" name="stop_circle" />
              Arrêter
            </span>
          </button>
        )}

        <div ref={bottom} />
      </div>

      <ChatBar coachName={coachName} disabled={!configured || !online} onSend={onSend} />
    </div>
  )
}
