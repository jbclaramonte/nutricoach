import { useEffect } from 'react'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { ChatBar } from './components/ChatBar'
import { CoachSheet } from './components/chat/CoachSheet'
import { dashboardData } from './data/dashboard'
import { NAV_ITEMS } from './lib/navigation'
import { isPast, isToday } from './lib/day'
import { purgeExpired } from './lib/retention'
import { useActivities } from './hooks/useActivities'
import { useAiSettings } from './hooks/useAiSettings'
import { useCoachChat } from './hooks/useCoachChat'
import { useDailyMenu } from './hooks/useDailyMenu'
import { useHashRoute } from './hooks/useHashRoute'
import { useModelCatalog } from './hooks/useModelCatalog'
import { useOnline } from './hooks/useOnline'
import { useProfile } from './hooks/useProfile'
import { useSchedule } from './hooks/useSchedule'
import { useSelectedDay } from './hooks/useSelectedDay'
import { isConfigured } from './lib/ai/settings'
import { DashboardScreen } from './screens/DashboardScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
  // Le ménage de l'historique est fait une fois, au démarrage : les hooks de
  // journée ne connaissent plus que la date qu'on leur donne.
  useEffect(() => {
    void purgeExpired()
  }, [])

  const [day, selectDay] = useSelectedDay()
  const past = isPast(day)
  const editable = !past

  const route = useHashRoute('dashboard')
  const navItem = NAV_ITEMS.find((item) => item.route === route)
  // Le coach est ouvert par-dessus le dashboard : la barre de chat n'est donc
  // visible que sur ces deux routes.
  const isCoach = route === 'coach'
  const isSettings = route === 'reglages'
  const showChat = route === 'dashboard' || isCoach

  // L'état partagé vit ici : le dashboard et le coach doivent voir le même
  // menu, sans quoi une génération resterait invisible du chat jusqu'au
  // prochain chargement.
  const profileStore = useProfile()
  const aiSettings = useAiSettings()
  const modelCatalog = useModelCatalog()
  const { profile } = profileStore
  const { settings } = aiSettings
  const { models } = modelCatalog
  const scheduleStore = useSchedule(settings, models)
  // Le planning alimente la journée : les habitudes du jour sont proposées
  // dans la chronologie, à confirmer une par une.
  const activityStore = useActivities(scheduleStore.schedule, scheduleStore.loaded, day, isToday(day))
  const dailyMenu = useDailyMenu(
    settings,
    profile,
    profileStore.loaded,
    activityStore.activities,
    models,
    day,
    editable,
  )
  const online = useOnline()
  const { messages, state, error, send, stop, clear } = useCoachChat(
    settings,
    profile,
    activityStore.activities,
    dailyMenu.menu,
    models,
    day,
    editable,
  )

  const configured = isConfigured(settings)

  function handleSend(message: string, photo: File | null) {
    if (!isCoach) window.location.hash = '#/coach'
    send(message, photo)
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <AppHeader
        avatarUrl={dashboardData.user.avatarUrl}
        logoUrl={dashboardData.logoUrl}
        title={isSettings ? 'Réglages' : (navItem?.label ?? 'NutriAdapt')}
      />

      <main className="min-h-screen bg-background pb-20 pt-16">
        {isSettings ? (
          <SettingsScreen aiSettings={aiSettings} modelCatalog={modelCatalog} />
        ) : route === 'profil' ? (
          <ProfileScreen configured={configured} profileStore={profileStore} scheduleStore={scheduleStore} />
        ) : route === 'progress' ? (
          <PlaceholderScreen
            description="Le suivi du poids et des tendances de macros arrivera ici."
            icon="monitoring"
            title="Progrès"
          />
        ) : route === 'recipes' ? (
          <PlaceholderScreen
            description="Vos recettes enregistrées et les suggestions du coach s'afficheront ici."
            icon="restaurant_menu"
            title="Recettes"
          />
        ) : (
          <DashboardScreen
            activities={activityStore}
            configured={configured}
            dailyMenu={dailyMenu}
            day={day}
            onDayChange={selectDay}
            profile={profile}
            readOnly={past}
          />
        )}
      </main>

      {isCoach && (
        <CoachSheet
          coachName={dashboardData.coach.name}
          configured={configured}
          day={day}
          error={error}
          messages={messages}
          hasMenu={dailyMenu.menu !== null}
          onApplyToMenu={(request) => {
            void dailyMenu.revise(request)
          }}
          onClear={clear}
          onSend={handleSend}
          onStop={stop}
          online={online}
          reviseError={dailyMenu.reviseError}
          readOnly={past}
          reviseNotice={dailyMenu.reviseNotice}
          revising={dailyMenu.reviseState === 'revising'}
          streaming={state === 'streaming'}
        />
      )}

      {showChat && !isCoach && (
        <ChatBar
          coachName={dashboardData.coach.name}
          disabled={!configured || !online || past}
          onSend={handleSend}
        />
      )}
      {/* Les réglages ne sont pas un onglet : aucun item ne doit s'y allumer. */}
      <BottomNav activeRoute={isSettings ? '' : (navItem?.route ?? 'dashboard')} />
    </div>
  )
}
