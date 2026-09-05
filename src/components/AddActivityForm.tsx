import { useState } from 'react'
import { ACTIVITY_TYPES, estimateCalories, findActivityType, type Activity } from '../lib/activities'
import { Icon } from './Icon'

interface AddActivityFormProps {
  weightKg: number
  onAdd: (activity: Activity) => void
  onCancel: () => void
}

export function AddActivityForm({ weightKg, onAdd, onCancel }: AddActivityFormProps) {
  const [typeId, setTypeId] = useState(ACTIVITY_TYPES[0].id)
  const [time, setTime] = useState('12:00')
  const [durationMin, setDurationMin] = useState(30)
  const [title, setTitle] = useState('')

  const type = findActivityType(typeId)
  const calories = estimateCalories(type.met, weightKg, durationMin)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onAdd({
      id: `activity-${Date.now()}`,
      time,
      typeId,
      title: title.trim(),
      durationMin,
    })
  }

  return (
    <form
      className="flex flex-col gap-sm rounded-2xl border border-primary/20 bg-surface-container-lowest p-md shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-headline-md text-body-lg font-bold text-on-surface">Nouvelle activité</h4>
        <button
          aria-label="Annuler"
          className="flex items-center justify-center text-on-surface-variant"
          onClick={onCancel}
          type="button"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-xs">
        {ACTIVITY_TYPES.map((option) => {
          const active = option.id === typeId
          return (
            <button
              aria-pressed={active}
              className={`flex flex-col items-center justify-center gap-xs rounded-lg p-sm transition-colors ${
                active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant'
              }`}
              key={option.id}
              onClick={() => setTypeId(option.id)}
              type="button"
            >
              <Icon className="text-body-lg" name={option.icon} />
              <span className="text-center font-caption text-caption font-semibold leading-tight">
                {option.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-sm">
        <label className="flex flex-col gap-xs">
          <span className="font-caption text-caption text-on-surface-variant">Heure</span>
          <input
            className="rounded-lg bg-surface-container-low px-md py-xs font-label-md text-label-md text-on-surface focus:outline-none"
            onChange={(event) => setTime(event.target.value)}
            required
            type="time"
            value={time}
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-caption text-caption text-on-surface-variant">Durée (min)</span>
          <input
            className="rounded-lg bg-surface-container-low px-md py-xs font-label-md text-label-md text-on-surface focus:outline-none"
            max={600}
            min={1}
            onChange={(event) => setDurationMin(Math.max(1, Number(event.target.value) || 1))}
            type="number"
            value={durationMin}
          />
        </label>
      </div>

      <label className="flex flex-col gap-xs">
        <span className="font-caption text-caption text-on-surface-variant">
          Intitulé (facultatif)
        </span>
        <input
          className="rounded-lg bg-surface-container-low px-md py-xs font-body-md text-caption text-on-surface placeholder:text-outline focus:outline-none"
          onChange={(event) => setTitle(event.target.value)}
          placeholder={type.label}
          type="text"
          value={title}
        />
      </label>

      <p className="flex items-center gap-xs rounded-lg bg-primary/10 px-sm py-xs font-label-md text-caption text-on-primary-container">
        <Icon className="text-body-md text-primary" name="local_fire_department" />
        <span>Dépense estimée : ~{calories} kcal</span>
      </p>

      <button
        className="flex w-full items-center justify-center gap-xs rounded-xl bg-primary py-sm font-headline-md text-body-md text-on-primary shadow-sm transition-transform active:scale-[0.98]"
        type="submit"
      >
        <Icon name="add" />
        Intercaler l'activité
      </button>
    </form>
  )
}
