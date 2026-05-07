/**
 * Calcul d'estimation immobiliere "grandeur nature".
 *
 * Methode :
 *  1. Prix m2 de base : mediane DVF du quartier (sinon valeur tabulee)
 *  2. Coefficients d'ajustement (etage, etat, exposition, parking, exterieur, annee)
 *  3. Prix = surface x prix_m2_base x coef_total
 *  4. Fourchette : +/- 7 %
 */

// Valeurs par defaut tres approximatives si pas de DVF disponible.
const PRIX_M2_DEFAULTS = {
  appartement: 3500,
  maison: 3000,
};

const COEF_ETAT = {
  neuf: 1.10,
  refait: 1.05,
  bon: 1.00,
  a_rafraichir: 0.95,
  a_renover: 0.85,
  a_reconstruire: 0.70,
};

const COEF_EXPOSITION = {
  sud: 1.03,
  sud_est: 1.02,
  sud_ouest: 1.02,
  est: 1.00,
  ouest: 1.00,
  nord_est: 0.99,
  nord_ouest: 0.99,
  nord: 0.97,
};

const COEF_EXTERIEUR = {
  jardin: 1.10,
  terrasse: 1.05,
  balcon: 1.02,
  aucun: 1.00,
};

const COEF_PARKING = {
  box: 1.05,
  place: 1.03,
  aucun: 1.00,
};

/**
 * @param {Object} bien
 * @param {'appartement'|'maison'} bien.type
 * @param {number} bien.surface
 * @param {number} [bien.etage]
 * @param {boolean} [bien.ascenseur]
 * @param {keyof COEF_ETAT} [bien.etat]
 * @param {keyof COEF_EXPOSITION} [bien.exposition]
 * @param {keyof COEF_PARKING} [bien.parking]
 * @param {keyof COEF_EXTERIEUR} [bien.exterieur]
 * @param {number} [bien.annee]
 * @param {Object} [dvfStats] - resultat de statsDvf()
 * @returns {{prix, prixBas, prixHaut, prixM2, prixM2Base, coef, breakdown}}
 */
export function estimerBien(bien, dvfStats) {
  const prixM2Base = dvfStats?.median || PRIX_M2_DEFAULTS[bien.type] || 3000;

  const breakdown = [];
  let coef = 1;

  // Etage (uniquement pour appartements)
  if (bien.type === 'appartement' && bien.etage != null) {
    let cEtage = 1;
    let labelEtage = '';
    if (bien.etage === 0) { cEtage = 0.95; labelEtage = 'RDC'; }
    else if (bien.etage <= 2) { cEtage = 0.98; labelEtage = `${bien.etage}e etage`; }
    else if (bien.etage <= 5) { cEtage = 1.00; labelEtage = `${bien.etage}e etage`; }
    else { cEtage = bien.ascenseur ? 1.04 : 0.92; labelEtage = `${bien.etage}e etage ${bien.ascenseur ? 'avec ascenseur' : 'sans ascenseur'}`; }
    coef *= cEtage;
    if (cEtage !== 1) breakdown.push({ label: labelEtage, coef: cEtage });
  }

  // Etat
  if (bien.etat && COEF_ETAT[bien.etat]) {
    const c = COEF_ETAT[bien.etat];
    coef *= c;
    if (c !== 1) breakdown.push({ label: `Etat : ${bien.etat.replace('_', ' ')}`, coef: c });
  }

  // Exposition
  if (bien.exposition && COEF_EXPOSITION[bien.exposition]) {
    const c = COEF_EXPOSITION[bien.exposition];
    coef *= c;
    if (c !== 1) breakdown.push({ label: `Exposition : ${bien.exposition.replace('_', '-')}`, coef: c });
  }

  // Parking
  if (bien.parking && COEF_PARKING[bien.parking]) {
    const c = COEF_PARKING[bien.parking];
    coef *= c;
    if (c !== 1) breakdown.push({ label: `Stationnement : ${bien.parking}`, coef: c });
  }

  // Exterieur
  if (bien.exterieur && COEF_EXTERIEUR[bien.exterieur]) {
    const c = COEF_EXTERIEUR[bien.exterieur];
    coef *= c;
    if (c !== 1) breakdown.push({ label: `Exterieur : ${bien.exterieur}`, coef: c });
  }

  // Annee de construction
  if (bien.annee) {
    let cAnnee = 1;
    if (bien.annee < 1900) cAnnee = 0.97;
    else if (bien.annee < 1948) cAnnee = 0.98;
    else if (bien.annee < 1980) cAnnee = 0.99;
    else if (bien.annee >= 2000) cAnnee = 1.02;
    coef *= cAnnee;
    if (cAnnee !== 1) breakdown.push({ label: `Annee : ${bien.annee}`, coef: cAnnee });
  }

  const prixCalcule = Math.round(prixM2Base * coef * (bien.surface || 0));
  const prixBas = Math.round(prixCalcule * 0.93);
  const prixHaut = Math.round(prixCalcule * 1.07);
  const prixM2 = bien.surface ? Math.round(prixCalcule / bien.surface) : 0;

  return {
    prix: prixCalcule,
    prixBas,
    prixHaut,
    prixM2,
    prixM2Base: Math.round(prixM2Base),
    coef: Math.round(coef * 100) / 100,
    breakdown,
  };
}

/**
 * Format un prix en euros (1 234 567 e).
 */
export function formatPrix(n) {
  if (n == null || isNaN(n)) return '-';
  return `${Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ')} \u20ac`;
}

/**
 * Format un prix au m2 (3 450 e/m2).
 */
export function formatPrixM2(n) {
  if (n == null || isNaN(n)) return '-';
  return `${Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ')} \u20ac/m\u00b2`;
}
