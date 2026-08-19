# Handoff — Avis de valeur V2 (`/avis-valeur`)

Refonte du document « Avis de valeur » remis au mandant lors du second rendez-vous.
Route inchangée : `#/avis-valeur`.

---

## 1. Fichiers touchés

| Fichier | Nature |
|---|---|
| `app/src/pages/AvisValeurDoc.jsx` | Réécriture complète du composant |
| `app/src/data/propertyData.js` | Ajout de champs (aucune suppression, aucun renommage) |
| `app/src/components/Layout.jsx` | 3 lignes : `/avis-valeur` passe en mode document pleine largeur |

Aucune dépendance ajoutée. Aucune modification de routing.

---

## 2. Ce qui change dans le document

### Structure V1 → V2

| V1 | V2 |
|---|---|
| En-tête : « ideeri » en texte | En-tête : logo agence en `<img>` |
| — | **Votre bien** — photo principale + 4 vignettes légendées |
| Bien estimé (3 encarts) | **Informations générales** — 6 encarts + descriptif rédigé |
| — | **Argumentaire de valorisation** — atouts / points de vigilance |
| Avis de valeur — 3 postes de détail | **Avis de valeur** — 1 seul poste de détail |
| — | **Votre interlocuteur** — agent + agence |
| Mention courte en pied de page | **Mentions** — 4 paragraphes légaux |

### Détail du prix — suppression volontaire

La V1 affichait trois postes : prix médian comparables, impact tension marché
(`+0.7%`), corrections spécifiques (`−1.5%`). **La V2 n'affiche plus que le prix
médian des comparables**, puis directement le prix retenu et la fourchette.

Décision produit assumée : le document remis au mandant ne détaille plus les
ajustements. Les données correspondantes (`avisValeur.decomposition`) restent
présentes dans `propertyData.js` et intactes — rien à nettoyer, elles servent
ailleurs (Step 5, compte rendu).

> **Point ouvert** — l'écart entre la valeur comparables (302 470 €) et le prix
> retenu (300 000 €) n'est donc plus expliqué dans le document. À arbitrer avec
> Manon : soit on laisse tel quel, soit on ajoute une ligne discrète
> « arrondi commercial » sous le prix.

---

## 3. Sources de données

### Priorité de lecture

```
reportStore (localStorage, saisies utilisateur)  →  propertyData.js (mocks de démo)
```

Concrètement, dans `AvisValeurDoc.jsx` :

```js
const agence = { ...agenceMock, ...(reportState.agence || {}) };
const agent  = { ...agentMock,  ...(reportState.agent  || {}) };

const pointsForts     = reportState.pointsForts?.length     ? reportState.pointsForts     : avisValeur.pointsForts;
const pointsVigilance = reportState.pointsVigilance?.length ? reportState.pointsVigilance : avisValeur.pointsVigilance;
const prixRetenu      = reportState.customPrice || avisValeur.prixMedian;
```

Les saisies de la fiche Réglages (identités agence / agent / logo) et de Step 5
(points forts, points de vigilance, prix personnalisé) remontent donc
automatiquement dans le document.

### Photos

```
IndexedDB (photos uploadées en Step 1, via getPhotosForCarousel)  →  PROPERTY_PHOTOS (démo)
```

Sélection automatique par `pickDocumentPhotos()` : un représentant par type dans
l'ordre `salon → cuisine → chambre → sdb → exterieur → autre`, complété par ce qui
reste, plafonné à 5 photos (1 hero + 4 vignettes).

Les object URLs créées par `getPhotosForCarousel()` sont revoquées au démontage
via `revokePhotoUrls()` dans le cleanup du `useEffect`.

> **Limite connue** — si le composant se démonte avant la résolution de la
> promesse, les URLs de ce cycle ne sont pas revoquées (fuite mémoire mineure,
> bornée à 5 blobs). Corrigeable avec un `useRef` si ça gêne.

---

## 4. Nouveaux champs dans `propertyData.js`

### `property`

```js
etagesTotal: 6,          // dénominateur affiché « 4ᵉ / 6 »
ascenseur: true,         // true → « — avec ascenseur », false → « — sans ascenseur »
                         // undefined → rien n'est affiché
balcon: 5.2,             // m² ; falsy → l'encart Extérieur affiche « Aucun »
cave: true,              // pas encore affiché dans le document
parking: false,          // pas encore affiché dans le document
dateAvisValeur: "31 mars 2026",
descriptif: [ "…", "…", "…" ],   // un paragraphe par entrée
```

### `avisValeur`

```js
prixM2Comparables: 4172,  // prix médian pondéré des comparables retenus
```

Auparavant la valeur `4172` était codée en dur dans le JSX de la V1. Elle est
maintenant dans les données, avec repli `|| 4172` dans le composant.

> **Point ouvert — le plus important pour l'intégration**
>
> `property.descriptif` est actuellement du texte de démo écrit à la main. Il n'y
> a aucune saisie correspondante dans Step 1. Deux pistes :
>
> 1. Ajouter un champ texte multiligne dans un accordéon de Step 1, persisté via
>    `mergeReportSection('bienDetails', { … })`, et le lire ici en priorité.
> 2. Générer le descriptif à partir des champs déjà saisis en Step 1.
>
> Tant que ce n'est pas branché, tous les biens affichent le même descriptif.

---

## 5. Rendu et impression

- CSS injecté via une balise `<style>` dans le composant, toutes les classes
  préfixées `av-` pour éviter les collisions avec `App.css`.
- Variables CSS scopées sur `.av-doc` (`--av-green`, `--av-ink`, `--av-line`…).
  Si tu veux brancher `agence.couleurPrimaire`, c'est le seul endroit à toucher :
  passer `--av-green` en style inline sur le conteneur `.av-doc`.
- Impression : `@page A4` marges 14/12 mm, saut de page avant l'argumentaire
  (`.av-page-break`), `break-inside: avoid` sur cartes et sections, hero réduit
  à 260 px de haut.
- Responsive : sous 760 px, les grilles passent en une colonne.
- Le bouton « Imprimer / PDF » et « Retour à l'estimation » portent la classe
  `av-no-print`.

### Layout

`Layout.jsx` masquait déjà sidebar + topbar pour `/report`. La condition inclut
maintenant `/avis-valeur` :

```js
const isReport =
  location.pathname.startsWith('/report') ||
  location.pathname.startsWith('/avis-valeur');
```

---

## 6. Vérifications faites / restant à faire

**Fait**

- Syntaxe des 3 fichiers validée (esbuild, loader JSX).
- Rendu de la maquette contrôlé visuellement (structure, grilles, pagination).

**À faire de ton côté**

- `npm run build` — pas lancé, l'environnement de génération ne pouvait pas
  charger le binding natif de rolldown.
- Vérifier le rendu avec de vraies photos uploadées en Step 1 (le contrôle a été
  fait sur le jeu de démo `PROPERTY_PHOTOS`).
- Vérifier l'export PDF réel via le dialogue d'impression Chrome, notamment la
  pagination si le descriptif est plus long que 3 paragraphes.
- Vérifier le rendu quand un logo agence personnalisé est chargé depuis les
  Réglages (contraintes : `max-height: 64px`, `max-width: 240px`, `object-fit: contain`).

---

## 7. Données de démo

Toutes les données du document sont fictives (bien de démonstration Lyon 3ᵉ,
« Marie Dupont », « Agence Immobilière de Lyon », numéros en `00 00 00 00`).
Aucune donnée personnelle réelle n'est présente dans le repo.
