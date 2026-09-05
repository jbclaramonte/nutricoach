import { useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { ChatBar } from './components/ChatBar'
import { Icon } from './components/Icon'
import { MacroGrid } from './components/MacroGrid'
import { MealCard } from './components/MealCard'
import { dashboardData } from './data/dashboard'

export function Dashboard() {
  const [meals, setMeals] = useState(dashboardData.meals)

  function toggleEaten(mealId: string) {
    setMeals((current) =>
      current.map((meal) => (meal.id === mealId ? { ...meal, eaten: !meal.eaten } : meal)),
    )
  }

  // Le coach IA n'est pas encore branché : l'envoi est journalisé en attendant
  // l'intégration du LLM.
  function handleSend(message: string, photo: File | null) {
    console.info('[coach] message en attente d’envoi', { message, photo: photo?.name ?? null })
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <AppHeader
        avatarUrl={dashboardData.user.avatarUrl}
        logoUrl={dashboardData.logoUrl}
        title="Dashboard"
      />

      <main className="min-h-screen bg-background pb-20 pt-16">
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
            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} onToggleEaten={toggleEaten} />
            ))}
          </div>
        </div>
      </main>

      <ChatBar coachName={dashboardData.coach.name} onSend={handleSend} />
      <BottomNav activeKey="dashboard" />
    </div>
  )
}
