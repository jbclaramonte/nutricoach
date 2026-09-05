import { Icon } from '../Icon'

interface SectionCardProps {
  icon: string
  title: string
  /** Couleur Tailwind de l'icône, par ex. « text-tertiary ». */
  iconClass?: string
  /** Contenu aligné à droite du titre (badge, compteur). */
  aside?: React.ReactNode
  description?: string
  children: React.ReactNode
}

export function SectionCard({
  icon,
  title,
  iconClass = 'text-primary',
  aside,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="flex flex-col gap-md rounded-xl bg-surface-container-lowest p-md shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex items-center gap-xs">
          <Icon className={iconClass} name={icon} />
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
        </div>
        {aside}
      </div>
      {description && (
        <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
      )}
      {children}
    </section>
  )
}
