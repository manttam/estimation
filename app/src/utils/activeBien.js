/**
 * Active bien : bien actuellement en cours d'estimation.
 *
 * Sauvegarde en localStorage (persistant entre les Steps et entre rechargements
 * de la page) pour que tout le flow Step1 -> Step5 + PropertyCard travaille
 * sur le meme bien saisi par l'utilisateur depuis /nouveau-bien.
 *
 * Si aucun bien actif n'est saisi, les pages retombent sur la donnee fictive
 * exportee dans data/propertyData.js (12 rue des Lilas).
 */

const STORAGE_KEY = 'ideeri_active_bien';

/**
 * Sauvegarde le bien actif (toutes les donnees saisies + resultat d'estimation).
 *
 * Structure attendue :
 * {
 *   adresse: { label, postcode, city, citycode, coords },
 *   bien:    { type, surface, pieces, chambres, etage, ascenseur, annee,
 *              etat, exposition, parking, exterieur },
 *   result:  { prix, prixBas, prixHaut, prixM2, prixM2Base, coef, breakdown },
 *   dvfStats: { median, moyenne, ... } | null,
 *   dvfTopComparables: [...],
 *   createdAt: ISO string
 * }
 */
export function setActiveBien(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('[activeBien] setActiveBien error', err);
  }
}

/**
 * Recupere le bien actif, ou null si rien n'est stocke.
 */
export function getActiveBien() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[activeBien] getActiveBien error', err);
    return null;
  }
}

/**
 * Supprime le bien actif (retour au mode demo / 12 rue des Lilas).
 */
export function clearActiveBien() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[activeBien] clearActiveBien error', err);
  }
}

/**
 * Helper : derive un objet "property" compatible avec PropertyCard
 * a partir du bien actif. Renvoie null si aucun bien actif.
 *
 * @returns {{
 *   title, reference, collaborateur, createdAt, source, tags,
 *   disponibilite, completude, adresse, lat, lng, surface, pieces,
 *   chambres, etage, dpe, annee, prix_m2_estime
 * } | null}
 */
export function getActiveBienAsProperty() {
  const a = getActiveBien();
  if (!a || !a.adresse || !a.bien) return null;

  const b = a.bien;
  const adr = a.adresse;
  const r = a.result || {};

  // Tags : type + pieces + surface + ville
  const tags = [];
  if (b.type) tags.push(b.type === 'appartement' ? 'Appartement' : 'Maison');
  if (b.pieces) tags.push(`${b.pieces} pi\u00e8ces`);
  if (b.surface) tags.push(`${b.surface} m\u00b2`);
  if (adr.city) tags.push(adr.city);

  const refDate = a.createdAt ? new Date(a.createdAt) : new Date();
  const ref = `IDR-${refDate.getFullYear()}-${(Math.floor(Math.random() * 90000) + 10000)}`;

  // Date au format "25 Mars 2026"
  const months = ['Janvier', 'F\u00e9vrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Ao\u00fbt', 'Septembre', 'Octobre', 'Novembre', 'D\u00e9cembre'];
  const formattedDate = `${refDate.getDate()} ${months[refDate.getMonth()]} ${refDate.getFullYear()}`;

  // Title : "Vente Appartement T3 a Lyon 3eme"
  const typeLabel = b.type === 'maison' ? 'Maison' : 'Appartement';
  const tLabel = b.pieces ? `T${b.pieces}` : '';
  const cityLabel = adr.city ? `\u00e0 ${adr.city}` : '';
  const title = `Vente ${typeLabel} ${tLabel} ${cityLabel}`.replace(/\s+/g, ' ').trim();

  return {
    title,
    reference: ref,
    collaborateur: 'Marie Dupont',
    createdAt: formattedDate,
    source: 'Ideeri',
    tags,
    disponibilite: '',
    completude: { pct: 100, critiques: '19/19', importants: '50/50' },
    adresse: adr.label || '',
    lat: adr.coords ? adr.coords[0] : null,
    lng: adr.coords ? adr.coords[1] : null,
    surface: b.surface || 0,
    pieces: b.pieces || 0,
    chambres: b.chambres || 0,
    etage: b.etage != null ? b.etage : null,
    dpe: '-',
    annee: b.annee || null,
    prix_m2_estime: r.prixM2 || 0,
  };
}
