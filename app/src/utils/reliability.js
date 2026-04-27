/**
 * Indice de fiabilité d'un comparable — par données croisées (V2).
 *
 * On compte le nombre de critères vérifiables dont la valeur a été croisée
 * et confirmée, parmi 10 critères possibles. Le résultat est factuel,
 * mesurable et défendable face au mandant (pas de scoring subjectif).
 *
 * @param {object} comparable - doit exposer comparable.donneesCroisees, un
 *   objet avec 10 booleans (un par critère listé dans CRITERES_FIABILITE).
 * @returns {{
 *   count: number,     // nombre de critères croisés (0 à 10)
 *   total: number,     // toujours 10
 *   checks: boolean[], // tableau des 10 booleans dans l'ordre de la liste
 *   label: string,     // "Très fiable" | "Fiable" | "Fiabilité limitée"
 *   color: string,     // hex (vert / ambre / rouge)
 * }}
 */

// Ordre canonique des 10 critères. Doit correspondre à l'ordre d'affichage
// des ronds dans le badge ReliabilityBadge.
export const CRITERES_FIABILITE = [
  { key: "source",            label: "Source vérifiée" },
  { key: "surface",           label: "Surface confirmée" },
  { key: "prixTransaction",   label: "Prix de transaction" },
  { key: "datePrecise",       label: "Date précise" },
  { key: "etage",             label: "Étage et étage max" },
  { key: "dpe",               label: "DPE / GES officiels" },
  { key: "etatDocumente",     label: "État documenté" },
  { key: "exposition",        label: "Exposition vérifiée" },
  { key: "anneeConstruction", label: "Année de construction" },
  { key: "distancePrecise",   label: "Distance géo précise" },
];

export function calculerFiabilite(comparable) {
  const dc = (comparable && comparable.donneesCroisees) || {};
  const checks = CRITERES_FIABILITE.map((c) => Boolean(dc[c.key]));
  const count = checks.filter(Boolean).length;
  const total = CRITERES_FIABILITE.length;

  let label;
  let color;
  if (count >= 8) {
    label = "Très fiable";
    color = "#46B962";
  } else if (count >= 5) {
    label = "Fiable";
    color = "#e8a838";
  } else {
    label = "Fiabilité limitée";
    color = "#e05252";
  }

  return { count, total, checks, label, color };
}
