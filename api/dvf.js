/**
 * Endpoint serverless Vercel — DVF (Demandes de Valeurs Foncières).
 *
 * Proxy côté serveur de la base DVF Etalab statique :
 *   https://files.data.gouv.fr/geo-dvf/latest/csv/{YEAR}/communes/{DEP}/{INSEE}.csv
 *
 * Pourquoi un proxy ?
 *   - cquest.org/dvf est chroniquement KO (504 gateway timeout)
 *   - Le fetch direct depuis le navigateur sur files.data.gouv.fr échoue
 *     (CORS strict, pas d'header Access-Control-Allow-Origin)
 *   - En passant par notre fonction Vercel, on contourne CORS et on
 *     centralise le calcul des stats (médiane, moyenne, p25, p75).
 *
 * Input  : GET /api/dvf?citycode=69065[&type=appartement|maison]
 * Output : { ok: true, count, median, moyenne, min, max, p25, p75,
 *            transactions: [{ date, prix, surface, pieces, type, prixM2,
 *                             adresse, lat, lon }] }
 *          ou { ok: false, error: '...' } en cas d'échec.
 *
 * Cache : 24h via header Cache-Control (les données DVF changent
 *         rarement — màj trimestrielle côté Etalab).
 */

export const config = {
  runtime: 'nodejs',
  maxDuration: 25,
};

/* INSEE citycode → département (gère 2A/2B Corse + 97x DOM). */
function depFromCitycode(citycode) {
  if (!citycode) return null;
  const c = String(citycode);
  if (c.startsWith('2A')) return '2A';
  if (c.startsWith('2B')) return '2B';
  if (/^97[1-6]/.test(c)) return c.slice(0, 3); // DOM
  return c.slice(0, 2);
}

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

/* Calcul percentile (sur tableau trié croissant). */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

/* Stats à partir d'un tableau de transactions (filtrées par type optionnel). */
function computeStats(transactions, type = null) {
  let list = transactions;
  if (type) {
    const want = type.toLowerCase();
    list = transactions.filter((t) => t.type === want);
  }
  if (!list.length) return null;
  const prices = list.map((t) => t.prixM2).sort((a, b) => a - b);
  const sum = prices.reduce((acc, v) => acc + v, 0);
  return {
    count: prices.length,
    median: percentile(prices, 0.5),
    moyenne: Math.round(sum / prices.length),
    min: prices[0],
    max: prices[prices.length - 1],
    p25: percentile(prices, 0.25),
    p75: percentile(prices, 0.75),
  };
}

/* Fetch + parse CSV pour une (commune, année). */
async function fetchYear(citycode, dep, year) {
  const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/${year}/communes/${dep}/${citycode}.csv`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log('[api/dvf]', year, citycode, 'HTTP', res.status);
      return [];
    }
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
        type: typeLocal, // "appartement" | "maison" | "local industriel..." etc.
        prixM2,
        adresse: [cells[iNum], cells[iAdr]].filter(Boolean).join(' ').trim(),
        commune: cells[iCom] || '',
        cp: cells[iCp] || '',
        lat: parseFloat(cells[iLat] || '0') || null,
        lon: parseFloat(cells[iLon] || '0') || null,
      });
    }
    console.log('[api/dvf]', year, citycode, '→', out.length, 'tx');
    return out;
  } catch (err) {
    console.warn('[api/dvf]', year, citycode, 'fetch error', err.message);
    return [];
  }
}

export default async function handler(req, res) {
  // Tolère GET et HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const citycode = (req.query?.citycode || '').toString().trim();
  const type = (req.query?.type || '').toString().trim() || null;

  if (!citycode || !/^(2A|2B|\d{2,3})\d{2,3}$/.test(citycode)) {
    res.status(400).json({ ok: false, error: 'citycode INSEE invalide ou manquant (ex: 69065)' });
    return;
  }

  const dep = depFromCitycode(citycode);
  if (!dep) {
    res.status(400).json({ ok: false, error: 'département non déductible du citycode' });
    return;
  }

  // Tente sur 3 années (la plus récente d'abord) et cumule.
  const years = [2025, 2024, 2023];
  const lists = await Promise.all(years.map((y) => fetchYear(citycode, dep, y)));
  const transactions = lists.flat();

  if (transactions.length === 0) {
    // Cache courte durée pour ne pas hammerer Etalab
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({
      ok: false,
      error: 'Aucune transaction DVF trouvée pour cette commune sur 2023-2025',
      citycode,
      count: 0,
    });
    return;
  }

  const statsByType = type ? computeStats(transactions, type) : null;
  const statsAll = computeStats(transactions);
  const statsRetenues = (statsByType && statsByType.count >= 5) ? statsByType : statsAll;

  // Cache 24h sur le CDN Vercel (DVF est mis à jour trimestriellement)
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  res.status(200).json({
    ok: true,
    citycode,
    dep,
    type: type || null,
    typeMatched: statsByType && statsByType.count >= 5 ? type : null,
    count: transactions.length,
    countByType: statsByType ? statsByType.count : null,
    ...statsRetenues,
    transactions: transactions.slice(0, 100), // limite payload
  });
}
