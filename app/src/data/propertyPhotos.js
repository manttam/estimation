// =====================================================================
// Catalogue de photos du bien (Step 1 — démo Ideeri)
// ---------------------------------------------------------------------
// 12 photos d'intérieurs et extérieurs, sélectionnées et vérifiées
// visuellement par l'équipe Ideeri.
//
// RGPD : photos de biens immobiliers uniquement, aucune personne
//        physique identifiable. Vérification visuelle faite avant
//        intégration.
//
// Source : Unsplash (Licence Unsplash — utilisation commerciale et
//          modification autorisées, sans attribution obligatoire).
//          Voir https://unsplash.com/license
//
// Usage : importé par Step1BienCible.jsx via PROPERTY_PHOTOS.
//        Chaque entrée expose { id, type, label, url }.
//
// Note sur les types : on garde les 8 types existants (salon, cuisine,
//        chambre, sdb, wc, bureau, exterieur, autre) pour ne pas
//        casser le filtrage. Les pièces non couvertes (salle à manger,
//        garage, salle de jeux) sont rangées en `autre` avec un label
//        explicite. Élargir la liste si besoin dans un second temps.
// =====================================================================

// Paramètres communs appliqués à chaque URL Unsplash pour standardiser
// le rendu (largeur 1400px, qualité 80, format auto, crop intelligent).
const UNSPLASH_PARAMS = 'w=1400&q=80&auto=format&fit=crop';

export const PROPERTY_PHOTOS = [
  {
    id: 1,
    type: 'salon',
    label: 'Salon principal',
    url: `https://images.unsplash.com/photo-1554995207-c18c203602cb?${UNSPLASH_PARAMS}`,
  },
  {
    id: 2,
    type: 'exterieur',
    label: 'Extérieur — vue maison',
    url: `https://plus.unsplash.com/premium_photo-1778527396547-d0db0fc2af78?${UNSPLASH_PARAMS}`,
  },
  {
    id: 3,
    type: 'wc',
    label: 'Toilettes',
    url: `https://images.unsplash.com/photo-1517414628894-83d47b22f233?${UNSPLASH_PARAMS}`,
  },
  {
    id: 4,
    type: 'chambre',
    label: 'Chambre 1',
    url: `https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?${UNSPLASH_PARAMS}`,
  },
  {
    id: 5,
    type: 'chambre',
    label: 'Chambre 2',
    url: `https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?${UNSPLASH_PARAMS}`,
  },
  {
    id: 6,
    type: 'chambre',
    label: 'Chambre 3',
    url: `https://images.unsplash.com/photo-1556020685-ae41abfc9365?${UNSPLASH_PARAMS}`,
  },
  {
    id: 7,
    type: 'cuisine',
    label: 'Cuisine',
    url: `https://images.unsplash.com/photo-1628797285815-453c1d0d21e3?${UNSPLASH_PARAMS}`,
  },
  {
    id: 8,
    type: 'autre',
    label: 'Salle à manger',
    url: `https://images.unsplash.com/photo-1617098709804-705581f844eb?${UNSPLASH_PARAMS}`,
  },
  {
    id: 9,
    type: 'exterieur',
    label: 'Jardin',
    url: `https://images.unsplash.com/photo-1778683326192-898fc982e6a6?${UNSPLASH_PARAMS}`,
  },
  {
    id: 10,
    type: 'autre',
    label: 'Garage',
    url: `https://images.unsplash.com/photo-1646377365268-27dd70e88b47?${UNSPLASH_PARAMS}`,
  },
  {
    id: 11,
    type: 'autre',
    label: 'Salle de jeux',
    url: `https://images.unsplash.com/photo-1646592491741-e79ae5953486?${UNSPLASH_PARAMS}`,
  },
  {
    id: 12,
    type: 'sdb',
    label: 'Salle de bain',
    url: `https://images.unsplash.com/photo-1695002817411-203c7f19dfa3?${UNSPLASH_PARAMS}`,
  },
];
