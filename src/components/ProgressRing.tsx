interface ProgressRingProps {
  /** Progression 0–100. */
  percent: number
  /** Classe Tailwind de couleur du tracé, par ex. « stroke-primary ». */
  strokeClass: string
  /** Contenu affiché au centre de l'anneau. */
  children: React.ReactNode
  className?: string
}

export function ProgressRing({ percent, strokeClass, children, className = '' }: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle className="stroke-surface-dim" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
        <circle
          className={strokeClass}
          cx="18"
          cy="18"
          fill="none"
          r="16"
          strokeDasharray="100"
          strokeDashoffset={100 - clamped}
          strokeLinecap="round"
          strokeWidth="3"
          pathLength={100}
        />
      </svg>
      {children}
    </div>
  )
}
