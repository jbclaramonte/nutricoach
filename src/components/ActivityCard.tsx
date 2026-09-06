import {
  estimateCalories,
  findActivityType,
  intensityLabel,
  type Activity,
} from '../lib/activities'
import { Icon } from './Icon'

interface ActivityCardProps {
  activity: Activity
  /** Poids du profil, base de l'estimation de dépense. */
  weightKg: number
  onRemove: (activityId: string) => void
  onConfirm: (activityId: string) => void
}

export function ActivityCard({ activity, weightKg, onRemove, onConfirm }: ActivityCardProps) {
  const type = findActivityType(activity.typeId)
  const calories = estimateCalories(type.met, weightKg, activity.durationMin)
  // Les déplacements se distinguent des séances par la couleur secondaire.
  const secondary = type.category === 'Déplacement actif'
  const accentText = secondary ? 'text-secondary' : 'text-primary'
  // Une proposition du planning se lit comme une esquisse : elle ne compte ni
  // dans la dépense du jour, ni visuellement comme une séance faite.
  const planned = activity.planned === true

  return (
    <article
      className={`relative flex flex-col gap-sm overflow-hidden rounded-2xl p-md ${
        planned
          ? 'border border-dashed border-outline-variant/60 bg-surface-container-lowest/60 opacity-70'
          : 'border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
      }`}
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="flex items-center gap-sm">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              secondary ? 'bg-secondary-container text-secondary' : 'bg-primary/10 text-primary'
            }`}
          >
            <Icon name={type.icon} />
          </span>
          <div>
            <div className="flex flex-wrap items-baseline gap-xs">
              <span className={`whitespace-nowrap text-caption font-bold ${accentText}`}>
                {activity.time}
              </span>
              <span className="whitespace-nowrap text-caption text-on-surface-variant">
                • {type.category}
              </span>
            </div>
            <h4 className="font-headline-md text-body-lg font-bold text-on-surface">
              {activity.title || type.label}
            </h4>
            {planned && (
              <span className="mt-xs inline-flex items-center gap-xs rounded-full bg-surface-container-high px-sm py-xs font-label-md text-caption text-on-surface-variant">
                <Icon className="text-caption" name="event_upcoming" />
                Prévu
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-xs">
          <span
            className={`rounded-full px-sm py-xs text-caption font-bold ${
              secondary
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-primary-container/20 text-on-primary-container'
            }`}
          >
            {activity.durationMin} min
          </span>
          <button
            aria-label={`${planned ? 'Écarter' : 'Supprimer'} ${activity.title || type.label}`}
            className="flex items-center justify-center text-on-surface-variant hover:opacity-75"
            onClick={() => onRemove(activity.id)}
            type="button"
          >
            <Icon className="text-body-md" name="close" />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-xs rounded-xl bg-surface-container-low px-xs py-sm text-center">
        <div className="flex flex-col">
          <dt className="text-caption text-on-surface-variant">Durée</dt>
          <dd className="font-label-md font-bold text-on-surface">{activity.durationMin} min</dd>
        </div>
        <div className="flex flex-col border-x border-outline-variant/30">
          <dt className="text-caption text-on-surface-variant">
            {planned ? 'Estimation' : 'Brûlées'}
          </dt>
          <dd className={`whitespace-nowrap font-label-md font-bold ${accentText}`}>
            ~{calories} kcal
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-caption text-on-surface-variant">Effort</dt>
          <dd className="font-label-md font-bold text-on-surface">{intensityLabel(type.met)}</dd>
        </div>
      </dl>

      {planned && (
        <button
          className="flex items-center justify-center gap-xs rounded-full bg-primary-container px-sm py-xs font-label-md text-caption font-bold text-on-primary-container transition-colors hover:bg-primary-container/80 active:scale-95"
          onClick={() => onConfirm(activity.id)}
          type="button"
        >
          <Icon className="text-body-md" name="check" />
          <span>Confirmer</span>
        </button>
      )}

      {activity.impact && (
        <p
          className={`flex items-center gap-xs rounded-lg px-sm py-xs font-label-md text-caption ${
            secondary
              ? 'bg-secondary-container/40 text-on-secondary-container'
              : 'bg-primary/10 text-on-primary-container'
          }`}
        >
          <Icon
            className={`text-body-md ${accentText}`}
            name={secondary ? 'water_drop' : 'bolt'}
          />
          <span>{activity.impact}</span>
        </p>
      )}
    </article>
  )
}
