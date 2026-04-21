import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';

/* ─── Données personas ─── */
const PERSONAS = {
  familles: {
    name: 'Familles',
    count: 8,
    budget: '295 k€',
    delai: '3 mois',
    compat: '0,74',
    sub: 'couple + enfants',
    needs: [
      { txt: 'École primaire < 500 m', match: true, tag: 'Votre bien : École Lamartine à 320 m', tagMatch: true },
      { txt: 'Espace extérieur (balcon/terrasse)', match: true, tag: '6 m² de balcon', tagMatch: true },
      { txt: 'T3 minimum, 2 chambres séparées', match: true, tag: 'T3 / 2 ch.', tagMatch: true },
      { txt: 'Quartier calme le soir', match: true, tag: 'Rue peu passante', tagMatch: true },
      { txt: 'Parking ou place de stationnement', match: false, tag: 'Non disponible', tagMatch: false },
      { txt: 'Ascenseur (poussette)', match: false, tag: '3ème sans ascenseur', tagMatch: false },
    ],
    buyers: [
      { rank: 1, name: 'Famille #F047', budget: '305 k€', score: '0,88' },
      { rank: 2, name: 'Famille #F112', budget: '290 k€', score: '0,81' },
      { rank: 3, name: 'Famille #F203', budget: '310 k€', score: '0,76' },
    ],
    others: 5,
  },
  investisseurs: {
    name: 'Investisseurs',
    count: 5,
    budget: '280 k€',
    delai: '1 mois',
    compat: '0,68',
    sub: 'locatif / rendement',
    needs: [
      { txt: 'Rendement brut > 4,5%', match: true, tag: 'Estimé 4,7%', tagMatch: true },
      { txt: 'Quartier étudiant / cadre', match: true, tag: 'Lyon 3ème', tagMatch: true },
      { txt: 'Bien déjà loué ou meublé possible', match: false, tag: 'Vide', tagMatch: false },
      { txt: 'DPE E ou mieux (loi climat)', match: true, tag: 'DPE D', tagMatch: true },
      { txt: 'Charges copropriété < 2 000 €/an', match: true, tag: '1 850 €/an', tagMatch: true },
      { txt: 'Travaux récents ou aucun à prévoir', match: false, tag: 'Rafraîchissement à prévoir', tagMatch: false },
    ],
    buyers: [
      { rank: 1, name: 'Invest. #I021', budget: '285 k€', score: '0,79' },
      { rank: 2, name: 'Invest. #I044', budget: '270 k€', score: '0,72' },
    ],
    others: 3,
  },
  primo: {
    name: 'Primo-accédants',
    count: 4,
    budget: '268 k€',
    delai: '4 mois',
    compat: '0,65',
    sub: '1ère acquisition',
    needs: [
      { txt: 'Budget serré, prêt PTZ éligible', match: true, tag: 'Zone B1 → PTZ possible', tagMatch: true },
      { txt: 'Proximité transports publics', match: true, tag: 'Métro Part-Dieu 450 m', tagMatch: true },
      { txt: 'Charges copropriété faibles', match: true, tag: '1 850 €/an', tagMatch: true },
      { txt: 'Pas de gros travaux', match: true, tag: 'État correct', tagMatch: true },
      { txt: 'DPE C ou mieux (éviter passoire)', match: false, tag: 'DPE D', tagMatch: false },
    ],
    buyers: [
      { rank: 1, name: 'Primo #P008', budget: '275 k€', score: '0,71' },
      { rank: 2, name: 'Primo #P031', budget: '265 k€', score: '0,63' },
    ],
    others: 2,
  },
  retraites: {
    name: 'Retraités',
    count: 3,
    budget: '340 k€',
    delai: '6 mois',
    compat: '0,61',
    sub: 'logement plus petit / pied-à-terre',
    needs: [
      { txt: 'Ascenseur obligatoire', match: false, tag: '3ème sans ascenseur', tagMatch: false },
      { txt: 'Pied-à-terre / résidence secondaire', match: true, tag: 'T3 cohérent', tagMatch: true },
      { txt: 'Commerces de proximité', match: true, tag: 'Rue commerçante', tagMatch: true },
      { txt: 'Quartier calme et sécurisé', match: true, tag: 'Quartier résidentiel', tagMatch: true },
      { txt: 'Terrasse ou balcon spacieux', match: true, tag: '6 m² balcon', tagMatch: true },
    ],
    buyers: [
      { rank: 1, name: 'Retraité #R014', budget: '350 k€', score: '0,67' },
    ],
    others: 2,
  },
  mono: {
    name: 'Mono-parentaux',
    count: 3,
    budget: '278 k€',
    delai: '2 mois',
    compat: '0,69',
    sub: 'parent + enfant(s)',
    needs: [
      { txt: 'École primaire proche', match: true, tag: 'Lamartine 320 m', tagMatch: true },
      { txt: '2 chambres séparées (parent + enfant)', match: true, tag: 'T3 adapté', tagMatch: true },
      { txt: 'Quartier sécurisé', match: true, tag: 'Lyon 3ème résidentiel', tagMatch: true },
      { txt: 'Place de parking sécurisée', match: false, tag: 'Non disponible', tagMatch: false },
    ],
    buyers: [
      { rank: 1, name: 'Mono #M019', budget: '285 k€', score: '0,74' },
      { rank: 2, name: 'Mono #M027', budget: '270 k€', score: '0,68' },
    ],
    others: 1,
  },
};

/* ─── Buckets de budget (tranches de plafond) ─── */
const BUCKETS = [
  { label: '< 280',   min: 0,   max: 280 },
  { label: '280-300', min: 280, max: 300 },
  { label: '300-320', min: 300, max: 320 },
  { label: '320-340', min: 320, max: 340 },
  { label: '340-360', min: 340, max: 360 },
  { label: '> 360',   min: 360, max: 9999 },
];

/* ─── Données figées : période < 1 an ─── */
const PERIOD = {
  total: 54,
  pool: 612,
  forts: 15,
  budget: 304,
  dist: [3, 8, 13, 15, 10, 5],
  personas: { familles: 19, investisseurs: 12, primo: 10, retraites: 7, mono: 6 },
};

const ATOUTS = [
  { label: 'Localisation Lyon 3ème', sub: 'Quartier recherché · transports, commerces', pct: 91 },
  { label: 'Surface 72,5 m²',        sub: 'Dans la tranche cible pour T3',              pct: 83 },
  { label: 'Balcon 6 m²',            sub: 'Critère différenciant post-Covid',           pct: 70 },
];
const FREINS = [
  { label: 'Sans parking',              sub: 'Critère attendu par la majorité de la demande', pct: 61 },
  { label: 'DPE D',                     sub: 'Sensibilité énergie · recherche DPE ≤ C',       pct: 48 },
  { label: '3ème étage sans ascenseur', sub: 'Retraités et familles avec poussette',          pct: 39 },
  { label: 'Exposition ouest',          sub: 'Recherche sud/est majoritaire',                 pct: 39 },
];

/* ─── Détails projets (anonymes, RGPD) ─── */
const PROJECT_DETAILS = {
  'Famille #F047': {
    persona: 'Familles', etat: 'Recherche active', etatCls: 'active', lastSeen: 'actif il y a 2 jours',
    budgetMin: 0, budgetMed: 305, budgetMax: 345, budgetScaleMin: 0, budgetScaleMax: 370,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e (rayon 1 km)', match: true },
      { label: 'Surface', value: '≥ 65 m²', match: true },
      { label: 'Typologie', value: 'T3', match: true },
      { label: 'DPE', value: 'D ou mieux', match: true },
    ],
    souhaits: [
      { label: 'Balcon / terrasse', value: 'Oui', match: true },
      { label: 'Parking', value: 'Oui', match: false },
      { label: 'Quartier calme', value: 'Oui', match: true },
      { label: 'École primaire < 500 m', value: 'Oui', match: true },
    ],
    stats: { vus: 12, fav: 3, vis: 2 },
  },
  'Famille #F112': {
    persona: 'Familles', etat: 'Simulation prêt', etatCls: 'pending', lastSeen: 'actif il y a 5 jours',
    budgetMin: 0, budgetMed: 290, budgetMax: 325, budgetScaleMin: 0, budgetScaleMax: 360,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e / 6e', match: true },
      { label: 'Surface', value: '≥ 65 m²', match: true },
      { label: 'Typologie', value: 'T3', match: true },
      { label: 'DPE', value: 'D ou mieux', match: true },
    ],
    souhaits: [
      { label: 'Balcon / terrasse', value: 'Oui', match: true },
      { label: 'Parking', value: 'Souhaité', match: false },
      { label: 'Quartier calme', value: 'Oui', match: true },
      { label: 'École primaire proche', value: 'Oui', match: true },
    ],
    stats: { vus: 8, fav: 2, vis: 1 },
  },
  'Famille #F203': {
    persona: 'Familles', etat: 'Prêt validé', etatCls: 'ready', lastSeen: 'actif hier',
    budgetValidated: true, budgetFixed: 310,
    budgetMin: 280, budgetMed: 310, budgetMax: 340, budgetScaleMin: 240, budgetScaleMax: 370,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e', match: true },
      { label: 'Surface', value: '≥ 70 m²', match: true },
      { label: 'Typologie', value: 'T3 / T4', match: true },
      { label: 'DPE', value: 'C ou mieux', match: false },
    ],
    souhaits: [
      { label: 'Balcon / terrasse', value: 'Oui', match: true },
      { label: 'Parking', value: 'Obligatoire', match: false },
      { label: '2 chambres séparées', value: 'Oui', match: true },
      { label: 'Extérieur', value: 'Oui', match: true },
    ],
    stats: { vus: 15, fav: 4, vis: 3 },
  },
  'Invest. #I021': {
    persona: 'Investisseurs', etat: 'Prêt validé', etatCls: 'ready', lastSeen: 'actif hier',
    budgetValidated: true, budgetFixed: 285,
    budgetMin: 255, budgetMed: 285, budgetMax: 315, budgetScaleMin: 220, budgetScaleMax: 340,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e / 7e', match: true },
      { label: 'Surface', value: '≥ 60 m²', match: true },
      { label: 'Typologie', value: 'T2 / T3', match: true },
      { label: 'DPE', value: 'E ou mieux', match: true },
    ],
    souhaits: [
      { label: 'Rendement brut > 4,5 %', value: 'Estimé 4,7 %', match: true },
      { label: 'Charges < 2 000 €/an', value: '1 850 €/an', match: true },
      { label: 'Déjà loué', value: 'Oui', match: false },
      { label: 'Aucun travaux', value: 'Oui', match: false },
    ],
    stats: { vus: 20, fav: 5, vis: 2 },
  },
  'Invest. #I044': {
    persona: 'Investisseurs', etat: 'Recherche active', etatCls: 'active', lastSeen: 'actif il y a 3 jours',
    budgetMin: 0, budgetMed: 270, budgetMax: 305, budgetScaleMin: 0, budgetScaleMax: 340,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e', match: true },
      { label: 'Surface', value: '≥ 55 m²', match: true },
      { label: 'Typologie', value: 'T2 / T3', match: true },
      { label: 'DPE', value: 'E ou mieux', match: true },
    ],
    souhaits: [
      { label: 'Rendement brut > 5 %', value: 'Estimé 4,7 %', match: false },
      { label: 'Charges basses', value: '1 850 €/an', match: true },
      { label: 'Déjà loué', value: 'Oui', match: false },
      { label: 'Aucun travaux', value: 'Oui', match: false },
    ],
    stats: { vus: 14, fav: 2, vis: 1 },
  },
  'Primo #P008': {
    persona: 'Primo-accédants', etat: 'PTZ en cours', etatCls: 'pending', lastSeen: 'actif il y a 2 jours',
    budgetMin: 0, budgetMed: 275, budgetMax: 295, budgetScaleMin: 0, budgetScaleMax: 320,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e (Zone B1)', match: true },
      { label: 'Surface', value: '≥ 60 m²', match: true },
      { label: 'Typologie', value: 'T3', match: true },
      { label: 'DPE', value: 'C ou mieux', match: false },
    ],
    souhaits: [
      { label: 'Transports proches', value: 'Oui', match: true },
      { label: 'Charges basses', value: 'Oui', match: true },
      { label: 'Sans gros travaux', value: 'Oui', match: true },
      { label: 'DPE C+ (éviter passoire)', value: 'Oui', match: false },
    ],
    stats: { vus: 22, fav: 6, vis: 4 },
  },
  'Primo #P031': {
    persona: 'Primo-accédants', etat: 'Recherche active', etatCls: 'active', lastSeen: 'actif il y a 4 jours',
    budgetMin: 0, budgetMed: 265, budgetMax: 290, budgetScaleMin: 0, budgetScaleMax: 320,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e / 8e', match: true },
      { label: 'Surface', value: '≥ 55 m²', match: true },
      { label: 'Typologie', value: 'T2 / T3', match: true },
      { label: 'DPE', value: 'D ou mieux', match: true },
    ],
    souhaits: [
      { label: 'Transports proches', value: 'Oui', match: true },
      { label: 'Charges basses', value: 'Oui', match: true },
      { label: 'Sans gros travaux', value: 'Oui', match: true },
      { label: 'DPE C+ idéalement', value: 'Oui', match: false },
    ],
    stats: { vus: 18, fav: 3, vis: 2 },
  },
  'Retraité #R014': {
    persona: 'Retraités', etat: 'Prêt validé', etatCls: 'ready', lastSeen: 'actif il y a 6 jours',
    budgetValidated: true, budgetFixed: 350,
    budgetMin: 295, budgetMed: 350, budgetMax: 400, budgetScaleMin: 260, budgetScaleMax: 420,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e', match: true },
      { label: 'Surface', value: '≥ 60 m²', match: true },
      { label: 'Ascenseur', value: 'Obligatoire', match: false },
      { label: 'DPE', value: 'D ou mieux', match: true },
    ],
    souhaits: [
      { label: 'Balcon / terrasse', value: 'Oui', match: true },
      { label: 'Commerces proches', value: 'Oui', match: true },
      { label: 'Quartier calme', value: 'Oui', match: true },
    ],
    stats: { vus: 9, fav: 2, vis: 1 },
  },
  'Mono #M019': {
    persona: 'Mono-parentaux', etat: 'Recherche active', etatCls: 'active', lastSeen: 'actif hier',
    budgetMin: 0, budgetMed: 285, budgetMax: 320, budgetScaleMin: 0, budgetScaleMax: 340,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e', match: true },
      { label: 'Surface', value: '≥ 65 m²', match: true },
      { label: 'Typologie', value: 'T3', match: true },
      { label: 'DPE', value: 'D ou mieux', match: true },
    ],
    souhaits: [
      { label: 'École proche', value: 'Oui', match: true },
      { label: '2 chambres séparées', value: 'Oui', match: true },
      { label: 'Quartier sécurisé', value: 'Oui', match: true },
      { label: 'Parking', value: 'Souhaité', match: false },
    ],
    stats: { vus: 16, fav: 4, vis: 2 },
  },
  'Mono #M027': {
    persona: 'Mono-parentaux', etat: 'Simulation prêt', etatCls: 'pending', lastSeen: 'actif il y a 3 jours',
    budgetMin: 0, budgetMed: 270, budgetMax: 305, budgetScaleMin: 0, budgetScaleMax: 340,
    durs: [
      { label: 'Localisation', value: 'Lyon 3e / 7e', match: true },
      { label: 'Surface', value: '≥ 60 m²', match: true },
      { label: 'Typologie', value: 'T3', match: true },
      { label: 'DPE', value: 'D ou mieux', match: true },
    ],
    souhaits: [
      { label: 'École proche', value: 'Oui', match: true },
      { label: '2 chambres', value: 'Oui', match: true },
      { label: 'Quartier sécurisé', value: 'Oui', match: true },
      { label: 'Parking', value: 'Souhaité', match: false },
    ],
    stats: { vus: 11, fav: 3, vis: 1 },
  },
};

const cssStyles = `
  .step4-page { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif; --green:#46B962; --green-dark:#1aa564; --green-soft:#e8f6ec; --blue:#4a6cf7; --orange:#f5a623; --orange-soft:#fef5e6; --red:#e74c3c; --red-soft:#fdecec; --grey:#949494; --border:#eee; --text:#393939; --muted:#949494; --bg:#fafafa; --white:#ffffff; color: var(--text); font-size: 13px; line-height: 1.4; }

  .act { background: var(--white); border: 1px solid #eee; border-radius: 12px; padding: 32px 28px; margin-bottom: 18px; position: relative; }
  .act-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .act-num { font-size: 10px; font-weight: 800; color: var(--green); letter-spacing: 2px; background: var(--green-soft); padding: 3px 8px; border-radius: 4px; }
  .act-title { font-size: 17px; font-weight: 700; color: var(--text); }
  .act-subtitle { font-size: 13px; color: var(--muted); margin-bottom: 28px; line-height: 1.55; }

  .pdf-toggle { position: absolute; top: 10px; right: 12px; display: flex; align-items: center; gap: 5px; z-index: 5; }
  .pdf-toggle input[type="checkbox"] { display: none; }
  .pdf-toggle label { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 10px; color: #bbb; padding: 3px 8px; border-radius: 5px; border: 1px solid transparent; user-select: none; background: rgba(255,255,255,0.9); }
  .pdf-toggle label:hover { color: #888; background: #f5f5f5; }
  .pdf-toggle input:checked + label { color: var(--green); background: var(--green-soft); border-color: #c5e8cf; }

  /* ACTE 1 */
  .act-1 { text-align: center; padding: 32px 28px 28px; }
  .act-1 .act-header { justify-content: center; }
  .hero-zone { display: flex; flex-direction: column; align-items: center; margin: 4px 0 22px; }
  .hero-number { font-size: 72px; font-weight: 700; color: var(--green); line-height: 1; letter-spacing: -2px; }
  .hero-label { font-size: 14px; color: var(--text); font-weight: 600; margin-top: 4px; letter-spacing: 0.2px; }
  .hero-sub { font-size: 11.5px; color: var(--muted); margin-top: 5px; max-width: 520px; line-height: 1.5; }

  .secondary-row { display: flex; justify-content: center; align-items: stretch; gap: 48px; margin: 6px 0 22px; flex-wrap: wrap; }
  .secondary-kpi { display: flex; flex-direction: column; align-items: center; min-width: 120px; }
  .secondary-number { font-size: 30px; font-weight: 700; color: var(--text); line-height: 1; letter-spacing: -0.5px; }
  .secondary-number.accent { color: var(--orange); }
  .secondary-label { font-size: 11.5px; color: var(--muted); margin-top: 5px; text-align: center; max-width: 140px; line-height: 1.4; }
  .secondary-sep { width: 1px; background: #eee; align-self: stretch; }

  /* Distribution des budgets */
  .budget-dist { max-width: 720px; margin: 28px auto 0; padding: 20px 24px; background: #fafafa; border-radius: 10px; }
  .budget-dist-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 16px; flex-wrap: wrap; }
  .budget-dist-title { font-size: 12px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 1px; }
  .budget-dist-hint { font-size: 11px; color: var(--muted); font-style: italic; text-align: left; }
  .budget-dist-bars { display: flex; flex-direction: column; gap: 6px; }
  .budget-bar-row { display: grid; grid-template-columns: 100px 1fr 32px; align-items: center; gap: 10px; font-size: 11.5px; }
  .budget-bar-label { color: var(--text); font-weight: 600; text-align: left; }
  .budget-bar-track { height: 14px; background: #fff; border: 1px solid #eee; border-radius: 3px; overflow: hidden; }
  .budget-bar-fill { height: 100%; background: #cfe8d5; border-radius: 2px; transition: width 0.3s ease; }
  .budget-bar-fill.mode { background: var(--green); }
  .budget-bar-row.mode .budget-bar-label { color: var(--green-dark); font-weight: 700; }
  .budget-bar-row.mode .budget-bar-count { color: var(--text); font-weight: 700; }
  .budget-bar-count { font-size: 11px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
  .budget-dist-highlight { margin: 4px 0 14px; padding: 10px 14px; background: #fff; border: 1px solid var(--green-soft); border-left: 3px solid var(--green); border-radius: 6px; font-size: 12px; color: var(--text); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .budget-dist-highlight-label { color: var(--muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .budget-dist-highlight-value { font-weight: 700; color: var(--green-dark); }
  .budget-dist-highlight-count { color: var(--muted); font-size: 11px; margin-left: auto; }

  .hero-divider { border: none; border-top: 1px solid #eee; margin: 26px auto 22px; max-width: 720px; }

  .mini-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 560px; margin: 0 auto; }
  .mini-kpi { display: flex; flex-direction: column; align-items: center; padding: 4px; }
  .mini-kpi-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 600; }
  .mini-kpi-value { font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; }
  .mini-kpi-value.green { color: var(--green); }
  .mini-kpi-value.orange { color: var(--orange); }
  .mini-kpi-hint { font-size: 10px; color: var(--muted); margin-top: 4px; font-weight: 400; }

  /* ACTE 2 */
  .personas-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 22px; }
  .persona-card { border: 1px solid #eee; border-radius: 8px; padding: 20px 14px 18px; background: #fff; cursor: pointer; transition: all 0.18s; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }
  .persona-card:hover { border-color: #bde5c7; background: #fafffb; }
  .persona-card.active { border: 1px solid var(--green); background: var(--green-soft); }
  .persona-card.active::after { content: ''; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid var(--green); z-index: 2; }
  .persona-count { font-size: 34px; font-weight: 700; color: var(--text); line-height: 1; letter-spacing: -0.5px; }
  .persona-card.active .persona-count { color: var(--green); }
  .persona-name { font-size: 12.5px; font-weight: 600; color: var(--text); margin-top: 10px; }
  .persona-sub { font-size: 10.5px; color: var(--muted); margin-top: 3px; font-weight: 400; }

  .focus-panel { border: 1px solid #e0e5d8; border-radius: 10px; background: linear-gradient(180deg, #f9fdf8 0%, #fff 60%); padding: 22px 24px; position: relative; animation: fadeIn 0.25s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  .focus-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #eaf0e5; flex-wrap: wrap; }
  .focus-title { font-size: 14.5px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 10px; }
  .focus-title-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
  .focus-title-count { background: var(--green); color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
  .focus-meta { display: flex; gap: 18px; font-size: 11px; color: var(--muted); flex-wrap: wrap; }
  .focus-meta strong { color: var(--text); font-weight: 700; }

  .focus-body { display: grid; grid-template-columns: 1.3fr 1fr; gap: 22px; }
  .focus-needs h4 { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .need-list { list-style: none; display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0; }
  .need-item { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: var(--text); line-height: 1.5; }
  .need-bullet { font-weight: 700; margin-top: 2px; flex-shrink: 0; }
  .need-tag { font-size: 10px; color: var(--green); background: var(--green-soft); padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-weight: 600; vertical-align: middle; }
  .need-tag.miss { color: var(--red); background: var(--red-soft); }

  .focus-buyers h4 { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .buyer-list { display: flex; flex-direction: column; gap: 6px; }
  .buyer-row { display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; padding: 8px 10px; background: #fff; border: 1px solid #eaf0e5; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .buyer-row:hover { border-color: var(--green); background: #fafffb; }
  .buyer-row:focus { outline: 2px solid var(--green); outline-offset: 2px; }
  .buyer-rank { font-weight: 700; color: var(--muted); font-size: 10px; min-width: 16px; }
  .buyer-name { color: var(--text); font-weight: 600; }
  .buyer-budget { color: var(--muted); font-size: 10px; }
  .buyer-score { font-weight: 700; color: var(--green); font-size: 12px; }
  .buyer-link { font-size: 11px; color: var(--green); text-decoration: none; margin-top: 6px; display: inline-block; font-weight: 600; cursor: pointer; }
  .buyer-link:hover { text-decoration: underline; }

  /* ACTE 3 */
  .act-3 { padding-bottom: 28px; }
  .af-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px; }
  .af-col { border: 1px solid #eee; border-radius: 10px; padding: 18px 18px 16px; background: #fff; }
  .af-col.atouts { border-left: 3px solid var(--green); background: #fcfffc; }
  .af-col.freins { border-left: 3px solid var(--orange); background: #fffcf6; }
  .af-col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
  .af-col-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text); }
  .af-col-title .dot { width: 8px; height: 8px; border-radius: 50%; }
  .af-col.atouts .dot { background: var(--green); }
  .af-col.freins .dot { background: var(--orange); }
  .af-col-hint { font-size: 10px; color: var(--muted); }

  .af-item { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 10px 4px; border-bottom: 1px solid #f3f3f3; }
  .af-item:last-child { border-bottom: none; }
  .af-item-label { font-size: 13px; color: var(--text); font-weight: 600; line-height: 1.35; }
  .af-item-sub { font-size: 11px; color: var(--muted); font-weight: 400; margin-top: 2px; }
  .af-item-score { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .af-item-bar { width: 48px; height: 5px; background: #eee; border-radius: 3px; overflow: hidden; }
  .af-item-fill { height: 100%; border-radius: 3px; }
  .af-col.atouts .af-item-fill { background: var(--green); }
  .af-col.freins .af-item-fill { background: var(--orange); }
  .af-item-ratio { font-size: 12px; font-weight: 700; color: var(--text); min-width: 38px; text-align: right; }
  .af-item-ratio .denom { color: var(--muted); font-weight: 400; }

  .leviers-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
  .leviers-title::before { content: '→'; color: var(--green); font-weight: 700; }
  .leviers-sub { font-size: 12px; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
  .leviers-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 760px; }
  .levier-card { border: 1px solid #eee; border-radius: 10px; padding: 16px 16px 14px; background: #fff; display: flex; flex-direction: column; position: relative; overflow: hidden; border-left: 3px solid var(--green); }
  .levier-card.teaser { border-left: 3px dashed #bbb; background: #fafafa; }
  .levier-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .levier-title { font-size: 12.5px; font-weight: 700; color: var(--text); }
  .levier-badge { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--green); background: var(--green-soft); }
  .levier-badge.teaser-badge { color: #777; background: #eee; }
  .levier-impact { font-size: 20px; font-weight: 700; color: var(--green); line-height: 1; margin: 4px 0 4px; }
  .levier-impact.teaser-arrow { color: #bbb; font-size: 28px; font-weight: 400; }
  .levier-impact .plus { color: var(--green); }
  .levier-cost { font-size: 11px; color: var(--muted); margin-bottom: 10px; }
  .levier-cost strong { color: var(--text); font-weight: 700; }
  .levier-desc { font-size: 11px; color: var(--muted); line-height: 1.5; border-top: 1px solid #f3f3f3; padding-top: 8px; margin-top: auto; }

  /* FOOTER */
  .footer-buttons { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; }
  .btn { padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 6px; font-family: 'Open Sans', sans-serif; text-decoration: none; }
  .btn-primary { background: var(--green); color: white; }
  .btn-primary:hover { background: var(--green-dark); }
  .btn-ghost { background: transparent; color: var(--text); border: 1px solid #eee; }
  .btn-ghost:hover { background: var(--bg); }

  /* MODALE PROJET */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(57, 57, 57, 0.32); opacity: 0; pointer-events: none; transition: opacity 0.22s ease; z-index: 1000; }
  .modal-backdrop.open { opacity: 1; pointer-events: auto; }
  .project-modal { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 94vw; background: #fff; box-shadow: -10px 0 32px rgba(0, 0, 0, 0.10); transform: translateX(100%); transition: transform 0.28s cubic-bezier(.2, .8, .2, 1); z-index: 1001; display: flex; flex-direction: column; font-family: 'Open Sans', sans-serif; }
  .project-modal.open { transform: translateX(0); }
  .modal-close { position: absolute; top: 14px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: #f5f4f4; border: none; cursor: pointer; font-size: 18px; color: var(--muted); line-height: 1; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
  .modal-close:hover { background: #eaeaea; color: var(--text); }
  .modal-head { padding: 22px 60px 16px 24px; border-bottom: 1px solid #eee; background: linear-gradient(180deg, #fafafa 0%, #fff 100%); }
  .modal-head-persona { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--green); background: var(--green-soft); padding: 3px 9px; border-radius: 4px; margin-bottom: 8px; }
  .modal-title { font-size: 18px; font-weight: 700; color: var(--text); line-height: 1.3; margin-bottom: 4px; }
  .modal-sub { font-size: 12px; color: var(--muted); }
  .modal-etat-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.3px; text-transform: uppercase; margin-right: 8px; }
  .modal-etat-badge.active { color: var(--green); background: var(--green-soft); }
  .modal-etat-badge.ready { color: #ffffff; background: var(--green); }
  .modal-etat-badge.pending { color: #8a6200; background: var(--orange-soft); }
  .modal-body { flex: 1; overflow-y: auto; padding: 20px 24px 28px; }
  .modal-section { margin-bottom: 22px; }
  .modal-section-title { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .modal-section-meta { font-size: 11px; color: var(--text); font-weight: 700; text-transform: none; letter-spacing: normal; }
  .modal-section-meta.ok { color: var(--green); }
  .modal-section-meta.partial { color: var(--orange); }
  .modal-budget-range { display: flex; justify-content: space-between; align-items: baseline; font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
  .modal-budget-range strong { color: var(--text); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .modal-budget-med { color: var(--text); font-weight: 600; }
  .modal-budget-bar { position: relative; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
  .modal-budget-bar-fill { position: absolute; height: 100%; background: #cfe8d5; }
  .modal-budget-bar-tick { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--green-dark); }
  .modal-budget-fixed { padding: 14px 16px; background: var(--green-soft); border-left: 3px solid var(--green); border-radius: 6px; font-size: 13px; color: var(--text); line-height: 1.6; }
  .modal-budget-fixed-check { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: var(--green); color: #fff; font-size: 11px; font-weight: 700; align-items: center; justify-content: center; margin-right: 8px; vertical-align: middle; }
  .modal-budget-fixed-amount { font-size: 20px; font-weight: 700; color: var(--green-dark); font-variant-numeric: tabular-nums; }
  .modal-budget-fixed-amount .unit { font-size: 13px; font-weight: 600; margin-left: 2px; }
  .modal-crit { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #eee; font-size: 12px; }
  .modal-crit:last-child { border-bottom: none; }
  .modal-crit-bullet { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; line-height: 1; }
  .modal-crit-bullet.ok { background: var(--green-soft); color: var(--green); }
  .modal-crit-bullet.miss { background: var(--red-soft); color: var(--red); }
  .modal-crit-label { color: var(--text); font-weight: 600; }
  .modal-crit-value { color: var(--muted); font-size: 11px; text-align: right; }
  .modal-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .modal-stat { background: #fafafa; border-radius: 8px; padding: 12px 10px; text-align: center; }
  .modal-stat-val { font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; font-variant-numeric: tabular-nums; }
  .modal-stat-lab { font-size: 10.5px; color: var(--muted); margin-top: 5px; line-height: 1.3; }
  .modal-privacy { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: #f9fafc; border: 1px solid #eef0f5; border-radius: 6px; font-size: 10.5px; color: var(--muted); line-height: 1.4; }
  .modal-privacy-icon { font-size: 12px; line-height: 1.3; }

  @media (max-width: 1100px) {
    .personas-row { grid-template-columns: repeat(3, 1fr); }
    .focus-body { grid-template-columns: 1fr; }
    .leviers-grid { grid-template-columns: 1fr; }
    .af-grid { grid-template-columns: 1fr; }
    .mini-kpis { grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .secondary-row { gap: 32px; }
  }
  @media (max-width: 600px) {
    .project-modal { width: 100%; }
  }
`;

/* ─── Composant modale projet ─── */
function ProjectModal({ name, onClose }) {
  const d = name ? PROJECT_DETAILS[name] : null;
  const isOpen = Boolean(d);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!d) {
    return (
      <>
        <div className="modal-backdrop" onClick={onClose} />
        <aside className="project-modal" aria-hidden="true" />
      </>
    );
  }

  const dursMatch = d.durs.filter((c) => c.match).length;
  const souhMatch = d.souhaits.filter((c) => c.match).length;

  const range = d.budgetScaleMax - d.budgetScaleMin;
  const left = ((d.budgetMin - d.budgetScaleMin) / range) * 100;
  const width = ((d.budgetMax - d.budgetMin) / range) * 100;
  const medPos = ((d.budgetMed - d.budgetScaleMin) / range) * 100;

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <aside className="project-modal open" role="dialog" aria-hidden="false">
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="modal-head">
          <div className="modal-head-persona">{d.persona}</div>
          <div className="modal-title">{name}</div>
          <div className="modal-sub">
            <span className={`modal-etat-badge ${d.etatCls || 'active'}`}>{d.etat}</span>
            <span>{d.lastSeen}</span>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-title">
              {d.budgetValidated ? 'Financement validé' : (
                <>Budget recherché <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>(saisi à la découverte)</span></>
              )}
            </div>
            {d.budgetValidated ? (
              <div className="modal-budget-fixed">
                <span className="modal-budget-fixed-check">✓</span>
                Financement à hauteur de{' '}
                <span className="modal-budget-fixed-amount">
                  {d.budgetFixed}<span className="unit">k€</span>
                </span>{' '}
                accordé
              </div>
            ) : (
              <>
                <div className="modal-budget-range">
                  <span>
                    {d.budgetMin === 0 ? (
                      <em style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11.5, fontStyle: 'italic' }}>aucun plancher</em>
                    ) : (
                      <><strong>{d.budgetMin}</strong> k€</>
                    )}
                  </span>
                  <span className="modal-budget-med">médian <strong>{d.budgetMed}</strong> k€</span>
                  <span><strong>{d.budgetMax}</strong> k€</span>
                </div>
                <div className="modal-budget-bar">
                  <div className="modal-budget-bar-fill" style={{ left: `${left}%`, width: `${width}%` }} />
                  <div className="modal-budget-bar-tick" style={{ left: `${medPos}%` }} />
                </div>
              </>
            )}
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              Critères durs{' '}
              <span className={`modal-section-meta ${dursMatch === d.durs.length ? 'ok' : 'partial'}`}>
                {dursMatch} / {d.durs.length}
              </span>
            </div>
            {d.durs.map((c, i) => (
              <div key={i} className="modal-crit">
                <span className={`modal-crit-bullet ${c.match ? 'ok' : 'miss'}`}>{c.match ? '✓' : '✗'}</span>
                <span className="modal-crit-label">{c.label}</span>
                <span className="modal-crit-value">{c.value}</span>
              </div>
            ))}
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              Critères souhaités{' '}
              <span className={`modal-section-meta ${souhMatch === d.souhaits.length ? 'ok' : 'partial'}`}>
                {souhMatch} / {d.souhaits.length}
              </span>
            </div>
            {d.souhaits.map((c, i) => (
              <div key={i} className="modal-crit">
                <span className={`modal-crit-bullet ${c.match ? 'ok' : 'miss'}`}>{c.match ? '✓' : '✗'}</span>
                <span className="modal-crit-label">{c.label}</span>
                <span className="modal-crit-value">{c.value}</span>
              </div>
            ))}
          </div>

          <div className="modal-section">
            <div className="modal-section-title">Parcours de recherche</div>
            <div className="modal-stats">
              <div className="modal-stat">
                <div className="modal-stat-val">{d.stats.vus}</div>
                <div className="modal-stat-lab">biens consultés</div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-val">{d.stats.fav}</div>
                <div className="modal-stat-lab">favoris</div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-val">{d.stats.vis}</div>
                <div className="modal-stat-lab">visites programmées</div>
              </div>
            </div>
          </div>

          <div className="modal-privacy">
            <span className="modal-privacy-icon">🔒</span>
            <span>Projet anonymisé — seul l'agent mandataire peut révéler le contact acquéreur via la fiche projet dédiée.</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Step4TensionMarche() {
  const [activePersona, setActivePersona] = useState('familles');
  const [openedProject, setOpenedProject] = useState(null);
  const [pdfSel, setPdfSel] = useState({ act1: true, act2: true, act3: true });

  const P = PERIOD;
  const OFFRE_SNAPSHOT = 7;
  const tension = (P.total / OFFRE_SNAPSHOT).toFixed(1).replace('.', ',');

  const persona = PERSONAS[activePersona];
  const cardCount = P.personas[activePersona];
  const shownBuyers = persona.buyers.slice(0, cardCount);
  const othersCount = Math.max(0, cardCount - shownBuyers.length);

  const pdfChecked = Object.values(pdfSel).filter(Boolean).length;
  const pdfTotal = Object.keys(pdfSel).length;

  const togglePdf = (key) => setPdfSel((s) => ({ ...s, [key]: !s[key] }));
  const toggleAllPdf = () => {
    const allChecked = Object.values(pdfSel).every(Boolean);
    const next = !allChecked;
    setPdfSel({ act1: next, act2: next, act3: next });
  };

  // Histogramme budgets — mode = indice de la tranche la plus représentée
  const maxDist = Math.max(...P.dist);
  const modeIdx = P.dist.indexOf(maxDist);

  useEffect(() => {
    document.body.style.paddingBottom = '70px';
    return () => { document.body.style.paddingBottom = ''; };
  }, []);

  return (
    <div className="step4-page">
      <style>{cssStyles}</style>
      <PropertyCard />
      <Stepper currentStep={4} />

      {/* ═══ ACTE 1 ═══ */}
      <section className="act act-1">
        <div className="pdf-toggle">
          <input type="checkbox" id="pdf-act1" checked={pdfSel.act1} onChange={() => togglePdf('act1')} />
          <label htmlFor="pdf-act1"><span role="img" aria-label="pdf">📄</span> PDF</label>
        </div>
        <div className="act-header">
          <span className="act-num">ACTE 1</span>
          <span className="act-title">Il y a une demande réelle sur votre bien</span>
        </div>
        <div className="act-subtitle">
          Projets d'achat actifs dans votre périmètre dont les critères matchent votre bien LYN-2026-00847.
        </div>

        <div className="hero-zone">
          <div className="hero-number">{P.total}</div>
          <div className="hero-label">projets d'achat qui recherchent un bien comme le vôtre</div>
          <div className="hero-sub">
            Sur <span>{P.pool}</span> profils actifs dans le périmètre Lyon 3ème (rayon 1,5 km), entrés en recherche il y a moins d'1 an · Critères durs matchés : localisation, surface, typologie, DPE.
          </div>
        </div>

        <div className="secondary-row">
          <div className="secondary-kpi">
            <div className="secondary-number accent">{P.forts}</div>
            <div className="secondary-label">
              avec critères parfaits<br />
              <span style={{ opacity: 0.7 }}>(tous crit. durs + souhaits)</span>
            </div>
          </div>
          <div className="secondary-sep"></div>
          <div className="secondary-kpi">
            <div className="secondary-number">
              <span>{P.budget}</span>
              <span style={{ fontSize: 20 }}>&nbsp;k€</span>
            </div>
            <div className="secondary-label">
              budget médian recherché<br />
              <span style={{ opacity: 0.7 }}>sur ces <span>{P.total}</span> projets</span>
            </div>
          </div>
        </div>

        {/* Distribution par tranche de plafond */}
        <div className="budget-dist">
          <div className="budget-dist-header">
            <div className="budget-dist-title">Distribution par tranche de plafond</div>
            <div className="budget-dist-hint">Classement par plafond de budget (tranche haute). Ces tranches alimenteront la fixation du prix à l'étape suivante.</div>
          </div>
          <div className="budget-dist-highlight">
            <span className="budget-dist-highlight-label">Plafond de budget le plus fréquent</span>
            <span className="budget-dist-highlight-value">{BUCKETS[modeIdx].label} k€</span>
            <span className="budget-dist-highlight-count">
              <strong>{maxDist}</strong> projets plafonnent ici, sur <span>{P.total}</span>
            </span>
          </div>
          <div className="budget-dist-bars">
            {BUCKETS.map((b, i) => {
              const count = P.dist[i];
              const pct = maxDist > 0 ? (count / maxDist) * 100 : 0;
              const isMode = i === modeIdx;
              return (
                <div key={b.label} className={`budget-bar-row${isMode ? ' mode' : ''}`}>
                  <div className="budget-bar-label">{b.label} k€</div>
                  <div className="budget-bar-track">
                    <div className={`budget-bar-fill${isMode ? ' mode' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="budget-bar-count">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        <hr className="hero-divider" />

        <div className="mini-kpis">
          <div className="mini-kpi">
            <div className="mini-kpi-label">Offre</div>
            <div className="mini-kpi-value">
              <span>{OFFRE_SNAPSHOT}</span>
              <span style={{ fontSize: 14, color: '#949494' }}>&nbsp;biens</span>
            </div>
            <div className="mini-kpi-hint">similaires en vente à l'instant T</div>
          </div>
          <div className="mini-kpi">
            <div className="mini-kpi-label">Tension</div>
            <div className="mini-kpi-value orange">
              <span>{tension}</span>
              <span style={{ fontSize: 14, color: '#949494' }}>×</span>
            </div>
            <div className="mini-kpi-hint">projets pour 1 bien</div>
          </div>
          <div className="mini-kpi">
            <div className="mini-kpi-label">Nouveaux</div>
            <div className="mini-kpi-value green">+5</div>
            <div className="mini-kpi-hint">cette semaine</div>
          </div>
        </div>
      </section>

      {/* ═══ ACTE 2 ═══ */}
      <section className="act act-2">
        <div className="pdf-toggle">
          <input type="checkbox" id="pdf-act2" checked={pdfSel.act2} onChange={() => togglePdf('act2')} />
          <label htmlFor="pdf-act2"><span role="img" aria-label="pdf">📄</span> PDF</label>
        </div>
        <div className="act-header">
          <span className="act-num">ACTE 2</span>
          <span className="act-title">Qui se cache derrière ces projets d'achat ?</span>
        </div>
        <div className="act-subtitle">
          5 profils-types se dégagent. Cliquez sur un profil pour voir ses besoins spécifiques et les projets concernés.
        </div>

        <div className="personas-row">
          {Object.entries(PERSONAS).map(([key, p]) => (
            <div
              key={key}
              className={`persona-card${activePersona === key ? ' active' : ''}`}
              onClick={() => setActivePersona(key)}
            >
              <div className="persona-count">{P.personas[key]}</div>
              <div className="persona-name">{p.name}</div>
              <div className="persona-sub">{p.sub}</div>
            </div>
          ))}
        </div>

        <div className="focus-panel">
          <div className="focus-header">
            <div className="focus-title">
              <span className="focus-title-dot"></span>
              <span>{persona.name}</span>
              <span className="focus-title-count">{cardCount} projets</span>
            </div>
            <div className="focus-meta">
              <span>Budget moyen <strong>{persona.budget}</strong></span>
              <span>Délai cible <strong>{persona.delai}</strong></span>
              <span>Compatibilité moyenne <strong style={{ color: 'var(--green)' }}>{persona.compat}</strong></span>
            </div>
          </div>
          <div className="focus-body">
            <div className="focus-needs">
              <h4>Besoins principaux identifiés</h4>
              <ul className="need-list">
                {persona.needs.map((n, i) => (
                  <li key={i} className="need-item">
                    <span className="need-bullet" style={{ color: n.match ? 'var(--green)' : 'var(--red)' }}>
                      {n.match ? '✓' : '✗'}
                    </span>
                    <span>
                      {n.txt}
                      <span className={`need-tag${n.tagMatch ? '' : ' miss'}`}>{n.tag}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="focus-buyers">
              <h4>Top projets d'achat de ce profil</h4>
              <div className="buyer-list">
                {shownBuyers.map((b) => (
                  <div
                    key={b.rank}
                    className="buyer-row"
                    tabIndex={0}
                    role="button"
                    aria-label={`Ouvrir le détail du projet ${b.name}`}
                    onClick={() => setOpenedProject(b.name)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenedProject(b.name); } }}
                  >
                    <span className="buyer-rank">#{b.rank}</span>
                    <span className="buyer-name">{b.name}</span>
                    <span className="buyer-budget">{b.budget}</span>
                    <span className="buyer-score">{b.score}</span>
                  </div>
                ))}
              </div>
              <a className="buyer-link" onClick={(e) => e.preventDefault()}>
                → Voir les <span>{othersCount}</span> autres projets «{persona.name}»
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ACTE 3 ═══ */}
      <section className="act act-3">
        <div className="pdf-toggle">
          <input type="checkbox" id="pdf-act3" checked={pdfSel.act3} onChange={() => togglePdf('act3')} />
          <label htmlFor="pdf-act3"><span role="img" aria-label="pdf">📄</span> PDF</label>
        </div>
        <div className="act-header">
          <span className="act-num">ACTE 3</span>
          <span className="act-title">Ce qui plaît, ce qui freine — et ce que vous pouvez faire</span>
        </div>
        <div className="act-subtitle">
          Chaque caractéristique de votre bien notée par la demande réelle (<span>{P.total}</span> projets d'achat). Les leviers sont les actions chiffrées pour mieux correspondre à ce marché.
        </div>

        <div className="af-grid">
          <div className="af-col atouts">
            <div className="af-col-header">
              <div className="af-col-title"><span className="dot"></span>Ce qui plaît</div>
              <div className="af-col-hint">% de projets pour qui c'est un plus</div>
            </div>
            {ATOUTS.map((a) => {
              const x = Math.round((a.pct * P.total) / 100);
              return (
                <div key={a.label} className="af-item">
                  <div>
                    <div className="af-item-label">{a.label}</div>
                    <div className="af-item-sub">{a.sub}</div>
                  </div>
                  <div className="af-item-score">
                    <div className="af-item-bar">
                      <div className="af-item-fill" style={{ width: `${a.pct}%` }} />
                    </div>
                    <div className="af-item-ratio">
                      <span className="num">{x}</span>
                      <span className="denom">/{P.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="af-col freins">
            <div className="af-col-header">
              <div className="af-col-title"><span className="dot"></span>Ce qui freine</div>
              <div className="af-col-hint">% de projets qui l'évoquent comme frein</div>
            </div>
            {FREINS.map((f) => {
              const x = Math.round((f.pct * P.total) / 100);
              return (
                <div key={f.label} className="af-item">
                  <div>
                    <div className="af-item-label">{f.label}</div>
                    <div className="af-item-sub">{f.sub}</div>
                  </div>
                  <div className="af-item-score">
                    <div className="af-item-bar">
                      <div className="af-item-fill" style={{ width: `${f.pct}%` }} />
                    </div>
                    <div className="af-item-ratio">
                      <span className="num">{x}</span>
                      <span className="denom">/{P.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="leviers-title">Leviers chiffrés pour capter davantage de demande</div>
        <div className="leviers-sub">Actions concrètes sur le bien — le levier prix sera simulé à l'étape suivante.</div>

        <div className="leviers-grid">
          <div className="levier-card">
            <div className="levier-header">
              <div className="levier-title">Passer DPE D → C</div>
              <span className="levier-badge">Actionnable</span>
            </div>
            <div className="levier-impact"><span className="plus">+4</span> projets</div>
            <div className="levier-cost">Coût estimé : <strong>~8 000 €</strong> (travaux isolation + fenêtres)</div>
            <div className="levier-desc">Débloque 4 projets avec critère énergie dur.</div>
          </div>
          <div className="levier-card teaser">
            <div className="levier-header">
              <div className="levier-title">Levier prix</div>
              <span className="levier-badge teaser-badge">Étape suivante</span>
            </div>
            <div className="levier-impact teaser-arrow">→</div>
            <div className="levier-cost"><strong>Simulateur de prix</strong> basé sur la distribution des budgets ci-dessus.</div>
            <div className="levier-desc">À l'étape Avis de valeur, vous verrez combien de projets vous captez selon le prix fixé.</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <div className="footer-buttons">
        <Link to="/step/3" className="btn btn-ghost">← Étape précédente : Comparables</Link>
        <Link to="/step/5" className="btn btn-primary">Étape suivante : Avis de valeur →</Link>
      </div>

      {/* PDF FLOATING BAR */}
      <div style={{ position: 'fixed', bottom: 0, left: 220, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <span role="img" aria-label="pdf">📄</span>
          <span>Rapport vendeur :</span>
          <span style={{ background: '#46B962', color: 'white', padding: '2px 10px', borderRadius: 12, fontWeight: 700, fontSize: 12 }}>{pdfChecked}</span>
          <span style={{ color: '#666', fontSize: 12 }}>actes sélectionnés sur {pdfTotal}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleAllPdf} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #eee', background: '#fff', color: '#999', fontFamily: 'Open Sans, sans-serif' }}>
            Tout (dé)sélectionner
          </button>
          <button style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#46B962', color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Open Sans, sans-serif' }}>
            <span role="img" aria-label="pdf">📄</span> Générer PDF vendeur
          </button>
        </div>
      </div>

      <ProjectModal name={openedProject} onClose={() => setOpenedProject(null)} />
    </div>
  );
}
