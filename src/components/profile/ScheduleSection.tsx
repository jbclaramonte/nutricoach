import { useState } from 'react'
import { Icon } from '../Icon'
import { SectionCard } from './SectionCard'
import type { UseScheduleResult } from '../../hooks/useSchedule'
import { ACTIVITY_TYPES, findActivityType } from '../../lib/activities'
import { WEEKDAY_LABELS, type RecurringActivity } from '../../lib/schedule'

interface ScheduleSectionProps {
  scheduleStore: UseScheduleResult
  notes: string
  /** false tant que la clé et le modèle ne sont pas renseignés. */
  configured: boolean
}

const FIELD_CLASS =
  'rounded-lg bg-surface-container-low px-sm py-xs font-label-md text-caption text-on-surface focus:outline-none'

function newActivity(): RecurringActivity {
  return {
    id: `recurring-${Date.now()}`,
    weekdays: [1],
    typeId: ACTIVITY_TYPES[0].id,
    title: '',
    time: '08:00',
    durationMin: 30,
  }
}

interface DurationFieldProps {
  activity: RecurringActivity
  onCommit: (activityId: string, patch: Partial<RecurringActivity>) => void
}

/**
 * La saisie vit en local le temps de la frappe : borner à chaque touche
 * empêcherait de vider le champ pour retaper une durée.
 */
function DurationField({ activity, onCommit }: DurationFieldProps) {
  const [draft, setDraft] = useState(`${activity.durationMin}`)

  return (
    <label className="flex flex-col gap-xs">
      <span className="font-caption text-caption text-on-surface-variant">Durée (min)</span>
      <input
        className={FIELD_CLASS}
        max={600}
        min={1}
        onBlur={() => {
          const durationMin = Math.max(1, Math.round(Number(draft)) || 1)
          setDraft(`${durationMin}`)
          onCommit(activity.id, { durationMin })
        }}
        onChange={(event) => setDraft(event.target.value)}
        type="number"
        value={draft}
      />
    </label>
  )
}

/** Résumé d'une ligne, utilisé dans l'aperçu de la proposition. */
function describe(activity: RecurringActivity): string {
  const type = findActivityType(activity.typeId)
  const days = activity.weekdays.map((day) => WEEKDAY_LABELS[day]).join(', ')
  return `${days} — ${activity.title || type.label}, ${activity.time}, ${activity.durationMin} min`
}

export function ScheduleSection({ scheduleStore, notes, configured }: ScheduleSectionProps) {
  const { schedule, setAll, add, update, remove, extract, extractState, extractError } =
    scheduleStore
  const [proposal, setProposal] = useState<RecurringActivity[] | null>(null)

  const canExtract = configured && notes.trim().length > 0 && extractState !== 'extracting'

  function handleExtract() {
    void extract(notes).then((extracted) => {
      if (extracted) setProposal(extracted)
    })
  }

  return (
    <SectionCard
      description="Vos activités récurrentes ; elles seront reportées automatiquement sur la journée."
      icon="event_repeat"
      title="Habitudes de la semaine"
    >
      {schedule.length === 0 && (
        <p className="font-body-md text-caption text-on-surface-variant">
          Aucune habitude enregistrée pour l'instant.
        </p>
      )}

      <div className="flex flex-col gap-sm">
        {schedule.map((activity) => (
          <div className="flex flex-col gap-xs rounded-lg bg-surface-container p-sm" key={activity.id}>
            <div className="flex items-center gap-xs">
              <Icon
                className="text-body-md text-primary"
                name={findActivityType(activity.typeId).icon}
              />
              <select
                className={`${FIELD_CLASS} min-w-0 flex-1`}
                onChange={(event) => update(activity.id, { typeId: event.target.value })}
                value={activity.typeId}
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button
                aria-label="Supprimer cette habitude"
                className="flex items-center justify-center text-on-surface-variant"
                onClick={() => remove(activity.id)}
                type="button"
              >
                <Icon name="delete" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-xs">
              <label className="flex flex-col gap-xs">
                <span className="font-caption text-caption text-on-surface-variant">Heure</span>
                <input
                  className={FIELD_CLASS}
                  // Un champ vidé enregistrerait une heure vide, qui trie en
                  // tête de journée et s'affiche en blanc : on l'ignore.
                  onChange={(event) => {
                    if (event.target.value) update(activity.id, { time: event.target.value })
                  }}
                  type="time"
                  value={activity.time}
                />
              </label>
              <DurationField activity={activity} onCommit={update} />
            </div>

            <div className="flex flex-wrap gap-xs">
              {WEEKDAY_LABELS.slice(1).map((label, index) => {
                const day = index + 1
                const active = activity.weekdays.includes(day)
                return (
                  <button
                    aria-pressed={active}
                    className={`rounded-full px-sm py-xs font-label-md text-caption transition-colors ${
                      active
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                    key={day}
                    onClick={() =>
                      update(activity.id, {
                        weekdays: active
                          ? activity.weekdays.filter((entry) => entry !== day)
                          : [...activity.weekdays, day].sort((a, b) => a - b),
                      })
                    }
                    type="button"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        className="flex w-full items-center justify-center gap-xs rounded-lg bg-surface-container-low py-sm font-label-md text-caption font-semibold text-primary"
        onClick={() => add(newActivity())}
        type="button"
      >
        <Icon className="text-body-md" name="add" />
        Ajouter une habitude
      </button>

      <div className="flex flex-col gap-xs border-t border-outline/20 pt-sm">
        <button
          className="flex w-full items-center justify-center gap-xs rounded-lg bg-secondary-container py-sm font-label-md text-caption font-semibold text-on-secondary-container disabled:opacity-50"
          disabled={!canExtract}
          onClick={handleExtract}
          type="button"
        >
          <Icon className="text-body-md" name="auto_awesome" />
          {extractState === 'extracting' ? 'Lecture de vos précisions…' : 'Déduire de mes précisions'}
        </button>
        <p className="font-caption text-caption text-on-surface-variant">
          {!configured
            ? 'Renseignez une clé et un modèle dans les réglages pour utiliser la déduction.'
            : notes.trim().length === 0
              ? 'Écrivez d’abord vos précisions libres ci-dessus.'
              : 'Le résultat vous sera proposé : rien n’est enregistré sans votre accord.'}
        </p>
        {extractState === 'error' && (
          <p className="rounded-lg bg-error-container p-sm font-label-md text-caption text-on-error-container">
            {extractError}
          </p>
        )}
      </div>

      {proposal && (
        <div className="flex flex-col gap-sm rounded-lg border border-primary/30 bg-primary/5 p-sm">
          <p className="font-label-md text-caption font-semibold text-primary">
            Proposition déduite de vos précisions
          </p>
          <ul className="flex flex-col gap-xs">
            {proposal.map((activity) => (
              <li className="font-body-md text-caption text-on-surface" key={activity.id}>
                {describe(activity)}
              </li>
            ))}
          </ul>
          <p className="font-caption text-caption text-on-surface-variant">
            {schedule.length > 0
              ? `Accepter remplacera vos ${schedule.length} habitude(s) actuelle(s) par ces ${proposal.length}.`
              : `Accepter enregistrera ces ${proposal.length} habitude(s).`}
          </p>
          <div className="grid grid-cols-2 gap-xs">
            <button
              className="rounded-lg bg-surface-container-low py-sm font-label-md text-caption font-semibold text-on-surface-variant"
              onClick={() => setProposal(null)}
              type="button"
            >
              Ignorer
            </button>
            <button
              className="rounded-lg bg-primary py-sm font-label-md text-caption font-semibold text-on-primary"
              onClick={() => {
                setAll(proposal)
                setProposal(null)
              }}
              type="button"
            >
              Remplacer
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
