import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { ChatBar } from './components/ChatBar'
import { dashboardData } from './data/dashboard'
import { NAV_ITEMS } from './lib/navigation'
import { useHashRoute } from './hooks/useHashRoute'
import { DashboardScreen } from './screens/DashboardScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'
import { ProfileScreen } from './screens/ProfileScreen'

export default function App() {
  const route = useHashRoute('dashboard')
  const navItem = NAV_ITEMS.find((item) => item.route === route)
  // Le coach n'est joignable que depuis le menu du jour.
  const showChat = route === 'dashboard'

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
        title={navItem?.label ?? 'NutriAdapt'}
      />

      <main className="min-h-screen bg-background pb-20 pt-16">
        {route === 'profil' ? (
          <ProfileScreen />
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
          <DashboardScreen />
        )}
      </main>

      {showChat && <ChatBar coachName={dashboardData.coach.name} onSend={handleSend} />}
      <BottomNav activeRoute={navItem?.route ?? 'dashboard'} />
    </div>
  )
}
