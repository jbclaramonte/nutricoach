import { useState } from 'react'
import { Icon } from '../Icon'

interface ChipInputProps {
  values: string[]
  placeholder: string
  onChange: (values: string[]) => void
  /** Classes du chip, pour distinguer favoris, exclus et allergies. */
  chipClass: string
  /** Classes du bouton d'ajout. */
  addButtonClass: string
  /** Icône affichée devant le libellé, par ex. « warning » pour une allergie. */
  chipIcon?: string
  chipIconClass?: string
  /** Arrondi du chip : pilule par défaut, coins doux pour les allergies. */
  rounded?: 'full' | 'lg'
}

export function ChipInput({
  values,
  placeholder,
  onChange,
  chipClass,
  addButtonClass,
  chipIcon,
  chipIconClass = '',
  rounded = 'full',
}: ChipInputProps) {
  const [draft, setDraft] = useState('')

  function add() {
    const value = draft.trim()
    if (!value) return
    if (!values.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value])
    }
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap gap-xs">
        {values.map((value) => (
          <span
            className={`flex items-center gap-xs px-sm py-xs font-label-md text-caption ${chipClass} ${
              rounded === 'full' ? 'rounded-full' : 'rounded-lg'
            }`}
            key={value}
          >
            {chipIcon && <Icon className={`text-caption ${chipIconClass}`} name={chipIcon} />}
            {value}
            <button
              aria-label={`Retirer ${value}`}
              className="ml-xs flex items-center justify-center hover:opacity-75"
              onClick={() => onChange(values.filter((entry) => entry !== value))}
              type="button"
            >
              <Icon className="text-caption" name="close" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-xs">
        <input
          className="min-w-0 flex-1 rounded-lg bg-surface-container-low px-md py-xs font-body-md text-caption text-on-surface placeholder:text-outline focus:bg-surface-container focus:outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
          placeholder={placeholder}
          type="text"
          value={draft}
        />
        <button
          aria-label="Ajouter"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${addButtonClass}`}
          onClick={add}
          type="button"
        >
          <Icon className="text-body-md" name="add" />
        </button>
      </div>
    </div>
  )
}
