import { useMemo, useState } from 'react'
import { Icon } from '../Icon'
import type { ORModel } from '../../lib/openrouter/types'

// Le catalogue dépasse 400 entrées : n'en rendre qu'une tranche garde la liste
// fluide sur mobile, le champ de recherche servant à atteindre le reste.
const MAX_RENDERED = 40

interface ModelPickerProps {
  models: ORModel[]
  selectedId: string
  onSelect: (modelId: string) => void
}

function formatPrice(pricePerM: number | null): string {
  if (pricePerM === null) return 'tarif variable'
  if (pricePerM === 0) return 'gratuit'
  return `${pricePerM < 1 ? pricePerM.toFixed(2) : pricePerM.toFixed(1)} $/M`
}

export function ModelPicker({ models, selectedId, onSelect }: ModelPickerProps) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return models
      .filter((model) => showAll || (model.supportsVision && model.supportsStructuredOutputs))
      .filter(
        (model) =>
          !needle ||
          model.id.toLowerCase().includes(needle) ||
          model.name.toLowerCase().includes(needle),
      )
      .sort((a, b) => (a.promptPricePerM ?? Infinity) - (b.promptPricePerM ?? Infinity))
  }, [models, query, showAll])

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-xs">
        <input
          className="min-w-0 flex-1 rounded-lg bg-surface-container-low px-md py-xs font-body-md text-caption text-on-surface placeholder:text-outline focus:bg-surface-container focus:outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un modèle…"
          type="search"
          value={query}
        />
        <button
          aria-pressed={showAll}
          className={`flex shrink-0 items-center gap-xs rounded-lg px-sm py-xs font-label-md text-caption transition-colors ${
            showAll ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
          }`}
          onClick={() => setShowAll((current) => !current)}
          type="button"
        >
          <Icon className="text-caption" name={showAll ? 'filter_alt_off' : 'filter_alt'} />
          Tous
        </button>
      </div>

      <p className="font-caption text-caption text-on-surface-variant">
        {matches.length} modèle{matches.length > 1 ? 's' : ''}
        {showAll ? '' : ' compatibles photo et JSON'}
        {matches.length > MAX_RENDERED ? ` — ${MAX_RENDERED} affichés, affinez la recherche` : ''}
      </p>

      <div className="flex flex-col gap-xs">
        {matches.slice(0, MAX_RENDERED).map((model) => {
          const active = model.id === selectedId
          return (
            <button
              aria-pressed={active}
              className={`flex flex-col gap-xs rounded-lg p-sm text-left transition-colors ${
                active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface'
              }`}
              key={model.id}
              onClick={() => onSelect(model.id)}
              type="button"
            >
              <span className="flex items-center justify-between gap-xs">
                <span className="font-label-md text-caption font-semibold">{model.name}</span>
                <Icon
                  className={`text-caption ${active ? '' : 'text-outline'}`}
                  filled={active}
                  name={active ? 'check_circle' : 'radio_button_unchecked'}
                />
              </span>
              <span
                className={`font-caption text-caption ${active ? 'opacity-80' : 'text-on-surface-variant'}`}
              >
                {formatPrice(model.promptPricePerM)} entrée ·{' '}
                {formatPrice(model.completionPricePerM)} sortie
              </span>
              <span className="flex flex-wrap gap-xs">
                {model.supportsVision && (
                  <span
                    className={`flex items-center gap-xs rounded-full px-sm py-xs font-label-md text-caption ${
                      active ? 'bg-on-primary/20' : 'bg-secondary-container text-on-secondary-container'
                    }`}
                  >
                    <Icon className="text-caption" name="photo_camera" /> Photo
                  </span>
                )}
                {model.supportsStructuredOutputs && (
                  <span
                    className={`flex items-center gap-xs rounded-full px-sm py-xs font-label-md text-caption ${
                      active ? 'bg-on-primary/20' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <Icon className="text-caption" name="data_object" /> JSON
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
