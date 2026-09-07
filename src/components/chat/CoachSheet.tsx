import { useEffect, useRef, useState } from 'react'
import { ChatBar } from '../ChatBar'
import { Icon } from '../Icon'
import type { ChatMessage } from '../../lib/chat'
import { dayLabel } from '../../lib/day'
import { MessageBubble } from './MessageBubble'

/** Hauteur du volet replié, en pourcentage de la fenêtre. */
const PEEK_VH = 55
/** Hauteur du volet déployé, un bandeau restant visible au-dessus. */
const FULL_VH = 92
/** Course minimale, en pixels, au-delà de laquelle le volet change d'état. */
const SNAP_PX = 72
/** Course en deçà de laquelle le geste est traité comme un simple appui. */
const TAP_PX = 6

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
  /** Jour de la conversation, au format AAAA-MM-JJ. */
  day: string
  /** Vrai pour un jour révolu : la conversation se relit, ne se poursuit pas. */
  readOnly: boolean
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
  day,
  readOnly,
}: CoachSheetProps) {
  const bottom = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  // Décalage vertical du geste en cours, en pixels ; 0 hors glissement.
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<number | null>(null)
  // Un glissement se termine aussi par un clic : sans ce garde-fou, l'appui
  // simulé rebasculerait aussitôt l'état que le geste vient de choisir.
  const moved = useRef(false)

  // La révision part de ce que l'utilisateur a demandé, pas de la réponse du
  // coach : celle-ci n'est proposée que sous le dernier tour du coach.
  const last = messages[messages.length - 1]
  const lastRequestIndex = messages.map((message) => message.role).lastIndexOf('user')
  const lastRequest = lastRequestIndex >= 0 ? messages[lastRequestIndex].text : ''
  const canApply =
    hasMenu &&
    !readOnly &&
    !streaming &&
    last?.role === 'assistant' &&
    !last.failed &&
    lastRequest.trim().length > 0

  // Replié, le volet ne montre que l'échange en cours : la question posée et sa
  // réponse. Les tours antérieurs n'apparaissent qu'une fois déployé.
  const currentStart = lastRequestIndex >= 0 ? lastRequestIndex : 0
  const previous = expanded ? messages.slice(0, currentStart) : []
  const current = messages.slice(currentStart)

  // Le flux arrive par petits morceaux : on suit le bas à chaque mise à jour,
  // sauf si l'utilisateur a lui-même remonté la conversation.
  useEffect(() => {
    const node = list.current
    if (node && node.scrollHeight - node.scrollTop - node.clientHeight > 120) return
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, expanded])

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    dragStart.current = event.clientY
    moved.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragStart.current === null) return
    const delta = event.clientY - dragStart.current
    if (Math.abs(delta) > TAP_PX) moved.current = true
    // Le volet ne dépasse jamais ses deux positions : vers le haut quand il est
    // replié, vers le bas quand il est déployé.
    setDrag(expanded ? Math.max(0, delta) : Math.min(0, delta))
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragStart.current === null) return
    const delta = event.clientY - dragStart.current
    dragStart.current = null
    setDrag(0)
    if (Math.abs(delta) < SNAP_PX) return
    setExpanded(delta < 0)
  }

  const height = expanded ? FULL_VH : PEEK_VH

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Fermer la conversation"
        className="absolute inset-0 h-full w-full bg-black/30"
        onClick={() => {
          window.location.hash = '#/dashboard'
        }}
        type="button"
      />

      <section
        className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl bg-background shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
        style={{
          height: `${height}vh`,
          transform: `translateY(${drag}px)`,
          transition: drag === 0 ? 'height 200ms ease, transform 200ms ease' : 'none',
        }}
      >
        <button
          aria-expanded={expanded}
          aria-label={expanded ? 'Replier la conversation' : 'Déployer la conversation'}
          className="flex shrink-0 touch-none flex-col items-center gap-xs pb-xs pt-sm"
          onClick={() => {
            if (moved.current) return
            setExpanded((value) => !value)
          }}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          type="button"
        >
          <span className="h-1 w-10 rounded-full bg-surface-container-highest" />
        </button>

        <header className="flex shrink-0 items-center justify-between gap-sm border-b border-surface-container px-margin-mobile pb-sm">
          <div className="flex flex-col">
            <span className="font-headline-md text-body-md text-on-surface">{coachName}</span>
            <span className="font-caption text-caption text-on-surface-variant">
              {streaming ? 'Rédige une réponse…' : `Votre coach nutrition — ${dayLabel(day).toLowerCase()}`}
            </span>
          </div>
          <div className="flex items-center gap-xs">
            {messages.length > 0 && !readOnly && (
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
          <p className="flex shrink-0 items-center gap-xs bg-secondary-container px-margin-mobile py-xs font-label-md text-caption text-on-secondary-container">
            <Icon className="text-body-md" name="cloud_off" />
            Hors ligne — l'historique reste lisible, l'envoi reprendra au retour du réseau.
          </p>
        )}

        <div
          className="flex flex-1 flex-col gap-md overflow-y-auto px-margin-mobile pb-40 pt-md"
          ref={list}
        >
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

          {previous.length > 0 && (
            <>
              <p className="flex items-center gap-sm font-caption text-caption text-on-surface-variant">
                <span className="h-px flex-1 bg-surface-container" />
                Échanges précédents — non transmis au coach
                <span className="h-px flex-1 bg-surface-container" />
              </p>
              {previous.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <span className="h-px bg-surface-container" />
            </>
          )}

          {current.map((message) => (
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
              {reviseError && <p className="font-body-md text-caption text-error">{reviseError}</p>}
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

          {readOnly && (
            <p className="flex items-center gap-xs rounded-xl bg-surface-container p-sm font-body-md text-caption text-on-surface-variant">
              <Icon className="text-body-md" name="history" />
              Journée archivée — consultation seule.
            </p>
          )}

          <div ref={bottom} />
        </div>

        <ChatBar disabled={!configured || !online || readOnly} onSend={onSend} />
      </section>
    </div>
  )
}
