/**
 * Schéma du relevé d'information Step 1 (refonte drawer-first).
 *
 * Remplace l'ancien `bienCibleCategories` (accordéon) par deux structures :
 *  - A. `sectionsGenerales` : sections d'informations générales (cartes + drawer)
 *  - B. `roomFieldSchema`    : champs d'une pièce (drawer pièce)
 *  - C. `ROOM_TYPES`         : catalogue des types de pièce
 *
 * + helper `buildRoomsFromActiveBien(active)` qui dérive une liste de pièces
 *   depuis le bien actif (sinon liste démo statique).
 *
 * IMPORTANT — Rétrocompat CompteRendu :
 * Les `key` des champs sont slugifiés et persistés sous `bienDetails` au format
 * `${sectionKey}__${fieldKey}`. CompteRendu.jsx lit ces clés via un lookup
 * tolérant (`endsWith('__'+slug)`). Les labels/keys ci-dessous sont calés pour
 * produire les slugs attendus : surface_carrez_m, nombre_de_pieces,
 * nombre_de_chambres, etage_du_bien, annee_de_construction, classe_dpe,
 * classe_ges, type_de_chauffage, etat_general.
 */

// Types de champ supportés par le rendu / drawer :
//   'text' | 'number' | 'select' | 'toggle' | 'date' | 'textarea'

const CLASSES_DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const ETAGE_OPTIONS = [
  'Rez-de-chaussée',
  '1er étage',
  '2ème étage',
  '3ème étage',
  '4ème étage',
  '5ème étage',
  '6ème étage',
  '7ème étage et +',
];

const ORIENTATION_OPTIONS = [
  'Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest',
];

const ETAT_OPTIONS = [
  'Neuf', 'Refait à neuf', 'Bon état', 'À rafraîchir', 'À rénover', 'À restructurer',
];

// ============================================================================
// A. Sections d'informations générales
// ============================================================================

export const sectionsGenerales = [
  {
    key: 'informations_principales',
    title: 'Informations principales',
    icon: '🏠',
    fields: [
      {
        key: 'type_de_bien',
        label: 'Type de bien',
        type: 'select',
        options: ['Appartement', 'Maison individuelle', 'Maison de ville', 'Immeuble', 'Terrain', 'Local commercial'],
      },
      {
        key: 'statut',
        label: 'Statut',
        type: 'select',
        options: ['Disponible', 'Sous compromis', 'Vendu', 'Retiré', 'En estimation'],
      },
      { key: 'categories', label: 'Catégories', type: 'text', placeholder: 'Ex. Résidence principale, Investissement' },
      { key: 'adresse', label: 'Adresse', type: 'text', placeholder: '12 rue des Lilas, 69003 Lyon' },
      { key: 'annee_de_construction', label: 'Année de construction', type: 'number', placeholder: 'AAAA' },
      { key: 'nombre_de_pieces', label: 'Nombre de pièces', type: 'number', placeholder: 'Ex. 4' },
      { key: 'nombre_de_chambres', label: 'Nombre de chambres', type: 'number', placeholder: 'Ex. 2' },
      { key: 'commentaire', label: 'Commentaire', type: 'textarea', placeholder: 'Notes libres sur le bien' },
    ],
  },
  {
    key: 'surfaces',
    title: 'Surfaces',
    icon: '📐',
    fields: [
      { key: 'surface_habitable_m', label: 'Surface Habitable (m²)', type: 'number', unit: 'm²' },
      { key: 'surface_carrez_m', label: 'Surface loi Carrez (m²)', type: 'number', unit: 'm²' },
      {
        key: 'surface_exterieure',
        label: 'Surface Extérieure',
        type: 'select',
        options: ['Aucune', 'Balcon', 'Terrasse', 'Jardin', 'Cour'],
      },
      { key: 'surface_cadastrale_m', label: 'Surface Cadastrale (m²)', type: 'number', unit: 'm²' },
      { key: 'references_cadastrales', label: 'Référence(s) Cadastrale(s)', type: 'text', placeholder: 'Ex. AB 0123' },
    ],
  },
  {
    key: 'dpe',
    title: 'Diagnostic de performance énergétique',
    icon: '⚡',
    fields: [
      { key: 'dpe_vierge', label: 'DPE vierge', type: 'toggle' },
      { key: 'non_soumis_au_dpe', label: 'Non soumis au DPE', type: 'toggle' },
      { key: 'date_de_realisation', label: 'Date de réalisation', type: 'date' },
      {
        group: 'Consommation énergétique',
        key: 'consommation_energetique_valeur',
        label: 'Consommation énergétique (kWh/m²/an)',
        type: 'number',
        unit: 'kWh/m²/an',
      },
      {
        group: 'Consommation énergétique',
        key: 'classe_dpe',
        label: 'Classe DPE',
        type: 'select',
        options: CLASSES_DPE,
      },
      {
        group: 'Gaz à effet de serre',
        key: 'gaz_effet_de_serre_valeur',
        label: 'Gaz à effet de serre (kgeqCO2/m².an)',
        type: 'number',
        unit: 'kgeqCO2/m².an',
      },
      {
        group: 'Gaz à effet de serre',
        key: 'classe_ges',
        label: 'Classe GES',
        type: 'select',
        options: CLASSES_DPE,
      },
      {
        group: 'Estimation des coûts annuels',
        key: 'cout_annuel_min',
        label: 'Coût annuel min (€)',
        type: 'number',
        unit: '€',
      },
      {
        group: 'Estimation des coûts annuels',
        key: 'cout_annuel_max',
        label: 'Coût annuel max (€)',
        type: 'number',
        unit: '€',
      },
      {
        group: 'Estimation des coûts annuels',
        key: 'annee_de_reference',
        label: 'Année(s) de référence',
        type: 'text',
        placeholder: 'Ex. 2021',
      },
    ],
  },
  {
    key: 'informations',
    title: 'Informations',
    icon: 'ℹ️',
    fields: [
      { key: 'etat_general', label: 'État général', type: 'select', options: ETAT_OPTIONS },
      { key: 'etage_du_bien', label: 'Étage du bien', type: 'select', options: ETAGE_OPTIONS },
      { key: 'ascenseur', label: 'Ascenseur', type: 'select', options: ['Oui', 'Non'] },
      { key: 'style', label: 'Style', type: 'select', options: ['Ancien', 'Contemporain', 'Moderne', 'Bourgeois', 'Atypique'] },
      { key: 'environnement', label: 'Environnement', type: 'select', options: ['Centre-ville', 'Quartier résidentiel', 'Périphérie', 'Campagne', 'Bord de mer'] },
      { key: 'construction', label: 'Construction', type: 'text', placeholder: 'Ex. Pierre, Brique' },
      { key: 'couverture', label: 'Couverture', type: 'text', placeholder: 'Ex. Tuiles' },
      { key: 'charpente', label: 'Charpente', type: 'select', options: ['Traditionnelle', 'Fermette', 'Métallique', 'Béton'] },
      { key: 'taxe_fonciere', label: 'Taxe foncière (€)', type: 'number', unit: '€' },
      { key: 'mitoyennete', label: 'Mitoyenneté', type: 'select', options: ['Non mitoyenne', 'Mitoyenne 1 côté', 'Mitoyenne 2 côtés', 'En bande'] },
      { key: 'acces_pmr', label: 'Accès PMR', type: 'select', options: ['Oui', 'Non', 'Partiel'] },
      { key: 'ventilation', label: 'Ventilation', type: 'select', options: ['VMC simple flux', 'VMC double flux', 'Naturelle', 'Aucune'] },
      { key: 'equipements', label: 'Équipements', type: 'text', placeholder: 'Ex. Interphone, Fibre' },
    ],
  },
  {
    key: 'chauffage',
    title: 'Chauffage',
    icon: '🔥',
    fields: [
      { key: 'type_de_chauffage', label: 'Type de chauffage', type: 'select', options: ['Individuel', 'Collectif', 'Mixte'] },
      { key: 'energie', label: 'Énergie', type: 'select', options: ['Gaz', 'Électrique', 'Fioul', 'Bois', 'Pompe à chaleur', 'Géothermie', 'Solaire'] },
      { key: 'diffusion_et_production', label: 'Diffusion et production', type: 'text', placeholder: 'Ex. Radiateurs, Plancher chauffant' },
    ],
  },
  {
    key: 'fenetres',
    title: 'Fenêtres',
    icon: '🪟',
    fields: [
      { key: 'fenetres', label: 'Fenêtres', type: 'select', options: ['Battantes', 'Coulissantes', 'Oscillo-battantes', 'Fixes'] },
      { key: 'materiaux_fenetres', label: 'Matériaux fenêtres', type: 'text', placeholder: 'Ex. PVC, Bois, Alu' },
      { key: 'vitrages_fenetres', label: 'Vitrages fenêtres', type: 'select', options: ['Simple vitrage', 'Double vitrage', 'Triple vitrage'] },
    ],
  },
  {
    key: 'volets',
    title: 'Volets',
    icon: '🚪',
    fields: [
      { key: 'volets', label: 'Volets', type: 'select', options: ['Roulants', 'Battants', 'Persiennes', 'Aucun'] },
      { key: 'materiaux_volets', label: 'Matériaux', type: 'text', placeholder: 'Ex. PVC, Bois, Alu' },
    ],
  },
  {
    key: 'ecs',
    title: 'Eau Chaude Sanitaire (ECS)',
    icon: '💧',
    fields: [
      { key: 'chauffe_eau', label: 'Chauffe-eau', type: 'select', options: ['Ballon électrique', 'Chaudière', 'Thermodynamique', 'Solaire', 'Instantané'] },
      { key: 'energie_ecs', label: 'Énergie', type: 'select', options: ['Gaz', 'Électrique', 'Solaire', 'Pompe à chaleur'] },
    ],
  },
  {
    key: 'assainissement',
    title: 'Assainissement',
    icon: '🌊',
    fields: [
      { key: 'type_assainissement', label: 'Type', type: 'select', options: ['Tout à l\'égout', 'Fosse septique', 'Micro-station', 'Assainissement individuel'] },
      { key: 'conformite', label: 'Conformité', type: 'select', options: ['Conforme', 'Non conforme', 'Non vérifiée'] },
      { key: 'date_du_diagnostic', label: 'Date du diagnostic', type: 'date' },
    ],
  },
];

// ============================================================================
// B. Schéma des champs d'une pièce
// ============================================================================

export const roomFieldSchema = [
  { key: 'surface', label: 'Surface (m²)', type: 'number', unit: 'm²' },
  { key: 'niveau', label: 'Niveau', type: 'select', options: ETAGE_OPTIONS },
  { key: 'annee', label: 'Année', type: 'number' },
  { key: 'orientation', label: 'Orientation', type: 'select', options: ORIENTATION_OPTIONS },
  { key: 'etat', label: 'État', type: 'select', options: ETAT_OPTIONS },
  { key: 'sols', label: 'Sols', type: 'select', options: ['Carrelage', 'Parquet', 'Stratifié', 'Moquette', 'Béton ciré', 'Lino'] },
  { key: 'ventilation', label: 'Ventilation', type: 'select', options: ['VMC simple flux', 'VMC double flux', 'Naturelle', 'Aucune'] },
  { key: 'fenetres', label: 'Fenêtres', type: 'select', options: ['Battantes', 'Coulissantes', 'Oscillo-battantes', 'Fixes', 'Aucune'] },
  { key: 'materiaux_fenetres', label: 'Matériaux fenêtres', type: 'text' },
  { key: 'vitrages_fenetres', label: 'Vitrages fenêtres', type: 'select', options: ['Simple vitrage', 'Double vitrage', 'Triple vitrage'] },
  { key: 'volets', label: 'Volets', type: 'select', options: ['Roulants', 'Battants', 'Persiennes', 'Aucun'] },
  { key: 'materiaux_volets', label: 'Matériaux volets', type: 'text' },
  { key: 'plafond', label: 'Plafond', type: 'select', options: ['Standard', 'Sous pente', 'Cathédrale', 'Faux plafond', 'Poutres apparentes'] },
  { key: 'chauffages', label: 'Chauffages', type: 'text' },
  { key: 'equipements', label: 'Équipements', type: 'text' },
  { key: 'hauteur', label: 'Hauteur (m)', type: 'number', unit: 'm' },
  { key: 'dressing', label: 'Dressing', type: 'toggle' },
  { key: 'ouverture', label: 'Ouverture', type: 'select', options: ['Sur séjour', 'Sur cuisine', 'Sur extérieur', 'Indépendante'] },
  { key: 'commentaire', label: 'Commentaire', type: 'textarea' },
];

// ============================================================================
// C. Catalogue des types de pièce
// ============================================================================

export const ROOM_TYPES = [
  { value: 'sejour', label: 'Séjour', photoType: 'salon' },
  { value: 'salon', label: 'Salon', photoType: 'salon' },
  { value: 'cuisine', label: 'Cuisine', photoType: 'cuisine' },
  { value: 'chambre', label: 'Chambre', photoType: 'chambre' },
  { value: 'chambre_parentale', label: 'Chambre Parentale', photoType: 'chambre' },
  { value: 'salle_de_bain', label: 'Salle de bain', photoType: 'sdb' },
  { value: 'salle_eau', label: 'Salle d\'eau', photoType: 'sdb' },
  { value: 'wc', label: 'WC', photoType: 'wc' },
  { value: 'hall', label: 'Hall / Entrée', photoType: 'autre' },
  { value: 'bureau', label: 'Bureau', photoType: 'bureau' },
  { value: 'dressing', label: 'Dressing', photoType: 'autre' },
  { value: 'buanderie', label: 'Buanderie', photoType: 'autre' },
  { value: 'cave', label: 'Cave', photoType: 'autre' },
  { value: 'garage', label: 'Garage', photoType: 'exterieur' },
  { value: 'autre', label: 'Autre', photoType: 'autre' },
];

export function roomTypeLabel(value) {
  const t = ROOM_TYPES.find((r) => r.value === value);
  return t ? t.label : 'Autre';
}

export function roomPhotoType(value) {
  const t = ROOM_TYPES.find((r) => r.value === value);
  return t ? t.photoType : 'autre';
}

// ============================================================================
// Génération des pièces depuis le bien actif
// ============================================================================

let _roomSeq = 0;
function makeRoomId() {
  _roomSeq += 1;
  return `room_${Date.now().toString(36)}_${_roomSeq}`;
}

function makeRoom(type, name, surface) {
  return {
    id: makeRoomId(),
    type,
    name: name || roomTypeLabel(type),
    surface: surface != null ? surface : '',
    fields: {},
  };
}

/**
 * Liste démo statique (mode preview / aucun bien actif), façon wireframe.
 */
function demoRooms() {
  return [
    makeRoom('hall', 'Hall', ''),
    makeRoom('salle_eau', 'Salle d\'eau', ''),
    makeRoom('chambre_parentale', 'Chambre Parentale', ''),
    makeRoom('wc', 'WC', ''),
    makeRoom('autre', 'Autre', ''),
  ];
}

/**
 * Dérive une liste de pièces depuis le bien actif.
 *  - Si `active.bien` : Séjour ×1, Cuisine ×1, Chambre ×chambres,
 *    Salle de bain ×1, WC ×1. Maison → + Hall/Entrée.
 *  - Sinon : liste démo statique.
 *
 * @param {object|null} active - résultat de getActiveBien()
 * @returns {Array<{id,type,name,surface,fields}>}
 */
export function buildRoomsFromActiveBien(active) {
  if (!active || !active.bien) {
    return demoRooms();
  }
  const b = active.bien;
  const rooms = [];

  rooms.push(makeRoom('sejour', 'Séjour', ''));
  rooms.push(makeRoom('cuisine', 'Cuisine', ''));

  const nbChambres = parseInt(b.chambres, 10);
  if (!Number.isNaN(nbChambres) && nbChambres > 0) {
    for (let i = 0; i < nbChambres; i += 1) {
      const name = nbChambres === 1 ? 'Chambre' : `Chambre ${i + 1}`;
      rooms.push(makeRoom('chambre', name, ''));
    }
  } else {
    rooms.push(makeRoom('chambre', 'Chambre', ''));
  }

  rooms.push(makeRoom('salle_de_bain', 'Salle de bain', ''));
  rooms.push(makeRoom('wc', 'WC', ''));

  if (b.type === 'maison') {
    rooms.push(makeRoom('hall', 'Hall / Entrée', ''));
  }

  return rooms;
}

/**
 * Crée une nouvelle pièce vierge (pour le bouton « + Ajouter une pièce »).
 */
export function createEmptyRoom(type = 'autre') {
  return makeRoom(type, roomTypeLabel(type), '');
}

// ============================================================================
// Pré-remplissage des sections générales depuis le bien actif
// ============================================================================

const TYPE_TO_LABEL = {
  appartement: 'Appartement',
  maison: 'Maison individuelle',
};

const EXPOSITION_TO_LABEL = {
  sud: 'Sud', sud_est: 'Sud-Est', sud_ouest: 'Sud-Ouest', est: 'Est',
  ouest: 'Ouest', nord_est: 'Nord-Est', nord_ouest: 'Nord-Ouest', nord: 'Nord',
};

const ETAT_TO_LABEL = {
  neuf: 'Neuf',
  refait: 'Refait à neuf',
  bon: 'Bon état',
  a_rafraichir: 'À rafraîchir',
  a_renover: 'À rénover',
  a_reconstruire: 'À restructurer',
};

function etageToLabel(e) {
  if (e == null || e === '') return null;
  const n = parseInt(e, 10);
  if (Number.isNaN(n)) return null;
  if (n === 0) return 'Rez-de-chaussée';
  if (n === 1) return '1er étage';
  if (n >= 7) return '7ème étage et +';
  return `${n}ème étage`;
}

/**
 * Construit les valeurs initiales de `bienDetails` (format `${sectionKey}__${fieldKey}`)
 * pré-remplies depuis le bien actif (saisi via /nouveau-bien). Les valeurs déjà
 * persistées dans reportStore ont priorité côté appelant.
 *
 * @param {object|null} active - résultat de getActiveBien()
 * @returns {Record<string, string|boolean>}
 */
export function buildInitialBienDetails(active) {
  const out = {};
  if (!active || !active.bien) return out;
  const b = active.bien;
  const adr = active.adresse || {};
  const set = (sectionKey, fieldKey, value) => {
    if (value !== undefined && value !== null && value !== '') {
      out[`${sectionKey}__${fieldKey}`] = String(value);
    }
  };

  set('informations_principales', 'type_de_bien', TYPE_TO_LABEL[b.type]);
  set('informations_principales', 'adresse', adr.label);
  set('informations_principales', 'annee_de_construction', b.annee);
  set('informations_principales', 'nombre_de_pieces', b.pieces);
  set('informations_principales', 'nombre_de_chambres', b.chambres);

  set('surfaces', 'surface_habitable_m', b.surface);
  set('surfaces', 'surface_carrez_m', b.surface);

  set('informations', 'etat_general', ETAT_TO_LABEL[b.etat]);
  set('informations', 'etage_du_bien', etageToLabel(b.etage));
  if (b.ascenseur) set('informations', 'ascenseur', 'Oui');

  // DPE saisi en Step0 si présent.
  if (b.dpe) set('dpe', 'classe_dpe', String(b.dpe).toUpperCase());

  // Orientation : pas de champ section dédié (porté par pièce), on ignore.
  void EXPOSITION_TO_LABEL;

  return out;
}
