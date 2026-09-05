import { Icon } from './Icon'

interface MenuStateCardProps {
  /** 'idle' englobe l'absence de menu enregistré comme le retour d'une erreur. */
  state: 'idle' | 'loading' | 'error'
  /** false tant que la clé et le modèle ne sont pas renseignés. */
  configured: boolean
  error: string
  onGenerate: () => void
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-md" aria-busy="true" aria-label="Génération du menu en cours">
      {[0, 1, 2].map((index) => (
        <div
          className="flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          key={index}
        >
          <div className="h-32 w-full animate-pulse bg-surface-container-high" />
          <div className="flex flex-col gap-sm p-4">
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-surface-container-high" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-container" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-container" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MenuStateCard({ state, configured, error, onGenerate }: MenuStateCardProps) {
  if (state === 'loading') return <Skeleton />

  return (
    <section className="flex flex-col items-center gap-md rounded-2xl bg-surface-container-lowest p-md text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <Icon
        className={state === 'error' ? 'text-error' : 'text-primary'}
        name={state === 'error' ? 'error' : 'restaurant_menu'}
      />
      {state === 'error' ? (
        <p className="font-body-md text-body-md text-on-surface-variant">{error}</p>
      ) : (
        <p className="font-body-md text-body-md text-on-surface-variant">
          {configured
            ? "Aucun menu pour aujourd'hui. Dr. Anya peut le composer à partir de votre profil et de vos activités."
            : 'Configurez votre clé OpenRouter pour générer votre menu'}
        </p>
      )}

      {configured ? (
        <button
          className="flex items-center gap-xs rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary transition-colors hover:bg-primary/90 active:scale-95"
          onClick={onGenerate}
          type="button"
        >
          <Icon className="text-body-md" name="auto_awesome" />
          <span>{state === 'error' ? 'Réessayer' : 'Générer mon menu'}</span>
        </button>
      ) : (
        <a
          className="flex items-center gap-xs rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary transition-colors hover:bg-primary/90 active:scale-95"
          href="#/profil"
        >
          <Icon className="text-body-md" name="key" />
          <span>Ouvrir le profil</span>
        </a>
      )}
    </section>
  )
}
