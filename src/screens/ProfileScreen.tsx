import { Icon } from '../components/Icon'
import { ChipInput } from '../components/profile/ChipInput'
import { NumberField } from '../components/profile/NumberField'
import { ScheduleSection } from '../components/profile/ScheduleSection'
import { SectionCard } from '../components/profile/SectionCard'
import type { UseProfileResult } from '../hooks/useProfile'
import type { UseScheduleResult } from '../hooks/useSchedule'
import {
  ACTIVITY_LEVELS,
  GOALS,
  HEALTH_TAGS,
  NOTES_MAX_LENGTH,
  computeBmi,
  describeGoals,
  toggle,
  type Sex,
} from '../lib/profile'

interface ProfileScreenProps {
  // Les états vivent dans App : une seconde instance de ces hooks ne verrait
  // pas ce qui est enregistré ici.
  profileStore: UseProfileResult
  scheduleStore: UseScheduleResult
  /** false tant que la clé et le modèle ne sont pas renseignés. */
  configured: boolean
}

export function ProfileScreen({ profileStore, scheduleStore, configured }: ProfileScreenProps) {
  const { profile, loaded, saveState, update, save } = profileStore
  const bmi = computeBmi(profile.heightCm, profile.weightKg)

  if (!loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-on-surface-variant">
        <span className="font-body-md text-body-md">Chargement de votre profil…</span>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-lg px-margin-mobile pb-xl">
      <header className="flex flex-col gap-xs pt-sm">
        <div className="flex items-center gap-xs text-primary">
          <Icon className="text-body-md" filled name="tune" />
          <span className="font-label-md text-label-md uppercase tracking-wider">
            Personnalisation active
          </span>
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Profil &amp; Contraintes
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Ces données permettent à l'IA d'adapter dynamiquement vos portions, calories et menus au
          quotidien.
        </p>
      </header>

      <SectionCard icon="accessibility_new" title="Biométrie &amp; Énergie">
        <div className="grid grid-cols-2 gap-sm">
          <NumberField
            label="Âge"
            max={120}
            min={1}
            onChange={(age) => update({ age })}
            unit="ans"
            value={profile.age}
          />
          <label className="flex flex-col justify-between rounded-lg bg-surface-container-low p-sm">
            <span className="font-caption text-caption text-on-surface-variant">
              Profil métabolique
            </span>
            <select
              className="mt-xs w-full min-w-0 bg-transparent font-headline-md text-body-lg font-semibold text-on-surface focus:outline-none"
              onChange={(event) => update({ sex: event.target.value as Sex })}
              value={profile.sex}
            >
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          </label>
          <NumberField
            label="Taille"
            max={250}
            min={50}
            onChange={(heightCm) => update({ heightCm })}
            unit="cm"
            value={profile.heightCm}
          />
          <NumberField
            label="Poids actuel"
            max={400}
            min={20}
            onChange={(weightKg) => update({ weightKg })}
            step={0.1}
            unit="kg"
            value={profile.weightKg}
          />
        </div>

        {bmi && (
          <div className="flex items-center justify-between gap-sm rounded-lg bg-surface-container-low px-md py-sm">
            <div className="flex items-center gap-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="text-body-md" name="speed" />
              </span>
              <span className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface">
                  Indicateur IMC : {bmi.value}
                </span>
                <span className="font-caption text-caption text-on-surface-variant">{bmi.label}</span>
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-xs pt-xs">
          <span className="font-label-md text-label-md text-on-surface">
            Rythme d'activité habituel
          </span>
          <div className="grid grid-cols-3 gap-xs">
            {ACTIVITY_LEVELS.map((level) => {
              const active = profile.activityLevel === level.id
              return (
                <button
                  aria-pressed={active}
                  className={`flex flex-col items-center justify-center rounded-lg p-sm transition-all ${
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                  key={level.id}
                  onClick={() => update({ activityLevel: level.id })}
                  type="button"
                >
                  <Icon className="text-body-lg" name={level.icon} />
                  <span className="mt-xs font-caption text-caption font-semibold">{level.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        aside={
          <span className="flex items-center gap-xs rounded-full bg-secondary-container px-sm py-xs font-label-md text-caption text-on-secondary-container">
            <Icon className="text-caption" name="checklist" /> Multi-sélection
          </span>
        }
        description="Sélectionnez un ou plusieurs objectifs pour orienter vos calculs de macros et suggestions."
        icon="track_changes"
        title="Objectifs Nutritionnels"
      >
        <div className="grid grid-cols-2 gap-xs">
          {GOALS.map((goal) => {
            const active = profile.goals.includes(goal.id)
            return (
              <button
                aria-pressed={active}
                className={`flex items-center justify-between gap-xs rounded-lg p-sm text-left transition-colors ${
                  active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface'
                }`}
                key={goal.id}
                onClick={() => update({ goals: toggle(profile.goals, goal.id) })}
                type="button"
              >
                <span className="flex items-center gap-xs">
                  <Icon
                    className={`text-body-md ${active ? '' : 'text-primary'}`}
                    name={goal.icon}
                  />
                  <span className="font-label-md text-caption font-semibold">{goal.label}</span>
                </span>
                <Icon
                  className={`text-caption ${active ? '' : 'text-outline'}`}
                  filled={active}
                  name={active ? 'check_circle' : 'add'}
                />
              </button>
            )
          })}
        </div>

        <div className="flex items-start gap-sm rounded-lg bg-primary/10 p-sm">
          <Icon className="mt-xs text-body-lg text-primary" filled name="hub" />
          <p className="font-body-md text-caption leading-relaxed text-on-surface-variant">
            <strong className="text-primary">Objectifs actifs combinés :</strong>{' '}
            {describeGoals(profile.goals)}
          </p>
        </div>
      </SectionCard>

      <SectionCard
        description="Indiquez vos sensibilités pour filtrer les protocoles culinaires adaptés."
        icon="healing"
        title="Santé &amp; Confort digestif"
      >
        <div className="flex flex-wrap gap-xs">
          {HEALTH_TAGS.map((tag) => {
            const active = profile.healthTags.includes(tag.id)
            return (
              <button
                aria-pressed={active}
                className={`flex items-center gap-xs rounded-full px-md py-xs font-label-md text-caption transition-all ${
                  active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface'
                }`}
                key={tag.id}
                onClick={() => update({ healthTags: toggle(profile.healthTags, tag.id) })}
                type="button"
              >
                <Icon className="text-caption" name={active ? 'check' : 'add'} />
                {tag.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-start gap-sm rounded-lg bg-secondary-container/50 p-sm">
          <Icon className="mt-xs text-body-lg text-secondary" name="shield_with_heart" />
          <p className="font-body-md text-caption leading-relaxed text-on-secondary-container">
            <strong>Engagement bienveillant :</strong> L'IA évitera les ingrédients irritants (sauces
            acides, épices fortes, surplus de lipides le soir) pour stabiliser votre confort et votre
            transit.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        aside={
          <span className="font-caption text-caption font-semibold uppercase tracking-wider text-tertiary">
            Exclusion 100%
          </span>
        }
        icon="error"
        iconClass="text-tertiary"
        title="Allergies strictes"
      >
        <ChipInput
          addButtonClass="bg-tertiary text-on-tertiary"
          chipClass="bg-tertiary-fixed text-on-tertiary-fixed"
          chipIcon="warning"
          chipIconClass="text-tertiary"
          onChange={(allergies) => update({ allergies })}
          placeholder="Ajouter une allergie ou intolérance..."
          rounded="lg"
          values={profile.allergies}
        />
      </SectionCard>

      <SectionCard icon="restaurant" title="Goûts &amp; Plaisir culinaire">
        <div className="flex flex-col gap-sm">
          <div className="flex items-center justify-between gap-sm">
            <span className="flex items-center gap-xs">
              <Icon className="text-body-md text-primary" filled name="favorite" />
              <span className="font-headline-md text-body-md font-semibold text-on-surface">
                Aliments favoris
              </span>
            </span>
            <span className="shrink-0 font-caption text-caption text-on-surface-variant">
              Favorisés aux repas
            </span>
          </div>
          <ChipInput
            addButtonClass="bg-primary text-on-primary"
            chipClass="bg-primary/10 text-primary"
            onChange={(favorites) => update({ favorites })}
            placeholder="Ajouter un aliment aimé..."
            values={profile.favorites}
          />
        </div>

        <div className="flex flex-col gap-sm pt-xs">
          <div className="flex items-center justify-between gap-sm">
            <span className="flex items-center gap-xs">
              <Icon className="text-body-md text-secondary" name="block" />
              <span className="font-headline-md text-body-md font-semibold text-on-surface">
                Non appréciés / Exclus
              </span>
            </span>
            <span className="shrink-0 font-caption text-caption text-on-surface-variant">
              Remplacés d'office
            </span>
          </div>
          <ChipInput
            addButtonClass="bg-secondary text-on-secondary"
            chipClass="bg-surface-container text-on-surface-variant"
            onChange={(dislikes) => update({ dislikes })}
            placeholder="Ajouter un aliment à écarter..."
            values={profile.dislikes}
          />
        </div>
      </SectionCard>

      <SectionCard icon="edit_note" title="Précisions libres">
        <textarea
          className="w-full resize-y rounded-lg bg-surface-container-low p-sm font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
          maxLength={NOTES_MAX_LENGTH}
          onChange={(event) => update({ notes: event.target.value })}
          placeholder="Ex : je vais au travail en vélo le mardi, mercredi et jeudi (18 km), télétravail le lundi et vendredi. Salle de sport le mardi matin, 30 minutes."
          rows={5}
          value={profile.notes}
        />
        <div className="flex items-start justify-between gap-sm">
          <p className="font-caption text-caption text-on-surface-variant">
            Ce texte est transmis tel quel au coach, en plus de votre profil.
          </p>
          <span
            className={`shrink-0 font-caption text-caption ${
              profile.notes.length >= NOTES_MAX_LENGTH ? 'text-error' : 'text-on-surface-variant'
            }`}
          >
            {profile.notes.length} / {NOTES_MAX_LENGTH}
          </span>
        </div>
      </SectionCard>

      <ScheduleSection configured={configured} notes={profile.notes} scheduleStore={scheduleStore} />

      <div className="flex items-start gap-sm rounded-xl bg-primary/10 p-md">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Icon className="text-body-md" filled name="auto_awesome" />
        </span>
        <span className="flex flex-col gap-xs">
          <span className="font-label-md text-label-md font-semibold text-primary">
            Impact IA NutriAdapt
          </span>
          <p className="font-body-md text-caption leading-relaxed text-on-surface-variant">
            Chaque modification réajuste vos suggestions de repas et le calcul des micronutriments
            (fibres, fer, vitamines) dès l'enregistrement.
          </p>
        </span>
      </div>

      <div className="sticky bottom-20 z-30 pt-xs">
        <button
          className="flex w-full items-center justify-center gap-sm rounded-xl bg-primary py-md font-headline-md text-body-md text-on-primary shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
          disabled={saveState === 'saving'}
          onClick={save}
          type="button"
        >
          <Icon className="text-body-lg" filled={saveState === 'saved'} name={saveState === 'saved' ? 'check' : 'verified'} />
          <span>
            {saveState === 'saved'
              ? 'Préférences enregistrées !'
              : saveState === 'saving'
                ? 'Enregistrement…'
                : 'Enregistrer mes préférences'}
          </span>
        </button>
        {saveState === 'error' && (
          <p className="mt-xs rounded-lg bg-error-container p-sm text-center font-label-md text-caption text-on-error-container">
            Enregistrement impossible — le stockage du navigateur est peut-être bloqué.
          </p>
        )}
      </div>
    </div>
  )
}
