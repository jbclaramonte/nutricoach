import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { ChatBar } from './components/ChatBar'
import { CoachSheet } from './components/chat/CoachSheet'
import { dashboardData } from './data/dashboard'
import { NAV_ITEMS } from './lib/navigation'
import { useActivities } from './hooks/useActivities'
import { useAiSettings } from './hooks/useAiSettings'
import { useCoachChat } from './hooks/useCoachChat'
import { useDailyMenu } from './hooks/useDailyMenu'
import { useHashRoute } from './hooks/useHashRoute'
import { useModelCatalog } from './hooks/useModelCatalog'
import { useOnline } from './hooks/useOnline'
import { useProfile } from './hooks/useProfile'
import { isConfigured } from './lib/ai/settings'
import { DashboardScreen } from './screens/DashboardScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
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
  const activityStore = useActivities()
  const profileStore = useProfile()
  const aiSettings = useAiSettings()
  const modelCatalog = useModelCatalog()
  const { profile } = profileStore
  const { settings } = aiSettings
  const { models } = modelCatalog
  const dailyMenu = useDailyMenu(
    settings,
    profile,
    profileStore.loaded,
    activityStore.activities,
    models,
  )
  const online = useOnline()
  const { messages, state, error, send, stop, clear } = useCoachChat(
    settings,
    profile,
    activityStore.activities,
    dailyMenu.menu,
    models,
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
          <ProfileScreen profileStore={profileStore} />
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
            profile={profile}
          />
        )}
      </main>

      {isCoach && (
        <CoachSheet
          coachName={dashboardData.coach.name}
          configured={configured}
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
          reviseNotice={dailyMenu.reviseNotice}
          revising={dailyMenu.reviseState === 'revising'}
          streaming={state === 'streaming'}
        />
      )}

      {showChat && !isCoach && (
        <ChatBar
          coachName={dashboardData.coach.name}
          disabled={!configured || !online}
          onSend={handleSend}
        />
      )}
      {/* Les réglages ne sont pas un onglet : aucun item ne doit s'y allumer. */}
      <BottomNav activeRoute={isSettings ? '' : (navItem?.route ?? 'dashboard')} />
    </div>
  )
}
