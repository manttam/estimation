/**
 * Endpoint serverless Vercel — Leboncoin (annonces de mise en vente).
 *
 * Proxy serveur de l'API mobile publique Leboncoin :
 *   POST https://api.leboncoin.fr/finder/v1/search
 *
 * Pourquoi un proxy ?
 *   - L'appel direct depuis le navigateur échoue (CORS strict)
 *   - Permet de normaliser la réponse au même format que /api/dvf.js
 *   - Centralise les headers (api_key, User-Agent appli mobile)
 *
 * Usage R&D / projet interne uniquement — les ToS Leboncoin interdisent
 * l'extraction automatisée. À ne PAS basculer en production Papiris.
 *
 * Input  : GET /api/leboncoin?postcode=69003&city=Lyon[&type=appartement|maison][&limit=35]
 * Output : { ok: true, postcode, city, type, count, total,
 *            transactions: [{ id, date, prix, surface, pieces, type,
 *              prixM2, adresse, commune, cp, lat, lon, url, photo,
 *              source: 'portail', portalName: 'leboncoin' }] }
 *          ou { ok: false, error: '...' } en cas d'échec.
 *
 * Cache : 1h (les annonces bougent plus vite que DVF — màj quotidienne).
 */

export const config = {
  runtime: 'nodejs',
  maxDuration: 20,
};

/* Mapping type cible → real_estate_type Leboncoin (1=maison, 2=appart). */
const TYPE_TO_LBC = {
  maison: '1',
  appartement: '2',
  appart: '2',
  terrain: '3',
};

/* Réciproque pour libellés "Maison"/"Appartement" du payload Leboncoin. */
function normalizeLbcType(label) {
  if (!label) return null;
  const l = String(label).toLowerCase();
  if (l.startsWith('maison')) return 'maison';
  if (l.startsWith('appart')) return 'appartement';
  if (l.startsWith('terrain')) return 'terrain';
  return l;
}

/* Récupère la valeur d'un attribut Leboncoin par sa key. */
function attr(ad, key) {
  if (!ad || !Array.isArray(ad.attributes)) return null;
  const found = ad.attributes.find((a) => a && a.key === key);
  if (!found) return null;
  return found.value_label || found.value || null;
}

/* Parse "55" → 55, "abc" → null, "" → null. */
function toInt(v) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/* Convertit "2025-04-12 14:32:01" → "2025-04-12" (gardé court pour Step3). */
function shortDate(iso) {
  if (!iso) return null;
  const s = String(iso);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/* Normalise une annonce Leboncoin → shape "transaction" (cohérente avec DVF). */
function lbcAdToTransaction(ad) {
  const prix = Array.isArray(ad?.price) && ad.price[0] != null
    ? Number(ad.price[0]) : null;
  const surface = toInt(attr(ad, 'square'));
  const pieces = toInt(attr(ad, 'rooms'));
  const typeLabel = attr(ad, 'real_estate_type');
  const type = normalizeLbcType(typeLabel);
  const prixM2 = (prix && surface) ? Math.round(prix / surface) : null;
  const loc = ad?.location || {};
  const lat = (typeof loc.lat === 'number') ? loc.lat : null;
  const lon = (typeof loc.lng === 'number') ? loc.lng : null;
  const photo = ad?.images?.thumb_url
    || (Array.isArray(ad?.images?.urls_thumb) && ad.images.urls_thumb[0])
    || (Array.isArray(ad?.images?.urls) && ad.images.urls[0])
    || null;
  return {
    id: ad?.list_id ? `lbc-${ad.list_id}` : null,
    date: shortDate(ad?.first_publication_date),
    prix,
    surface,
    pieces,
    type,
    prixM2,
    adresse: loc.street || null,
    commune: loc.city || null,
    cp: loc.zipcode || null,
    lat,
    lon,
    url: ad?.url || null,
    photo,
    source: 'portail',
    portalName: 'leboncoin',
    titre: ad?.subject || null,
  };
}

export default async function handler(req, res) {
  try {
    const { postcode, city, type, limit } = req.query || {};
    if (!postcode || !city) {
      res.status(400).json({
        ok: false,
        error: 'postcode et city requis (ex: ?postcode=69003&city=Lyon)',
      });
      return;
    }

    const realEstateType = type ? TYPE_TO_LBC[String(type).toLowerCase()] : null;
    const requestedLimit = Math.min(Math.max(toInt(limit) || 35, 1), 100);

    /* Construction du body Leboncoin (format api mobile v1). */
    const body = {
      limit: requestedLimit,
      limit_alu: 3,
      offset: 0,
      filters: {
        category: { id: '9' }, // 9 = Ventes immobilières
        enums: {
          ad_type: ['offer'],
          ...(realEstateType ? { real_estate_type: [realEstateType] } : {}),
        },
        location: {
          locations: [{
            locationType: 'city',
            city: String(city),
            zipcode: String(postcode),
            label: `${city} ${postcode}`,
          }],
        },
      },
    };

    /* Appel Leboncoin avec headers appli mobile. La clé api_key
     * 'ba0c2dad52b3ec' est extraite de l'appli mobile et largement
     * documentée publiquement. */
    const apiKey = process.env.LBC_API_KEY || 'ba0c2dad52b3ec';
    const ua = process.env.LBC_USER_AGENT
      || 'LBC;Android;9;Pixel 4;phone;abcdef0123456789;wifi;5.36.1.0;3;3;phone';

    const upstream = await fetch('https://api.leboncoin.fr/finder/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api_key': apiKey,
        'User-Agent': ua,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      res.status(502).json({
        ok: false,
        error: `Leboncoin upstream ${upstream.status}`,
        upstream_status: upstream.status,
        upstream_snippet: text.slice(0, 300),
      });
      return;
    }

    const json = await upstream.json();
    const ads = Array.isArray(json?.ads) ? json.ads : [];
    const total = typeof json?.total === 'number' ? json.total : ads.length;
    const transactions = ads
      .map(lbcAdToTransaction)
      .filter((t) => t && t.prix && t.surface);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      ok: true,
      postcode: String(postcode),
      city: String(city),
      type: type || null,
      count: transactions.length,
      total,
      transactions,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
}
