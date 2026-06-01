/**
 * Endpoint serverless Vercel — DVF multi-communes ("zone").
 *
 * Contrairement à /api/dvf (qui ne couvre qu'UNE commune via ?citycode=XXX),
 * cet endpoint agrège les transactions DVF de TOUTES les communes dont le
 * centre tombe dans un rayon autour d'un point (lat/lon). Cela permet au front
 * Step3 d'afficher plusieurs communes/quartiers quand on élargit le rayon.
 *
 * Pipeline :
 *   1. geo.gouv ?lat=&lon=  → commune du point → département.
 *   2. geo.gouv /departements/{dep}/communes (centre) → toutes les communes
 *      du département, filtrées par haversine (centre à <= radius + marge).
 *   3. fetch DVF Etalab statique de chaque commune retenue, en parallèle.
 *   4. agrégation + filtrage des transactions par distance réelle au point.
 *
 * Input  : GET /api/dvf-zone?lat=45.7578&lon=4.8590&radius=3000[&type=appartement]
 * Output : { ok: true, count, communes: [{code, nom, count}], transactions: [...] }
 *          shape transaction identique à /api/dvf (commune, cp, lat, lon, ...)
 *          pour que le front (dvfTxToOther) reste inchangé.
 *
 * Cache : 24h (DVF MAJ trimestrielle ; découpage communal quasi statique).
 */

export const config = {
  runtime: 'nodejs',
  maxDuration: 25,
};

/* Parse une ligne CSV en respectant les guillemets. */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/* Distance haversine en mètres entre deux points [lat, lon]. */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* INSEE citycode → département (gère 2A/2B Corse + 97x DOM). */
function depFromCitycode(citycode) {
  const c = String(citycode || '');
  if (c.startsWith('2A')) return '2A';
  if (c.startsWith('2B')) return '2B';
  if (/^97[1-6]/.test(c)) return c.slice(0, 3); // DOM
  return c.slice(0, 2);
}

/* PLM : geo.gouv ne connaît que la commune-mère (Lyon 69123, Marseille 13055,
 * Paris 75056) mais le DVF Etalab est découpé par ARRONDISSEMENT. On expanse
 * donc le code-mère vers ses codes INSEE d'arrondissement (sinon DVF vide). */
const PLM_ARRONDISSEMENTS = {
  '69123': Array.from({ length: 9 }, (_, i) => `693${81 + i}`),  // Lyon 1er–9e
  '13055': Array.from({ length: 16 }, (_, i) => `132${(i + 1).toString().padStart(2, '0')}`), // Marseille 1–16
  '75056': Array.from({ length: 20 }, (_, i) => `751${(i + 1).toString().padStart(2, '0')}`), // Paris 1–20
};

/* Développe un code INSEE en liste de codes DVF réels (arrondissements PLM
 * le cas échéant, sinon le code seul). */
function expandToDvfCodes(code) {
  return PLM_ARRONDISSEMENTS[code] || [code];
}

/* Commune (et donc département) du point via geo.gouv. */
async function communeFromPoint(lat, lon) {
  const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=code,nom&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

/* Toutes les communes du département avec leur centre. */
async function communesOfDepartement(dep) {
  const url = `https://geo.api.gouv.fr/departements/${dep}/communes?fields=code,nom,centre&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

/* Fetch + parse CSV DVF pour une (commune, année). */
async function fetchYear(citycode, dep, year) {
  const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/${year}/communes/${dep}/${citycode}.csv`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]);
    const idx = (name) => headers.indexOf(name);
    const iVal = idx('valeur_fonciere');
    const iSurf = idx('surface_reelle_bati');
    const iType = idx('type_local');
    const iDate = idx('date_mutation');
    const iLat = idx('latitude');
    const iLon = idx('longitude');
    const iAdr = idx('adresse_nom_voie');
    const iNum = idx('adresse_numero');
    const iCp = idx('code_postal');
    const iCom = idx('nom_commune');
    const iPiec = idx('nombre_pieces_principales');

    const out = [];
    for (let li = 1; li < lines.length; li++) {
      const cells = parseCsvLine(lines[li]);
      const surface = parseFloat(cells[iSurf] || '0');
      const prix = parseFloat(cells[iVal] || '0');
      const prixM2 = surface > 0 ? Math.round(prix / surface) : null;
      // Filtres assainissement (élimine valeurs aberrantes)
      if (!prixM2 || prixM2 < 500 || prixM2 > 30000 || surface < 9) continue;
      const typeLocal = (cells[iType] || '').toLowerCase();
      out.push({
        date: cells[iDate] || '',
        prix,
        surface,
        pieces: parseInt(cells[iPiec] || '0', 10) || null,
        type: typeLocal,
        prixM2,
        adresse: [cells[iNum], cells[iAdr]].filter(Boolean).join(' ').trim(),
        commune: cells[iCom] || '',
        cp: cells[iCp] || '',
        lat: parseFloat(cells[iLat] || '0') || null,
        lon: parseFloat(cells[iLon] || '0') || null,
      });
    }
    return out;
  } catch (err) {
    console.warn('[api/dvf-zone]', year, citycode, 'fetch error', err.message);
    return [];
  }
}

/* Toutes les transactions d'une commune sur 3 ans. Pour Lyon/Marseille/Paris,
 * agrège tous les arrondissements (le DVF n'expose pas le code-mère). */
async function fetchCommune(citycode, dep) {
  const years = [2025, 2024, 2023];
  const codes = expandToDvfCodes(citycode);
  const lists = await Promise.all(
    codes.flatMap((code) => years.map((y) => fetchYear(code, dep, y)))
  );
  return lists.flat();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const lat = parseFloat((req.query?.lat || '').toString());
  const lon = parseFloat((req.query?.lon || '').toString());
  const radius = Math.min(
    Math.max(parseInt((req.query?.radius || '2000').toString(), 10) || 2000, 200),
    10000
  );
  const type = (req.query?.type || '').toString().trim().toLowerCase() || null;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ ok: false, error: 'lat/lon invalides ou manquants' });
    return;
  }

  // 1. Commune du point → département
  const pointCommune = await communeFromPoint(lat, lon);
  if (!pointCommune?.code) {
    res.status(200).json({ ok: false, error: 'commune introuvable pour ce point', lat, lon });
    return;
  }
  const dep = depFromCitycode(pointCommune.code);

  // 2. Communes du département dont le centre est dans le rayon (+ marge 1.5km
  //    pour rattraper les grandes communes dont le centre est loin du bien).
  const all = await communesOfDepartement(dep);
  const margin = 1500;
  const candidates = all
    .map((c) => {
      const co = c.centre?.coordinates;
      if (!co) return null;
      const dist = haversineMeters(lat, lon, co[1], co[0]);
      return { code: c.code, nom: c.nom, centerDist: dist };
    })
    .filter((c) => c && c.centerDist <= radius + margin);

  // Toujours inclure la commune du point (son centre peut être > radius si grande)
  if (!candidates.some((c) => c.code === pointCommune.code)) {
    candidates.push({ code: pointCommune.code, nom: pointCommune.nom, centerDist: 0 });
  }

  // 3. Fetch DVF de chaque commune candidate, en parallèle.
  const perCommune = await Promise.all(
    candidates.map(async (c) => ({
      ...c,
      txs: await fetchCommune(c.code, dep),
    }))
  );

  // 4. Agrégation + filtrage par distance réelle au point.
  const transactions = [];
  const communeCounts = new Map();
  for (const c of perCommune) {
    for (const tx of c.txs) {
      if (type && tx.type !== type) continue;
      if (tx.lat && tx.lon) {
        const d = haversineMeters(lat, lon, tx.lat, tx.lon);
        if (d > radius) continue;
      }
      transactions.push(tx);
      const key = c.nom || tx.commune || c.code;
      communeCounts.set(key, (communeCounts.get(key) || 0) + 1);
    }
  }

  // Tri par distance croissante au point (plus pertinent en tête de liste).
  transactions.sort((a, b) => {
    const da = a.lat && a.lon ? haversineMeters(lat, lon, a.lat, a.lon) : 1e9;
    const db = b.lat && b.lon ? haversineMeters(lat, lon, b.lat, b.lon) : 1e9;
    return da - db;
  });

  const communes = Array.from(communeCounts.entries())
    .map(([nom, count]) => ({ nom, count }))
    .sort((x, y) => y.count - x.count || x.nom.localeCompare(y.nom, 'fr'));

  if (transactions.length === 0) {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({
      ok: false,
      error: 'Aucune transaction DVF dans ce rayon',
      dep,
      radius,
      communesScanned: candidates.length,
      count: 0,
    });
    return;
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  res.status(200).json({
    ok: true,
    lat,
    lon,
    radius,
    dep,
    type: type || null,
    communesScanned: candidates.length,
    communes,
    count: transactions.length,
    transactions: transactions.slice(0, 200), // limite payload (zone = plus de tx)
  });
}
