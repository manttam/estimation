# Estimation — Prototype UX Ideeri

Prototype interactif d'un parcours d'estimation immobilière en 5 étapes, destiné
aux agents de l'équipe Ideeri. Toutes les données sont **fictives** et servent
uniquement à valider le parcours UX et les visuels avant intégration à la
plateforme production.

## Démo en ligne

- **App React (parcours interactif)** : https://estimation-nu.vercel.app
- **Wireframes HTML statiques** (maquettes source) :
  - `/Wireframe_Etape1_BienCible.html`
  - `/Wireframe_Etape2_ContexteZone.html`
  - `/Wireframe_Etape3_Comparables.html`
  - `/Wireframe_Etape4_TensionMarche.html`

## Stack technique

- **Framework** : React 19 + Vite 8
- **Routing** : react-router-dom 7 (hash routing → URLs `/#/step/1` etc.)
- **Cartographie** : Leaflet + react-leaflet
- **Styles** : CSS-in-JS via balises `<style>` inline par page (pas de
  framework CSS, pas de Tailwind)
- **Police** : Open Sans (chargée via Google Fonts)
- **Déploiement** : Vercel (auto-deploy sur push `main`)

## Arborescence

```
estimation/
├── app/                           # App Vite React (déployée sur Vercel)
│   ├── src/
│   │   ├── App.jsx                # HashRouter + routes
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Layout.jsx         # Sidebar + topbar + shell commun
│   │   │   ├── PropertyCard.jsx   # En-tête "Vente Appartement T3..."
│   │   │   └── Stepper.jsx        # Stepper 5 étapes en haut de page
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx            # Liste des estimations
│   │   │   ├── Step1BienCible.jsx       # Relevé d'informations du bien
│   │   │   ├── Step2ContexteZone.jsx    # POI, carte, marché local
│   │   │   ├── Step3Comparables.jsx     # Comparables DVF/Ideeri + filtres
│   │   │   ├── Step4TensionMarche.jsx   # Demande réelle + personas + leviers
│   │   │   ├── Step5AvisValeur.jsx      # Avis de valeur + simulateur prix
│   │   │   ├── CompteRendu.jsx          # Rapport d'estimation imprimable
│   │   │   └── AvisValeurDoc.jsx        # Document officiel PDF
│   │   └── data/
│   │       └── propertyData.js          # Données fictives partagées
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   └── Wireframe_Etape4_TensionMarche.html   # Wireframe exposé via Vercel
│   ├── package.json
│   └── vite.config.js
│
├── Wireframe_Etape1_BienCible.html       # Maquettes HTML d'origine (source)
├── Wireframe_Etape2_ContexteZone.html
├── Wireframe_Etape3_Comparables.html
├── Wireframe_Etape4_TensionMarche.html
├── Architecture_UX_Estimation.html       # Schéma UX
├── Modele_Donnees_Estimation.html        # Diagramme du modèle de données
├── Modele_Donnees_Estimation.mermaid     # Mermaid source
├── Modele_Donnees_JSON.json              # Structure JSON cible
├── Modele_Completude_Ponderee.csv        # Règles de complétude pondérée
├── scoring_radar_matching.csv            # Scoring matching acquéreur/bien
├── Données/                              # Jeux de données de référence
├── vercel.json                           # Config déploiement
└── README.md                             # Ce fichier
```

## Lancer en local

```bash
git clone https://github.com/manttam/estimation.git
cd estimation/app
npm install
npm run dev                        # http://localhost:5173
```

### Build de production

```bash
cd app
npm run build                      # Sortie dans app/dist/
npm run preview                    # Sert le build localement
```

### Lint

```bash
cd app
npm run lint
```

## Parcours utilisateur (5 étapes)

1. **Relevé d'informations** (`/#/step/1`)
   Saisie des caractéristiques du bien. Complétude pondérée.

2. **Contexte zone** (`/#/step/2`)
   Carte interactive avec POI (commerces, transports, écoles, santé),
   rayon personnalisable, indicateurs de marché local.

3. **Comparables** (`/#/step/3`)
   Liste + carte satellite des biens similaires (DVF, Ideeri, en cours, portails).
   Filtres dynamiques (surface, pièces, prix, ancienneté). Dessin libre de zone.

4. **Tension marché** (`/#/step/4`)
   Récit en 3 actes :
   - Acte 1 : volume et distribution de la demande réelle
   - Acte 2 : 5 personas cliquables (familles, investisseurs, primo, retraités, mono-parentaux)
   - Acte 3 : atouts, freins, leviers chiffrés

5. **Avis de valeur** (`/#/step/5`)
   Décomposition du prix, slider de simulation demande/prix, 3 stratégies
   (agressif/marché/prudent), génération du compte rendu et du document
   officiel.

## Design system (minimaliste)

Couleurs clés (définies en variables CSS par page) :

| Couleur | Valeur | Usage |
|---|---|---|
| `--green` | `#46B962` | Primaire, succès, actif |
| `--green-dark` | `#1aa564` | Hover primaire |
| `--green-soft` | `#e8f6ec` | Fond léger vert |
| `--orange` | `#f5a623` | Alerte modérée, tension |
| `--red` | `#e74c3c` | Frein, non-compatible |
| `--text` | `#393939` | Texte principal |
| `--muted` | `#949494` | Texte secondaire |
| `--bg` | `#fafafa` | Fond de page |

Radius standard : `8px` (boutons, inputs), `10-12px` (cartes).

## Conventions

- **Routing** : HashRouter → URLs toujours préfixées par `/#/`. La page
  `Dashboard.jsx` est la racine.
- **Source de vérité des données** : `app/src/data/propertyData.js` et le
  dataset des 23 acquéreurs dans `Step5AvisValeur.jsx`. Les Step 4 et 5
  sont alignées sur ce dataset.
- **Aucune intégration backend** — toutes les données sont simulées en
  JS, certaines persistent via `localStorage` (historique des estimations
  dans le Dashboard).
- **Commits** : messages en français, structure `Step X : action concise`.

## Déploiement

Le déploiement est automatique sur Vercel à chaque push sur `main`. Config
dans `vercel.json` :

```json
{
  "buildCommand": "cd app && npm install && npm run build",
  "outputDirectory": "app/dist",
  "framework": "vite"
}
```

## Pour aller plus loin

Voir [HANDOFF.md](./HANDOFF.md) pour la liste des évolutions à prévoir,
des points de vigilance, et des hypothèses techniques à valider lors de
l'intégration côté plateforme Ideeri.

## Licence

Projet interne Ideeri — usage réservé à l'équipe produit.
