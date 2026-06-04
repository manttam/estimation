/* reportStore.js
 *
 * Store unifié des données saisies par l'utilisateur dans le tunnel
 * d'estimation (Step1 → Step5) qui doivent remonter dans le rapport
 * commercial (page /report).
 *
 * Persisté dans localStorage sous la clé `ideeri_report_state`.
 * Les Steps appellent `setReportState({...})` (merge superficiel à la
 * racine) à chaque modification, ou `mergeReportSection('cle', {...})`
 * pour des sous-objets imbriqués (ex. bienDetails, contexteMarche).
 *
 * La page CompteRendu lit l'état complet via `getReportState()` au
 * montage et l'utilise en priorité sur les valeurs calculées ou les
 * mocks de propertyData.
 *
 * Forme de l'état (tous champs optionnels) :
 * {
 *   // Step1 — fiche technique détaillée du bien (toutes les saisies
 *   // des accordéons sont stockées à plat, clés slugifiées en
 *   // `${catKey}__${fieldKey}` pour garantir l'unicité).
 *   bienDetails: { [key: string]: string | number | boolean },
 *
 *   // Step2 — contexte zone / marché local
 *   contexteMarche: {
 *     rayon?: number,           // m
 *     poi?: { transports: [], commerces: [], education: [], sante: [] },
 *     risques?: object,         // synthèse Géorisques
 *     dvfLive?: object,         // dvfStats recalculés en Step2
 *     prixM2Median?: number,
 *     evolution?: string,
 *     tensionLabel?: string,
 *     tensionScore?: number,
 *     delaiMoyen?: string,
 *     fourchette?: string,
 *     transactions?: number,
 *   },
 *
 *   // Step3 — comparables
 *   comparablesSelectionnes: Comparable[],  // top 3 sélectionnés
 *   comparablesConfig: {
 *     weights?: { [compId: string]: number },
 *     filtres?: {
 *       surfaceMin, surfaceMax, piecesMin, piecesMax,
 *       prixMin, prixMax, typeFilter, radius,
 *       delayDvf, delayIdeeri, delayEncours, delayPortail,
 *     },
 *   },
 *
 *   // Step4 — tension marché
 *   tensionConfig: {
 *     newProjectsWindow?: number,
 *     pdfSel?: { act1: boolean, act2: boolean, act3: boolean },
 *   },
 *
 *   // Step5 — planificateur de rendez-vous client (remonte dans Ideeri)
 *   rdvPlanner: {
 *     jalons?: Array<{
 *       id: string, label: string, date: string (ISO yyyy-mm-dd),
 *       heure: string (HH:MM), duree: number (min), color: string,
 *     }>,
 *   },
 *
 *   // Step5 — avis de valeur
 *   pointsForts: string[],
 *   pointsVigilance: string[],
 *   customPrice: number,
 *   selectedStrategy: number,
 *   displayConfig: {
 *     hideConfiance?: boolean,
 *     hideStrategie?: boolean,
 *     hideDemo?: boolean,
 *   },
 *
 *   // Identités — saisies sur fiche de réglages dédiée
 *   mandant: {
 *     civilite?: string,
 *     prenom?: string,
 *     nom?: string,
 *     email?: string,
 *     telephone?: string,
 *     adresseCorrespondance?: string,
 *   },
 *   agence: {
 *     nom?: string, adresse?: string, tel?: string, email?: string,
 *     logo?: string, couleurPrimaire?: string, couleurSecondaire?: string,
 *   },
 *   agent: {
 *     nom?: string, fonction?: string, email?: string, telephone?: string,
 *     signature?: string,
 *   },
 * }
 */

const STORAGE_KEY = 'ideeri_report_state';

function safeStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/* Lit l'état complet du rapport. Retourne un objet vide si rien n'est
 * persisté ou si la lecture échoue. */
export function getReportState() {
  const storage = safeStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/* Merge superficiel à la racine : on garde tous les autres champs et
 * on remplace uniquement les clés fournies dans `patch`. */
export function setReportState(patch) {
  if (!patch || typeof patch !== 'object') return;
  const storage = safeStorage();
  if (!storage) return;
  try {
    const current = getReportState();
    const next = { ...current, ...patch };
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota ou mode privé : silencieux */
  }
}

/* Merge d'un sous-objet sans écraser les autres clés du sous-objet.
 * Exemple : mergeReportSection('bienDetails', { 'structure__annee': 1972 })
 * ne supprime pas les autres champs déjà persistés dans bienDetails. */
export function mergeReportSection(sectionKey, patch) {
  if (!sectionKey || !patch || typeof patch !== 'object') return;
  const storage = safeStorage();
  if (!storage) return;
  try {
    const current = getReportState();
    const currentSection = (current[sectionKey] && typeof current[sectionKey] === 'object')
      ? current[sectionKey]
      : {};
    const nextSection = { ...currentSection, ...patch };
    const next = { ...current, [sectionKey]: nextSection };
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* silencieux */
  }
}

/* Helper de lecture d'une section avec fallback. */
export function getReportSection(sectionKey, fallback = {}) {
  const state = getReportState();
  const sec = state[sectionKey];
  return (sec && typeof sec === 'object') ? sec : fallback;
}

/* Reset complet — utile à la création d'un nouveau bien. */
export function clearReportState() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* silencieux */
  }
}

/* Slugifie une chaîne pour servir de clé stable (ex. "Hauteur sous
 * plafond (cm)" → "hauteur_sous_plafond_cm"). */
export function slugifyKey(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
