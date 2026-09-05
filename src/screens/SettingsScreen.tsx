import { AiSettingsSection } from '../components/profile/AiSettingsSection'
import { Icon } from '../components/Icon'
import type { UseAiSettingsResult } from '../hooks/useAiSettings'
import type { UseModelCatalogResult } from '../hooks/useModelCatalog'

interface SettingsScreenProps {
  // Comme pour le profil, les états vivent dans App : une seconde instance de
  // ces hooks ne verrait pas ce qui est enregistré ici.
  aiSettings: UseAiSettingsResult
  modelCatalog: UseModelCatalogResult
}

export function SettingsScreen({ aiSettings, modelCatalog }: SettingsScreenProps) {
  return (
    <div className="flex w-full flex-col gap-lg px-margin-mobile pb-xl">
      <header className="flex flex-col gap-xs pt-sm">
        <div className="flex items-center gap-xs text-primary">
          <Icon className="text-body-md" filled name="settings" />
          <span className="font-label-md text-label-md uppercase tracking-wider">
            Configuration
          </span>
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Réglages
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Connectez votre compte OpenRouter et choisissez le modèle qui fait tourner le coach.
        </p>
      </header>

      <AiSettingsSection modelCatalog={modelCatalog} settings={aiSettings} />
    </div>
  )
}
