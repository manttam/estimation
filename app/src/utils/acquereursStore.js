/**
 * Store des acquéreurs réels (saisis manuellement ou importés via CSV)
 * pour la session courante.
 *
 * Persiste dans sessionStorage pour que les acquéreurs ajoutés en Step 4
 * soient également disponibles en Step 5 (et autres pages) tant que
 * l'onglet est ouvert. Effacé à la fermeture du navigateur ou via
 * clearAcquereurs().
 *
 * Volontairement séparé de l'activeBien (localStorage) car les acquéreurs
 * ne doivent pas survivre à un changement de session/utilisateur.
 */

const STORAGE_KEY = 'ideeri_acquereurs';

export function getAcquereurs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[acquereursStore] getAcquereurs error', err);
    return [];
  }
}

export function setAcquereurs(list) {
  if (typeof window === 'undefined') return;
  try {
    const safe = Array.isArray(list) ? list : [];
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch (err) {
    console.warn('[acquereursStore] setAcquereurs error', err);
  }
}

export function clearAcquereurs() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[acquereursStore] clearAcquereurs error', err);
  }
}
