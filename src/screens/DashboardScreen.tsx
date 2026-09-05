import { useState } from 'react'
import { ActivityCard } from '../components/ActivityCard'
import { AddActivityForm } from '../components/AddActivityForm'
import { Icon } from '../components/Icon'
import { MacroGrid } from '../components/MacroGrid'
import { MealCard } from '../components/MealCard'
import { dashboardData } from '../data/dashboard'
import { useActivities } from '../hooks/useActivities'
import { useProfile } from '../hooks/useProfile'
import { buildTimeline } from '../lib/timeline'

export function DashboardScreen() {
  const [meals, setMeals] = useState(dashboardData.meals)
  const { activities, add, remove } = useActivities()
  const { profile } = useProfile()
  const [adding, setAdding] = useState(false)

  const timeline = buildTimeline(meals, activities)

  function toggleEaten(mealId: string) {
    setMeals((current) =>
      current.map((meal) => (meal.id === mealId ? { ...meal, eaten: !meal.eaten } : meal)),
    )
  }

  return (
    <div className="flex w-full flex-col gap-lg px-margin-mobile pb-40 pt-sm">
      <div className="flex items-start gap-sm rounded-xl bg-primary-container p-md text-on-primary-container shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <Icon className="mt-[2px]" name="auto_awesome" />
        <p className="font-body-md text-body-md">
          <span className="font-bold">{dashboardData.banner.highlight}</span>{' '}
          {dashboardData.banner.message}
        </p>
      </div>

      <div className="flex flex-col gap-xs">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-background">
          Votre Menu d'Aujourd'hui
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {dashboardData.dateLabel}
        </p>
      </div>

      <MacroGrid macros={dashboardData.macros} micros={dashboardData.micros} />

      <div className="mt-sm flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-xs px-xs">
          <h2 className="flex items-center gap-xs font-label-md text-caption uppercase tracking-wider text-on-surface-variant">
            <Icon className="text-body-md text-primary" name="timeline" />
            Chronologie &amp; Dépenses
          </h2>
          {!adding && (
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

        {adding && (
          <AddActivityForm
            onAdd={(activity) => {
              add(activity)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
            weightKg={profile.weightKg}
          />
        )}

        {timeline.map((entry) =>
          entry.kind === 'meal' ? (
            <MealCard key={entry.meal.id} meal={entry.meal} onToggleEaten={toggleEaten} />
          ) : (
            <ActivityCard
              activity={entry.activity}
              key={entry.activity.id}
              onRemove={remove}
              weightKg={profile.weightKg}
            />
          ),
        )}
      </div>
    </div>
  )
}
