import { useState } from 'react'
import { ActivityCard } from '../components/ActivityCard'
import { AddActivityForm } from '../components/AddActivityForm'
import { DaySelector } from '../components/DaySelector'
import { Icon } from '../components/Icon'
import { MacroGrid } from '../components/MacroGrid'
import { MealCard } from '../components/MealCard'
import { MenuStateCard } from '../components/MenuStateCard'
import { dashboardData } from '../data/dashboard'
import type { UseActivitiesResult } from '../hooks/useActivities'
import type { UseDailyMenuResult } from '../hooks/useDailyMenu'
import { toMacroRings } from '../lib/ai/menuMap'
import { isToday } from '../lib/day'
import { dailyTarget } from '../lib/energy'
import { buildTimeline } from '../lib/timeline'
import type { Profile } from '../lib/profile'

interface DashboardScreenProps {
  profile: Profile
  activities: UseActivitiesResult
  dailyMenu: UseDailyMenuResult
  /** Vrai quand une clé et un modèle sont enregistrés. */
  configured: boolean
  /** Jour affiché, au format AAAA-MM-JJ. */
  day: string
  onDayChange: (day: string) => void
  /** Vrai pour un jour révolu : la journée se consulte, ne se modifie pas. */
  readOnly: boolean
}

export function DashboardScreen({
  profile,
  activities: activityStore,
  dailyMenu,
  configured,
  day,
  onDayChange,
  readOnly,
}: DashboardScreenProps) {
  const { activities, add, remove, confirm } = activityStore
  const { menu, meals, state, error, dropped, generate, toggleEaten } = dailyMenu
  const [adding, setAdding] = useState(false)

  // Confirmer une séance ou cocher un repas ne se fait que le jour même :
  // demain, rien n'a encore eu lieu.
  const live = isToday(day)

  const timeline = buildTimeline(meals, activities)
  const macros = toMacroRings(meals, dailyTarget(profile, activities), profile.weightKg)

  return (
    <div className="flex w-full flex-col gap-lg px-margin-mobile pb-40 pt-sm">
      <DaySelector day={day} onChange={onDayChange} />

      {readOnly && (
        <p className="flex items-center gap-xs rounded-xl bg-surface-container px-md py-sm font-body-md text-caption text-on-surface-variant">
          <Icon className="text-body-md" name="history" />
          Journée archivée — consultation seule.
        </p>
      )}

      {menu && menu.banner.trim().length > 0 && (
        <div className="flex items-start gap-sm rounded-xl bg-primary-container p-md text-on-primary-container shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <Icon className="mt-[2px]" name="auto_awesome" />
          <p className="font-body-md text-body-md">
            <span className="font-bold">Menu du jour :</span> {menu.banner}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-xs">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-background">
          Votre Menu d'Aujourd'hui
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {dashboardData.dateLabel}
        </p>
      </div>

      <MacroGrid macros={macros} micros={dashboardData.micros} />

      <div className="mt-sm flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-xs px-xs">
          <h2 className="flex items-center gap-xs font-label-md text-caption uppercase tracking-wider text-on-surface-variant">
            <Icon className="text-body-md text-primary" name="timeline" />
            Chronologie &amp; Dépenses
          </h2>
          {live && !adding && (
            <button
              className="flex items-center gap-xs rounded-full bg-surface-container px-sm py-1 font-label-md text-caption text-primary transition-colors hover:bg-surface-container-high active:scale-95"
              onClick={() => setAdding(true)}
              type="button"
            >
              <Icon className="text-caption" name="add" />
              <span>Intercaler une activité</span>
            </button>
          )}
        </div>

        {live && adding && (
          <AddActivityForm
            onAdd={(activity) => {
              add(activity)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
            weightKg={profile.weightKg}
          />
        )}

        {meals.length > 0 && state === 'error' && (
          <p className="rounded-xl bg-error-container p-sm font-body-md text-body-md text-on-error-container">
            {error}
          </p>
        )}

        {dropped.length > 0 && (
          <p className="rounded-xl bg-surface-container p-sm font-body-md text-caption text-on-surface-variant">
            {dropped.length === 1
              ? `1 repas a été ignoré car la réponse du modèle était incomplète : ${dropped[0]}.`
              : `${dropped.length} repas ont été ignorés car la réponse du modèle était incomplète : ${dropped.join(', ')}.`}
          </p>
        )}

        {meals.length === 0 && !readOnly && (
          <MenuStateCard
            configured={configured}
            error={error}
            onGenerate={generate}
            state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'idle'}
          />
        )}

        {timeline.map((entry) =>
          entry.kind === 'meal' ? (
            <MealCard
              key={entry.meal.id}
              meal={entry.meal}
              onToggleEaten={toggleEaten}
              readOnly={!live}
            />
          ) : (
            <ActivityCard
              activity={entry.activity}
              key={entry.activity.id}
              onConfirm={confirm}
              onRemove={remove}
              readOnly={!live}
              weightKg={profile.weightKg}
            />
          ),
        )}
      </div>
    </div>
  )
}
