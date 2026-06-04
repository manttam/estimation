/* Moyenne pondérée du prix au m² des comparables retenus.
 *
 * Source de vérité unique pour le « prix de marché » : utilisée par Step3
 * (carte Récapitulatif du calcul) ET Step5 (prix de marché recommandé, fixe).
 *
 * Formule : pour chaque comparable, prix/m² brut corrigé de l'ajustement
 * qualitatif (adjTotal en %), puis moyenne pondérée par le poids du comparable
 * (weights[id], sinon poids par défaut = similarité×0.6 + données×0.4).
 *   avgM2 = Σ(adjustedM2 × weight) / Σ(weight)
 */

/* Poids par défaut d'un comparable quand aucun poids explicite n'est défini :
 * pertinence = similarité ×0.6 + couverture données ×0.4 (mêmes coefficients
 * que Step3 defaultWeightFor). */
export function defaultWeightFor(c) {
  return Math.round((Number(c?.similarite) || 0) * 0.6 + (Number(c?.donnees) || 0) * 0.4);
}

/* Poids effectif : poids explicite (0-100) si défini, sinon poids par défaut. */
export function effectiveWeightOf(c, weights) {
  const w = weights ? weights[c?.id] : undefined;
  return w !== undefined ? Number(w) : defaultWeightFor(c);
}

/* Parse un pourcentage d'ajustement « +3,5% » / « −2% » / « 0% » → nombre.
 * Gère le signe moins typographique (−, U+2212) et la virgule décimale. */
function parseAdjPct(adjTotal) {
  const s = String(adjTotal ?? '0%').replace(',', '.');
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  const sign = s.trim().startsWith('\u2212') ? -1 : 1;
  return parseFloat(m[0]) * sign;
}

/* Calcule la moyenne pondérée du prix/m² sur une liste de comparables.
 * @param comparables  tableau des comparables retenus (champs prixM2, adjTotal,
 *                     similarite, donnees, id)
 * @param weights      map { [id]: poids 0-100 } (comparablesConfig.weights)
 * @returns { avgM2, sumW, rows } — avgM2 arrondi à l'entier, 0 si liste vide.
 */
export function computeWeightedM2(comparables, weights) {
  const list = Array.isArray(comparables) ? comparables : [];
  const rows = list.map((c) => {
    const m2Num = parseInt(String(c?.prixM2).replace(/\D/g, ''), 10) || 0;
    const adjPct = parseAdjPct(c?.adjTotal);
    const adjustedM2 = Math.round(m2Num * (1 + adjPct / 100));
    const weight = effectiveWeightOf(c, weights);
    return { id: c?.id, title: c?.title, source: c?.source, prixM2: m2Num, adjPct, adjustedM2, weight };
  });
  const sumW = rows.reduce((s, r) => s + r.weight, 0);
  const sumWP = rows.reduce((s, r) => s + r.adjustedM2 * r.weight, 0);
  const avgM2 = sumW > 0 ? Math.round(sumWP / sumW) : 0;
  return { avgM2, sumW, rows };
}
