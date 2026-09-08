import type { FoodItem, Meal } from '../types'
import { formatGrams, sumMeal } from '../lib/nutrition'
import { Icon } from './Icon'
import { TimeField } from './TimeField'

interface MealCardProps {
  meal: Meal
  onToggleEaten: (mealId: string) => void
  /** Ouvre les actions de l'aliment touché. */
  onPickFood: (item: FoodItem) => void
  /** Gouverne la coche « repas pris » : elle n'a de sens que le jour vécu. */
  canCheckEaten?: boolean
  /** Gouverne les boutons d'aliment : ils suivent la règle de la révision. */
  canPickFood?: boolean
  /** Absent, l'heure du repas se lit sans se déplacer. */
  onTimeChange?: (mealId: string, time: string) => void
}

export function MealCard({
  meal,
  onToggleEaten,
  onPickFood,
  canCheckEaten = true,
  canPickFood = true,
  onTimeChange,
}: MealCardProps) {
  const totals = sumMeal(meal.items)

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <div
        aria-label={meal.imageAlt}
        className="relative h-32 w-full bg-cover bg-center"
        role="img"
        style={{ backgroundImage: `url("${meal.imageUrl}")` }}
      >
        {meal.badge && (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent p-sm">
            <span className="rounded-lg bg-inverse-surface/80 px-sm py-xs font-label-md text-caption text-inverse-on-surface backdrop-blur-md">
              {meal.badge}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-sm p-4">
        <div className="mb-sm flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-baseline gap-xs">
              <TimeField
                className="text-caption font-bold text-primary"
                label={meal.slotLabel}
                onChange={onTimeChange ? (time) => onTimeChange(meal.id, time) : undefined}
                time={meal.time}
              />
              <span className="whitespace-nowrap text-caption text-on-surface-variant">
                • {meal.slotLabel}
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{meal.title}</h3>
            {meal.rationale && (
              <p className="mt-xs flex items-start gap-xs font-body-md text-caption italic text-on-surface-variant">
                <Icon className="mt-[2px] text-caption text-primary" name="auto_awesome" />
                {meal.rationale}
              </p>
            )}
          </div>
          {canCheckEaten && (
            <button
              aria-label={
                meal.eaten
                  ? `Marquer ${meal.slotLabel} comme non pris`
                  : `Marquer ${meal.slotLabel} comme pris`
              }
              aria-pressed={meal.eaten}
              className={`flex items-center justify-center rounded-full p-1 transition-colors ${
                meal.eaten
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
              onClick={() => onToggleEaten(meal.id)}
              type="button"
            >
              <Icon
                filled={meal.eaten}
                name={meal.eaten ? 'check_circle' : 'radio_button_unchecked'}
              />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-caption">
            <thead className="border-b border-outline-variant text-on-surface-variant">
              <tr className="font-label-md">
                <th className="py-xs pr-xs">Aliment</th>
                <th className="px-xs py-xs">Qté</th>
                <th className="px-xs py-xs">kcal</th>
                <th className="px-xs py-xs">Prot.</th>
                <th className="py-xs pl-xs">Fibres</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {meal.items.map((item) => (
                <tr className="border-b border-outline-variant/30" key={item.name}>
                  <td className="py-xs pr-xs">
                    {canPickFood ? (
                      // Le geste reste un simple appui sur un bouton : le tableau
                      // défile encore horizontalement sans que rien ne l'intercepte.
                      <button
                        aria-label={`Actions pour ${item.name}`}
                        className="flex min-h-11 w-full items-center text-left underline decoration-outline-variant decoration-dotted underline-offset-4"
                        onClick={() => onPickFood(item)}
                        type="button"
                      >
                        {item.name}
                      </button>
                    ) : (
                      item.name
                    )}
                  </td>
                  <td className="px-xs py-xs">{item.quantity}</td>
                  <td className="px-xs py-xs">{item.calories}</td>
                  <td className="px-xs py-xs">{formatGrams(item.protein)}</td>
                  <td className="py-xs pl-xs">{formatGrams(item.fiber)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className="text-primary">
                <td className="pt-sm" colSpan={2}>
                  Total
                </td>
                <td className="pt-sm">~{Math.round(totals.calories)}</td>
                <td className="pt-sm">~{formatGrams(totals.protein)}</td>
                <td className="pt-sm">~{formatGrams(totals.fiber)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </article>
  )
}
