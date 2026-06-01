/**
 * Mapping et calculs de couverture de comparaison entre le bien cible (Step 1)
 * et un comparable (DVF, Ideeri, Portail, En cours, manuel).
 *
 * Logique métier :
 * - Le bien cible expose N champs renseignés (parmi les 200+ champs Step 1).
 * - Chaque comparable expose un sous-ensemble M de ces mêmes champs.
 * - "Couverture données" (% données) = M / N
 *   → reflète la richesse de la comparaison possible.
 * - "Pertinence" (% sim) = sur ces M champs, combien sont alignés à la cible.
 *   → reflète la qualité de la comparaison sur les champs disponibles.
 *
 * Exemple : bien cible avec 80 champs renseignés.
 * - DVF (5 champs) → 5/80 = 6% données — peu de matière à comparer
 * - Ideeri minimal (12 champs) → 12/80 = 15% données
 * - Ideeri complet (78 champs en commun) → 78/80 = 98% données
 *
 * On ne se compare jamais à un référentiel artificiel (genre "/19 fixe") :
 * on est honnête sur le périmètre réel de la comparaison.
 */

/**
 * Liste canonique des champs comparables entre deux biens.
 *
 * Chaque entrée :
 * - key       : identifiant interne (utilisé pour les Sets d'intersection)
 * - label     : libellé humain (debug / UI)
 * - bienCible : tuple [titreCategorie, labelChamp] permettant de retrouver le
 *               champ dans bienCibleCategories (cf. activeBien.buildBienCibleCategories)
 * - compKeys  : tableau de noms de propriétés à tester sur un comparable OTHER
 *               (premier non vide gagne). Permet de gérer les variations
 *               (ex : 'surface' OU 'surfaceCarrez').
 *
 * Cette liste est volontairement ouverte : tu peux en ajouter / retirer
 * sans casser le calcul (le ratio M/N s'ajuste automatiquement).
 */
export const COMPARABLE_FIELDS = [
  // --- Identification ---
  { key: 'type', label: 'Type de bien',
    bienCible: ['Identification et Statut Juridique', 'Type de bien'],
    compKeys: ['type'] },

  // --- Caractéristiques générales ---
  { key: 'surface', label: 'Surface Carrez',
    bienCible: ['Caractéristiques Générales', 'Surface Carrez (m²)'],
    compKeys: ['surface'] },
  { key: 'surfaceUtile', label: 'Surface Boutin/SHAB',
    bienCible: ['Caractéristiques Générales', 'Surface Boutin/SHAB (m²)'],
    compKeys: ['surfaceUtile', 'surfaceShab'] },
  { key: 'pieces', label: 'Nombre de pièces',
    bienCible: ['Caractéristiques Générales', 'Nombre de pièces'],
    compKeys: ['pieces'] },
  { key: 'chambres', label: 'Nombre de chambres',
    bienCible: ['Caractéristiques Générales', 'Nombre de chambres'],
    compKeys: ['chambres'] },
  { key: 'sdb', label: 'Nombre SDB',
    bienCible: ['Caractéristiques Générales', 'Nombre SDB'],
    compKeys: ['sdb', 'nbSdb'] },
  { key: 'wc', label: 'Nombre WC',
    bienCible: ['Caractéristiques Générales', 'Nombre WC'],
    compKeys: ['wc', 'nbWc'] },
  { key: 'etage', label: 'Étage du bien',
    bienCible: ['Caractéristiques Générales', 'Étage du bien'],
    compKeys: ['etage'] },
  { key: 'etagesTotal', label: 'Nb étages immeuble',
    bienCible: ['Caractéristiques Générales', 'Nb étages immeuble'],
    compKeys: ['etagesTotal'] },
  { key: 'orientation', label: 'Orientation',
    bienCible: ['Caractéristiques Générales', 'Orientation'],
    compKeys: ['orientation'] },
  { key: 'ascenseur', label: 'Ascenseur',
    bienCible: ['Caractéristiques Générales', 'Ascenseur'],
    compKeys: ['ascenseur'] },
  { key: 'cave', label: 'Cave (m²)',
    bienCible: ['Caractéristiques Générales', 'Cave (m²)'],
    compKeys: ['cave'] },
  { key: 'garage', label: 'Garage / Box fermé',
    bienCible: ['Caractéristiques Générales', 'Garage / Box fermé'],
    compKeys: ['garage'] },
  { key: 'parking', label: 'Parking extérieur',
    bienCible: ['Caractéristiques Générales', 'Parking extérieur'],
    compKeys: ['parking'] },
  { key: 'terrasse', label: 'Terrasse (m²)',
    bienCible: ['Caractéristiques Générales', 'Terrasse (m²)'],
    compKeys: ['terrasse'] },
  { key: 'balcon', label: 'Balcon (m²)',
    bienCible: ['Caractéristiques Générales', 'Balcon (m²)'],
    compKeys: ['balcon'] },
  { key: 'loggia', label: 'Loggia (m²)',
    bienCible: ['Caractéristiques Générales', 'Loggia (m²)'],
    compKeys: ['loggia'] },
  { key: 'jardin', label: 'Jardin privatif (m²)',
    bienCible: ['Caractéristiques Générales', 'Jardin privatif (m²)'],
    compKeys: ['jardin', 'surfaceTerrain'] },
  { key: 'piscine', label: 'Piscine',
    bienCible: ['Caractéristiques Générales', 'Piscine'],
    compKeys: ['piscine'] },

  // --- Structure ---
  { key: 'anneeConstruction', label: 'Année de construction',
    bienCible: ['Structure et Gros Œuvre', 'Année de construction'],
    compKeys: ['anneeConstruction', 'annee'] },
  { key: 'epoqueConstruction', label: 'Époque de construction',
    bienCible: ['Structure et Gros Œuvre', 'Époque de construction'],
    compKeys: ['epoqueConstruction', 'epoque'] },
  { key: 'facadesEtat', label: 'État des façades',
    bienCible: ['Structure et Gros Œuvre', 'Façades — État'],
    compKeys: ['facadesEtat', 'etatGeneral'] },

  // --- Menuiseries ---
  { key: 'vitrage', label: 'Type de vitrage',
    bienCible: ['Menuiseries et Fenêtres', 'Type de vitrage'],
    compKeys: ['vitrage'] },

  // --- Chauffage ---
  { key: 'chauffageType', label: 'Type de chauffage',
    bienCible: ['Chauffage', 'Type de chauffage'],
    compKeys: ['chauffageType', 'chauffage'] },
  { key: 'chauffageEnergie', label: 'Énergie chauffage',
    bienCible: ['Chauffage', 'Énergie principale'],
    compKeys: ['chauffageEnergie', 'energie'] },

  // --- Isolation / DPE ---
  { key: 'dpe', label: 'DPE — Étiquette énergie',
    bienCible: ['Isolation Thermique', 'DPE — Étiquette énergie'],
    compKeys: ['dpe'] },
  { key: 'dpeConsommation', label: 'DPE — Consommation',
    bienCible: ['Isolation Thermique', 'DPE — Consommation (kWh/m²/an)'],
    compKeys: ['dpeConsommation'] },
  { key: 'ges', label: 'DPE — Étiquette GES',
    bienCible: ['Isolation Thermique', 'DPE — Étiquette GES'],
    compKeys: ['ges'] },

  // --- Cuisine / état ---
  { key: 'cuisineEquipee', label: 'Cuisine équipée',
    bienCible: ['Cuisine', 'Cuisine équipée'],
    compKeys: ['cuisineEquipee'] },
  { key: 'etatCuisine', label: 'État cuisine',
    bienCible: ['Cuisine', 'État général cuisine'],
    compKeys: ['etatCuisine'] },

  // --- Prix ---
  { key: 'prix', label: 'Prix de vente',
    bienCible: null, // pas de champ "prix" dans le bien cible
    compKeys: ['prix'] },
  { key: 'prixM2', label: 'Prix au m²',
    bienCible: null,
    compKeys: ['prixM2'] },
];

/**
 * Vérifie si une valeur de champ Step 1 (string / number / undefined) est
 * considérée comme renseignée. Vide / "—" / undefined = non renseignée.
 */
function isFieldFilled(field) {
  if (!field) return false;
  if (field.type === 'toggle') {
    // Un toggle est "renseigné" s'il a été activé (on === true).
    // Toggle off = non renseigné (sinon tous les toggles seraient remplis par défaut).
    return field.on === true;
  }
  const v = field.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (typeof v === 'string' && (v === '—' || v === '-' || v === 'Aucune' || v === 'Non')) {
    // Cas spéciaux : "Aucune" / "Non" comptent comme renseigné (c'est une réponse).
    // On ne les exclut pas. Si tu veux les exclure, retire cette ligne.
    return true;
  }
  return true;
}

/**
 * Récupère le champ Step 1 correspondant à une clé canonique.
 * Renvoie undefined si la clé n'est pas mappée vers le bien cible (cas du prix).
 */
function findBienCibleField(bienCibleCategories, fieldKey) {
  const def = COMPARABLE_FIELDS.find((f) => f.key === fieldKey);
  if (!def || !def.bienCible) return undefined;
  const [catTitle, fieldLabel] = def.bienCible;
  const cat = bienCibleCategories.find((c) => c.title === catTitle);
  if (!cat) return undefined;
  return cat.fields.find((f) => f.label === fieldLabel);
}

/**
 * Renvoie l'ensemble des keys (parmi COMPARABLE_FIELDS) renseignées sur le
 * bien cible. C'est le DÉNOMINATEUR du ratio "M/N".
 */
export function getTargetFilledFieldKeys(bienCibleCategories) {
  const filled = new Set();
  if (!Array.isArray(bienCibleCategories)) return filled;
  COMPARABLE_FIELDS.forEach((def) => {
    if (!def.bienCible) return; // pas de mapping vers le bien cible
    const f = findBienCibleField(bienCibleCategories, def.key);
    if (isFieldFilled(f)) filled.add(def.key);
  });
  return filled;
}

/**
 * Vérifie si une valeur (extrait depuis un comparable) est considérée comme
 * renseignée. Plus tolérant que isFieldFilled (pas de notion de toggle ici).
 */
function isCompValueFilled(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (typeof v === 'number' && Number.isNaN(v)) return false;
  if (typeof v === 'boolean') return true; // false compte comme "renseigné"
  return true;
}

/**
 * Renvoie l'ensemble des keys renseignées sur un comparable.
 * On regarde compKeys (tableau de propriétés possibles) + un éventuel
 * objet `fields` injecté pour la démo (mocks INITIAL_OTHERS).
 */
export function getComparableFilledFieldKeys(comp) {
  const filled = new Set();
  if (!comp || typeof comp !== 'object') return filled;
  COMPARABLE_FIELDS.forEach((def) => {
    // 1) Cherche dans comp.fields (objet de démo) en premier
    if (comp.fields && Object.prototype.hasOwnProperty.call(comp.fields, def.key)) {
      if (isCompValueFilled(comp.fields[def.key])) filled.add(def.key);
      return;
    }
    // 2) Sinon teste les compKeys (props directes)
    for (const k of def.compKeys || []) {
      if (Object.prototype.hasOwnProperty.call(comp, k) && isCompValueFilled(comp[k])) {
        filled.add(def.key);
        break;
      }
    }
  });
  return filled;
}

/**
 * Calcule la couverture données entre une cible (Set<key>) et un comparable.
 * Renvoie { count, total, percent, intersection } :
 * - count        : nb champs en commun (M)
 * - total        : nb champs renseignés sur la cible (N)
 * - percent      : entier 0-100 (M/N * 100)
 * - intersection : Set<key> des champs effectivement comparables
 *
 * Si la cible est vide (N = 0), on tombe en mode dégradé : le total prend la
 * taille de COMPARABLE_FIELDS (sinon le ratio M/0 n'a pas de sens).
 */
export function computeDataCoverage(targetSet, comparable) {
  const compSet = getComparableFilledFieldKeys(comparable);
  const intersection = new Set();
  for (const k of compSet) {
    if (targetSet.has(k)) intersection.add(k);
  }
  const total = targetSet.size > 0 ? targetSet.size : COMPARABLE_FIELDS.length;
  const count = intersection.size;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return { count, total, percent, intersection };
}

/**
 * Mappe un % de couverture vers une classe CSS ("high" / "mid" / "low").
 * Seuils :
 * - >= 60% : couverture riche → high
 * - 25-59% : couverture moyenne → mid
 * - < 25%  : couverture faible → low
 */
export function dataCoverageClass(percent) {
  if (percent >= 60) return 'high';
  if (percent >= 25) return 'mid';
  return 'low';
}
