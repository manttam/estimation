/**
 * acquereursCsv.js
 * ----------------
 * Helpers pour l'import / export CSV des acquéreurs en mode live (Step 4)
 * et calcul de scoring vis-à-vis du bien actif.
 *
 * Schéma riche (17 colonnes) :
 *   nom, persona, statut, budget_min, budget_max, type, surface_min,
 *   pieces_min, chambres_min, etage_max, ascenseur, dpe_min, parking,
 *   exterieur, etat, delai_mois, notes
 *
 * Format CSV : virgule ou point-virgule comme séparateur (auto-détection),
 * 1ère ligne = entêtes. Encodage UTF-8.
 *
 * Persistance : SESSION uniquement. Aucun localStorage.
 */

const HEADERS = [
  'nom',
  'persona',
  'statut',
  'budget_min',
  'budget_max',
  'type',
  'surface_min',
  'pieces_min',
  'chambres_min',
  'etage_max',
  'ascenseur',
  'dpe_min',
  'parking',
  'exterieur',
  'etat',
  'delai_mois',
  'notes',
];

const PERSONA_VALUES = ['familles', 'investisseurs', 'primo', 'retraites', 'mono', 'autre'];
const STATUT_VALUES = ['chaud', 'actif', 'passif'];
const TYPE_VALUES = ['appartement', 'maison', 'indifferent'];
const ASCENSEUR_VALUES = ['obligatoire', 'souhaite', 'indifferent'];
const PARKING_VALUES = ['obligatoire', 'souhaite', 'non'];
const EXTERIEUR_VALUES = ['obligatoire', 'souhaite', 'non'];
const ETAT_VALUES = ['a-renover', 'bon', 'neuf', 'indifferent'];
const DPE_VALUES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * Détecte le séparateur CSV en regardant la première ligne.
 * Préfère ; si présent (export Excel FR), sinon , (standard).
 * @param {string} firstLine
 * @returns {string} ';' ou ','
 */
function detectSeparator(firstLine) {
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi > comma ? ';' : ',';
}

/**
 * Parse une ligne CSV en respectant les guillemets.
 * @param {string} line
 * @param {string} sep
 * @returns {string[]}
 */
function parseLine(line, sep) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === sep && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * Normalise un identifiant d'entête (lowercase, accents et espaces remplacés).
 * @param {string} s
 * @returns {string}
 */
function normHeader(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Coerce une valeur texte en nombre, ou null si vide / invalide.
 * @param {string} v
 * @returns {number | null}
 */
function toNumber(v) {
  if (v == null || v === '') return null;
  const cleaned = String(v).replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Coerce une valeur texte en option d'enum, sinon retourne le fallback.
 * @param {string} v
 * @param {string[]} allowed
 * @param {string} fallback
 * @returns {string}
 */
function toEnum(v, allowed, fallback) {
  if (!v) return fallback;
  const normalized = String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = allowed.find((a) => a === normalized);
  return match || fallback;
}

/**
 * Parse un fichier CSV (texte) en tableau d'acquéreurs.
 * Retourne `{ rows, errors }` :
 *   - rows : acquéreurs valides
 *   - errors : avertissements/erreurs par ligne
 *
 * @param {string} text - contenu UTF-8 du CSV
 * @returns {{ rows: object[], errors: { line: number, message: string }[] }}
 */
export function parseAcquereursCsv(text) {
  const errors = [];
  if (!text || typeof text !== 'string') {
    return { rows: [], errors: [{ line: 0, message: 'Fichier vide' }] };
  }
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: 'Fichier vide' }] };
  }
  const sep = detectSeparator(lines[0]);
  const headers = parseLine(lines[0], sep).map(normHeader);

  const idx = {};
  HEADERS.forEach((h) => {
    const i = headers.indexOf(h);
    if (i >= 0) idx[h] = i;
  });
  if (idx.nom == null) {
    return {
      rows: [],
      errors: [{
        line: 1,
        message: `Colonne "nom" manquante. Ent\u00eates attendues : ${HEADERS.join(', ')}`,
      }],
    };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseLine(lines[i], sep);
    const get = (key) => (idx[key] != null ? cells[idx[key]] : '');
    const nom = (get('nom') || '').trim();
    if (!nom) {
      errors.push({ line: i + 1, message: 'Nom vide \u2014 ligne ignor\u00e9e' });
      continue;
    }
    rows.push({
      id: `csv-${Date.now()}-${i}`,
      source: 'csv',
      nom,
      persona: toEnum(get('persona'), PERSONA_VALUES, 'autre'),
      statut: toEnum(get('statut'), STATUT_VALUES, 'actif'),
      budgetMin: toNumber(get('budget_min')),
      budgetMax: toNumber(get('budget_max')),
      type: toEnum(get('type'), TYPE_VALUES, 'indifferent'),
      surfaceMin: toNumber(get('surface_min')),
      piecesMin: toNumber(get('pieces_min')),
      chambresMin: toNumber(get('chambres_min')),
      etageMax: toNumber(get('etage_max')),
      ascenseur: toEnum(get('ascenseur'), ASCENSEUR_VALUES, 'indifferent'),
      dpeMin: (() => {
        const v = (get('dpe_min') || '').toUpperCase();
        return DPE_VALUES.includes(v) ? v : 'D';
      })(),
      parking: toEnum(get('parking'), PARKING_VALUES, 'souhaite'),
      exterieur: toEnum(get('exterieur'), EXTERIEUR_VALUES, 'souhaite'),
      etat: toEnum(get('etat'), ETAT_VALUES, 'bon'),
      delaiMois: toNumber(get('delai_mois')),
      notes: (get('notes') || '').trim(),
    });
  }
  return { rows, errors };
}

/**
 * Génère un template CSV (entêtes + 2 lignes d'exemple) téléchargeable.
 * @returns {string} contenu CSV UTF-8
 */
export function buildAcquereurCsvTemplate() {
  const lines = [
    HEADERS.join(','),
    [
      'Famille #F047', 'familles', 'chaud',
      280, 305, 'appartement', 65, 3, 2, 5,
      'souhaite', 'D', 'souhaite', 'obligatoire', 'bon', 3,
      '"Recherche active sur Lyon 3e"',
    ].join(','),
    [
      'Invest. #I021', 'investisseurs', 'actif',
      260, 290, 'appartement', 40, 2, 1, '',
      'indifferent', 'E', 'non', 'non', 'a-renover', 6,
      '"Locatif \u00e9tudiant"',
    ].join(','),
  ];
  return lines.join('\n');
}

/* ─── Scoring ────────────────────────────────────────────────────────────
 * Score = % de critères durs respectés par le bien actif.
 * Critères pondérés simples : chaque critère vaut 1 point s'il est respecté,
 * 0 sinon (les critères "indifferent" sont neutralisés). */

const DPE_RANK = { A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1 };

/**
 * Calcule le score d'un acquéreur vis-à-vis du bien actif.
 * @param {object} acq - acquéreur
 * @param {object} bien - bien actif (de getActiveBien().bien)
 * @param {number | null} prixEstime - prix estimé du bien en euros (ou null)
 * @returns {{ score: number, matches: { label: string, ok: boolean }[] }}
 */
export function scoreAcquereur(acq, bien, prixEstime) {
  if (!acq || !bien) return { score: 0, matches: [] };
  const matches = [];

  // Budget : on compare le prix estimé du bien à [budgetMin, budgetMax]
  if (acq.budgetMax != null && prixEstime != null) {
    const okMax = prixEstime <= acq.budgetMax * 1000; // budgetMax en k€
    const okMin = acq.budgetMin == null || prixEstime >= acq.budgetMin * 1000;
    matches.push({ label: 'Budget', ok: okMax && okMin });
  }

  // Type
  if (acq.type && acq.type !== 'indifferent' && bien.type) {
    matches.push({ label: 'Type', ok: acq.type === bien.type });
  }

  // Surface min
  if (acq.surfaceMin != null && bien.surface != null) {
    matches.push({ label: 'Surface', ok: Number(bien.surface) >= acq.surfaceMin });
  }

  // Pièces min
  if (acq.piecesMin != null && bien.pieces != null && bien.pieces !== '') {
    matches.push({ label: 'Pi\u00e8ces', ok: Number(bien.pieces) >= acq.piecesMin });
  }

  // Chambres min
  if (acq.chambresMin != null && bien.chambres != null && bien.chambres !== '') {
    matches.push({ label: 'Chambres', ok: Number(bien.chambres) >= acq.chambresMin });
  }

  // Étage max
  if (acq.etageMax != null && bien.etage != null && bien.etage !== '') {
    matches.push({ label: '\u00c9tage', ok: Number(bien.etage) <= acq.etageMax });
  }

  // Ascenseur
  if (acq.ascenseur === 'obligatoire') {
    matches.push({ label: 'Ascenseur', ok: !!bien.ascenseur });
  }

  // DPE
  if (acq.dpeMin && bien.dpe) {
    const required = DPE_RANK[acq.dpeMin] || 0;
    const actual = DPE_RANK[String(bien.dpe).toUpperCase()] || 0;
    matches.push({ label: 'DPE', ok: actual >= required });
  }

  // Parking
  if (acq.parking === 'obligatoire') {
    matches.push({ label: 'Parking', ok: bien.parking && bien.parking !== 'aucun' });
  }

  // Extérieur
  if (acq.exterieur === 'obligatoire') {
    matches.push({ label: 'Ext\u00e9rieur', ok: bien.exterieur && bien.exterieur !== 'aucun' });
  }

  // État
  if (acq.etat && acq.etat !== 'indifferent' && bien.etat) {
    let ok = false;
    if (acq.etat === 'a-renover') ok = true;
    else if (acq.etat === 'bon') ok = ['bon', 'tres-bon', 'neuf'].includes(bien.etat);
    else if (acq.etat === 'neuf') ok = bien.etat === 'neuf';
    matches.push({ label: '\u00c9tat', ok });
  }

  if (matches.length === 0) return { score: 0, matches: [] };
  const passes = matches.filter((m) => m.ok).length;
  const score = Math.round((passes / matches.length) * 100);
  return { score, matches };
}

export const ACQUEREUR_HEADERS = HEADERS;
