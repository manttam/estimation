/**
 * Catégories de commodités — définition unique partagée par l'étape 3
 * (Contexte & zone) et le compte rendu remis au mandant.
 *
 * Une seule source pour les libellés, les couleurs et les pictogrammes :
 * une catégorie doit porter la même couleur partout dans le produit, sinon
 * l'agent classe dans un code couleur et le mandant en lit un autre.
 *
 * `svg` est du markup SVG *interne* (sans la balise <svg>), pour être injecté
 * aussi bien dans un divIcon Leaflet que dans un composant React. Chaînes
 * statiques écrites en dur : aucune entrée utilisateur n'y transite.
 * Pictogrammes Lucide (licence ISC).
 */
export const POI_CATEGORIES = {
  education: {
    label: 'Écoles',
    color: '#2563EB',
    emoji: '🎓',
    svg: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  },
  commerces: {
    label: 'Commerces',
    color: '#D97706',
    emoji: '🛒',
    svg: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  },
  sante: {
    label: 'Santé',
    color: '#DC2626',
    emoji: '🏥',
    svg: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  },
  transports: {
    label: 'Transports',
    color: '#7C3AED',
    emoji: '🚇',
    svg: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  },
  environnement: {
    label: 'Environnement',
    color: '#059669',
    emoji: '🌳',
    svg: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  },
};

/* Ordre d'affichage : du critère le plus structurant pour un acquéreur au
 * plus accessoire. */
export const POI_ORDER = ['education', 'commerces', 'sante', 'transports', 'environnement'];

/**
 * Traduction des types OpenStreetMap. `buildPoiDetail` (étape 3) préfixe le
 * détail avec la valeur brute du tag `shop` ou `amenity`, donc en anglais :
 * « bakery — 319 m ». On l'affiche en français dans le document.
 */
export const TYPE_LABELS = {
  bakery: 'Boulangerie',
  supermarket: 'Supermarché',
  convenience: 'Épicerie',
  butcher: 'Boucherie',
  greengrocer: 'Primeur',
  pharmacy: 'Pharmacie',
  post_office: 'Bureau de poste',
  'post office': 'Bureau de poste',
  bank: 'Banque',
  cafe: 'Café',
  restaurant: 'Restaurant',
  kindergarten: 'Crèche',
  school: 'École',
  college: 'Collège',
  university: 'Université',
  hospital: 'Hôpital',
  clinic: 'Clinique',
  doctors: 'Médecin',
  dentist: 'Dentiste',
  park: 'Parc',
  garden: 'Jardin',
  playground: 'Aire de jeux',
  nature_reserve: 'Réserve naturelle',
  'nature reserve': 'Réserve naturelle',
};

/**
 * Sépare le `detail` d'un POI (« bakery — 319 m ») en type lisible et reste.
 * Renvoie une chaîne vide si le détail ne porte pas de type.
 */
export function typeLisible(detail) {
  if (!detail) return '';
  const brut = String(detail).split('—')[0].trim();
  if (!brut || /^\d/.test(brut)) return '';
  const traduit = TYPE_LABELS[brut.toLowerCase()];
  if (traduit) return traduit;
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

/* Distance en mètres → libellé français (« 319 m », « 2,2 km »). */
export function fmtDistance(m) {
  if (m == null || Number.isNaN(m)) return '—';
  return m < 1000
    ? `${Math.round(m)} m`
    : `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

/* Distance haversine approchée entre deux paires [lat, lon], en mètres. */
export function distanceMetres(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(h)));
}

/**
 * Commodités de démonstration autour du bien démo (12 rue des Lilas, Lyon 3ᵉ).
 * ⚠️ Données fictives. En mode live, les POI viennent d'Overpass via l'étape 3.
 */
export const POI_DEMO = {
  transports: [
    { name: 'Métro Saxe-Gambetta', coords: [45.7565, 4.8545], detail: 'Station — 350 m' },
    { name: 'Tram T1 — Guillotière', coords: [45.7558, 4.8570], detail: 'Station — 500 m' },
    { name: 'Bus C3 — Dauphiné', coords: [45.7595, 4.8615], detail: 'Arrêt bus — 180 m' },
    { name: "Vélo'v — Place Guichard", coords: [45.7575, 4.8560], detail: 'Vélos — 200 m' },
    { name: 'Bus C9 — Villette', coords: [45.7605, 4.8575], detail: 'Arrêt bus — 280 m' },
  ],
  commerces: [
    { name: 'Carrefour City', coords: [45.7573, 4.8610], detail: 'convenience — 150 m' },
    { name: 'Boulangerie Paul', coords: [45.7585, 4.8565], detail: 'bakery — 120 m' },
    { name: 'Pharmacie des Lilas', coords: [45.7590, 4.8600], detail: 'pharmacy — 80 m' },
    { name: 'Marché couvert Part-Dieu', coords: [45.7608, 4.8570], detail: 'supermarket — 650 m' },
    { name: 'Tabac Presse Liberté', coords: [45.7568, 4.8598], detail: 'convenience — 200 m' },
    { name: 'La Poste Lyon 3', coords: [45.7555, 4.8585], detail: 'post_office — 400 m' },
    { name: 'Banque LCL', coords: [45.7582, 4.8550], detail: 'bank — 350 m' },
  ],
  education: [
    { name: 'École maternelle Montbrillant', coords: [45.7600, 4.8555], detail: 'kindergarten — 500 m' },
    { name: 'Collège Raoul Dufy', coords: [45.7545, 4.8610], detail: 'college — 800 m' },
    { name: 'Lycée Lacassagne', coords: [45.7530, 4.8570], detail: 'school — 950 m' },
    { name: "Crèche Les P'tits Loups", coords: [45.7592, 4.8625], detail: 'kindergarten — 300 m' },
  ],
  sante: [
    { name: 'Cabinet Dr. Martin', coords: [45.7572, 4.8605], detail: 'doctors — 100 m' },
    { name: 'Hôpital Édouard Herriot', coords: [45.7540, 4.8630], detail: 'hospital — 1.1 km' },
    { name: 'Dentiste Dr. Roux', coords: [45.7588, 4.8555], detail: 'dentist — 250 m' },
    { name: 'Laboratoire Biogroup', coords: [45.7578, 4.8620], detail: 'clinic — 200 m' },
  ],
  environnement: [
    { name: 'Parc Bazin', coords: [45.7548, 4.8552], detail: 'park — 410 m' },
    { name: 'Square Rambaud', coords: [45.7601, 4.8618], detail: 'garden — 520 m' },
  ],
};
