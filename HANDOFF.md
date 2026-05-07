# Handoff développeur — Estimation Ideeri

Ce document résume **ce qui est fait** (prototype UX) et **ce qui reste à
faire** (intégration production) pour transmettre le projet à l'équipe
dev.

---

## ✅ Ce qui est livré

### Parcours UX complet (5 étapes + 2 documents)

Les 5 étapes du parcours d'estimation sont implémentées comme composants
React fonctionnels, navigables via le stepper et les boutons précédent/
suivant. Toutes les interactions visuelles fonctionnent avec des **données
simulées** (pas de backend).

| Page | Route | Contenu |
|---|---|---|
| Dashboard | `/#/` | Liste des estimations sauvegardées (persistées en localStorage) |
| Relevé d'informations | `/#/step/1` | Formulaire + complétude pondérée |
| Contexte zone | `/#/step/2` | Carte Leaflet avec POI, rayon réglable |
| Comparables | `/#/step/3` | Table + carte satellite + filtres dynamiques + dessin libre |
| Tension marché | `/#/step/4` | 3 actes : demande, personas, atouts/freins |
| Avis de valeur | `/#/step/5` | Simulateur prix ↔ demande, 3 stratégies, actions |
| Compte rendu | `/#/report` | Document imprimable |
| Avis de valeur (doc) | `/#/avis-valeur` | PDF officiel à remettre au vendeur |

### Composants réutilisables

- `Layout.jsx` : shell avec sidebar (Dashboard, Agenda, Clients, …) et topbar
- `PropertyCard.jsx` : en-tête bien + tabs + barre de complétude
- `Stepper.jsx` : stepper 5 étapes

### Données fictives

- `app/src/data/propertyData.js` : prix, comparables, leviers, etc.
- Dataset des **23 acquéreurs** hardcodé dans `Step5AvisValeur.jsx` (source
  de vérité pour les étapes 4 et 5)
- Distribution des budgets par tranche de plafond cohérente entre Step 4 et
  Step 5
- Persistence légère via `localStorage` (clé `ideeri_estimations`)

### Documents de référence à la racine

- `Architecture_UX_Estimation.html` — schéma UX des parcours
- `Modele_Donnees_Estimation.html` + `.mermaid` — modèle de données cible
- `Modele_Donnees_JSON.json` — structure JSON (schéma API)
- `Modele_Completude_Ponderee.csv` — règles de complétude pondérée
- `scoring_radar_matching.csv` — axes et poids du matching bien ↔ acquéreur
- `Wireframe_Etape[1-4]_*.html` — maquettes HTML d'origine

---

## 🚧 Ce qui reste à faire

### 1. Intégration backend / API Ideeri

Le prototype n'a **aucune connexion backend**. À câbler côté plateforme :

- [ ] Auth (sidebar affiche un user hardcodé "Manon MATRAT / Administratif")
- [ ] Création / sauvegarde / chargement d'une estimation (actuellement localStorage)
- [ ] Récupération du bien cible (Step 1) depuis la fiche mandataire existante
- [ ] API POI pour Step 2 (commerces, transports, écoles, santé)
- [ ] API DVF + portails pour Step 3 (comparables)
- [ ] API projets d'achat / acquéreurs qualifiés pour Step 4
- [ ] Génération PDF serveur pour le compte rendu et l'avis de valeur

### 2. Calculs réels

Les calculs actuels sont des approximations visuelles :

- [ ] **Score de complétude pondérée** : utiliser `Modele_Completude_Ponderee.csv`
      comme source de règles (actuellement hardcodé à 64%)
- [ ] **Scoring matching bien ↔ acquéreur** : implémenter les 7 axes du
      `scoring_radar_matching.csv` (actuellement simulé)
- [ ] **Décomposition du prix** en Step 5 : brancher les vraies valeurs
      (prix médian comparables, impact tension marché, corrections spécifiques DPE/travaux/balcon etc.)
- [ ] **Distribution des plafonds de budget** en Step 4 : calculer à partir
      des vrais projets d'achat (actuellement sur les 23 fictifs)
- [ ] **Durées de vente estimées** (Step 5, stratégies) : modèle à définir

### 3. Filtres et interactions

- [ ] Step 3 : les filtres affichent un compte de biens approximatif (fonction
      `computeFilteredCount`). À remplacer par un vrai filtrage sur les données
      comparables.
- [ ] Step 3 : le **double slider de prix** utilise une gaussienne fictive
      (pic 43 biens @ 300k€) — à remplacer par la distribution réelle.
- [ ] Step 4 : la modale projet affiche des critères hardcodés par
      `#F047`/`#F112`/… — à brancher sur les vrais profils acquéreurs.
- [ ] Step 5 : les 3 stratégies (Agressif/Marché/Prudent) sont hardcodées
      à 315k/305k/290k — à calculer selon la fourchette réelle.

### 4. Points UX à valider / affiner

- [ ] **Confidentialité RGPD** : Step 4 modale projet affiche des identifiants
      anonymes (`#F047`). Confirmer les règles de révélation du contact
      acquéreur (mandataire uniquement).
- [ ] **PDF vendeur** : la barre flottante de Step 4 permet de sélectionner
      3 actes à inclure dans un PDF — génération à implémenter.
- [ ] **Historique des versions** : Step 5 mentionne "V1 de l'estimation" —
      brancher le système de versionning réel.
- [ ] **Édition inline** (Step 5, points forts / vigilance) : utilise
      `contentEditable`. À remplacer par un composant contrôlé si besoin.

### 5. Dette technique identifiée

- [ ] **Bundle size** : ~627 kB (warning Vite > 500 kB). Probablement dû à
      Leaflet et aux composants de carte — envisager du code-splitting par
      route avec `React.lazy`.
- [ ] **CSS inline** : chaque page injecte son CSS via `<style>` dans le JSX.
      Fonctionne mais dupliqué. Migration vers CSS Modules ou styled-components
      à envisager si le projet grossit.
- [ ] **Pas de tests** : aucun test unitaire ni e2e pour l'instant.
- [ ] **Pas de TypeScript** : le projet est en JS pur. Si l'équipe utilise
      TS, conversion à prévoir.
- [ ] **Pas d'ESLint strict** : config par défaut, certaines règles de hooks
      pourraient être renforcées.

### 6. Accessibilité

Les interactions principales sont accessibles (tabindex, aria-label sur les
personas, les lignes d'acheteurs, la modale projet). À auditer plus largement :

- [ ] Navigation clavier complète dans les étapes
- [ ] Contrastes (vérifier le gris `#949494` sur blanc)
- [ ] Focus visibles sur tous les contrôles interactifs
- [ ] Tests avec lecteur d'écran (NVDA / VoiceOver)

---

## 📝 Hypothèses techniques à valider avec l'équipe plateforme

1. **Framework cible** : la plateforme Ideeri est-elle en React ? Sinon, ce
   prototype sert de référence visuelle mais les composants devront être
   portés (Vue, Angular, template serveur…).

2. **Design system** : existe-t-il un DS Ideeri ? Les couleurs / radii /
   typos du prototype devront s'y aligner.

3. **Cartographie** : Leaflet est utilisé ici. La plateforme utilise-t-elle
   la même solution ou Mapbox / Google Maps / autre ?

4. **Routing** : le prototype utilise HashRouter (pour Vercel). En production
   le routing sera probablement côté serveur.

5. **Persistence** : actuellement localStorage pour le Dashboard. À migrer
   vers l'API de persistence Ideeri.

6. **Internationalisation** : tout est en français hardcodé. Si besoin de
   multilingue, extraire les chaînes.

---

## 🔗 Accès & onboarding

1. **Repo GitHub** : https://github.com/manttam/estimation
   → Inviter le dev comme collaborateur (Settings → Collaborators)
2. **Vercel** : le projet est auto-déployé sur push `main`
   → Inviter le dev sur le projet Vercel si besoin d'accéder aux logs/envs
3. **Commandes de démarrage** : voir [README.md](./README.md#lancer-en-local)

---

## 📬 Contact

Pour toute question sur le parcours UX ou les choix produit :
**Manon Matrat** — équipe produit Ideeri.
