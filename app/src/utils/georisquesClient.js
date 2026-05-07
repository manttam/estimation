/**
 * Géorisques — API publique data.gouv.fr (https://www.georisques.gouv.fr/api/v1/)
 *
 * Renvoie une synthèse simplifiée des risques pour une commune (citycode INSEE)
 * et des coordonnées (lat, lon) :
 *  - inondation (PPRI)
 *  - retrait-gonflement argile (RGA)
 *  - sismicité
 *  - radon
 *  - mouvement de terrain
 *  - sols pollués (BASIAS / BASOL)
 *
 * En cas d'échec réseau / CORS / endpoint indispo, renvoie null silencieusement.
 * L'appelant retombera sur les données démo.
 */

const BASE = 'https://www.georisques.gouv.fr/api/v1';

/**
 * Fetch helper avec timeout + signal partagé.
 */
async function gfetch(url, signal, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  // chain abort signals
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Synthèse risques par citycode INSEE.
 *
 * @param {string} citycode - code INSEE 5 chiffres (ex. '69383')
 * @param {[number,number]} coords - [lat, lon] (ex. [45.758, 4.859])
 * @param {AbortSignal} [signal]
 * @returns {Promise<{
 *   inondation: { present: boolean, niveau: string|null } | null,
 *   argile:     { niveau: string|null } | null,
 *   sismique:   { zone: string|null, niveau: string|null } | null,
 *   radon:      { potentiel: string|null } | null,
 *   mouvement:  { present: boolean, count: number } | null,
 *   basias:     { present: boolean, count: number } | null,
 * } | null>}
 */
export async function getRisquesSynthese(citycode, coords, signal) {
  if (!citycode || !coords) return null;
  const [lat, lon] = coords;

  // Endpoints publics — chaque appel est isolé pour qu'un échec partiel
  // ne tue pas tout le bloc.
  const safeCall = async (fn) => {
    try { return await fn(); } catch { return null; }
  };

  // Sismicité (zonage) — par citycode
  const sismique = await safeCall(async () => {
    const j = await gfetch(`${BASE}/zonage_sismique?code_insee=${citycode}`, signal);
    if (!j || !j.data || j.data.length === 0) return null;
    const z = j.data[0];
    const zoneNum = z.code_zone || z.zone_sismicite;
    const niveau = ({
      '1': 'Très faible',
      '2': 'Faible',
      '3': 'Modérée',
      '4': 'Moyenne',
      '5': 'Forte',
    })[String(zoneNum)] || null;
    return { zone: String(zoneNum), niveau };
  });

  // Radon (potentiel) — par citycode
  const radon = await safeCall(async () => {
    const j = await gfetch(`${BASE}/radon?code_insee=${citycode}`, signal);
    if (!j || !j.data || j.data.length === 0) return null;
    const r = j.data[0];
    const cat = r.classe_potentiel || r.classe || null;
    const niveau = ({
      '1': 'Faible',
      '2': 'Moyen',
      '3': 'Élevé',
    })[String(cat)] || null;
    return { potentiel: niveau };
  });

  // Argile (RGA) — par coordonnées
  const argile = await safeCall(async () => {
    const j = await gfetch(`${BASE}/risques/argiles?latlon=${lon},${lat}`, signal);
    if (!j || !j.exposition) return null;
    return { niveau: j.exposition || null };
  });

  // Synthèse rapport risque (PPRI inondation + mouvement) — par latlon
  const rapport = await safeCall(async () => {
    const url = `${BASE}/resultats_rapport_risque?latlon=${lon},${lat}&rayon=500&code_insee=${citycode}`;
    return await gfetch(url, signal);
  });

  let inondation = null;
  let mouvement = null;
  if (rapport) {
    const ppr = Array.isArray(rapport.ppr) ? rapport.ppr : [];
    const inondPpr = ppr.find((p) => /inondation/i.test(p.libelle_risque || p.lib_risque_jur || ''));
    inondation = {
      present: !!inondPpr,
      niveau: inondPpr ? (inondPpr.libelle_etat_procedure || inondPpr.libelle_risque || 'PPRI') : null,
    };
    const mvts = Array.isArray(rapport.mvts) ? rapport.mvts : [];
    mouvement = { present: mvts.length > 0, count: mvts.length };
  }

  // Sites BASIAS (sols pollués) — par coordonnées, rayon 500 m
  const basias = await safeCall(async () => {
    const j = await gfetch(`${BASE}/installations_classees?latlon=${lon},${lat}&rayon=500`, signal);
    const list = Array.isArray(j?.data) ? j.data : [];
    return { present: list.length > 0, count: list.length };
  });

  return { inondation, argile, sismique, radon, mouvement, basias };
}
