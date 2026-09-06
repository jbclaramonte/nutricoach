# Calendrier des journées et menu du lendemain — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de consulter l'historique des journées et de générer le menu du lendemain, en faisant suivre un jour sélectionné au menu, aux activités et au coach.

**Architecture:** Un module `src/lib/day.ts` devient la seule source de vérité sur les dates. `App` porte le jour sélectionné et le passe aux trois hooks datés, qui perdent leur `todayKey()` interne. Les trois purges « efface le passé » sont remplacées par une rétention unique de 90 jours.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, IndexedDB via `src/lib/db.ts`, vitest (ajouté par ce plan), oxlint.

**Spec:** `docs/superpowers/specs/2026-09-06-menu-du-lendemain-design.md`

## Global Constraints

- Commentaires, libellés d'interface et messages d'erreur en français ; l'utilisateur est vouvoyé.
- Les commentaires expliquent pourquoi le code est ainsi, jamais ce qu'il fait.
- Messages de commit en anglais, une phrase à l'impératif décrivant l'effet.
- `npm run build` et `npm run lint` passent à la fin de chaque tâche.
- Rétention : 90 jours. Plage du sélecteur : `[aujourd'hui − 90 j, demain]`.
- Aucune écriture en base pour un jour futur tant qu'aucun menu n'y est généré.
- Un jour passé est en consultation seule ; demain n'accepte que la génération et la révision du menu.

---

### Task 1: Module de dates et runner de tests

**Files:**
- Create: `src/lib/day.ts`
- Create: `src/lib/day.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.app.json`

**Interfaces:**
- Consumes: rien.
- Produces: `dayKey(date: Date): string`, `todayKey(): string`, `shiftDay(key: string, days: number): string`, `dayLabel(key: string): string`, `isPast(key: string): boolean`, `isToday(key: string): boolean`, `isTomorrow(key: string): boolean`, `oldestKey(): string`, `RETENTION_DAYS: number`.

- [ ] **Step 1: Installer vitest**

```bash
npm install --save-dev vitest@^3
```

Puis ajouter le script dans `package.json`, section `scripts` :

```json
    "test": "vitest run",
```

- [ ] **Step 2: Écrire les tests qui échouent**

Créer `src/lib/day.test.ts` :

```ts
import { describe, expect, it, vi } from 'vitest'
import { dayKey, dayLabel, isPast, isTomorrow, oldestKey, shiftDay, todayKey } from './day'

/** Fige l'horloge sur une date locale, pour que « aujourd'hui » soit connu. */
function at(iso: string, run: () => void) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
  try {
    run()
  } finally {
    vi.useRealTimers()
  }
}

describe('dayKey', () => {
  it('formate en AAAA-MM-JJ local, avec zéros de tête', () => {
    expect(dayKey(new Date(2026, 8, 6, 23, 30))).toBe('2026-09-06')
    expect(dayKey(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('shiftDay', () => {
  it('avance et recule d’un jour', () => {
    expect(shiftDay('2026-09-06', 1)).toBe('2026-09-07')
    expect(shiftDay('2026-09-06', -1)).toBe('2026-09-05')
  })

  it('franchit les mois et les années', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('reste juste au passage à l’heure d’hiver', () => {
    // Nuit du 25 au 26 octobre 2026 en Europe : 25 heures dans la journée.
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftDay('2026-10-26', -1)).toBe('2026-10-25')
  })

  it('recule de 90 jours sans dérive', () => {
    expect(shiftDay('2026-09-06', -90)).toBe('2026-06-08')
  })
})

describe('bornes', () => {
  it('place la borne basse 90 jours avant aujourd’hui', () => {
    at('2026-09-06T12:00:00', () => {
      expect(todayKey()).toBe('2026-09-06')
      expect(oldestKey()).toBe('2026-06-08')
    })
  })

  it('reconnaît hier, aujourd’hui et demain', () => {
    at('2026-09-06T12:00:00', () => {
      expect(isPast('2026-09-05')).toBe(true)
      expect(isPast('2026-09-06')).toBe(false)
      expect(isTomorrow('2026-09-07')).toBe(true)
      expect(isTomorrow('2026-09-08')).toBe(false)
    })
  })
})

describe('dayLabel', () => {
  it('nomme les jours proches, date complète au-delà', () => {
    at('2026-09-06T12:00:00', () => {
      expect(dayLabel('2026-09-06')).toBe("Aujourd'hui")
      expect(dayLabel('2026-09-07')).toBe('Demain')
      expect(dayLabel('2026-09-01')).toBe('mardi 1 septembre')
    })
  })
})
```

- [ ] **Step 3: Lancer les tests pour les voir échouer**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./day"`.

- [ ] **Step 4: Écrire le module**

Créer `src/lib/day.ts` :

```ts
/** Nombre de jours d'historique conservés dans IndexedDB. */
export const RETENTION_DAYS = 90

/** Clé d'un jour, au format AAAA-MM-JJ, en heure locale. */
export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayKey(): string {
  return dayKey(new Date())
}

/**
 * Décale une clé de jour. Le calcul passe par une date fixée à midi : ajouter
 * des millisecondes ferait dériver la journée d'une heure au changement
 * d'heure, et un décalage négatif tomberait la veille.
 */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  return dayKey(new Date(year, month - 1, day + days, 12))
}

/** Borne basse du calendrier : au-delà, les journées sont purgées. */
export function oldestKey(): string {
  return shiftDay(todayKey(), -RETENTION_DAYS)
}

export function isToday(key: string): boolean {
  return key === todayKey()
}

export function isPast(key: string): boolean {
  return key < todayKey()
}

export function isTomorrow(key: string): boolean {
  return key === shiftDay(todayKey(), 1)
}

const FULL_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Libellé lisible : les deux jours proches sont nommés, les autres datés. */
export function dayLabel(key: string): string {
  if (isToday(key)) return "Aujourd'hui"
  if (isTomorrow(key)) return 'Demain'
  const [year, month, day] = key.split('-').map(Number)
  return FULL_DATE.format(new Date(year, month - 1, day, 12))
}
```

- [ ] **Step 5: Lancer les tests pour les voir passer**

Run: `npm test`
Expected: PASS, 8 tests.

- [ ] **Step 6: Vérifier build et lint**

Run: `npm run build && npm run lint`
Expected: aucun message d'erreur.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/day.ts src/lib/day.test.ts
git commit -m "feat: give the app a single source of truth for calendar days"
```

---

### Task 2: Rétention unique à la place des trois purges

**Files:**
- Create: `src/lib/retention.ts`
- Create: `src/lib/retention.test.ts`
- Modify: `src/hooks/useActivities.ts` (supprimer `purgeOldDays` et son appel)
- Modify: `src/hooks/useDailyMenu.ts` (supprimer `purgeOldMenus` et son appel)
- Modify: `src/hooks/useCoachChat.ts` (supprimer `purgeOldChats` et son appel)
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `oldestKey` de `src/lib/day.ts`, `dbDelete`/`dbKeys` de `src/lib/db.ts`.
- Produces: `expiredKeys(keys: string[], oldest: string): string[]`, `purgeExpired(): Promise<void>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/retention.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { expiredKeys } from './retention'

describe('expiredKeys', () => {
  const oldest = '2026-06-08'

  it('garde les journées dans la fenêtre', () => {
    const keys = ['menu:2026-06-08', 'activities:2026-09-06', 'chat:2026-09-07']
    expect(expiredKeys(keys, oldest)).toEqual([])
  })

  it('supprime les journées antérieures à la fenêtre', () => {
    const keys = ['menu:2026-06-07', 'activities:2026-01-02', 'chat:2026-06-08']
    expect(expiredKeys(keys, oldest)).toEqual(['menu:2026-06-07', 'activities:2026-01-02'])
  })

  it('supprime les clés héritées sans date', () => {
    expect(expiredKeys(['activities:today', 'chat:messages'], oldest)).toEqual([
      'activities:today',
      'chat:messages',
    ])
  })

  it('ne touche pas aux clés étrangères aux journées', () => {
    const keys = ['profile', 'ai:settings', 'models:catalog', 'schedule']
    expect(expiredKeys(keys, oldest)).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./retention"`.

- [ ] **Step 3: Écrire le module**

Créer `src/lib/retention.ts` :

```ts
import { dbDelete, dbKeys } from './db'
import { oldestKey } from './day'

/** Magasins découpés par jour : tout le reste est hors du ménage. */
const DATED_PREFIXES = ['menu:', 'activities:', 'chat:']

/**
 * Clés sans date, héritées du modèle antérieur au découpage par jour. Elles
 * trient après les clés datées et échapperaient à la comparaison.
 */
const LEGACY_KEYS = ['activities:today', 'chat:messages']

/** Clés à supprimer : hors de la fenêtre de rétention, ou héritées. */
export function expiredKeys(keys: string[], oldest: string): string[] {
  return keys.filter((key) => {
    if (LEGACY_KEYS.includes(key)) return true
    const prefix = DATED_PREFIXES.find((entry) => key.startsWith(entry))
    if (!prefix) return false
    return key.slice(prefix.length) < oldest
  })
}

/**
 * Ménage unique de l'historique, au démarrage. Sans lui le magasin grossirait
 * indéfiniment ; avec une fenêtre trop courte, le calendrier n'aurait rien à
 * montrer.
 */
export function purgeExpired(): Promise<void> {
  return dbKeys()
    .then((keys) => Promise.all(expiredKeys(keys, oldestKey()).map((key) => dbDelete(key))))
    .then(() => undefined)
    .catch((error) => console.error('[historique] purge impossible', error))
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Supprimer les trois purges existantes**

Dans `src/hooks/useActivities.ts` : supprimer la fonction `purgeOldDays` avec son commentaire, l'appel `.then(() => purgeOldDays(key))` dans l'effet de chargement, et l'import `dbDelete`/`dbKeys` devenu inutile (garder `dbGet`, `dbSet`).

Dans `src/hooks/useDailyMenu.ts` : supprimer `purgeOldMenus` avec son commentaire et son appel, et retirer `dbDelete`/`dbKeys` de l'import.

Dans `src/hooks/useCoachChat.ts` : supprimer `purgeOldChats` avec son commentaire et l'appel `void purgeOldChats(key)`, et retirer `dbDelete`/`dbKeys` de l'import.

Attention : dans `useCoachChat`, la constante `KEY_PREFIX` reste utilisée par `todayKey()` ; dans `useActivities`, `LEGACY_KEY` reste utilisée par la migration au chargement.

- [ ] **Step 6: Brancher la rétention dans App**

Dans `src/App.tsx`, ajouter les imports :

```tsx
import { useEffect } from 'react'
import { purgeExpired } from './lib/retention'
```

puis, au début du corps de `App`, avant les hooks de données :

```tsx
  // Le ménage de l'historique est fait une fois, au démarrage : les hooks de
  // journée ne connaissent plus que la date qu'on leur donne.
  useEffect(() => {
    void purgeExpired()
  }, [])
```

- [ ] **Step 7: Vérifier**

Run: `npm test && npm run build && npm run lint`
Expected: tests verts, build sans erreur TypeScript (aucun import inutilisé restant).

- [ ] **Step 8: Commit**

```bash
git add src/lib/retention.ts src/lib/retention.test.ts src/hooks src/App.tsx
git commit -m "feat: keep ninety days of history instead of erasing the past each day"
```

---

### Task 3: `useActivities` suit le jour donné

**Files:**
- Create: `src/lib/dayActivities.ts`
- Create: `src/lib/dayActivities.test.ts`
- Modify: `src/hooks/useActivities.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `plannedActivitiesFor` de `src/lib/schedule.ts`, `dayKey`/`isToday` de `src/lib/day.ts`.
- Produces: `dateOfKey(key: string): Date`, `useActivities(schedule, scheduleLoaded, dayKey: string, editable: boolean): UseActivitiesResult`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/dayActivities.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { dateOfKey } from './dayActivities'
import { plannedActivitiesFor } from './schedule'

describe('dateOfKey', () => {
  it('rend une date locale à midi, pour ce jour-là', () => {
    const date = dateOfKey('2026-09-07')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(7)
  })

  it('donne au planning le bon jour de la semaine', () => {
    // Le 7 septembre 2026 est un lundi : ISO 1.
    const schedule = [
      {
        id: 'velo',
        typeId: 'cycling',
        title: 'Vélo au travail',
        time: '08:00',
        durationMin: 50,
        weekdays: [1],
      },
    ]
    const monday = plannedActivitiesFor(dateOfKey('2026-09-07'), schedule)
    const tuesday = plannedActivitiesFor(dateOfKey('2026-09-08'), schedule)
    expect(monday).toHaveLength(1)
    expect(monday[0].durationMin).toBe(50)
    expect(tuesday).toHaveLength(0)
  })
})
```

Si le type `RecurringActivity` exige d'autres champs, compléter l'objet du test avec les valeurs exigées ; ne pas modifier le type.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./dayActivities"`.

- [ ] **Step 3: Écrire le helper**

Créer `src/lib/dayActivities.ts` :

```ts
/**
 * Date correspondant à une clé de jour, fixée à midi : le planning ne lit que
 * le jour de la semaine, et midi met la journée hors d'atteinte des sauts
 * d'heure.
 */
export function dateOfKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Faire suivre le jour au hook**

Dans `src/hooks/useActivities.ts` :

1. Supprimer la fonction locale `todayKey()` et sa constante `KEY_PREFIX` si elle ne sert plus qu'à elle ; sinon garder `KEY_PREFIX` pour composer la clé.
2. Nouvelle signature :

```ts
export function useActivities(
  schedule: RecurringActivity[],
  scheduleLoaded: boolean,
  day: string,
  editable: boolean,
): UseActivitiesResult {
```

3. La clé du magasin devient `` `${KEY_PREFIX}${day}` ``. Remplacer partout `todayKey()` par cette expression, et le garde-fou `dayKey.current` par une comparaison au `day` reçu.
4. L'effet de chargement dépend de `day` : `}, [day])` au lieu de `}, [])`. Y remettre `setStored(null)` et `setLoaded(false)` en entrée d'effet, sans quoi la journée précédente resterait affichée pendant la lecture.
5. La migration de `LEGACY_KEY` ne s'applique qu'au jour courant : l'entourer de `if (isToday(day))`. Reprendre l'ancien journal sous la clé d'un jour passé serait faux.
6. Les activités du planning sont dérivées du jour affiché :

```ts
  const planned = plannedActivitiesFor(dateOfKey(day), schedule)
```

7. `add`, `remove` et `confirm` sortent sans rien faire si `editable` est faux :

```ts
    // Un jour archivé ou seulement prévu ne s'édite pas : une commande restée
    // en vol après un changement de jour écrirait dans la mauvaise journée.
    if (!editable) return
```

8. Le jeu de démonstration (`defaultActivities`) ne s'applique qu'à aujourd'hui : `stored?.activities ?? (isToday(day) && schedule.length === 0 ? defaultActivities : [])`. Sinon chaque jour vide de l'historique afficherait la démo.

Ajouter les imports `import { isToday } from '../lib/day'` et `import { dateOfKey } from '../lib/dayActivities'`.

- [ ] **Step 6: Appeler le hook avec le jour**

Dans `src/App.tsx`, pour cette tâche seulement, passer le jour courant en dur — le sélecteur arrive en tâche 7 :

```tsx
  const activityStore = useActivities(scheduleStore.schedule, scheduleStore.loaded, todayKey(), true)
```

avec `import { todayKey } from './lib/day'`.

- [ ] **Step 7: Vérifier**

Run: `npm test && npm run build && npm run lint`
Expected: tout passe.

- [ ] **Step 8: Commit**

```bash
git add src/lib/dayActivities.ts src/lib/dayActivities.test.ts src/hooks/useActivities.ts src/App.tsx
git commit -m "feat: read a day's activities from the day it is given"
```

---

### Task 4: `useDailyMenu` suit le jour donné

**Files:**
- Modify: `src/hooks/useDailyMenu.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `dayLabel` de `src/lib/day.ts`.
- Produces: `useDailyMenu(settings, profile, profileLoaded, activities, models, day: string, editable: boolean): UseDailyMenuResult`.

- [ ] **Step 1: Faire suivre le jour au hook**

Dans `src/hooks/useDailyMenu.ts` :

1. Supprimer la fonction locale `todayKey()`, garder `KEY_PREFIX`.
2. Nouvelle signature, `day` et `editable` ajoutés après `models`.
3. `applyStored` écrit sous `` `${KEY_PREFIX}${day}` ``. Comme `applyStored` est un `useCallback`, ajouter `day` à ses dépendances — sans quoi une génération lancée avant un changement de jour écrirait sous l'ancienne clé.
4. L'effet de chargement dépend de `day` et réinitialise l'état en entrée : `setStored(null)`, `storedRef.current = null`, `setState('idle')`, `setError('')`, `setDropped([])`.
5. `generate`, `revise` et `toggleEaten` sortent immédiatement si `editable` est faux.
6. `toggleEaten` sort aussi si le jour n'est pas aujourd'hui : on ne coche pas un repas d'un jour qu'on n'est pas en train de vivre.

```ts
    // Cocher un repas est un geste du présent : ni un jour archivé ni un jour
    // à venir n'ont de repas « pris ».
    if (!isToday(day)) return
```

7. La requête de menu porte déjà un libellé de date : remplacer l'appel à `buildMenuRequest` pour qu'il reçoive `dayLabel(day)` au lieu du libellé d'aujourd'hui calculé sur place.

- [ ] **Step 2: Mettre l'appel à jour dans App**

```tsx
  const dailyMenu = useDailyMenu(
    settings,
    profile,
    profileStore.loaded,
    activityStore.activities,
    models,
    todayKey(),
    true,
  )
```

- [ ] **Step 3: Vérifier**

Run: `npm test && npm run build && npm run lint`
Expected: tout passe.

- [ ] **Step 4: Vérifier à la main que rien n'a régressé**

Run: `npm run dev`
Ouvrir l'application, générer un menu, cocher un repas, recharger la page : le menu et la coche reviennent.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDailyMenu.ts src/App.tsx
git commit -m "feat: store and load the menu under the day it belongs to"
```

---

### Task 5: `useCoachChat` suit le jour donné

**Files:**
- Modify: `src/hooks/useCoachChat.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `dayKey` de `src/lib/day.ts`.
- Produces: `useCoachChat(settings, profile, activities, todaysMenu, models, day: string, editable: boolean): UseCoachChatResult`.

- [ ] **Step 1: Faire suivre le jour au hook**

Dans `src/hooks/useCoachChat.ts` :

1. Supprimer la fonction locale `todayKey()`, garder `KEY_PREFIX`.
2. Nouvelle signature, `day` et `editable` ajoutés après `models`.
3. `persist` écrit sous `` `${KEY_PREFIX}${day}` `` ; ajouter `day` à ses dépendances de `useCallback`.
4. L'effet de chargement dépend de `day`. En entrée d'effet :

```ts
    // Le flux du jour précédent écrirait ses tokens dans la conversation
    // affichée : il est coupé avant de changer de journée.
    controller.current?.abort()
    controller.current = null
    loaded.current = false
    applyMessages([])
    setState('idle')
    setError('')
```

5. `send` et `clear` sortent immédiatement si `editable` est faux.

- [ ] **Step 2: Mettre l'appel à jour dans App**

```tsx
  const { messages, state, error, send, stop, clear } = useCoachChat(
    settings,
    profile,
    activityStore.activities,
    dailyMenu.menu,
    models,
    todayKey(),
    true,
  )
```

- [ ] **Step 3: Vérifier**

Run: `npm test && npm run build && npm run lint`
Expected: tout passe.

- [ ] **Step 4: Vérifier à la main**

Run: `npm run dev`
Poser une question au coach, recharger : la conversation du jour revient.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCoachChat.ts src/App.tsx
git commit -m "feat: keep one coach conversation per day, chosen by the caller"
```

---

### Task 6: Le prompt dit de quel jour il parle

**Files:**
- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/hooks/useCoachChat.ts`
- Modify: `src/hooks/useDailyMenu.ts`
- Create: `src/lib/ai/prompts.test.ts`

**Interfaces:**
- Consumes: `dayLabel` de `src/lib/day.ts`.
- Produces: `buildCoachSystemPrompt(profile, activities, dayLabel: string, todaysMenu?: GeneratedMenu): string`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/ai/prompts.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { buildCoachSystemPrompt } from './prompts'
import { defaultProfile } from '../profile'

describe('buildCoachSystemPrompt', () => {
  it('annonce le jour décrit', () => {
    const prompt = buildCoachSystemPrompt(defaultProfile, [], 'lundi 7 septembre (demain)')
    expect(prompt).toContain('LA JOURNÉE — lundi 7 septembre (demain)')
  })
})
```

Si `src/lib/profile.ts` n'exporte pas `defaultProfile`, utiliser le nom réel du profil par défaut qu'il exporte ; ne pas en créer un nouveau.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npm test`
Expected: FAIL — la chaîne attendue n'apparaît pas.

- [ ] **Step 3: Ajouter le libellé au prompt**

Dans `src/lib/ai/prompts.ts`, signature :

```ts
export function buildCoachSystemPrompt(
  profile: Profile,
  activities: Activity[],
  dayLabel: string,
  todaysMenu?: GeneratedMenu,
): string {
```

et, dans le bloc de la journée, remplacer la ligne de titre `'LA JOURNÉE',` par :

```ts
      // Sans le jour nommé, le modèle raisonne toujours comme si la journée
      // décrite était celle en cours.
      `LA JOURNÉE — ${dayLabel}`,
```

Adapter aussi la phrase de repli « Aucune activité faite ou confirmée aujourd’hui. » en « Aucune activité faite ou confirmée ce jour-là. »

- [ ] **Step 4: Mettre les deux appelants à jour**

Dans `src/hooks/useCoachChat.ts` :

```ts
              buildCoachSystemPrompt(profile, activities, dayLabel(day), todaysMenu ?? undefined),
```

Dans `src/hooks/useDailyMenu.ts`, aux deux appels (génération et révision), passer `dayLabel(day)` en troisième argument, le menu en quatrième. Ajouter `import { dayLabel } from '../lib/day'` dans les deux fichiers.

- [ ] **Step 5: Vérifier**

Run: `npm test && npm run build && npm run lint`
Expected: tout passe.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts src/hooks/useCoachChat.ts src/hooks/useDailyMenu.ts
git commit -m "feat: tell the coach which day it is describing"
```

---

### Task 7: Sélecteur de jour et états de consultation

**Files:**
- Create: `src/components/DaySelector.tsx`
- Modify: `src/App.tsx`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/components/chat/CoachSheet.tsx`

**Interfaces:**
- Consumes: `dayLabel`, `isPast`, `isToday`, `isTomorrow`, `oldestKey`, `shiftDay`, `todayKey` de `src/lib/day.ts`.
- Produces: `DaySelector` (props `day`, `onChange`), et les props `day`/`editable`/`readOnly` sur `DashboardScreen` et `CoachSheet`.

- [ ] **Step 1: Écrire le sélecteur**

Créer `src/components/DaySelector.tsx` :

```tsx
import { dayLabel, oldestKey, shiftDay, todayKey } from '../lib/day'
import { Icon } from './Icon'

interface DaySelectorProps {
  day: string
  onChange: (day: string) => void
}

/**
 * Navigation d'un jour à l'autre. La borne haute est demain : préparer la
 * veille est le besoin, planifier la semaine n'en est pas un.
 */
export function DaySelector({ day, onChange }: DaySelectorProps) {
  const oldest = oldestKey()
  const newest = shiftDay(todayKey(), 1)
  const previous = shiftDay(day, -1)
  const next = shiftDay(day, 1)

  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-container-lowest px-sm py-xs">
      <button
        aria-label="Jour précédent"
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors active:bg-surface-container disabled:opacity-40"
        disabled={previous < oldest}
        onClick={() => onChange(previous)}
        type="button"
      >
        <Icon name="chevron_left" />
      </button>

      <span className="font-headline-md text-body-md text-on-surface">{dayLabel(day)}</span>

      <button
        aria-label="Jour suivant"
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors active:bg-surface-container disabled:opacity-40"
        disabled={next > newest}
        onClick={() => onChange(next)}
        type="button"
      >
        <Icon name="chevron_right" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Porter le jour sélectionné dans App**

Dans `src/App.tsx` :

```tsx
  const [day, setDay] = useState(todayKey())

  // Une session laissée ouverte la nuit afficherait hier en le nommant
  // « aujourd'hui » : au retour au premier plan, la sélection suit le jour réel
  // si elle portait sur le jour qui vient de passer.
  useEffect(() => {
    function follow() {
      if (document.visibilityState !== 'visible') return
      setDay((current) => (current < todayKey() && current === shiftDay(todayKey(), -1) ? todayKey() : current))
    }
    document.addEventListener('visibilitychange', follow)
    return () => document.removeEventListener('visibilitychange', follow)
  }, [])

  const past = isPast(day)
  const editable = !past
```

Puis passer `day` et l'éditabilité aux trois hooks :

- `useActivities(scheduleStore.schedule, scheduleStore.loaded, day, isToday(day))` — les activités ne s'éditent que le jour même.
- `useDailyMenu(settings, profile, profileStore.loaded, activityStore.activities, models, day, editable)`
- `useCoachChat(settings, profile, activityStore.activities, dailyMenu.menu, models, day, editable)`

et à l'affichage : `<DashboardScreen ... day={day} onDayChange={setDay} readOnly={past} />`, `<CoachSheet ... day={day} readOnly={past} />`. Enfin, la barre de chat du dashboard est désactivée sur un jour passé : `disabled={!configured || !online || past}`.

Imports à ajouter : `useState`, `DaySelector` n'est pas importé ici (il est rendu par le dashboard), `isPast`, `isToday`, `shiftDay`, `todayKey`.

- [ ] **Step 3: Afficher le sélecteur et l'état de consultation**

Dans `src/screens/DashboardScreen.tsx`, ajouter aux props :

```tsx
  /** Jour affiché, au format AAAA-MM-JJ. */
  day: string
  onDayChange: (day: string) => void
  /** Vrai pour un jour révolu : la journée se consulte, ne se modifie pas. */
  readOnly: boolean
```

En tête du rendu, avant le bandeau du menu :

```tsx
      <DaySelector day={day} onChange={onDayChange} />

      {readOnly && (
        <p className="flex items-center gap-xs rounded-xl bg-surface-container px-md py-sm font-body-md text-caption text-on-surface-variant">
          <Icon className="text-body-md" name="history" />
          Journée archivée — consultation seule.
        </p>
      )}
```

Puis masquer les commandes d'écriture quand `readOnly` est vrai : le bouton d'ajout d'activité et son formulaire, la carte d'état du menu qui porte le bouton de génération, et les coches de repas (passer `readOnly` à `MealCard`/`ActivityCard` si elles exposent déjà une prop de désactivation ; sinon ne pas câbler `toggleEaten` et ne pas rendre le bouton de suppression).

Sur un jour futur, les coches n'ont pas de sens non plus : utiliser `isToday(day)` pour décider de leur affichage, `readOnly` pour la génération.

- [ ] **Step 4: Nommer le jour dans le volet coach**

Dans `src/components/chat/CoachSheet.tsx`, ajouter les props `day: string` et `readOnly: boolean`, et remplacer le sous-titre :

```tsx
            <span className="font-caption text-caption text-on-surface-variant">
              {streaming ? 'Rédige une réponse…' : `Votre coach nutrition — ${dayLabel(day).toLowerCase()}`}
            </span>
```

et désactiver la saisie : `<ChatBar ... disabled={!configured || !online || readOnly} />`. Importer `dayLabel` depuis `../../lib/day`.

- [ ] **Step 5: Vérifier**

Run: `npm test && npm run build && npm run lint`
Expected: tout passe.

- [ ] **Step 6: Vérifier à la main le parcours complet**

Run: `npm run dev`

1. Le dashboard s'ouvre sur « Aujourd'hui ».
2. Flèche droite : « Demain », le menu est vide, le bouton de génération est là, les activités du planning du lendemain apparaissent comme prévues, la flèche droite est désormais désactivée.
3. Générer le menu de demain, recharger la page, revenir sur demain : le menu est là.
4. Flèche gauche deux fois : « Hier » (ou la date), bandeau de consultation, aucune commande d'écriture, saisie coach désactivée.
5. Retour sur aujourd'hui : tout redevient modifiable.

- [ ] **Step 7: Commit**

```bash
git add src/components/DaySelector.tsx src/App.tsx src/screens/DashboardScreen.tsx src/components/chat/CoachSheet.tsx
git commit -m "feat: let the dashboard move between the kept days and tomorrow"
```

---

## Notes d'exécution

- La grille mensuelle décrite dans la spec est volontairement absente de ce plan : les flèches couvrent le besoin (préparer demain, revenir sur hier), et une grille de 90 jours se conçoit mieux une fois l'historique réellement rempli. À rouvrir si la navigation par flèches devient pénible.
- Les tâches 3 à 5 laissent `App` sur `todayKey()` en dur ; la tâche 7 est celle qui branche le sélecteur. L'application reste fonctionnelle après chaque tâche.
