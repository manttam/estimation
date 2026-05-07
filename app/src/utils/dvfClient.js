/**
 * Client DVF (Demandes de Valeurs Foncieres) - donnees publiques Etalab.
 * Utilise l'API publique cquest.org (mirroir Etalab) qui supporte CORS.
 *
 * Doc DVF officielle: https://app.dvf.etalab.gouv.fr/
 * API utilisee:        https://api.cquest.org/dvf
 */

const DVF_BASE = 'https://api.cquest.org/dvf';

/**
 * Recupere les transactions DVF pour une commune (code INSEE).
 * Filtre les valeurs aberrantes (< 500 e/m2 ou > 30 000 e/m2).
 *
 * @param {string} citycode - code INSEE 5 chiffres
 * @param {Object} [opts]
 * @param {number} [opts.limit=200]
 * @returns {Promise<Array>}
 */
export async function fetchDvfByCommune(citycode, opts = {}) {
  if (!citycode) return [];
  const limit = opts.limit ?? 200;
  const url = `${DVF_BASE}?code_commune=${citycode}&limit=${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DVF HTTP ${res.status}`);
    const data = await res.json();

    return (data.resultats || [])
      .map((r) => {
        const surface = parseFloat(r.surface_relle_bati || r.surface_reelle_bati || 0);
        const prix = parseFloat(r.valeur_fonciere || 0);
        const prixM2 = surface > 0 ? Math.round(prix / surface) : null;
        return {
          date: r.date_mutation,
          prix,
          surface,
          pieces: r.nombre_pieces_principales ? parseInt(r.nombre_pieces_principales, 10) : null,
          type: (r.type_local || '').toLowerCase(),
          adresse: [r.adresse_numero, r.adresse_nom_voie].filter(Boolean).join(' '),
          commune: r.nom_commune,
          cp: r.code_postal,
          lat: r.lat ? parseFloat(r.lat) : null,
          lon: r.lon ? parseFloat(r.lon) : null,
          prixM2,
        };
      })
      .filter((r) => r.prixM2 && r.prixM2 >= 500 && r.prixM2 <= 30000 && r.surface >= 9);
  } catch (err) {
    console.error('[DVF] fetchDvfByCommune error', err);
    return [];
  }
}

/**
 * Statistiques sur un set de transactions DVF.
 * @param {Array} transactions
 * @param {string} [type] - filtre par type ("appartement" | "maison" | undefined)
 * @returns {{median, moyenne, min, max, p25, p75, count}|null}
 */
export function statsDvf(transactions, type) {
  const filtered = type
    ? transactions.filter((t) => t.type === type.toLowerCase())
    : transactions;
  if (filtered.length === 0) return null;
  const prixM2 = filtered
    .map((t) => t.prixM2)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (prixM2.length === 0) return null;
  const median = prixM2[Math.floor(prixM2.length / 2)];
  const moyenne = Math.round(prixM2.reduce((a, b) => a + b, 0) / prixM2.length);
  const min = prixM2[0];
  const max = prixM2[prixM2.length - 1];
  const p25 = prixM2[Math.floor(prixM2.length * 0.25)];
  const p75 = prixM2[Math.floor(prixM2.length * 0.75)];
  return { median, moyenne, min, max, p25, p75, count: filtered.length };
}

/**
 * Trie les transactions par proximite geographique d'un point donne.
 * @param {Array} transactions
 * @param {[number, number]} [lat, lon]
 * @returns {Array} - meme format, avec champ `distance` ajoute (en metres)
 */
export function sortByDistance(transactions, [lat, lon]) {
  if (lat == null || lon == null) return transactions;
  return transactions
    .map((t) => {
      if (t.lat == null || t.lon == null) return { ...t, distance: Infinity };
      const dLat = (t.lat - lat) * 111000;
      const dLon = (t.lon - lon) * 111000 * Math.cos((lat * Math.PI) / 180);
      const distance = Math.round(Math.sqrt(dLat * dLat + dLon * dLon));
      return { ...t, distance };
    })
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Filtre les transactions par anciennete maximum (en mois).
 */
export function filterByRecent(transactions, maxMonths = 24) {
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth() - maxMonths, now.getDate());
  return transactions.filter((t) => {
    if (!t.date) return false;
    const d = new Date(t.date);
    return !isNaN(d.getTime()) && d >= limit;
  });
}
