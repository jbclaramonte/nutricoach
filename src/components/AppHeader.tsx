interface AppHeaderProps {
  logoUrl: string
  avatarUrl: string
  title: string
}

export function AppHeader({ logoUrl, avatarUrl, title }: AppHeaderProps) {
  return (
    <header className="fixed top-0 z-50 w-full bg-surface/80 pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-margin-mobile">
        <div className="flex items-center gap-sm">
          <img alt="NutriAdapt" className="h-8 w-auto object-contain" src={logoUrl} />
          <span className="font-headline-md text-headline-md text-on-surface">{title}</span>
        </div>
        <img alt="Profil" className="h-8 w-8 rounded-full object-cover" src={avatarUrl} />
      </div>
    </header>
  )
}
