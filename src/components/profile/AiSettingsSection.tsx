import { Icon } from '../Icon'
import { ApiKeyField } from './ApiKeyField'
import { ModelPicker } from './ModelPicker'
import { SectionCard } from './SectionCard'
import type { UseAiSettingsResult } from '../../hooks/useAiSettings'
import type { UseModelCatalogResult } from '../../hooks/useModelCatalog'

function formatCredit(limitRemaining: number | null): string {
  if (limitRemaining === null) return 'crédit non plafonné'
  return `crédit restant ${limitRemaining.toFixed(2)} $`
}

interface AiSettingsSectionProps {
  settings: UseAiSettingsResult
  modelCatalog: UseModelCatalogResult
}

export function AiSettingsSection({ settings: aiSettings, modelCatalog }: AiSettingsSectionProps) {
  const { settings, saveState, update, save, testState, keyInfo, testError, testKey } = aiSettings
  const { models, error: catalogError, refresh } = modelCatalog

  return (
    <SectionCard
      description="Choisissez le modèle qui analysera vos photos de repas et générera vos menus."
      icon="smart_toy"
      title="Coach IA"
    >
      <ApiKeyField
        onChange={(apiKey) => update({ apiKey })}
        onTest={testKey}
        testing={testState === 'testing'}
        value={settings.apiKey}
      />

      {testState === 'ok' && keyInfo && (
        <p className="flex items-start gap-xs rounded-lg bg-primary/10 p-sm font-label-md text-caption text-on-surface-variant">
          <Icon className="text-body-md text-primary" filled name="check_circle" />
          Clé valide{keyInfo.label ? ` (${keyInfo.label})` : ''} — {formatCredit(keyInfo.limitRemaining)}
          {keyInfo.isFreeTier ? ', offre gratuite' : ''}.
        </p>
      )}
      {testState === 'error' && (
        <p className="rounded-lg bg-error-container p-sm font-label-md text-caption text-on-error-container">
          {testError}
        </p>
      )}

      <div className="flex items-center justify-between gap-sm pt-xs">
        <span className="font-label-md text-label-md text-on-surface">Modèle</span>
        <button
          className="flex items-center gap-xs rounded-full bg-surface-container px-sm py-xs font-label-md text-caption text-on-surface-variant"
          onClick={refresh}
          type="button"
        >
          <Icon className="text-caption" name="refresh" />
          Actualiser
        </button>
      </div>
      {catalogError && (
        <p className="font-caption text-caption text-on-surface-variant">
          {catalogError} La liste affichée provient du dernier téléchargement.
        </p>
      )}
      <ModelPicker
        models={models}
        onSelect={(modelId) => update({ modelId })}
        selectedId={settings.modelId}
      />

      <p className="flex items-start gap-sm rounded-lg bg-secondary-container/50 p-sm font-body-md text-caption leading-relaxed text-on-secondary-container">
        <Icon className="mt-xs text-body-lg text-secondary" name="lock" />
        <span>
          Votre clé reste stockée dans ce navigateur uniquement ; vos repas et vos photos sont
          envoyés à OpenRouter et au fournisseur du modèle choisi pour être analysés.
        </span>
      </p>

      <button
        className="flex w-full items-center justify-center gap-sm rounded-lg bg-primary py-sm font-headline-md text-body-md text-on-primary shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
        disabled={saveState === 'saving'}
        onClick={save}
        type="button"
      >
        <Icon className="text-body-md" filled={saveState === 'saved'} name={saveState === 'saved' ? 'check' : 'save'} />
        {saveState === 'saved' ? 'Réglages IA enregistrés !' : 'Enregistrer les réglages IA'}
      </button>
      {saveState === 'error' && (
        <p className="rounded-lg bg-error-container p-sm text-center font-label-md text-caption text-on-error-container">
          Enregistrement impossible — le stockage du navigateur est peut-être bloqué.
        </p>
      )}
    </SectionCard>
  )
}
