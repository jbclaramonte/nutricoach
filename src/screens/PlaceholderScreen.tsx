import { Icon } from '../components/Icon'

interface PlaceholderScreenProps {
  icon: string
  title: string
  description: string
}

/** Écran encore à concevoir, atteignable depuis la barre de navigation. */
export function PlaceholderScreen({ icon, title, description }: PlaceholderScreenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-sm px-margin-mobile text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={icon} />
      </span>
      <h1 className="font-headline-md text-headline-md text-on-surface">{title}</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
    </div>
  )
}
