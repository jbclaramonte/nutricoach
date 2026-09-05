interface IconProps {
  /** Nom du glyphe Material Symbols, par ex. « auto_awesome ». */
  name: string
  filled?: boolean
  className?: string
}

export function Icon({ name, filled = false, className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}
