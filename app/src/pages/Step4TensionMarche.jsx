import { useState, useMemo, useEffect } from 'react';
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
    needs: [
      { txt: 'Budget serré, prêt PTZ éligible', match: false, tag: 'Zone B1 éligible mais prix haut', tagMatch: false },
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
    needs: [
      { txt: 'École primaire proche', match: true, tag: 'Lamartine 320 m', tagMatch: true },
      { txt: '2 chambres séparées (parent + enfant)', match: true, tag: 'T3 adapté', tagMatch: true },
      { txt: 'Quartier sécurisé', match: true, tag: 'Lyon 3ème résidentiel', tagMatch: true },
      { txt: 'Budget < 290 k€', match: true, tag: '305 k€ (limite)', tagMatch: true },
      { txt: 'Place de parking sécurisée', match: false, tag: 'Non disponible', tagMatch: false },
    ],
    buyers: [
      { rank: 1, name: 'Mono #M019', budget: '285 k€', score: '0,74' },
      { rank: 2, name: 'Mono #M027', budget: '270 k€', score: '0,68' },
    ],
    others: 1,
  },
};

/* ─── Ancres période (interpolation) ─── */
const ANCHORS = [
  { d: 7,   total: 5,  pool: 67,  forts: 2,  budget: 295, personas: { familles: 2,  investisseurs: 1,  primo: 1,  retraites: 0, mono: 1 } },
  { d: 30,  total: 12, pool: 158, forts: 4,  budget: 308, personas: { familles: 4,  investisseurs: 3,  primo: 2,  retraites: 1, mono: 2 } },
  { d: 90,  total: 23, pool: 312, forts: 7,  budget: 312, personas: { familles: 8,  investisseurs: 5,  primo: 4,  retraites: 3, mono: 3 } },
  { d: 180, total: 38, pool: 468, forts: 11, budget: 308, personas: { familles: 13, investisseurs: 8,  primo: 7,  retraites: 5, mono: 5 } },
  { d: 365, total: 54, pool: 612, forts: 15, budget: 304, personas: { familles: 19, investisseurs: 12, primo: 10, retraites: 7, mono: 6 } },
];

function interp(days) {
  days = Math.max(7, Math.min(365, days));
  let a = ANCHORS[0], b = ANCHORS[ANCHORS.length - 1], t = 0;
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    if (days >= ANCHORS[i].d && days <= ANCHORS[i + 1].d) {
      a = ANCHORS[i];
      b = ANCHORS[i + 1];
      t = b.d === a.d ? 0 : (days - a.d) / (b.d - a.d);
      break;
    }
  }
  const lerp = (x, y) => x + (y - x) * t;
  return {
    days,
    total: Math.round(lerp(a.total, b.total)),
    pool: Math.round(lerp(a.pool, b.pool)),
    forts: Math.round(lerp(a.forts, b.forts)),
    budget: Math.round(lerp(a.budget, b.budget)),
    personas: {
      familles: Math.round(lerp(a.personas.familles, b.personas.familles)),
      investisseurs: Math.round(lerp(a.personas.investisseurs, b.personas.investisseurs)),
      primo: Math.round(lerp(a.personas.primo, b.personas.primo)),
      retraites: Math.round(lerp(a.personas.retraites, b.personas.retraites)),
      mono: Math.round(lerp(a.personas.mono, b.personas.mono)),
    },
  };
}

function formatDays(d) {
  if (d >= 360) return '1 an';
  if (d >= 30) {
    const m = d / 30;
    if (Number.isInteger(m)) return m + ' mois';
    return (Math.round(m * 10) / 10).toString().replace('.', ',') + ' mois';
  }
  return d + ' j';
}

const LOG_MIN = Math.log(7);
const LOG_MAX = Math.log(365);
const LOG_RANGE = LOG_MAX - LOG_MIN;
const posToDays = (pos) => Math.round(Math.exp(LOG_MIN + (pos / 1000) * LOG_RANGE));
const daysToPos = (days) => {
  days = Math.max(7, Math.min(365, days));
  return Math.round(((Math.log(days) - LOG_MIN) / LOG_RANGE) * 1000);
};

const PERIOD_MARKS = [
  { idx: 0, days: 7, label: '7 j' },
  { idx: 1, days: 30, label: '30 j' },
  { idx: 2, days: 90, label: '3 mois' },
  { idx: 3, days: 180, label: '6 mois' },
  { idx: 4, days: 365, label: 'Tous' },
];

const ATOUTS = [
  { label: 'Localisation Lyon 3ème', sub: 'Quartier recherché · transports, commerces', pct: 91 },
  { label: 'Surface 72,5 m²',        sub: 'Dans la fourchette cible pour T3',          pct: 83 },
  { label: 'Prix 305 k€',            sub: 'Dans le budget de la majorité',             pct: 78 },
  { label: 'Balcon 6 m²',            sub: 'Critère différenciant post-Covid',          pct: 70 },
];
const FREINS = [
  { label: 'Sans parking',             sub: 'Critère attendu par la majorité de la demande', pct: 61 },
  { label: 'DPE D',                    sub: 'Sensibilité énergie · recherche DPE ≤ C',       pct: 48 },
  { label: '3ème étage sans ascenseur', sub: 'Retraités et familles avec poussette',         pct: 39 },
  { label: 'Exposition ouest',         sub: 'Recherche sud/est majoritaire',                 pct: 39 },
];

const cssStyles = `
  .step4-page { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif; --green:#46B962; --green-dark:#1aa564; --green-soft:#e8f6ec; --blue:#4a6cf7; --orange:#f5a623; --orange-soft:#fef5e6; --red:#e74c3c; --red-soft:#fdecec; --grey:#949494; --border:#eee; --text:#393939; --muted:#949494; --bg:#fafafa; --white:#ffffff; color: var(--text); font-size: 13px; line-height: 1.4; }

  /* ACT — Structure commune */
  .act { background: var(--white); border: 1px solid #eee; border-radius: 12px; padding: 32px 28px; margin-bottom: 18px; position: relative; }
  .act-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .act-num { font-size: 10px; font-weight: 800; color: var(--green); letter-spacing: 2px; background: var(--green-soft); padding: 3px 8px; border-radius: 4px; }
  .act-title { font-size: 17px; font-weight: 700; color: var(--text); }
  .act-subtitle { font-size: 13px; color: var(--muted); margin-bottom: 28px; line-height: 1.55; }

  /* PDF TOGGLE */
  .pdf-toggle { position: absolute; top: 10px; right: 12px; display: flex; align-items: center; gap: 5px; z-index: 5; }
  .pdf-toggle input[type="checkbox"] { display: none; }
  .pdf-toggle label { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 10px; color: #bbb; padding: 3px 8px; border-radius: 5px; border: 1px solid transparent; user-select: none; background: rgba(255,255,255,0.9); }
  .pdf-toggle label:hover { color: #888; background: #f5f5f5; }
  .pdf-toggle input:checked + label { color: var(--green); background: var(--green-soft); border-color: #c5e8cf; }

  /* ACTE 1 */
  .act-1 { text-align: center; padding: 32px 28px 28px; }
  .act-1 .act-header { justify-content: center; }
  .period-filter { display: flex; align-items: center; gap: 20px; margin: 18px auto 26px; padding: 12px 22px 14px; background: #fafbfc; border: 1px solid #eee; border-radius: 8px; max-width: 640px; }
  .period-filter-label { font-size: 10px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0; white-space: nowrap; }
  .period-current-inline { color: var(--green); font-weight: 800; font-size: 12px; text-transform: none; letter-spacing: 0; margin-left: 6px; display: inline-block; min-width: 62px; }
  .period-slider-wrap { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .period-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; background: #e5e7e9; border-radius: 2px; outline: none; cursor: pointer; margin: 0; padding: 0; }
  .period-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--green); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.18); cursor: pointer; }
  .period-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--green); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.18); cursor: pointer; border-style: solid; }
  .period-marks { position: relative; height: 22px; font-size: 10.5px; color: var(--muted); font-weight: 600; margin-top: -2px; }
  .period-marks span { position: absolute; cursor: pointer; white-space: nowrap; transition: color 0.15s; text-align: center; }
  .period-marks span.active { color: var(--green); font-weight: 700; }
  .period-marks span::before { content: ''; display: block; width: 1px; height: 5px; background: #ccc; margin: -6px auto 3px; }

  .hero-zone { display: flex; flex-direction: column; align-items: center; margin: 4px 0 22px; }
  .hero-number { font-size: 72px; font-weight: 700; color: var(--green); line-height: 1; letter-spacing: -2px; font-family: 'Open Sans', sans-serif; }
  .hero-label { font-size: 14px; color: var(--text); font-weight: 600; margin-top: 4px; letter-spacing: 0.2px; }
  .hero-sub { font-size: 11.5px; color: var(--muted); margin-top: 5px; max-width: 520px; line-height: 1.5; }

  .secondary-row { display: flex; justify-content: center; align-items: stretch; gap: 48px; margin: 6px 0 22px; flex-wrap: wrap; }
  .secondary-kpi { display: flex; flex-direction: column; align-items: center; min-width: 120px; }
  .secondary-number { font-size: 30px; font-weight: 700; color: var(--text); line-height: 1; letter-spacing: -0.5px; }
  .secondary-number.accent { color: var(--orange); }
  .secondary-label { font-size: 11.5px; color: var(--muted); margin-top: 5px; text-align: center; max-width: 140px; line-height: 1.4; }
  .secondary-sep { width: 1px; background: #eee; align-self: stretch; }

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
  .persona-card.active { border: 1px solid var(--green); padding: 20px 14px 18px; background: var(--green-soft); }
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
  .buyer-row { display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; padding: 8px 10px; background: #fff; border: 1px solid #eaf0e5; border-radius: 6px; font-size: 11.5px; }
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
  .levier-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .levier-title { font-size: 12.5px; font-weight: 700; color: var(--text); }
  .levier-badge { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--green); background: var(--green-soft); }
  .levier-impact { font-size: 20px; font-weight: 700; color: var(--green); line-height: 1; margin: 4px 0 4px; }
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

  @media (max-width: 1100px) {
    .personas-row { grid-template-columns: repeat(3, 1fr); }
    .focus-body { grid-template-columns: 1fr; }
    .leviers-grid { grid-template-columns: 1fr; }
    .af-grid { grid-template-columns: 1fr; }
    .mini-kpis { grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .secondary-row { gap: 32px; }
  }
`;

/* Positions des marqueurs (échelle log) */
const MARK_STYLES = PERIOD_MARKS.map((m, i) => {
  const pos = daysToPos(m.days);
  const pct = (pos / 1000) * 100;
  if (i === 0) return { left: '0', transform: 'none' };
  if (i === PERIOD_MARKS.length - 1) return { right: '0', transform: 'none', left: 'auto' };
  return { left: `${pct}%`, transform: 'translateX(-50%)' };
});

export default function Step4TensionMarche() {
  const [sliderPos, setSliderPos] = useState(() => daysToPos(90));
  const [activePersona, setActivePersona] = useState('familles');
  const [pdfSel, setPdfSel] = useState({ act1: true, act2: true, act3: true });

  const days = posToDays(sliderPos);
  const P = useMemo(() => interp(days), [days]);

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

  // Scroll le bien pour que la pdf-bar ne cache rien
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

        <div className="period-filter">
          <div className="period-filter-label">
            Entrés en recherche depuis
            <span className="period-current-inline">{formatDays(P.days)}</span>
          </div>
          <div className="period-slider-wrap">
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={sliderPos}
              className="period-slider"
              aria-label="Filtre fraîcheur des projets d'achat, de 7 à 365 jours"
              onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
            />
            <div className="period-marks">
              {PERIOD_MARKS.map((m, i) => (
                <span
                  key={m.idx}
                  style={MARK_STYLES[i]}
                  className={P.days === m.days ? 'active' : ''}
                  onClick={() => setSliderPos(daysToPos(m.days))}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-zone">
          <div className="hero-number">{P.total}</div>
          <div className="hero-label">projets d'achat qualifiés sur votre bien</div>
          <div className="hero-sub">
            Sur <span>{P.pool}</span> profils actifs dans le périmètre Lyon 3ème (rayon 1,5 km) · Score de compatibilité &gt; 0,50 après filtres durs.
          </div>
        </div>

        <div className="secondary-row">
          <div className="secondary-kpi">
            <div className="secondary-number accent">{P.forts}</div>
            <div className="secondary-label">
              en forte compatibilité<br />
              <span style={{ opacity: 0.7 }}>(score &gt; 0,75)</span>
            </div>
          </div>
          <div className="secondary-sep"></div>
          <div className="secondary-kpi">
            <div className="secondary-number">
              <span>{P.budget}</span>
              <span style={{ fontSize: 20 }}>&nbsp;k€</span>
            </div>
            <div className="secondary-label">
              budget médian<br />
              <span style={{ opacity: 0.7 }}>sur ces <span>{P.total}</span> projets</span>
            </div>
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
              <div className="persona-sub">
                {key === 'familles' && 'couple + enfants'}
                {key === 'investisseurs' && 'locatif / rendement'}
                {key === 'primo' && '1ère acquisition'}
                {key === 'retraites' && 'logement plus petit / pied-à-terre'}
                {key === 'mono' && 'parent + enfant(s)'}
              </div>
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
                    <span dangerouslySetInnerHTML={{ __html: n.txt }} />
                    <span className={`need-tag${n.tagMatch ? '' : ' miss'}`}>{n.tag}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="focus-buyers">
              <h4>Top projets d'achat de ce profil</h4>
              <div className="buyer-list">
                {shownBuyers.map((b) => (
                  <div key={b.rank} className="buyer-row">
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
        <div className="leviers-sub">Actions concrètes — chaque levier est estimé en gain de projets forts et en coût.</div>

        <div className="leviers-grid">
          <div className="levier-card">
            <div className="levier-header">
              <div className="levier-title">Passer DPE D → C</div>
              <span className="levier-badge">Actionnable</span>
            </div>
            <div className="levier-impact"><span className="plus">+4</span> forts</div>
            <div className="levier-cost">Coût estimé : <strong>~8 000 €</strong> (travaux isolation + fenêtres)</div>
            <div className="levier-desc">Débloque 4 projets avec critère énergie dur · ROI estimé sur prix de vente +2 à +3%.</div>
          </div>
          <div className="levier-card">
            <div className="levier-header">
              <div className="levier-title">Négocier prix -3% (295 k€)</div>
              <span className="levier-badge">Actionnable</span>
            </div>
            <div className="levier-impact"><span className="plus">+3</span> forts</div>
            <div className="levier-cost">Impact : <strong>-10 000 €</strong> sur prix de vente</div>
            <div className="levier-desc">Fait entrer 3 projets investisseurs et 1 primo-accédant dans la fourchette «forte compatibilité».</div>
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
    </div>
  );
}
