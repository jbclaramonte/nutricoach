import { useState } from 'react'
import { Icon } from '../Icon'

interface ApiKeyFieldProps {
  value: string
  onChange: (apiKey: string) => void
  onTest: () => void
  testing: boolean
}

export function ApiKeyField({ value, onChange, onTest, testing }: ApiKeyFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface">Clé API OpenRouter</span>
      <div className="flex items-center gap-xs">
        <input
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg bg-surface-container-low px-md py-xs font-body-md text-caption text-on-surface placeholder:text-outline focus:bg-surface-container focus:outline-none"
          onChange={(event) => onChange(event.target.value)}
          placeholder="sk-or-v1-…"
          spellCheck={false}
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Masquer la clé' : 'Afficher la clé'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <Icon className="text-body-md" name={visible ? 'visibility_off' : 'visibility'} />
        </button>
      </div>
      <div className="flex items-center gap-xs">
        <button
          className="flex flex-1 items-center justify-center gap-xs rounded-lg bg-primary px-md py-xs font-label-md text-caption text-on-primary shadow-sm disabled:opacity-60"
          disabled={testing || !value.trim()}
          onClick={onTest}
          type="button"
        >
          <Icon className="text-body-md" name={testing ? 'hourglass_top' : 'network_check'} />
          {testing ? 'Vérification…' : 'Tester la clé'}
        </button>
        <button
          className="flex items-center gap-xs rounded-lg bg-surface-container px-md py-xs font-label-md text-caption text-on-surface-variant disabled:opacity-60"
          disabled={!value}
          onClick={() => onChange('')}
          type="button"
        >
          <Icon className="text-body-md" name="delete" />
          Effacer
        </button>
      </div>
    </div>
  )
}
