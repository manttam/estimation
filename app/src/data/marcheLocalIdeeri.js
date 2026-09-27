/**
 * Marché local Ideeri — biens vendus / sous compromis / en vente autour du
 * bien estimé, tous réseaux confondus.
 *
 * ⚠️ DONNÉES ENTIÈREMENT FICTIVES, générées localement.
 * Aucune donnée réelle de mandant, d'acquéreur ou de transaction n'est utilisée.
 * Ce module simule ce que renverra l'API Ideeri (`GET /marche-local?lat&lon&rayon`)
 * pour que la Step 1 soit démontrable hors connexion. À remplacer par l'appel
 * réel : garder la même forme d'objet `bien` et le même contrat de retour.
 *
 * La génération est DÉTERMINISTE (seed dérivée des coordonnées du bien) :
 * deux rendus successifs sur le même bien produisent exactement le même
 * marché, sinon la carte "danserait" à chaque re-render.
 */

import { agence } from './propertyData';

// ---------------------------------------------------------------------------
// Réseau : mon agence + les autres agences abonnées à la solution Ideeri.
// ---------------------------------------------------------------------------
export const AGENCES_RESEAU = [
  { id: 'moi', nom: agence.nom, mine: true },
  { id: 'riviere', nom: 'Rivière & Associés', mine: false },
  { id: 'portalis', nom: 'Cabinet Portalis', mine: false },
  { id: 'horizon', nom: 'Horizon Immobilier', mine: false },
  { id: 'clevoute', nom: 'Clé de Voûte Immobilier', mine: false },
  { id: 'terres', nom: 'Terres & Demeures', mine: false },
];

export const STATUTS = {
  vendu: { key: 'vendu', label: 'Vendu', pluriel: 'Vendus', color: '#46B962' },
  compromis: { key: 'compromis', label: 'Sous compromis', pluriel: 'Sous compromis', color: '#f5a623' },
  en_vente: { key: 'en_vente', label: 'En vente', pluriel: 'En vente', color: '#4a6cf7' },
};

export const STATUT_ORDER = ['vendu', 'compromis', 'en_vente'];

// Voies fictives : utilisées tant que le géocodage inverse BAN n'a pas répondu
// (ou s'il échoue — mode hors ligne).
const VOIES_FICTIVES = [
  'rue des Acacias', 'chemin des Vignes', 'allée du Lavoir', 'route de la Combe',
  'impasse des Mûriers', 'rue du Vieux Puits', 'montée des Peupliers',
  'chemin du Pré Long', 'rue de la Fontaine', 'route des Coteaux',
  'clos des Tilleuls', 'rue de la Croix Blanche', 'chemin de Bellevue',
  'lotissement Les Terrasses', 'rue de l’Ancienne Gare', 'sentier des Buis',
];

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// ---------------------------------------------------------------------------
// Aléatoire déterministe (mulberry32) : même seed => même suite.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromCoords(lat, lon) {
  const a = Math.round(Math.abs(lat) * 10000);
  const b = Math.round(Math.abs(lon) * 10000);
  return (a * 7919 + b * 104729) % 2147483647;
}

// ---------------------------------------------------------------------------
// Géométrie (approximation plane, suffisante à l'échelle d'un secteur d'agence)
// ---------------------------------------------------------------------------
const KM_PAR_DEGRE = 111.32;

export function distanceKm(from, to) {
  const dLat = (to[0] - from[0]) * KM_PAR_DEGRE;
  const dLon = (to[1] - from[1]) * KM_PAR_DEGRE
    * Math.cos(((from[0] + to[0]) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function offsetKm(origin, km, bearingRad) {
  const dLat = (km * Math.cos(bearingRad)) / KM_PAR_DEGRE;
  const dLon = (km * Math.sin(bearingRad))
    / (KM_PAR_DEGRE * Math.cos(origin[0] * (Math.PI / 180)));
  return [origin[0] + dLat, origin[1] + dLon];
}

// ---------------------------------------------------------------------------
// Helpers de tirage
// ---------------------------------------------------------------------------
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const between = (rnd, min, max) => min + rnd() * (max - min);
const intBetween = (rnd, min, max) => Math.floor(between(rnd, min, max + 1));

function piecesDepuisSurface(surface, rnd) {
  if (surface < 45) return intBetween(rnd, 1, 2);
  if (surface < 70) return intBetween(rnd, 2, 3);
  if (surface < 100) return intBetween(rnd, 3, 4);
  if (surface < 140) return intBetween(rnd, 4, 5);
  return intBetween(rnd, 5, 7);
}

function moisLabel(date) {
  return `${MOIS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

function moisEcoules(date, ref) {
  return (ref.getFullYear() - date.getFullYear()) * 12 + (ref.getMonth() - date.getMonth());
}

// ---------------------------------------------------------------------------
// Génération du marché local
// ---------------------------------------------------------------------------
/**
 * @param {object} opts
 * @param {number} opts.lat            latitude du bien estimé
 * @param {number} opts.lon            longitude du bien estimé
 * @param {string} [opts.ville]        commune du bien (libellé d'affichage)
 * @param {number} [opts.prixM2Ref]    prix/m² de référence du secteur
 * @param {number} [opts.count]        nombre de biens à générer
 * @param {number} [opts.rayonMaxKm]   rayon max de dispersion
 * @param {Date}   [opts.now]          date de référence (tests)
 * @returns {{ agence: object, biens: Array }}
 */
export function buildMarcheLocal({
  lat,
  lon,
  ville = '',
  prixM2Ref = 2600,
  count = 76,
  rayonMaxKm = 12,
  now = new Date(),
} = {}) {
  const centre = [lat, lon];
  const rnd = mulberry32(seedFromCoords(lat, lon));

  // Position de l'agence : point fixe à 3–7 km du bien. Dans la vraie vie,
  // c'est l'adresse de l'agence géocodée une fois pour toutes.
  const agenceDistance = between(rnd, 3, 7);
  const agenceCoords = offsetKm(centre, agenceDistance, between(rnd, 0, Math.PI * 2));

  const biens = [];
  for (let i = 0; i < count; i += 1) {
    // Exposant < 1 : densité plus forte près du bien, comme un vrai secteur.
    const d = Math.pow(rnd(), 0.9) * rayonMaxKm;
    const coords = offsetKm(centre, d, rnd() * Math.PI * 2);

    const r = rnd();
    const statut = r < 0.58 ? 'vendu' : r < 0.73 ? 'compromis' : 'en_vente';

    const estMaison = rnd() < (d > 4 ? 0.62 : 0.34);
    const type = estMaison ? 'Maison' : 'Appartement';
    const surface = estMaison
      ? Math.round(between(rnd, 78, 185))
      : Math.round(between(rnd, 32, 118));
    const pieces = piecesDepuisSurface(surface, rnd);

    // Prix/m² : décote progressive avec l'éloignement + bruit de marché.
    const decoteDistance = 1 - Math.min(d / rayonMaxKm, 1) * 0.14;
    const prixM2 = Math.round(
      prixM2Ref * decoteDistance * (estMaison ? 0.92 : 1) * between(rnd, 0.84, 1.18)
    );
    const prix = Math.round((prixM2 * surface) / 1000) * 1000;

    const agenceRef = rnd() < 0.38
      ? AGENCES_RESEAU[0]
      : pick(rnd, AGENCES_RESEAU.slice(1));

    const bien = {
      id: `ml-${i + 1}`,
      statut,
      type,
      pieces,
      surface,
      prix,
      prixM2: Math.round(prix / surface),
      coords,
      distance: Math.round(distanceKm(centre, coords) * 10) / 10,
      voie: pick(rnd, VOIES_FICTIVES),
      ville,
      adresse: null, // renseignée par enrichirAdresses() si la BAN répond
      agenceId: agenceRef.id,
      agenceNom: agenceRef.nom,
      mine: agenceRef.mine,
    };

    if (statut === 'en_vente') {
      // Bien encore au catalogue : ancienneté de l'annonce.
      bien.enLigneDepuisJours = intBetween(rnd, 6, 240);
      const misEnLigne = new Date(now);
      misEnLigne.setDate(misEnLigne.getDate() - bien.enLigneDepuisJours);
      bien.dateISO = misEnLigne.toISOString().slice(0, 10);
      bien.dateLabel = moisLabel(misEnLigne);
      bien.moisEcoules = moisEcoules(misEnLigne, now);
    } else {
      // Vendu ou sous compromis : date de signature + délai de vente.
      const moisArriere = intBetween(rnd, 0, 41);
      const date = new Date(now);
      date.setMonth(date.getMonth() - moisArriere);
      date.setDate(intBetween(rnd, 1, 28));
      bien.dateISO = date.toISOString().slice(0, 10);
      bien.dateLabel = moisLabel(date);
      bien.moisEcoules = moisArriere;
      bien.delaiJours = intBetween(rnd, 24, 205);
    }

    biens.push(bien);
  }

  return {
    agence: {
      nom: agence.nom,
      coords: agenceCoords,
      distance: Math.round(agenceDistance * 10) / 10,
      commune: null, // renseignée par enrichirAdresses()
    },
    biens,
  };
}

/**
 * Libellé d'adresse d'un bien : réelle si la BAN a répondu, fictive sinon.
 * On n'affiche jamais de numéro de rue — une voie et une commune suffisent
 * à démontrer l'implantation sans désigner un logement précis.
 */
export function adresseLisible(bien) {
  if (bien.adresse) return bien.adresse;
  return bien.ville ? `${bien.voie}, ${bien.ville}` : bien.voie;
}

/**
 * Enrichit les biens avec la voie + la commune réelles (géocodage inverse BAN).
 * Non bloquant : la carte s'affiche immédiatement avec les libellés fictifs,
 * et se met à jour quand les réponses arrivent.
 *
 * @param {Array} biens
 * @param {function} reverseGeocode  utils/banClient.reverseGeocode
 * @param {object} [opts]
 * @param {number} [opts.concurrence] requêtes simultanées
 * @param {function} [opts.onBatch]   callback(biensEnrichis) après chaque lot
 */
export async function enrichirAdresses(biens, reverseGeocode, opts = {}) {
  const { concurrence = 6, onBatch } = opts;
  const out = biens.map((b) => ({ ...b }));

  for (let i = 0; i < out.length; i += concurrence) {
    const lot = out.slice(i, i + concurrence);
    await Promise.all(lot.map(async (b) => {
      const res = await reverseGeocode(b.coords[0], b.coords[1]);
      if (!res) return;
      // On retire le numéro de voie du libellé BAN : on ne pointe pas un logement.
      const voie = (res.label || '').replace(/^\d+\s*(bis|ter|quater)?\s*/i, '');
      if (voie) b.adresse = voie;
      if (res.city) b.ville = res.city;
    }));
    if (onBatch) onBatch(out.slice());
  }

  return out;
}
