/**
 * Marché communal et conditions de financement.
 *
 * Source : jeu « Acheter dans sa ville » (Terralyse, millésime 2026) publié
 * sur data.gouv.fr, qui croise DVF (DGFiP) pour les prix, INSEE Filosofi et
 * recensement pour les revenus et les acheteurs, et Banque de France pour le
 * taux moyen des crédits à l'habitat.
 *
 * Le front consomme /api/marche-financement?citycode=XXXXX. Le jeu de démo
 * ci-dessous est un extrait RÉEL de ce millésime pour Lyon 3e — pas des
 * valeurs inventées — afin que le document de démonstration montre ce que
 * l'agent verra vraiment.
 *
 * ⚠️ Données par COMMUNE. Sur une grande commune, c'est une moyenne unique
 * pour tout le territoire : à ne pas confondre avec la médiane du secteur
 * immédiat du bien, calculée séparément à partir de DVF.
 */

export const MARCHE_FINANCEMENT_DEMO = {
  ok: true,
  commune: 'Lyon 3e',
  millesime: 2026,
  marche: {
    prixM2Median: 4487,
    valeurMediane: 270000,
    surfaceMediane: 66,
    nbVentes: 1342,
  },
  foyer: {
    revenuMensuel: 3774,
    mensualiteMax: 1321,
    budgetAchat: 261000,
    indiceAccessibilite: 97,
    surfaceAchetable: 58,
  },
  taux: {
    banqueDeFrance: 3.2687,
    avecAssurance: 3.6187,
  },
  acheteurs: {
    nbRecents: 1300,
    partLocaux: 69,
    ageDominant: '25-39 ans',
    categorieDominante: 'cadres',
    origines: [
      { commune: 'Villeurbanne', pct: 7 },
      { commune: 'Paris', pct: 3 },
    ],
  },
  source:
    'DVF 2025 (DGFiP), INSEE Filosofi 2023 (revenus), INSEE recensement 2022 (acheteurs), Banque de France (taux) — via data.gouv.fr',
};

/**
 * Mensualité d'un prêt amortissable à annuités constantes.
 *
 * @param {number} capital  montant emprunté, en euros
 * @param {number} tauxPct  taux annuel en pourcentage (assurance incluse)
 * @param {number} annees   durée en années
 * @returns {number|null} mensualité arrondie à l'euro, ou null si les
 *   paramètres ne permettent pas le calcul.
 */
export function mensualite(capital, tauxPct, annees) {
  const C = Number(capital);
  const t = Number(tauxPct);
  const n = Number(annees) * 12;
  if (!Number.isFinite(C) || C <= 0 || !Number.isFinite(n) || n <= 0) return null;
  if (!Number.isFinite(t)) return null;
  // Taux nul : simple division, la formule ci-dessous diviserait par zéro.
  if (t === 0) return Math.round(C / n);
  const i = t / 100 / 12;
  return Math.round((C * i) / (1 - (1 + i) ** -n));
}

/* Récupère le marché communal. Échec silencieux : le document se passe de la
 * section plutôt que d'afficher des tirets. */
export async function fetchMarcheFinancement(citycode, signal) {
  if (!citycode) return null;
  try {
    const r = await fetch(`/api/marche-financement?citycode=${encodeURIComponent(citycode)}`, { signal });
    const json = await r.json();
    return json && json.ok ? json : null;
  } catch {
    return null;
  }
}
