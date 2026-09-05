import { Icon } from './Icon'

const ITEMS = [
  { key: 'dashboard', label: 'Menu', icon: 'restaurant_menu' },
  { key: 'journal', label: 'Journal', icon: 'calendar_month' },
  { key: 'coach', label: 'Coach', icon: 'forum' },
  { key: 'settings', label: 'Réglages', icon: 'settings' },
] as const

interface BottomNavProps {
  activeKey: string
}

export function BottomNav({ activeKey }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 z-50 w-full bg-surface/80 pb-safe shadow-[0_-1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <ul className="flex h-16 items-stretch">
        {ITEMS.map((item) => {
          const active = item.key === activeKey
          return (
            <li className="flex-1" key={item.key}>
              <button
                aria-current={active ? 'page' : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-xs ${
                  active ? 'font-bold text-primary' : 'text-on-surface-variant'
                } disabled:opacity-40`}
                disabled={!active}
                type="button"
              >
                <Icon filled={active} name={item.icon} />
                <span className="text-[10px] uppercase tracking-tighter">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
