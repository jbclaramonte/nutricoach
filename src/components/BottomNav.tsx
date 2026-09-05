import { NAV_ITEMS } from '../lib/navigation'
import { Icon } from './Icon'


interface BottomNavProps {
  activeRoute: string
}

export function BottomNav({ activeRoute }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 z-50 w-full bg-surface/80 pb-safe shadow-[0_-1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-around px-xs">
        {NAV_ITEMS.map((item) => {
          const active = item.route === activeRoute
          return (
            <a
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center transition-colors ${
                active ? 'font-bold text-primary' : 'text-on-surface-variant'
              }`}
              href={`#/${item.route}`}
              key={item.route}
            >
              <Icon filled={active} name={item.icon} />
              <span className="font-label-md text-caption">{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
