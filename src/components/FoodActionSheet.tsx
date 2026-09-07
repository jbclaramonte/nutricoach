import { useEffect, useId, useRef } from 'react'
import type { FoodItem } from '../types'
import { Icon } from './Icon'

interface FoodActionSheetProps {
  food: FoodItem
  /** Libellé du repas d'où vient l'aliment : « Déjeuner ». */
  mealLabel: string
  onLike: () => void
  onDislike: () => void
  onMissing: () => void
  onClose: () => void
  /** Vrai après un rejet : la feuille propose alors de remplacer l'aliment. */
  replaceOffered: boolean
  onReplace: () => void
  /** Renseigné quand le goût n'a pas pu être enregistré ; la feuille reste ouverte. */
  tasteError?: string
}

interface Action {
  icon: string
  label: string
  /** Ce que l'action change, dit à l'utilisateur avant qu'il ne la déclenche. */
  consequence: string
  onClick: () => void
}

export function FoodActionSheet({
  food,
  mealLabel,
  onLike,
  onDislike,
  onMissing,
  onClose,
  replaceOffered,
  onReplace,
  tasteError = '',
}: FoodActionSheetProps) {
  const first = useRef<HTMLButtonElement>(null)
  const confirmation = useRef<HTMLParagraphElement>(null)
  const sheet = useRef<HTMLElement>(null)
  const titleId = useId()

  // Déclaré avant le déplacement du focus : sinon la feuille se prendrait
  // elle-même pour point de départ. La ligne d'origine est démontée avec la
  // feuille : sans cette restitution, la
  // navigation au clavier repartirait du haut du document.
  useEffect(() => {
    const origin = document.activeElement
    return () => {
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus()
    }
  }, [])

  // Sans cela le focus resterait sur la ligne du tableau, derrière le voile.
  // Le rejet enregistré n'apparaît que dans la confirmation : c'est elle qu'il
  // faut lire, pas le bouton qui la suit.
  useEffect(() => {
    if (replaceOffered) confirmation.current?.focus()
    else first.current?.focus()
  }, [replaceOffered])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      // Les commandes restées derrière le voile sont encore focusables : le Tab
      // tourne donc en boucle dans la feuille plutôt que d'y aboutir.
      const stops = sheet.current?.querySelectorAll('button')
      if (!stops || stops.length === 0) return
      const edge = event.shiftKey ? stops[0] : stops[stops.length - 1]
      if (document.activeElement !== edge && sheet.current?.contains(document.activeElement)) return
      event.preventDefault()
      ;(event.shiftKey ? stops[stops.length - 1] : stops[0]).focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const actions: Action[] = [
    {
      icon: 'favorite',
      label: "J'aime",
      consequence: 'proposé plus souvent dans vos prochains menus',
      onClick: onLike,
    },
    {
      icon: 'heart_broken',
      label: "Je n'aime pas",
      consequence: 'ne reviendra plus dans vos menus',
      onClick: onDislike,
    },
    {
      icon: 'remove_shopping_cart',
      label: "Je n'en ai pas",
      consequence: 'remplacé dans ce repas',
      onClick: onMissing,
    },
  ]

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Fermer les actions"
        className="absolute inset-0 h-full w-full bg-black/30"
        onClick={onClose}
        type="button"
      />

      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl bg-background pb-md shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
        ref={sheet}
        role="dialog"
      >
        <div className="flex shrink-0 flex-col items-center gap-xs pb-xs pt-sm">
          <span className="h-1 w-10 rounded-full bg-surface-container-highest" />
        </div>

        <header className="flex flex-col border-b border-surface-container px-margin-mobile pb-sm">
          <span className="font-headline-md text-body-md text-on-surface" id={titleId}>
            {food.name}
          </span>
          <span className="font-caption text-caption text-on-surface-variant">
            {food.quantity} — {mealLabel}
          </span>
        </header>

        {replaceOffered ? (
          <div className="flex flex-col gap-sm px-margin-mobile pt-md">
            <p
              className="font-body-md text-body-md text-on-surface"
              ref={confirmation}
              role="status"
              tabIndex={-1}
            >
              {food.name} n'apparaîtra plus dans vos menus.
            </p>
            <button
              className="flex items-center justify-center gap-xs rounded-full bg-primary px-md py-sm font-label-md text-body-md text-on-primary transition-colors active:opacity-80"
              onClick={onReplace}
              type="button"
            >
              <Icon className="text-body-md" name="restaurant_menu" />
              Le remplacer maintenant
            </button>
            <button
              className="rounded-full bg-surface-container px-md py-sm font-label-md text-body-md text-on-surface-variant transition-colors active:bg-surface-container-highest"
              onClick={onClose}
              type="button"
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-xs px-margin-mobile pt-sm">
            {tasteError && (
              <p
                className="flex items-center gap-xs rounded-xl bg-error-container px-md py-sm font-body-md text-body-md text-on-error-container"
                role="alert"
              >
                <Icon className="text-body-md" name="error" />
                {tasteError}
              </p>
            )}
            {actions.map((action, index) => (
              <button
                className="flex items-center gap-sm rounded-2xl px-sm py-sm text-left transition-colors active:bg-surface-container"
                key={action.label}
                onClick={action.onClick}
                ref={index === 0 ? first : undefined}
                type="button"
              >
                <Icon className="text-primary" name={action.icon} />
                <span className="flex flex-col">
                  <span className="font-label-md text-body-md text-on-surface">{action.label}</span>
                  <span className="font-body-md text-caption text-on-surface-variant">
                    {action.consequence}
                  </span>
                </span>
              </button>
            ))}
            <button
              className="mt-xs rounded-full bg-surface-container px-md py-sm font-label-md text-body-md text-on-surface-variant transition-colors active:bg-surface-container-highest"
              onClick={onClose}
              type="button"
            >
              Annuler
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
