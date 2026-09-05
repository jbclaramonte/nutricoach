# Intégration OpenRouter — suite du plan (sections 4 à 8)

## 4. Profil + activités → prompt système (suite)

```ts
// src/lib/ai/prompts.ts
export function buildCoachSystemPrompt(
  profile: Profile,
  activities: Activity[],
  todaysMenu?: GeneratedMenu,
): string

export function buildMenuRequest(
  dateLabel: string,
  hasStructuredOutputs: boolean,
): string
```

Un seul prompt système, partagé entre le chat et la génération de menu, composé de huit blocs.

### Bloc 1 — Persona
Dr. Anya, diététicienne. Réponses en français, vouvoiement (cohérent avec l'UI
actuelle : « Enregistrer mes préférences », « Votre Menu d'Aujourd'hui »).
Ton concis et bienveillant. Interdiction explicite de poser un diagnostic
médical ou de contredire un professionnel de santé.

### Bloc 2 — Biométrie
Âge, sexe, taille, poids issus de `Profile`. IMC et son interprétation via
`computeBmi(profile.heightCm, profile.weightKg)` — on réutilise la fonction
existante plutôt que de laisser le modèle recalculer. Rythme d'activité
habituel via le `label` de `ACTIVITY_LEVELS`, pas l'identifiant.

### Bloc 3 — Cible énergétique (un nombre, pas une déduction)
Calculée localement par `src/lib/energy.ts` :

```ts
export function basalMetabolicRate(profile: Profile): number      // Mifflin-St Jeor
export function dailyTarget(profile: Profile, activities: Activity[]): number
```

- Mifflin-St Jeor à partir de âge / sexe / taille / poids
- × facteur du `activityLevel` (sédentaire 1.2, actif 1.55, très actif 1.725)
- \+ somme des `estimateCalories(met, weightKg, durationMin)` des activités du jour
  (fonction déjà présente dans `src/lib/activities.ts`)
- ajustement objectifs : `fat-loss` −15 %, `muscle` +10 %, sinon neutre

On transmet le **chiffre** au modèle. On ne lui demande jamais de le déduire :
l'arithmétique est la chose que les LLM ratent le plus silencieusement.

### Bloc 4 — Objectifs
Les `label` de `GOALS` filtrés par `profile.goals`, jamais les identifiants.
« fat-loss » ne veut rien dire dans un prompt français ; « Perte de gras / Poids »
si. `describeGoals()` existe déjà et fait exactement cette jointure.

### Bloc 5 — Contraintes dures (allergies)
Bloc dédié, en tête des contraintes, dans cette forme :

```
ALLERGIES — INTERDICTION ABSOLUE
- Arachides
- Gluten / Maladie cœliaque
- Crustacés
Aucun de ces ingrédients, ni aucun de leurs dérivés, ne doit apparaître.
En cas de doute sur un ingrédient composé, choisis un autre ingrédient.
```

La consigne « en cas de doute, évite » est délibérée : elle pousse le modèle
vers le faux positif, qui est le sens sûr de l'erreur.

### Bloc 6 — Contraintes santé
Les `HEALTH_TAGS` actifs sont traduits en **règles culinaires**, pas recopiés
tels quels. Table de traduction hébergée dans `prompts.ts` — c'est de la
connaissance de prompt, pas du domaine profil, donc elle n'a rien à faire
dans `src/lib/profile.ts` :

| tag | règle injectée |
|---|---|
| `gerd` | pas d'acidité forte ni de repas lourd le soir, cuissons douces |
| `ibs` | faible en FODMAP, éviter oignon / ail / légumineuses en excès |
| `diabetes-2` | index glycémique bas, glucides répartis, pas de sucre ajouté |
| `hypertension` | sel réduit, pas de charcuterie ni de plat industriel |
| `lactose` | aucun produit laitier non délactosé |

### Bloc 7 — Goûts
`profile.favorites` à privilégier quand c'est cohérent avec la cible.
`profile.dislikes` à remplacer d'office, sans commentaire.

### Bloc 8 — La journée
Les activités du jour, chacune avec heure, durée, intensité via
`intensityLabel(met)` et kcal estimées, pour que le modèle place et calibre
les repas autour des séances (petit-déjeuner avant la gym, glucides après
le trajet vélo, etc.).

### Ce qui s'ajoute selon l'appel
- **Chat** : une restitution compacte du menu du jour, pour que le coach
  puisse en parler concrètement.
- **Menu** : un tour utilisateur avec la date, les créneaux attendus
  (petit-déjeuner / déjeuner / dîner / collation) et le format de sortie.

### Application des allergies — deux fois, et la seconde seule compte

1. **Dans le prompt** (bloc 5) — c'est une *suggestion*. Un LLM peut l'ignorer.
2. **Après le parsing**, par `findAllergyViolations(menu, profile.allergies)` —
   c'est une *garantie de code*.

Le second mécanisme est celui sur lequel repose la sécurité. Le premier ne fait
que réduire la fréquence des retours.

Limite à énoncer dans l'UI : la recherche est une correspondance de
sous-chaîne normalisée (minuscules, diacritiques retirées) sur les noms
d'aliments et les titres de recettes. Elle attrape les mentions littérales,
pas les dérivés — « semoule » ne contient pas la chaîne « gluten ». Une phrase
sous la section Allergies doit dire que la vérification finale reste à
l'utilisateur. C'est une app de santé : l'euphémisme serait une faute.

---

## 5. Persistance IndexedDB

Store `kv` existant, accès par `dbGet` / `dbSet`. **`DB_VERSION` reste à 1** :
c'est un magasin clé-valeur, aucune migration n'est nécessaire pour ajouter
des clés.

| Clé | Contenu |
|---|---|
| `ai:settings` | `{ apiKey, modelId, updatedAt }` |
| `models:catalog` | `{ fetchedAt, models: ORModel[] }` — sélecteur utilisable hors ligne, rafraîchi si > 24 h |
| `chat:messages` | `ChatMessage[]`, plafonné à 100 messages, les plus anciens tombent |
| `menu:2026-09-05` | `{ generatedAt, modelId, menu: GeneratedMenu }` — une entrée par jour |
| `menu:latest` | la chaîne de date, pour que le Dashboard charge sans recalculer la logique de « aujourd'hui » |

Les clés `menu:<date>` suivent la convention déjà posée par
`activities:today`, dont le commentaire annonce précisément ce passage à une
clé datée.

### Pièces jointes
Stockées en **data URL, après redimensionnement** par `src/lib/ai/images.ts` :
canvas, côté maximum 1024 px, JPEG qualité 0.8, environ 150 Ko.

Deux raisons, pas une :
- c'est exactement la charge utile envoyée à l'API, donc l'encodage est fait
  une seule fois et resservi à l'affichage comme à l'envoi ;
- un JPEG brut d'appareil photo moderne pèse ~4 Mo et saturerait le quota
  IndexedDB en quelques dizaines de messages.

Le redimensionnement est une nécessité, pas une optimisation.

---

## 6. Où vit la conversation, avec 4 onglets

**Recommandation : une feuille plein écran au-dessus du Dashboard, adressée
par le hash `#/coach`.**

- La `ChatBar` reste fixée en bas du Dashboard, **inchangée** — pas de passage
  de `fixed` à `sticky`, donc aucune régression de mise en page.
- Dès que le fil est non vide ou que le champ prend le focus, la feuille monte :
  liste de messages défilante, en-tête avec le nom du coach et une croix, et la
  **même `ChatBar` réutilisée** en pied de feuille.
- `useHashRoute` renvoie alors `'coach'`. `App.tsx` traite cette route comme
  « Dashboard + feuille ouverte » ; `NAV_ITEMS` n'est pas touché et la
  `BottomNav` reste sur l'onglet Dashboard.
- Le bouton retour d'Android ferme la feuille sans quitter l'application —
  comportement attendu d'une PWA, obtenu gratuitement par le hash.
- Les 4 onglets maquettés restent intacts.

### Alternatives rejetées
- **Un 5e onglet « Coach »** — casse la maquette à 4 onglets et éloigne le
  coach du menu dont il parle.
- **Une liste de messages inline au-dessus de la ChatBar** — se dispute la
  place avec la chronologie repas/activités, et obligerait la ChatBar à
  changer de mode de positionnement.
- **Réutiliser l'onglet « Recettes »** — ce placeholder a déjà une vocation
  annoncée dans son texte ; la détourner créerait une dette de navigation.

---

## 7. États d'erreur, vides et hors ligne

Tous les libellés en français.

| Situation | Dashboard | ChatBar / feuille | Profil |
|---|---|---|---|
| Aucune clé | « Configurez votre clé OpenRouter pour générer votre menu » + lien `#/profil`. Repas mockés **supprimés**, pas affichés | champ désactivé, placeholder « Configurez l'IA dans Profil » | section réglages mise en avant |
| 401 clé refusée | « Clé refusée par OpenRouter » + lien réglages | idem | résultat du test en rouge |
| 402 crédits | « Crédits OpenRouter épuisés » + lien vers openrouter.ai | idem | crédit restant affiché via `GET /key` |
| 429 quota | « Trop de requêtes — réessayez dans N s », N issu de `Retry-After` | envoi bloqué N secondes | — |
| 502 / 503 / 504 | « Le modèle n'a pas répondu » + Réessayer | bulle en erreur + Réessayer | — |
| Sortie invalide | menu précédent conservé + carte d'erreur + Réessayer | n/a | — |
| Allergène détecté | menu rejeté, ingrédient nommé, Réessayer | n/a | — |
| Photo + modèle non-vision | n/a | « Ce modèle ne lit pas les images » **avant** l'envoi | badge vision dans le sélecteur |
| Hors ligne | dernier menu stocké + bandeau « Hors ligne — menu du <date> » | envoi désactivé, historique lisible | catalogue depuis le cache, bouton Tester désactivé |
| Chargement | squelette des cartes repas | texte en streaming + bouton Arrêter | spinner sur Tester |

### Règles transversales
- Détection hors ligne : `navigator.onLine === false` **ou** `TypeError` sur
  `fetch`. Le premier ment régulièrement (réseau associé mais sans route) ;
  les deux sont nécessaires.
- Chaque hook lit **le cache d'abord, le réseau ensuite**. Pour une PWA, hors
  ligne est un état normal, pas un cas dégradé.
- Aucun message d'erreur ne contient la clé. Aucun `console.*` non plus.
- Une erreur mi-flux (HTTP 200 déjà envoyé, champ `error` dans un événement
  SSE) doit produire le même état visuel que l'erreur pré-flux correspondante.
  Le texte déjà streamé reste affiché, marqué interrompu.

---

## 8. Séquence d'implémentation

Six tranches. Chacune est livrable et testable seule.

### T0 — socle pur, sans réseau
`src/lib/energy.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/menuSchema.ts`.
Aucun composant touché, aucune clé requise. Vérifiable en affichant le prompt
construit à partir du `DEFAULT_PROFILE` et des `defaultActivities`.

### T1 — client + réglages  (capacité 1)
`openrouter/{types,sse,errors,client}.ts`, `ai/settings.ts`, `useAiSettings`,
`useModelCatalog`, puis `AiSettingsSection` + `ApiKeyField` + `ModelPicker`
montés dans `ProfileScreen` via le `SectionCard` existant.

- Le catalogue ne demandant **aucune authentification**, le sélecteur se
  construit et se teste avant toute saisie de clé — d'où sa place en premier.
- Bouton Tester → `GET /api/v1/key` : gratuit, rapide, discrimine
  valide / invalide, et renvoie le crédit restant.
- Sélecteur : filtré par défaut sur vision + `structured_outputs`
  (227 modèles sur 431), trié par prix d'entrée croissant, avec recherche,
  prix affichés en $/M tokens, badges vision et JSON, et une bascule
  « tous les modèles ».

### T2 — menu du jour  (capacité 3)
`ai/{menuParse,menuMap,allergies}.ts`, `useDailyMenu`, `MenuStateCard`,
câblage de `DashboardScreen`, retrait des repas mockés de
`src/data/dashboard.ts` — le chrome statique (`logoUrl`, `user`, `coach`)
y reste.
Les macros sont recalculées par `sumMeal` + `energy.ts`, jamais reprises
de la réponse du modèle.

### T3 — chat texte  (capacité 2, sans photo)
`src/lib/chat.ts`, `useCoachChat`, `CoachSheet` + `MessageBubble`, route
`#/coach` dans `App.tsx`, `ChatBar` branchée sur un envoi streamé réel avec
bouton Arrêter. Remplace le `console.info` de `handleSend` dans `App.tsx`.

### T4 — pièce jointe photo
`ai/images.ts`, contenu multi-parties
`[{ type: 'text' }, { type: 'image_url' }]`, et garde-fou si le modèle
sélectionné n'est pas vision — message clair avant envoi, jamais d'échec
silencieux. L'input `capture="environment"` existe déjà dans `ChatBar`.

### T5 — finitions
Bandeau hors ligne, respect de `Retry-After`, bouton de suppression de la clé,
CSP `connect-src 'self' https://openrouter.ai` dans `index.html`,
plafonnement de l'historique, mention de confidentialité (les données de santé
transitent par OpenRouter puis par le fournisseur du modèle choisi).

### Parallélisation
```
T0 ──> T1 ──┬──> T2 ──┐
            └──> T3 ──┴──> T5
                  └──> T4 ──┘
```
T2 et T3 sont indépendantes une fois T1 livrée et peuvent être menées en
parallèle. T4 dépend de T3. T5 clôt l'ensemble.
