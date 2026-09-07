import { dayLabel, oldestKey, shiftDay, todayKey } from '../lib/day'
import { Icon } from './Icon'

interface DaySelectorProps {
  day: string
  onChange: (day: string) => void
}

/**
 * Navigation d'un jour à l'autre. La borne haute est demain : préparer la
 * veille est le besoin, planifier la semaine n'en est pas un.
 */
export function DaySelector({ day, onChange }: DaySelectorProps) {
  const oldest = oldestKey()
  const newest = shiftDay(todayKey(), 1)
  const previous = shiftDay(day, -1)
  const next = shiftDay(day, 1)

  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-container-lowest px-sm py-xs">
      <button
        aria-label={`Jour précédent, ${dayLabel(previous).toLowerCase()}`}
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors active:bg-surface-container disabled:opacity-40"
        disabled={previous < oldest}
        onClick={() => onChange(previous)}
        type="button"
      >
        <Icon name="chevron_left" />
      </button>

      <span aria-live="polite" className="font-headline-md text-body-md text-on-surface">{dayLabel(day)}</span>

      <button
        aria-label={`Jour suivant, ${dayLabel(next).toLowerCase()}`}
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors active:bg-surface-container disabled:opacity-40"
        disabled={next > newest}
        onClick={() => onChange(next)}
        type="button"
      >
        <Icon name="chevron_right" />
      </button>
    </div>
  )
}
