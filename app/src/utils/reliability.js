/**
 * Calcul de l'indice de fiabilité d'un comparable (V2).
 *
 * 5 critères notés sur 1 point chacun → score total sur 5.
 *
 * @param {object} comparable - objet comparable enrichi (voir propertyData.js).
 *   Doit contenir : dateISO, source ("DVF"|"IDEERI"|"EN_COURS"),
 *   completudePct (0-100), distance (mètres), type, surface, bienRef.
 * @param {object} [comparable.bienRef] - bien estimé (pour similarité).
 * @returns {{ score: number, label: string, color: string, breakdown: object }}
 */
export function calculerFiabilite(comparable) {
  const { dateISO, source, completudePct, distance, type, surface } = comparable;
  const bienRef = comparable.bienRef || null;

  // 1. Fraîcheur de la transaction
  let fraicheur = 0;
  if (dateISO) {
    const mois =
      (Date.now() - new Date(dateISO).getTime()) /
      (1000 * 60 * 60 * 24 * 30);
    if (mois < 6) fraicheur = 1;
    else if (mois < 12) fraicheur = 0.5;
  }
  if (source === "EN_COURS") fraicheur = 0;

  // 2. Qualité de la source
  const sourceScore =
    { DVF: 1, IDEERI: 0.8, EN_COURS: 0.4 }[source] ?? 0.4;

  // 3. Complétude des données
  let completude = 0;
  if (completudePct >= 90) completude = 1;
  else if (completudePct >= 60) completude = 0.5;

  // 4. Proximité géographique
  let proximite = 0;
  if (distance < 300) proximite = 1;
  else if (distance < 800) proximite = 0.5;

  // 5. Similarité typologique
  let similarite = 0.5;
  if (bienRef && type && type.includes(bienRef.pieces ? `T${bienRef.pieces}` : "")) {
    const ecart = Math.abs(surface - bienRef.surface) / bienRef.surface;
    if (ecart < 0.1) similarite = 1;
    else if (ecart < 0.2) similarite = 0.5;
    else similarite = 0;
  } else if (bienRef) {
    similarite = 0;
  }

  const score = fraicheur + sourceScore + completude + proximite + similarite;

  // Échelle d'affichage
  let label;
  let color;
  if (score >= 4.5) {
    label = "Fiabilité excellente";
    color = "#46B962";
  } else if (score >= 4) {
    label = "Très fiable";
    color = "#46B962";
  } else if (score >= 3) {
    label = "Fiable";
    color = "#e8a838";
  } else if (score >= 2) {
    label = "Fiabilité moyenne";
    color = "#e8a838";
  } else {
    label = "Fiabilité limitée";
    color = "#e05252";
  }

  return {
    score: Math.round(score * 2) / 2,
    label,
    color,
    breakdown: { fraicheur, sourceScore, completude, proximite, similarite },
  };
}
