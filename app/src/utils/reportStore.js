/* reportStore.js
 *
 * Store unifié des données saisies par l'utilisateur dans le tunnel
 * d'estimation (Step3 → Step5) qui doivent remonter dans le rapport
 * commercial (page /report).
 *
 * Persisté dans localStorage sous la clé `ideeri_report_state`.
 * Les Steps appellent `setReportState({...})` (merge superficiel) à chaque
 * modification d'un champ ; la page CompteRendu lit l'état complet via
 * `getReportState()` au montage et l'utilise en priorité sur les valeurs
 * calculées ou les mocks.
 *
 * Forme de l'état (tous champs optionnels) :
 * {
 *   comparablesSelectionnes: Comparable[],  // top 3 sélectionnés en Step3
 *   pointsForts: string[],                  // édités en Step5
 *   pointsVigilance: string[],              // édités en Step5
 *   customPrice: number,                    // prix retenu en Step5
 *   selectedStrategy: number,               // index 0|1|2 (prudent/medium/ambitieux)
 *   contexteMarche: {                       // données de marché agrégées
 *     prixM2Median?: number,
 *     evolution?: string,
 *     tensionLabel?: string,
 *     tensionScore?: number,
 *     delaiMoyen?: string,
 *     fourchette?: string,
 *     transactions?: number,
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

/* Merge superficiel : on garde tous les autres champs existants et on
 * remplace uniquement les clés fournies dans `patch`. */
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
