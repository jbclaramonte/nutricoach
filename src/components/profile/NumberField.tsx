interface NumberFieldProps {
  label: string
  value: number
  unit?: string
  step?: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

/** Tuile de biométrie éditable : la valeur reste lisible au premier coup d'œil. */
export function NumberField({ label, value, unit, step = 1, min, max, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col justify-between rounded-lg bg-surface-container-low p-sm">
      <span className="font-caption text-caption text-on-surface-variant">{label}</span>
      <span className="mt-xs flex items-baseline gap-xs">
        <input
          className="w-full min-w-0 bg-transparent font-headline-md text-headline-md font-semibold text-on-surface focus:outline-none"
          inputMode="decimal"
          max={max}
          min={min}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            if (Number.isFinite(parsed)) onChange(parsed)
          }}
          step={step}
          type="number"
          value={value}
        />
        {unit && <span className="font-body-md text-caption text-on-surface-variant">{unit}</span>}
      </span>
    </label>
  )
}
