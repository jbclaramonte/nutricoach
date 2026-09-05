import type { MacroRing, MicroNutrient } from '../types'
import { ProgressRing } from './ProgressRing'

interface MacroGridProps {
  macros: MacroRing[]
  micros: MicroNutrient[]
}

export function MacroGrid({ macros, micros }: MacroGridProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-md">
        {macros.map((macro) => (
          <div
            key={macro.key}
            className="relative flex flex-col items-center justify-center gap-sm overflow-hidden rounded-xl bg-surface-container-highest p-md shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
          >
            <ProgressRing
              className="h-16 w-16"
              percent={macro.percent}
              strokeClass={macro.strokeClass}
            >
              <span className="font-label-md text-label-md text-on-surface">{macro.display}</span>
            </ProgressRing>
            <span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              {macro.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-sm flex flex-col gap-sm">
        <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
          Vitamines &amp; Minéraux
        </h2>
        <div className="grid grid-cols-3 gap-sm">
          {micros.map((micro) => (
            <div
              key={micro.key}
              className="flex flex-col items-center gap-xs rounded-xl bg-surface-container-low p-sm shadow-sm"
            >
              <ProgressRing className="h-10 w-10" percent={micro.percent} strokeClass="stroke-primary">
                <span className="text-[10px] font-bold">{micro.percent}%</span>
              </ProgressRing>
              <span className="text-[10px] uppercase tracking-tighter">{micro.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
