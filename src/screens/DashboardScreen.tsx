import { useRef, useState } from 'react'
import { ActivityCard } from '../components/ActivityCard'
import { AddActivityForm } from '../components/AddActivityForm'
import { DaySelector } from '../components/DaySelector'
import { FoodActionSheet } from '../components/FoodActionSheet'
import { Icon } from '../components/Icon'
import { MacroGrid } from '../components/MacroGrid'
import { MealCard } from '../components/MealCard'
import { MenuStateCard } from '../components/MenuStateCard'
import { dashboardData } from '../data/dashboard'
import type { UseActivitiesResult } from '../hooks/useActivities'
import type { UseDailyMenuResult } from '../hooks/useDailyMenu'
import { toMacroRings } from '../lib/ai/menuMap'
import { dayLabel, isToday, isTomorrow } from '../lib/day'
import { dailyTarget } from '../lib/energy'
import { buildTimeline } from '../lib/timeline'
import type { Profile } from '../lib/profile'
import type { FoodItem } from '../types'

/** Aliment touché, avec le repas d'où il vient : les deux nomment la demande. */
interface PickedFood {
  item: FoodItem
  mealLabel: string
}

interface DashboardScreenProps {
  profile: Profile
  /** Classe un aliment dans une liste de goûts du profil ; faux si rien n'a été enregistré. */
  addTaste: (list: 'favorites' | 'dislikes', food: string) => Promise<boolean>
  /** Vrai quand la lecture du profil a échoué : plus aucune écriture n'est possible. */
  profileReadFailed: boolean
  activities: UseActivitiesResult
  dailyMenu: UseDailyMenuResult
  /** Vrai quand une clé et un modèle sont enregistrés. */
  configured: boolean
  /** Jour affiché, au format AAAA-MM-JJ. */
  day: string
  onDayChange: (day: string) => void
  /** Vrai pour un jour révolu : la journée se consulte, ne se modifie pas. */
  readOnly: boolean
  /** Vrai quand le volet coach est ouvert par-dessus l'écran. */
  coachOpen: boolean
}

export function DashboardScreen({
  profile,
  addTaste,
  profileReadFailed,
  activities: activityStore,
  dailyMenu,
  configured,
  day,
  onDayChange,
  readOnly,
  coachOpen,
}: DashboardScreenProps) {
  const { activities, add, remove, confirm } = activityStore
  const { menu, meals, state, error, dropped, generate, toggleEaten, revise } = dailyMenu
  const [adding, setAdding] = useState(false)
  const [shownDay, setShownDay] = useState(day)
  const [picked, setPicked] = useState<PickedFood | null>(null)
  // Le rejet est enregistré dès le geste, mais la feuille reste ouverte pour
  // proposer le remplacement : c'est à l'utilisateur de trancher.
  const [replaceOffered, setReplaceOffered] = useState(false)
  const [tasteError, setTasteError] = useState('')
  // Le masquage porte sur l'identifiant de la révision, pas sur son texte : deux
  // révisions de suite peuvent se résumer par la même phrase.
  const [dismissedRevision, setDismissedRevision] = useState(0)
  // Identité de la feuille ouverte : une écriture lente peut se résoudre alors
  // que la feuille a été refermée puis rouverte sur un autre aliment. Refermer
  // seul ne compte pas : il ne reste alors rien à l'écran sur quoi agir, et la
  // réouverture remet de toute façon la feuille à neuf.
  const sheetGeneration = useRef(0)

  // Changer de jour referme le formulaire : sa saisie portait sur la journée
  // qu'on vient de quitter. L'ajustement se fait pendant le rendu, pour que le
  // formulaire ne réapparaisse pas le temps d'une frame.
  if (shownDay !== day) {
    setShownDay(day)
    setAdding(false)
    setPicked(null)
    setReplaceOffered(false)
    setTasteError('')
    setDismissedRevision(0)
  }

  // Confirmer une séance ou cocher un repas ne se fait que le jour même :
  // demain, rien n'a encore eu lieu.
  const live = isToday(day)
  // Une révision en cours réécrit le menu : agir sur l'aliment affiché
  // porterait sur un repas déjà remplacé.
  const revising = dailyMenu.reviseState === 'revising'
  // Préparer la veille est le cas d'usage de ces actions : elles suivent donc
  // la règle de la révision, ouverte à demain, et non celle de la coche.
  const foodActions = !readOnly && !revising

  function closeSheet() {
    setPicked(null)
    setReplaceOffered(false)
    setTasteError('')
  }

  function openSheet(item: FoodItem, mealLabel: string) {
    sheetGeneration.current += 1
    setPicked({ item, mealLabel })
    setReplaceOffered(false)
    setTasteError('')
  }

  /** Enchaîne `after` sur un enregistrement réussi, sinon garde la feuille ouverte. */
  async function recordTaste(list: 'favorites' | 'dislikes', food: string, after: () => void) {
    const generation = sheetGeneration.current
    const saved = await addTaste(list, food)
    // La feuille du geste n'est plus à l'écran : sa suite porterait sur un
    // aliment que l'utilisateur n'a pas jugé.
    if (sheetGeneration.current !== generation) return
    if (saved) {
      setTasteError('')
      after()
      return
    }
    // Un profil illisible et une écriture refusée n'appellent pas le même geste :
    // le premier ne se retente pas, la seconde si.
    setTasteError(
      profileReadFailed
        ? "Votre profil n'a pas pu être lu, ce choix n'a pas été enregistré."
        : "Ce choix n'a pas pu être enregistré. Réessayez.",
    )
  }

  function requestReplacement(food: PickedFood) {
    void revise(
      `Je n'ai pas de ${food.item.name.trim()} pour le ${food.mealLabel}. Remplace-le ; si le plat ne tient plus sans lui, repropose ce repas. Garde les autres repas à l'identique.`,
    )
    closeSheet()
  }

  const timeline = buildTimeline(meals, activities)
  const macros = toMacroRings(meals, dailyTarget(profile, activities), profile.weightKg)

  return (
    <div className="flex w-full flex-col gap-lg px-margin-mobile pb-40 pt-sm">
      <DaySelector day={day} onChange={onDayChange} />

      {readOnly && (
        <p className="flex items-center gap-xs rounded-xl bg-surface-container px-md py-sm font-body-md text-caption text-on-surface-variant">
          <Icon className="text-body-md" name="history" />
          Journée archivée — consultation seule.
        </p>
      )}

      {menu && menu.banner.trim().length > 0 && (
        <div className="flex items-start gap-sm rounded-xl bg-primary-container p-md text-on-primary-container shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <Icon className="mt-[2px]" name="auto_awesome" />
          <p className="font-body-md text-body-md">
            <span className="font-bold">Menu du jour :</span> {menu.banner}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-xs">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-background">
          Votre menu — {dayLabel(day).toLowerCase()}
        </h1>
      </div>

      <MacroGrid macros={macros} micros={dashboardData.micros} />

      <div className="mt-sm flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-xs px-xs">
          <h2 className="flex items-center gap-xs font-label-md text-caption uppercase tracking-wider text-on-surface-variant">
            <Icon className="text-body-md text-primary" name="timeline" />
            Chronologie &amp; Dépenses
          </h2>
          {live && !adding && (
            <button
              className="flex items-center gap-xs rounded-full bg-surface-container px-sm py-1 font-label-md text-caption text-primary transition-colors hover:bg-surface-container-high active:scale-95"
              onClick={() => setAdding(true)}
              type="button"
            >
              <Icon className="text-caption" name="add" />
              <span>Intercaler une activité</span>
            </button>
          )}
        </div>

        {live && adding && (
          <AddActivityForm
            onAdd={(activity) => {
              add(activity)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
            weightKg={profile.weightKg}
          />
        )}

        {state === 'error' && (meals.length > 0 || readOnly) && (
          <p className="rounded-xl bg-error-container p-sm font-body-md text-body-md text-on-error-container">
            {error}
          </p>
        )}

        {dailyMenu.reviseError && (
          <p className="flex items-center gap-xs rounded-xl bg-error-container px-md py-sm font-body-md text-body-md text-on-error-container">
            <Icon className="text-body-md" name="error" />
            {dailyMenu.reviseError}
          </p>
        )}

        {/* Le volet coach porte déjà ce message : sous lui, il se lirait deux fois. */}
        {!coachOpen && dailyMenu.reviseNotice && dailyMenu.reviseId !== dismissedRevision && (
          <p className="flex items-center gap-xs rounded-xl bg-surface-container px-md py-sm font-body-md text-caption text-on-surface-variant">
            <Icon className="text-body-md" name="auto_awesome" />
            <span className="flex-1">{dailyMenu.reviseNotice}</span>
            <button
              aria-label="Masquer le résultat de la révision"
              className="shrink-0 rounded-full p-1 transition-colors active:bg-surface-container-highest"
              onClick={() => setDismissedRevision(dailyMenu.reviseId)}
              type="button"
            >
              <Icon className="text-body-md" name="close" />
            </button>
          </p>
        )}

        {dropped.length > 0 && (
          <p className="rounded-xl bg-surface-container p-sm font-body-md text-caption text-on-surface-variant">
            {dropped.length === 1
              ? `1 repas a été ignoré car la réponse du modèle était incomplète : ${dropped[0]}.`
              : `${dropped.length} repas ont été ignorés car la réponse du modèle était incomplète : ${dropped.join(', ')}.`}
          </p>
        )}

        {meals.length === 0 && !readOnly && (
          <MenuStateCard
            configured={configured}
            dayLabel={dayLabel(day)}
            error={error}
            onGenerate={generate}
            state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'idle'}
            tomorrow={isTomorrow(day)}
          />
        )}

        {timeline.map((entry) =>
          entry.kind === 'meal' ? (
            <MealCard
              key={entry.meal.id}
              canCheckEaten={live}
              canPickFood={foodActions}
              meal={entry.meal}
              onPickFood={(item) => openSheet(item, entry.meal.slotLabel)}
              onToggleEaten={toggleEaten}
            />
          ) : (
            <ActivityCard
              activity={entry.activity}
              key={entry.activity.id}
              onConfirm={confirm}
              onRemove={remove}
              readOnly={!live}
              weightKg={profile.weightKg}
            />
          ),
        )}
      </div>

      {picked && (
        <FoodActionSheet
          food={picked.item}
          mealLabel={picked.mealLabel}
          onClose={closeSheet}
          onDislike={() => {
            void recordTaste('dislikes', picked.item.name, () => setReplaceOffered(true))
          }}
          onLike={() => {
            void recordTaste('favorites', picked.item.name, closeSheet)
          }}
          onMissing={() => requestReplacement(picked)}
          onReplace={() => requestReplacement(picked)}
          replaceOffered={replaceOffered}
          tasteError={tasteError}
        />
      )}
    </div>
  )
}
