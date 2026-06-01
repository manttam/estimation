# Photos du bien actif

Ce dossier contient les photos du bien actuellement en cours d'estimation.
Step1 affiche ces photos dans le carrousel + lightbox quand un bien actif
est saisi via /nouveau-bien.

## Comment ajouter des photos

**Tu deposes tes images directement dans ce dossier — c'est tout.**
Vite scanne automatiquement le contenu au build (`import.meta.glob`),
donc pas de manifest a maintenir.

## Convention de nommage

`<type>-<numero>[-<label>].<extension>`

Exemples :

```
salon-01-principal.jpg
salon-02-vue-cheminee.jpg
cuisine-01-equipee.jpg
chambre-01-parentale.jpg
chambre-02-enfant.jpg
sdb-01.jpg
exterieur-01-balcon.png
```

### Decomposition

- **type** (obligatoire pour le filtrage) : un parmi
  `salon`, `cuisine`, `chambre`, `sdb`, `wc`, `bureau`, `exterieur`, `autre`.
  Si le prefixe ne correspond pas, le type sera `autre`.
- **numero** (recommande) : determine l'ordre d'affichage dans le filtre
  "Toutes". Sur 2 chiffres pour bon tri (`01`, `02`...).
- **label** (optionnel) : tout ce qui suit le numero, separe par `-`.
  Sera affiche dans le carrousel et le lightbox. Les tirets sont
  remplaces par des espaces et la premiere lettre passe en majuscule.

### Exemples de rendu

| Fichier                        | Type     | Ordre | Label affiche       |
| ------------------------------ | -------- | ----- | ------------------- |
| `salon-01-principal.jpg`       | salon    | 1     | Principal           |
| `cuisine-01-vue-jardin.jpg`    | cuisine  | 1     | Vue Jardin          |
| `sdb-01.jpg`                   | sdb      | 1     | Sdb 01              |
| `vue-foret.jpg`                | autre    | 999   | Vue Foret           |

## Comportement par defaut

- **Avec bien actif + photos dans ce dossier** : carrousel custom.
- **Avec bien actif mais dossier vide** : retombe sur le catalogue demo Unsplash.
- **Sans bien actif** : carrousel demo (mode preview).

## Formats supportes

`jpg`, `jpeg`, `png`, `webp`. Optimisation : Vite va re-process et hash
chaque image au build (cache busting automatique).
