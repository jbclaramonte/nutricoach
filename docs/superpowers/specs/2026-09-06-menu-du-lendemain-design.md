# Calendrier des journées et menu du lendemain

Date : 2026-09-06
État : validé, prêt pour le plan d'implémentation

## Problème

L'application ne connaît qu'une journée : aujourd'hui. Les trois magasins
datés (menu, activités, conversation) calculent leur clé eux-mêmes au moment
de l'écriture, et chacun purge au chargement tout ce qui précède le jour
courant. Deux conséquences : on ne peut pas voir le menu de demain pour
préparer un repas la veille, et l'historique est détruit à chaque changement
de jour.

## Ce qui est construit

Un jour sélectionné, porté par `App`, que suivent le menu, les activités et la
conversation coach. Un sélecteur de date en tête du dashboard permet de
remonter dans l'historique conservé et d'avancer d'un jour, pas plus.

Décisions cadrantes :

- Le jour sélectionné change le contexte de tout le dashboard, coach compris.
- Plage atteignable : des 90 derniers jours à demain inclus.
- Un jour passé est en consultation seule : ni génération, ni révision, ni
  coche de repas, ni envoi au coach.
- Demain n'accepte que la génération et la révision du menu. Ses activités
  viennent du planning hebdomadaire et ne se confirment pas : une séance non
  faite ne se coche pas.

## Architecture

### `src/lib/day.ts` — unique source de vérité sur les dates

Remplace les trois `todayKey()` recopiés dans les hooks.

- `dayKey(date): string` — `AAAA-MM-JJ`, en heure locale.
- `todayKey(): string`
- `shiftDay(key, n): string` — décalage en jours, correct au changement de
  mois, d'année et d'heure d'été (le calcul passe par une date à midi local,
  jamais par une addition de millisecondes).
- `dayLabel(key): string` — « Aujourd'hui », « Demain », sinon
  « lundi 1 septembre ».
- `isPast(key)`, `isToday(key)`, `isTomorrow(key)`
- `RETENTION_DAYS = 90`
- `oldestKey(): string` — borne basse du sélecteur.

### `src/lib/retention.ts` — ménage unique

Une seule fonction `purgeExpired()`, appelée une fois au montage de `App`.
Elle supprime, pour les préfixes `menu:`, `activities:` et `chat:`, les clés
antérieures à `oldestKey()`, ainsi que les deux clés héritées de l'ancien
modèle sans date (`activities:today`, `chat:messages`). Les trois
`purgeOldX()` actuelles sont supprimées.

### Les hooks reçoivent le jour

`useDailyMenu`, `useActivities` et `useCoachChat` prennent deux paramètres
supplémentaires : `dayKey` et `editable`.

- Le chargement dépend de `dayKey` : un changement de jour réinitialise
  l'état local, relit le magasin, et pour la conversation interrompt le flux
  en cours (sans quoi les tokens du jour précédent atterriraient dans le
  nouveau).
- Toute écriture (`generate`, `revise`, `toggleEaten`, `add`, `remove`,
  `confirm`, `send`, `clear`) sort immédiatement si `editable` est faux.
  L'interface cache déjà ces commandes ; ce garde-fou couvre la réponse
  arrivée après un changement de jour.
- Les hooks n'appellent plus `todayKey()` : la clé leur est donnée.

### Le jour sélectionné

`App` porte `selectedKey`, initialisé à `todayKey()`. Il est borné à
`[oldestKey(), shiftDay(todayKey(), 1)]`. Au retour au premier plan
(`visibilitychange`), si le jour réel a changé et que la sélection portait sur
l'ancien « aujourd'hui », elle suit le nouveau jour : un onglet resté ouvert
la nuit ne doit pas afficher hier en croyant montrer aujourd'hui.

`editable` vaut vrai pour aujourd'hui, vrai pour demain côté menu seulement,
faux pour le passé.

### Activités d'un jour futur

Demain n'a pas de journée enregistrée. `useActivities` la dérive alors du
planning hebdomadaire, via `plannedActivitiesFor` appliqué au jour de la
semaine visé, toutes activités marquées `planned`. Rien n'est écrit en base :
un jour futur ne laisse de trace que si un menu y est généré.

La cible énergétique suit la règle déjà en place — les activités `planned` ne
sont pas comptées, et le prompt les annonce séparément comme prévues. Demain
est donc calibré sur la dépense de base, avec les séances annoncées au coach
pour qu'il place les repas autour.

## Interface

### `DaySelector` (nouveau composant)

En tête du dashboard : une flèche précédent, le libellé du jour, une flèche
suivant. Les flèches sont désactivées aux bornes. Un appui sur le libellé
ouvre une grille mensuelle ; les jours hors plage y sont désactivés, ceux
portant un menu enregistré sont marqués d'un point.

### États du dashboard

- Jour passé : bandeau « Journée archivée — consultation seule », commandes
  de génération et coches masquées.
- Demain sans menu : bouton « Générer le menu de demain ».
- Demain avec menu : menu affiché, révision possible, coches masquées.

### Coach

Le volet indique le jour dont il parle sous le nom du coach. Sur un jour
passé, la barre de saisie est désactivée avec la même raison que le bandeau.

### Prompt

`buildCoachSystemPrompt` reçoit le libellé du jour et l'écrit en tête du bloc
`LA JOURNÉE` (« lundi 7 septembre — demain »). Sans cela le modèle raisonne
comme si la journée décrite était en cours.

## Tests

Le dépôt n'a aucun test ni runner. On ajoute vitest en dépendance de
développement et un script `test`. La couverture vise la logique pure, où une
erreur passe inaperçue :

- `shiftDay` autour d'un changement de mois, d'année, et du passage à l'heure
  d'hiver.
- Bornes du sélecteur : demain atteignable, après-demain non ; le 90ᵉ jour
  atteignable, le 91ᵉ non.
- `purgeExpired` : garde ce qui est dans la fenêtre, supprime le reste et les
  clés héritées.
- Dérivation des activités de demain : un planning du lundi produit les
  activités attendues, toutes `planned`, et rien n'est écrit en base.

Pas de test de rendu.

## Hors périmètre

- Planifier au-delà de demain.
- Modifier un jour passé.
- Une vue semaine ou une liste de courses.
