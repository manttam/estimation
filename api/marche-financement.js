/**
 * Endpoint serverless Vercel — marché communal et conditions de financement.
 *
 * Proxy de l'API tabulaire data.gouv.fr sur le jeu « Acheter dans sa ville »
 * (Terralyse, millésime 2026), qui croise trois sources publiques :
 *   - DVF (DGFiP) pour les prix et volumes de ventes
 *   - INSEE Filosofi + recensement pour les revenus et les acheteurs
 *   - Banque de France pour le taux moyen des crédits à l'habitat
 *
 * Pourquoi un proxy ?
 *   - L'API tabulaire ne renvoie pas d'en-tête CORS exploitable depuis le
 *     navigateur.
 *   - On n'expose au front que les champs réellement affichés, dans une forme
 *     stable : si le millésime change de colonnes, on adapte ici.
 *
 * Input  : GET /api/marche-financement?citycode=69383
 * Output : { ok: true, commune, millesime, marche: {...}, foyer: {...},
 *            taux: {...}, acheteurs: {...}, source }
 *          ou { ok: false, error: '...' }.
 *
 * Cache : 7 jours — le jeu est annuel, aucune raison de le rappeler souvent.
 */

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

/* Ressource « Communes, une ligne par commune » du millésime 2026. À mettre à
 * jour quand Terralyse publie le millésime suivant. */
const RESOURCE_ID = '132a03fe-9b8b-4469-a62c-044f53285f88';
const MILLESIME = 2026;
const TABULAR_API = 'https://tabular-api.data.gouv.fr/api/resources';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default async function handler(req, res) {
  const citycode = String(req.query?.citycode || '').trim();
  if (!/^(2[AB]|\d{2})\d{3}$/.test(citycode)) {
    res.status(400).json({ ok: false, error: 'citycode INSEE invalide' });
    return;
  }

  try {
    const url = `${TABULAR_API}/${RESOURCE_ID}/data/?code_insee__exact=${encodeURIComponent(citycode)}&page_size=1`;
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) {
      res.status(502).json({ ok: false, error: `API tabulaire: HTTP ${r.status}` });
      return;
    }
    const json = await r.json();
    const row = Array.isArray(json?.data) ? json.data[0] : null;
    if (!row) {
      res.status(404).json({ ok: false, error: 'commune absente du millésime' });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json({
      ok: true,
      commune: row.commune || null,
      millesime: MILLESIME,
      marche: {
        prixM2Median: num(row.prix_m2_median_2025),
        valeurMediane: num(row.valeur_mediane_ventes_2025),
        surfaceMediane: num(row.surface_mediane_2025),
        nbVentes: num(row.nb_actes_2025),
      },
      foyer: {
        revenuMensuel: num(row.revenu_mensuel_foyer_type),
        mensualiteMax: num(row.mensualite_maximale),
        budgetAchat: num(row.budget_achat_foyer_type),
        indiceAccessibilite: num(row.indice_accessibilite_pct),
        surfaceAchetable: num(row.surface_achetable_m2),
      },
      taux: {
        banqueDeFrance: num(row.taux_banque_de_france_pct),
        avecAssurance: num(row.taux_credit_utilise_pct),
      },
      acheteurs: {
        nbRecents: num(row.menages_acheteurs_recents_2022),
        partLocaux: num(row.part_acheteurs_locaux_pct),
        ageDominant: row.age_dominant_acheteurs || null,
        categorieDominante: row.categorie_dominante_acheteurs || null,
        origines: [1, 2, 3]
          .map((i) => ({ commune: row[`origine_${i}_commune`], pct: num(row[`origine_${i}_pct`]) }))
          .filter((o) => o.commune && o.pct),
      },
      source: row.source || 'DVF (DGFiP), INSEE, Banque de France — via data.gouv.fr',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
