# NutriAdapt

Coach nutritionnel adaptatif, sous forme de PWA installable sur mobile.
Tout tourne côté client : pas de backend, la clé API du LLM et les données
restent dans le navigateur de l'utilisateur.

## Développement

```bash
npm install
npm run dev       # http://localhost:5173/nutricoach/
npm run build
npm run preview -- --host   # test depuis un téléphone du même réseau
```

## Déploiement

Push sur `main` déclenche `.github/workflows/deploy.yml`, qui construit le site
et le publie sur GitHub Pages. Le chemin de base est dérivé du nom du repo via
`BASE_PATH` ; pour un domaine personnalisé, passer `BASE_PATH=/`.

## État

Première itération : squelette PWA et tableau de bord alimenté par des données
mockées (`src/data/dashboard.ts`). À venir : persistance IndexedDB et
intégration du coach LLM.
