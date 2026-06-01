// Helpers pour interroger les APIs publiques de l'IGN (data.gouv.fr / Géoplateforme)
//   - API Carto Cadastre : https://apicarto.ign.fr/api/cadastre
//   - API Carto GPU      : https://apicarto.ign.fr/api/gpu
//
// Toutes les réponses sont en GeoJSON (FeatureCollection).

const CADASTRE_BASE = 'https://apicarto.ign.fr/api/cadastre';
const GPU_BASE = 'https://apicarto.ign.fr/api/gpu';

const buildPointGeom = (lon, lat) =>
  encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }));

/**
 * Récupère la parcelle cadastrale qui contient le point (lon, lat).
 * Retourne le premier Feature trouvé (ou null).
 */
export async function fetchParcelle(lon, lat) {
  const geom = buildPointGeom(lon, lat);
  const url = `${CADASTRE_BASE}/parcelle?geom=${geom}&_limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API Cadastre HTTP ${res.status}`);
  const data = await res.json();
  return data.features?.[0] ?? null;
}

/**
 * Récupère la zone d'urbanisme (PLU/PLUi) qui contient le point.
 * Retourne le premier Feature trouvé (ou null).
 */
export async function fetchZoneUrba(lon, lat) {
  const geom = buildPointGeom(lon, lat);
  const url = `${GPU_BASE}/zone-urba?geom=${geom}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API GPU HTTP ${res.status}`);
  const data = await res.json();
  return data.features?.[0] ?? null;
}

/**
 * Construit l'URL des tuiles WMS de l'IGN pour le cadastre.
 * Couche : "CADASTRALPARCELS.PARCELLAIRE_EXPRESS"
 * Service ouvert (pas de clé) sur data.geopf.fr.
 */
export const CADASTRE_WMTS_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';

/**
 * Couche WMTS du Plan IGN (fond de carte par défaut).
 */
export const PLAN_IGN_WMTS_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';

/**
 * Couche WMTS du Géoportail de l'urbanisme (zonage PLU).
 * Note : couvre uniquement les communes ayant publié leur document sur le GPU.
 */
export const GPU_ZONE_URBA_WMTS_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GPU.ZONE-URBA&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';

/**
 * Formatte la contenance (m²) en surface lisible.
 */
export function formatContenance(m2) {
  if (m2 == null) return '—';
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${m2.toLocaleString('fr-FR')} m²`;
}
