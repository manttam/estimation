import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import RdvPlanner from '../components/RdvPlanner';
import { avisValeur } from '../data/propertyData';
import { getActiveBien } from '../utils/activeBien';
import { getAcquereurs } from '../utils/acquereursStore';
import { setReportState, mergeReportSection, getReportSection, getReportState } from '../utils/reportStore';
import { computeWeightedM2 } from '../utils/weightedM2';

const TYPE_LABELS = {
  appartement: 'Appartement',
  maison: 'Maison',
  studio: 'Studio',
  loft: 'Loft',
  duplex: 'Duplex',
  terrain: 'Terrain',
  parking: 'Parking',
  local: 'Local',
};

/* Objectif de vente : délai souhaité par le vendeur. Sert d'aide au choix
 * de la stratégie de prix (court terme → plutôt prudent, long terme →
 * possible d'être agressif). */
const OBJECTIF_OPTIONS = [
  { value: 'court', short: 'Court', label: 'Court terme (< 3 mois)' },
  { value: 'moyen', short: 'Moyen', label: 'Moyen terme (3 à 6 mois)' },
  { value: 'long', short: 'Long', label: 'Long terme (> 6 mois)' },
];

function describeBien(active) {
  if (!active || !active.bien) return null;
  const b = active.bien;
  const a = active.adresse || {};
  const type = TYPE_LABELS[b.type] || (b.type ? b.type.charAt(0).toUpperCase() + b.type.slice(1) : 'Bien');
  const piecesLabel = b.pieces ? `T${b.pieces}` : '';
  const surfaceLabel = b.surface ? `${b.surface} m²` : '';
  const cityLabel = a.city || '';
  const etageLabel = (b.etage !== undefined && b.etage !== null && b.etage !== '')
    ? (Number(b.etage) === 0 ? 'RDC' : `${b.etage}ème étage`)
    : '';
  const parts = [type, piecesLabel, surfaceLabel, cityLabel, etageLabel].filter(Boolean);
  return parts.join(' · ');
}

const cssStyles = `
  .step5-page {
    background: #fafafa;
    min-height: 100vh;
    padding-bottom: 32px;
    font-family: var(--font);
    line-height: 1.4;
    color: var(--text);
  }

  /* Pleine largeur comme Step2/3/4 : le Layout fournit déjà le padding latéral. */
  .step5-section {
    width: 100%;
  }

  /* ---- Récapitulatif des étapes ---- */
  .recap-section {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 24px 24px;
    margin-bottom: 14px;
  }
  .recap-head {
    margin-bottom: 16px;
  }
  .recap-head-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
  }
  .recap-head-sub {
    font-size: 12px;
    color: #888;
    margin-top: 2px;
  }
  .recap-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  @media (max-width: 1100px) {
    .recap-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 880px) {
    .recap-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .recap-card {
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .recap-step-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #999;
  }
  .recap-card-main {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.2;
  }
  .recap-card-line {
    font-size: 11px;
    color: #666;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recap-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }
  .recap-tag {
    display: inline-block;
    background: #eef6f0;
    color: var(--green-dark, #3da856);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
  }
  /* Objectif de vente : sélecteur de délai (court / moyen / long terme).
   * Compact : tient sur une seule ligne dans la grille du récap. */
  .objectif-choices {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .objectif-chip {
    flex: 1 1 0;
    min-width: 0;
    border: 1px solid #d8e0da;
    background: #fff;
    color: #555;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 4px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .objectif-chip:hover {
    border-color: var(--green, #46b962);
    color: var(--green-dark, #3da856);
  }
  .objectif-chip.selected {
    background: var(--green, #46b962);
    border-color: var(--green, #46b962);
    color: #fff;
  }

  /* ---- Demand Section ---- */
  /* ---- Rang\u00e9e haute : Impact du prix + Strat\u00e9gie c\u00f4te \u00e0 c\u00f4te ----
   * Grid 2 colonnes redimensionnable (1 poign\u00e9e). Largeurs via --top-l/--top-r. */
  .top-row {
    display: grid;
    grid-template-columns:
      minmax(0, var(--top-l, 64%))
      8px
      minmax(0, var(--top-r, 36%));
    gap: 0;
    margin-bottom: 14px;
    align-items: start;
  }
  .top-row.is-resizing {
    cursor: col-resize;
    user-select: none;
  }
  /* Dans la rang\u00e9e, les blocs n'ont plus de margin-bottom propre */
  .top-row .demand-section,
  .top-row .card.strategy {
    margin-bottom: 0;
    height: 100%;
  }

  .demand-section {
    background: #fff;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 14px;
    border: 1px solid var(--border);
    position: relative;
  }
  .demand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .demand-title {
    font-size: 14px;
    font-weight: 600;
  }
  .demand-subtitle {
    font-size: 11px;
    color: #666;
  }
  .demand-hero-row {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 20px;
  }
  .demand-big-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .demand-big-number {
    font-size: 52px;
    font-weight: 800;
    color: var(--green);
    line-height: 1;
    transition: color 0.3s;
    min-width: 80px;
    text-align: center;
  }
  .demand-big-label {
    font-size: 11px;
    color: #666;
    text-align: center;
    margin-top: 2px;
  }

  /* ---- Bloc demande : projets d'achat en vedette, tension en note secondaire ---- */
  .demand-lead-block {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .demand-lead-main {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  /* Note de tension : petite ligne discrète sous le chiffre vedette */
  .tension-note {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 240px;
    padding: 6px 12px;
    border-radius: 14px;
    background: #f4f4f4;
    font-size: 10px;
    line-height: 1.3;
    color: #666;
    text-align: center;
    transition: background 0.3s, color 0.3s;
  }
  .tension-note.high { background: #ecf8f0; color: #2f8f4e; }
  .tension-note.mid  { background: #fdf4e7; color: #b8860b; }
  .tension-note.low  { background: #fcefef; color: #d4452f; }
  .tension-note strong { font-weight: 800; }
  .tension-note-dot {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .tension-note-text { min-width: 0; }
  .demand-gauge-wrap {
    flex: 1;
  }
  .demand-price-display {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
    text-align: center;
    margin-bottom: 6px;
  }
  .demand-price-display .price-perm {
    font-size: 13px;
    font-weight: 500;
    color: #666;
    margin-left: 8px;
  }
  .demand-slider-wrap {
    position: relative;
    padding: 0 4px;
  }
  .demand-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    background: linear-gradient(to right, var(--green) 0%, var(--orange) 50%, var(--red) 100%);
  }
  .demand-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    border: 2px solid var(--green);
    box-shadow: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .demand-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    border: 2px solid var(--green);
    box-shadow: none;
    cursor: pointer;
  }
  .demand-slider-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 10px;
    color: #666;
  }
  .demand-slider-labels .estimation-marker {
    color: var(--green);
    font-weight: 600;
  }

  /* ---- Demand Criteria Grid ---- */
  .demand-detail-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }
  .demand-criteria {
    text-align: center;
    padding: 10px 6px;
    border-radius: 8px;
    background: #f9f9f9;
    border: 1px solid #f0f0f0;
    transition: all 0.3s;
  }
  .demand-criteria.match { border-color: #e8f5e9; }
  .demand-criteria.partial { border-color: #fff3e0; }
  .demand-criteria.low { border-color: #ffebee; }
  .demand-criteria-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 6px;
  }
  .demand-criteria-icon svg { width: 16px; height: 16px; }
  .demand-criteria.match .demand-criteria-icon { background: #e8f5e9; color: var(--green); }
  .demand-criteria.partial .demand-criteria-icon { background: #fff3e0; color: var(--orange); }
  .demand-criteria.low .demand-criteria-icon { background: #ffebee; color: var(--red); }
  .demand-criteria-label {
    font-size: 10px;
    color: #666;
    font-weight: 500;
  }
  .demand-criteria-value {
    font-size: 16px;
    font-weight: 700;
    margin: 2px 0;
    transition: all 0.3s;
  }
  .demand-criteria.match .demand-criteria-value { color: var(--green); }
  .demand-criteria.partial .demand-criteria-value { color: var(--orange); }
  .demand-criteria.low .demand-criteria-value { color: var(--red); }
  .demand-criteria-detail {
    font-size: 9px;
    color: #666;
  }
  .demand-criteria-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: #eee;
    margin-top: 6px;
    overflow: hidden;
  }
  .demand-criteria-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease, background 0.3s;
  }
  .demand-criteria.match .demand-criteria-fill { background: var(--green); }
  .demand-criteria.partial .demand-criteria-fill { background: var(--orange); }
  .demand-criteria.low .demand-criteria-fill { background: var(--red); }

  /* ---- Demand Verdict ---- */
  .demand-verdict {
    margin-top: 14px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.3s;
    background: #fafafa;
    border: 1px solid var(--border);
  }
  .demand-verdict.good { color: var(--green); }
  .demand-verdict.medium { color: #b8860b; }
  .demand-verdict.bad { color: var(--red); }
  .demand-verdict-icon { font-size: 20px; }
  .demand-verdict-text { flex: 1; }
  .demand-verdict-title { font-weight: 700; font-size: 13px; }
  .demand-verdict-desc { font-size: 11px; color: #666; margin-top: 2px; }

  /* ---- Content Grid (colonnes redimensionnables) ----
   * 2 colonnes + 1 poignée : Avis de valeur+Comparables (col1) |
   * Actions (col2). Largeur via --col-1 ; la colonne 2 prend le reste. */
  .content-grid {
    display: grid;
    grid-template-columns:
      minmax(0, var(--col-1, 60%))
      8px
      minmax(0, 1fr);
    gap: 0;
    margin-bottom: 14px;
    align-items: start;
  }
  .content-grid.single-col {
    grid-template-columns: minmax(0, 1fr);
  }
  .content-grid-col {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .col-resize-handle {
    cursor: col-resize;
    background: transparent;
    position: relative;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    border: none;
    padding: 0;
    align-self: stretch;
  }
  .col-resize-handle::before {
    content: '';
    width: 2px;
    height: 36px;
    background: #d8d8d8;
    border-radius: 2px;
    transition: background 0.15s, height 0.15s;
  }
  .col-resize-handle:hover {
    background: rgba(70, 185, 98, 0.06);
  }
  .col-resize-handle:hover::before {
    background: var(--green);
    height: 64px;
  }
  .col-resize-handle.is-dragging {
    background: rgba(70, 185, 98, 0.12);
  }
  .col-resize-handle.is-dragging::before {
    background: var(--green);
    height: 96px;
  }
  .content-grid.is-resizing {
    cursor: col-resize;
    user-select: none;
  }

  /* ---- Card ---- */
  .step5-page .card {
    background: #fff;
    border-radius: var(--radius-card);
    padding: 16px;
    border: 1px solid var(--border);
    position: relative;
  }
  .card-title {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 12px;
    color: #333;
  }

  /* ---- Strategy Options ---- */
  .strategy-option {
    padding: 12px;
    margin: 8px 0;
    border-radius: 8px;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.2s;
  }
  .strategy-option:hover {
    border-color: #ddd;
    background: #fafafa;
  }
  .strategy-option.selected {
    border-color: var(--green);
    background: #fafafa;
  }
  .strategy-radio {
    width: 16px;
    height: 16px;
    border: 2px solid #ddd;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .strategy-option.selected .strategy-radio {
    border-color: var(--green);
    background: var(--green);
  }
  .strategy-radio-inner {
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    opacity: 0;
  }
  .strategy-option.selected .strategy-radio-inner {
    opacity: 1;
  }
  .strategy-header-row {
    display: flex;
    align-items: center;
  }
  .strategy-name {
    font-weight: 600;
    font-size: 12px;
  }
  .strategy-price {
    font-size: 15px;
    font-weight: 700;
    margin: 6px 0;
  }
  .strategy-desc {
    font-size: 11px;
    color: #666;
    line-height: 1.4;
  }
  .strategy-duration {
    font-size: 10px;
    color: #666;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #f5f5f5;
  }
  .strategy-overcote {
    font-size: 10px;
    font-weight: 600;
    color: #b3160a;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #fbe3e0;
    line-height: 1.3;
  }
  .badge-rec {
    display: inline-block;
    background: var(--green);
    color: white;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-top: 6px;
  }
  /* ---- Actions Card ---- */
  /* Grille de 3 boutons cote a cote : la carte n'occupe plus toute la largeur
     depuis le passage en mono-colonne, donc on garde des boutons compacts. */
  .actions-card {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 14px;
  }
  .action-btn {
    padding: 7px 10px;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 11px;
    line-height: 1.25;
    transition: all 0.2s;
    font-family: var(--font);
  }
  .action-btn.primary {
    background: var(--green);
    color: white;
    font-weight: 600;
  }
  .action-btn.primary:hover { background: #17a05d; }
  .action-btn.secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .action-btn.secondary:hover {
    background: #f5f5f5;
    border-color: var(--green);
    color: var(--green);
  }
  .btn-sub {
    display: block;
    font-size: 9px;
    opacity: 0.85;
    margin-top: 1px;
    font-weight: 400;
    color: #555;
  }
  .action-btn.primary .btn-sub {
    color: rgba(255,255,255,0.9);
    opacity: 1;
  }

  /* ---- History Banner ---- */
  .history-banner {
    background: #fafafa;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 16px;
    margin-bottom: 14px;
    font-size: 11px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ---- Footer ---- */
  .footer-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
  }
  .step5-page .btn {
    padding: 10px 20px;
    border-radius: var(--radius-md);
    font-size: var(--fs-md);
    font-weight: 600;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font);
  }
  .step5-page .btn-ghost {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .step5-page .btn-ghost:hover { background: #f5f5f5; }
  .step5-page .btn-primary {
    background: var(--green);
    color: white;
  }
  .step5-page .btn-primary:hover { background: var(--green-dark); }
`;

/* ---------- helpers ---------- */
function formatPrice(n) {
  return n.toLocaleString('fr-FR') + ' \u20ac';
}

const DPE_RANK_LOCAL = { A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1 };

/* Interpole linéairement entre deux couleurs hex (#rrggbb) avec t ∈ [0,1].
 * t=0 → a, t=1 → b. Utilisé pour le dégradé vert→orange→rouge du prix. */
function mixColor(a, b, t) {
  const clamp = Math.max(0, Math.min(1, t));
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const ch = (i) => Math.round(pa[i] + (pb[i] - pa[i]) * clamp).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/* ==================== Component ==================== */
export default function Step5AvisValeur() {
  const navigate = useNavigate();

  /* ─── Mode live : récupération du bien actif et des acquéreurs réels ─── */
  const activeBien = useMemo(() => getActiveBien(), []);
  const hasRealLocation = !!(activeBien && activeBien.adresse && activeBien.adresse.label);
  const realAcquereurs = useMemo(() => (hasRealLocation ? getAcquereurs() : []), [hasRealLocation]);

  // Surface : depuis activeBien si dispo, sinon mock (72.5m²)
  const surface = useMemo(() => {
    const s = Number(activeBien?.bien?.surface);
    return Number.isFinite(s) && s > 0 ? s : 72.5;
  }, [activeBien]);

  /* ─── Prix de marché RECOMMANDÉ (fixe) ───
   * Source de vérité = moyenne pondérée du prix/m² des comparables retenus en
   * Step3 (mêmes poids comparablesConfig.weights, même formule computeWeightedM2).
   * Ce prix au m² × surface = valeur de marché. Il ne varie PAS avec le curseur :
   * le curseur sert uniquement à explorer la stratégie commerciale autour.
   * Fallback : activeBien.result.prix (calcul Step3/Step4), puis mock démo. */
  const marketM2 = useMemo(() => {
    const selComps = getReportSection('comparablesSelectionnes', []);
    const weights = getReportSection('comparablesConfig', {}).weights || {};
    const { avgM2 } = computeWeightedM2(selComps, weights);
    if (avgM2 > 0) return avgM2;
    // Pas de comparables exploitables → dérive du prix calculé déjà persisté.
    if (hasRealLocation && activeBien?.result?.prix) {
      return Math.round(Number(activeBien.result.prix) / surface);
    }
    return avisValeur.prixM2;
  }, [hasRealLocation, activeBien, surface]);

  // Prix de référence : prix de marché = marketM2 × surface (recommandé, fixe).
  const priceRef = useMemo(() => {
    const marche = Math.round(marketM2 * surface);
    if (marche > 0) {
      return {
        prixMedian: marche,
        prixBas: Math.round(marche * 0.93),
        prixHaut: Math.round(marche * 1.07),
        prixM2: marketM2,
      };
    }
    return {
      prixMedian: avisValeur.prixMedian,
      prixBas: avisValeur.prixBas,
      prixHaut: avisValeur.prixHaut,
      prixM2: avisValeur.prixM2,
    };
  }, [marketM2, surface]);

  // Description hero : "Appartement T3 · 72m² · Lyon 3ème · 4ème étage"
  const heroDescription = useMemo(() => {
    return describeBien(activeBien) || 'Appartement T3 · 72.5m² · Lyon 3ème · 4ème étage';
  }, [activeBien]);

  /* ---- Récapitulatif des étapes précédentes ----
   * Synthèse de ce qui a été défini en Step1→Step4 avant d'arriver à la
   * fourchette de prix. Lit le bien actif + les sections du reportStore
   * (bienDetails Step1, contexteMarche Step2, comparablesSelectionnes Step3).
   * Tolérant : chaque ligne tombe sur un fallback "—" si la donnée manque. */
  const recapData = useMemo(() => {
    const b = activeBien?.bien || {};
    const adr = activeBien?.adresse || {};
    const bd = getReportSection('bienDetails', {});
    const ctx = getReportSection('contexteMarche', {});
    const selComps = getReportSection('comparablesSelectionnes', []);

    // Lookup tolérant dans bienDetails (clés slugifiées "${cat}__${field}").
    const find = (...slugs) => {
      const keys = Object.keys(bd);
      for (const slug of slugs) {
        const hit = keys.find((k) => k.endsWith(`__${slug}`) || k === slug);
        if (hit && bd[hit] !== undefined && bd[hit] !== '' && bd[hit] !== null) return bd[hit];
      }
      return undefined;
    };

    const typeLabel = TYPE_LABELS[b.type] || (b.type ? b.type.charAt(0).toUpperCase() + b.type.slice(1) : null);
    const piecesLabel = b.pieces ? `T${b.pieces}` : null;
    const surfaceVal = b.surface || find('surface_carrez_m', 'surface_totale_m', 'surface');
    const surfaceLabel = surfaceVal ? `${surfaceVal} m²` : null;
    const etageLabel = (b.etage !== undefined && b.etage !== null && b.etage !== '')
      ? (Number(b.etage) === 0 ? 'RDC' : `${b.etage}e étage`)
      : null;
    const dpe = b.dpe || find('dpe_etiquette_energie', 'classe_dpe', 'dpe');
    const etat = b.etat || find('etat_general', 'etat_general_du_bien');

    // Step1 — bien : ligne synthétique des caractéristiques clés
    const bienParts = [typeLabel, piecesLabel, surfaceLabel, etageLabel].filter(Boolean);

    // Step2 — zone / marché local
    const villeLabel = adr.city || ctx.zoneLabel || null;
    const prixM2Zone = ctx.prixM2Median
      || (activeBien?.dvfStats?.median ? Math.round(activeBien.dvfStats.median).toLocaleString('fr-FR') : null);
    const evolution = ctx.evolution || activeBien?.dvfStats?.evolution || null;
    const delaiMoyen = ctx.delaiMoyen || activeBien?.dvfStats?.delaiMoyen || null;

    // Step3 — comparables retenus
    const nbComps = Array.isArray(selComps) ? selComps.length : 0;

    return {
      // Step 1
      bienLine: bienParts.length ? bienParts.join(' · ') : null,
      adresse: adr.label || null,
      dpe: dpe ? String(dpe).toUpperCase() : null,
      etat: etat || null,
      // Step 2
      ville: villeLabel,
      prixM2Zone,
      evolution,
      delaiMoyen,
      // Step 3
      nbComps,
      // Step 4 (estimation calculée)
      prixM2Estim: priceRef.prixM2,
    };
  }, [activeBien, priceRef]);

  // Bornes du slider de prix : -17% / +27% autour du prix médian, arrondies au millier
  const sliderBounds = useMemo(() => {
    const median = priceRef.prixMedian;
    const min = Math.max(0, Math.round((median * 0.83) / 1000) * 1000);
    const max = Math.round((median * 1.27) / 1000) * 1000;
    return { min, max };
  }, [priceRef]);

  const [sliderValue, setSliderValue] = useState(priceRef.prixMedian);
  const [selectedStrategy, setSelectedStrategy] = useState(1);

  // Objectif de vente : délai souhaité par le vendeur (court / moyen / long
  // terme). Persisté dans le reportStore pour le compte rendu. Défaut « moyen ».
  const [objectifVente, setObjectifVente] = useState(
    () => getReportSection('objectifVente', 'moyen')
  );

  // Les sections de démonstration (comparables fictifs, biens similaires
  // simulés…) sont toujours affichées : le bouton de masquage a été retiré.
  const hideDemo = false;

  /* Largeurs (en %) redimensionnables au drag des poignées (inspiré de
   * Step3). Persistées dans reportStore.displayConfig.step5Cols.
   *  - topL : largeur de "Impact du prix" dans la rangée haute (le reste = Stratégie) */
  const persistedCols = useMemo(
    () => getReportSection('displayConfig', {}).step5Cols || null,
    []
  );
  const [topL, setTopL] = useState(() => persistedCols?.topL ?? 64);
  // Poignée active : 'top' (rangée haute) ou null
  const [activeHandle, setActiveHandle] = useState(null);
  const topRowRef = useRef(null);

  const clampPct = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* Drag générique : ref = conteneur, setter = state %, key = id de poignée.
   * On mappe la position X de la souris en % de la largeur du conteneur,
   * bornée à [lo, hi] pour garder les blocs lisibles. */
  const startResize = (e, ref, setter, key, lo = 25, hi = 75) => {
    e.preventDefault();
    setActiveHandle(key);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const handleMove = (mv) => {
      const pct = ((mv.clientX - rect.left) / rect.width) * 100;
      setter(clampPct(pct, lo, hi));
    };
    const handleUp = () => {
      setActiveHandle(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  /* Reset (double-clic) : rangée haute → 64/36 */
  const resetTop = () => setTopL(64);

  // Persiste la largeur dans reportStore.displayConfig
  useEffect(() => {
    mergeReportSection('displayConfig', { step5Cols: { topL } });
  }, [topL]);

  // Persistance dans le reportStore pour que CompteRendu (/report) puisse
  // afficher les valeurs saisies par l'utilisateur (prix retenu, stratégie
  // sélectionnée). Les points forts/vigilance + avis vendeur sont désormais
  // saisis à l'étape 1 (formulaire du bien cible).
  // Le prix retenu (persiste pour CompteRendu / Step4) suit le curseur de prix.
  useEffect(() => {
    if (Number.isFinite(sliderValue) && sliderValue > 0) {
      setReportState({ customPrice: sliderValue });
    }
  }, [sliderValue]);
  useEffect(() => {
    setReportState({ selectedStrategy });
  }, [selectedStrategy]);
  useEffect(() => {
    setReportState({ objectifVente });
  }, [objectifVente]);

  /* ---- Demand computation (matching HTML wireframe logic) ---- */
  // Mock acquéreur data (mode démo) — utilisé quand pas d'acquéreurs réels
  const mockAcquereurs = [
    { budgetMax: 330000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 310000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 295000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 350000, type: true, surface: true, loc: true, dpe: false },
    { budgetMax: 280000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 320000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 305000, type: true, surface: false, loc: true, dpe: true },
    { budgetMax: 340000, type: false, surface: true, loc: true, dpe: true },
    { budgetMax: 290000, type: true, surface: true, loc: true, dpe: false },
    { budgetMax: 375000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 260000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 315000, type: true, surface: true, loc: false, dpe: true },
    { budgetMax: 300000, type: true, surface: true, loc: true, dpe: false },
    { budgetMax: 270000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 325000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 355000, type: true, surface: true, loc: true, dpe: false },
    { budgetMax: 285000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 310000, type: true, surface: false, loc: true, dpe: false },
    { budgetMax: 340000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 265000, type: false, surface: true, loc: true, dpe: true },
    { budgetMax: 298000, type: true, surface: true, loc: true, dpe: false },
    { budgetMax: 360000, type: true, surface: true, loc: true, dpe: true },
    { budgetMax: 275000, type: true, surface: true, loc: true, dpe: true },
  ];

  // En mode live : on dérive les flags type/surface/loc/dpe à partir des critères
  // de chaque acquéreur réel vis-à-vis du bien actif. La loc est neutre par défaut
  // (pas de critère "communes" dans le schéma actuel).
  const liveAcquereurs = useMemo(() => {
    if (!hasRealLocation || realAcquereurs.length === 0) return [];
    const bien = activeBien?.bien || {};
    const bienType = bien.type || null;
    const bienSurface = Number(bien.surface);
    const bienDpeRank = bien.dpe ? (DPE_RANK_LOCAL[String(bien.dpe).toUpperCase()] || 0) : null;
    return realAcquereurs.map((a) => {
      const budgetMax = a.budgetMax != null ? Number(a.budgetMax) * 1000 : Infinity;
      const typeOk = !a.type || a.type === 'indifferent' || !bienType
        ? true
        : a.type === bienType;
      const surfaceOk = a.surfaceMin == null || !Number.isFinite(bienSurface)
        ? true
        : bienSurface >= a.surfaceMin;
      const dpeOk = !a.dpeMin || bienDpeRank == null
        ? true
        : bienDpeRank >= (DPE_RANK_LOCAL[a.dpeMin] || 0);
      return {
        budgetMax,
        type: typeOk,
        surface: surfaceOk,
        loc: true, // pas de critère localisation dans le schéma actuel
        dpe: dpeOk,
      };
    });
  }, [hasRealLocation, realAcquereurs, activeBien]);

  const acquereurs = hasRealLocation && liveAcquereurs.length > 0 ? liveAcquereurs : mockAcquereurs;
  const totalAcquereurs = acquereurs.length;

  let budgetMatch = 0, typeMatch = 0, surfMatch = 0, locMatch = 0, dpeMatch = 0;
  acquereurs.forEach((a) => {
    const passBudget = a.budgetMax >= sliderValue;
    if (passBudget) budgetMatch++;
    if (a.type) typeMatch++;
    if (a.surface) surfMatch++;
    if (a.loc) locMatch++;
    if (a.dpe) dpeMatch++;
  });

  /* ---- Biens similaires en vente : biens immo \u00e0 vendre actuellement dans la fourchette de prix ----
     Simulation : distribution gaussienne centr\u00e9e sur 300k\u20ac (mode du march\u00e9 zone),
     \u00e9cart-type 35k\u20ac. Le compteur affiche le nombre de biens \u00e9quivalents en concurrence
     directe \u00e0 \u00b15% du prix s\u00e9lectionn\u00e9.
  */
  const offresImmo = (() => {
    const center = 300000;
    const sigma = 35000;
    // densit\u00e9 gaussienne approxim\u00e9e
    const peak = 14; // pic max ~14 offres
    const lower = sliderValue * 0.95;
    const upper = sliderValue * 1.05;
    // somme discr\u00e8te de la densit\u00e9 sur la fourchette
    let sum = 0;
    for (let p = lower; p <= upper; p += 5000) {
      const v = peak * Math.exp(-Math.pow(p - center, 2) / (2 * sigma * sigma));
      sum += v;
    }
    return Math.max(1, Math.round(sum / 4));
  })();

  const ppm = Math.round(sliderValue / surface);
  // Le hero affiche les acquéreurs budget-compatibles (seul critère impacté par le prix).
  // À prix minimum, tous les acquéreurs de la zone sont potentiellement intéressés.
  const ratio = budgetMatch / totalAcquereurs;
  const budgetPct = Math.round((budgetMatch / totalAcquereurs) * 100);

  const demandColor = ratio >= 0.5 ? '#46B962' : ratio >= 0.25 ? '#f5a623' : '#e74c3c';

  /* ---- Tension du marché : nombre d'acheteurs budget-compatibles par bien en vente ----
     C'est la donnée la plus actionnable pour le vendeur. Seuils alignés sur
     la lecture métier "1 acheteur pour 1 bien = équilibre vendeur" :
       >= 1   → au moins 1 acheteur par bien → marché favorable au vendeur (vert)
       0,6–1  → marché équilibré (orange)
       < 0,6  → l'acheteur a le choix, marché favorable aux acquéreurs (rouge) */
  const tensionRatio = offresImmo > 0 ? budgetMatch / offresImmo : budgetMatch;
  const tensionLevel = tensionRatio >= 1 ? 'high' : tensionRatio >= 0.6 ? 'mid' : 'low';
  const tensionLabel = tensionLevel === 'high'
    ? 'March\u00e9 favorable au vendeur'
    : tensionLevel === 'mid'
      ? 'March\u00e9 \u00e9quilibr\u00e9'
      : 'March\u00e9 favorable aux acqu\u00e9reurs';
  const tensionRatioLabel = tensionRatio.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  // Labels du panneau crit\u00e8res : d\u00e9riv\u00e9s du bien actif en mode live,
  // statiques (wireframe) en d\u00e9mo. Pas de fake data en live.
  const typeLabelCrit = hasRealLocation && activeBien?.bien?.pieces
    ? `Cherchent un T${activeBien.bien.pieces}`
    : 'Cherchent un T3';
  const surfBienLive = Number(activeBien?.bien?.surface);
  const surfLabelCrit = hasRealLocation && Number.isFinite(surfBienLive) && surfBienLive > 0
    ? `Surface ${Math.round(surfBienLive * 0.85)}-${Math.round(surfBienLive * 1.15)}m\u00B2`
    : 'Surface 60-85m\u00B2';
  const surfDetailCrit = hasRealLocation && Number.isFinite(surfBienLive) && surfBienLive > 0
    ? `fourchette ${surfBienLive}m\u00B2`
    : 'fourchette 72.5m\u00B2';
  const locLabelCrit = hasRealLocation && activeBien?.adresse?.city
    ? `${activeBien.adresse.city} / proches`
    : 'Lyon 3 / proches';
  const locDetailCrit = hasRealLocation && activeBien?.adresse?.city
    ? activeBien.adresse.city
    : 'Lyon 3, 6, 7, 8';
  const dpeLabelCrit = hasRealLocation && activeBien?.bien?.dpe
    ? `Acceptent DPE ${String(activeBien.bien.dpe).toUpperCase()}`
    : 'Acceptent DPE D';
  const dpeDetailCrit = hasRealLocation && activeBien?.bien?.dpe
    ? `DPE ${String(activeBien.bien.dpe).toUpperCase()} ou sans filtre`
    : 'DPE D ou sans filtre';

  const criteriaData = [
    {
      id: 'budget', label: 'Budget compatible', value: budgetMatch,
      detail: `sur ${totalAcquereurs} dans la zone`,
      pct: Math.round((budgetMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4.5v7M6 6.2c0-.7.9-1.2 2-1.2s2 .5 2 1.2-.9 1.3-2 1.3-2 .5-2 1.3.9 1.2 2 1.2 2-.5 2-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      ),
    },
    {
      id: 'type', label: typeLabelCrit, value: typeMatch,
      detail: 'T3 ou T2-T4 flexible',
      pct: Math.round((typeMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4" stroke="currentColor" strokeWidth="1.3"/><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.2"/></svg>
      ),
    },
    {
      id: 'surface', label: surfLabelCrit, value: surfMatch,
      detail: surfDetailCrit,
      pct: Math.round((surfMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><path d="M2 14V4l5-2v12M9 6l5-2v12M2 14h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ),
    },
    {
      id: 'loc', label: locLabelCrit, value: locMatch,
      detail: locDetailCrit,
      pct: Math.round((locMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2"/></svg>
      ),
    },
    {
      id: 'dpe', label: dpeLabelCrit, value: dpeMatch,
      detail: dpeDetailCrit,
      pct: Math.round((dpeMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ),
    },
  ];

  const getCriteriaClass = (pct) => pct >= 60 ? 'match' : pct >= 35 ? 'partial' : 'low';

  // Verdict — basé sur le nombre d'acquéreurs budget-compatibles
  let verdictClass, verdictIcon, verdictTitle, verdictDesc;
  if (ratio >= 0.6) {
    verdictClass = 'good';
    verdictIcon = '\uD83D\uDFE2';
    verdictTitle = 'Forte ad\u00E9quation prix / demande';
    verdictDesc = `\u00C0 ${formatPrice(sliderValue)}, ${budgetMatch} acqu\u00E9reurs sur ${totalAcquereurs} ont le budget compatible (${budgetPct}%). Potentiel de mise en concurrence.`;
  } else if (ratio >= 0.35) {
    verdictClass = 'medium';
    verdictIcon = '\uD83D\uDFE0';
    verdictTitle = 'Ad\u00E9quation mod\u00E9r\u00E9e';
    verdictDesc = `\u00C0 ${formatPrice(sliderValue)}, ${budgetMatch} acqu\u00E9reurs sur ${totalAcquereurs} ont le budget compatible (${budgetPct}%). Le nombre d'acqu\u00E9reurs diminue, ce qui allonge le d\u00E9lai de vente estim\u00E9.`;
  } else if (ratio >= 0.1) {
    verdictClass = 'bad';
    verdictIcon = '\uD83D\uDD34';
    verdictTitle = 'Faible demande \u00E0 ce prix';
    verdictDesc = `\u00C0 ${formatPrice(sliderValue)}, seulement ${budgetMatch} acqu\u00E9reur${budgetMatch > 1 ? 's' : ''} sur ${totalAcquereurs} a${budgetMatch > 1 ? 'ient' : ''} le budget \u2014 risque de stagnation et n\u00E9gociation forte. Envisager un repositionnement prix.`;
  } else {
    verdictClass = 'bad';
    verdictIcon = '\uD83D\uDD34';
    verdictTitle = 'Aucun acqu\u00E9reur compatible';
    verdictDesc = `\u00C0 ${formatPrice(sliderValue)}, aucun acqu\u00E9reur n'a le budget. Ce prix est d\u00E9connect\u00E9 du march\u00E9 acqu\u00E9reur actuel.`;
  }

  /* ---- Strategy pricing ----
   * Le prix "Marche" (recommande) est FIXE : c'est la moyenne ponderee des
   * comparables (priceRef.prixMedian), il ne bouge pas avec le curseur.
   * Le curseur represente le prix de MISE EN VENTE choisi par l'agent ; les
   * strategies "Prudent" et "Agressif" sont des bornes calculees autour de ce
   * prix de mise en vente (-7 % / +7 %, arrondi au millier) et evoluent donc
   * en continu quand l'agent deplace le curseur. Seul le Marche reste fige.
   */
  const strategies = useMemo(() => {
    const round1k = (n) => Math.round(n / 1000) * 1000;
    const marche = round1k(priceRef.prixMedian);
    const base = sliderValue; // prix de mise en vente piloté par le curseur
    const descAggr = hasRealLocation
      ? 'Au-dessus du prix de mise en vente. Pour test d\u2019app\u00e9tence avec marge de n\u00e9gociation.'
      : 'Au-dessus du prix de mise en vente. Capitalise sur la tension forte.';
    const descMarche = hasRealLocation
      ? 'Valeur de march\u00e9 issue de la moyenne pond\u00e9r\u00e9e des comparables. R\u00e9f\u00e9rence fixe.'
      : 'Valeur de march\u00e9 de r\u00e9f\u00e9rence (moyenne pond\u00e9r\u00e9e des comparables).';
    const descPrudent = hasRealLocation
      ? 'En dessous du prix de mise en vente. Maximise la rapidit\u00e9 de transaction.'
      : 'En dessous du prix de mise en vente. Maximise la rapidit\u00e9.';
    return [
      { label: 'Agressif', prix: round1k(base * 1.07), description: descAggr, duration: 'Dur\u00e9e estim\u00e9e : 35-50 jours' },
      { label: 'March\u00e9', prix: marche, description: descMarche, duration: 'Dur\u00e9e estim\u00e9e : 40-55 jours', recommended: true, fixed: true },
      { label: 'Prudent', prix: round1k(base * 0.93), description: descPrudent, duration: 'Dur\u00e9e estim\u00e9e : 25-35 jours' },
    ];
  }, [hasRealLocation, sliderValue, priceRef]);

  /* ---- Couleur de position du prix ----
   * La fourchette de référence est issue du calcul d'estimation :
   *   - "prix marché" (recommandé) = priceRef.prixMedian
   *   - "prix agressif" = priceRef.prixMedian * 1.07 (borne haute conseillée)
   * Sous le prix marché → vert (sûr). Entre marché et agressif → orange
   * (on monte dans la fourchette). Au-dessus de l'agressif → rouge, de plus
   * en plus saturé à mesure que l'on s'éloigne (jusqu'à +20 % = rouge plein),
   * pour signaler visuellement la surcote. */
  const priceColor = useMemo(() => {
    const marche = priceRef.prixMedian;
    const agressif = marche * 1.07;
    const GREEN = '#46B962';
    const ORANGE = '#f5a623';
    if (!Number.isFinite(sliderValue) || marche <= 0) return GREEN;
    if (sliderValue <= marche) return GREEN;
    if (sliderValue <= agressif) {
      // dégradé vert → orange dans la fourchette conseillée
      const t = (sliderValue - marche) / (agressif - marche);
      return mixColor(GREEN, ORANGE, t);
    }
    // au-dessus de l'agressif : orange → rouge de plus en plus profond.
    // +0 % au-dessus = orange ; +20 % (et au-delà) = rouge foncé.
    const over = Math.min(1, (sliderValue - agressif) / (agressif * 0.20));
    return mixColor(ORANGE, '#b3160a', over);
  }, [priceRef, sliderValue]);
  // Au-dessus de l'agressif on bascule la classe de tension/verdict en rouge.
  const priceAboveAggressif = Number.isFinite(sliderValue) && sliderValue > priceRef.prixMedian * 1.07;

  // Indice de confiance dynamique en mode live :
  // moyenne pond\u00e9r\u00e9e entre la compl\u00e9tude du bien (10 champs cl\u00e9s)
  // et la disponibilit\u00e9 des comparables DVF (5 min = optimal).
  const confidenceScore = useMemo(() => {
    if (!hasRealLocation) return avisValeur.confiance;
    const bien = activeBien?.bien || {};
    const champs = ['type', 'surface', 'pieces', 'etat', 'dpe', 'etage', 'ascenseur', 'exposition', 'parking', 'exterieur'];
    const renseigne = champs.filter((k) => bien[k] != null && bien[k] !== '').length;
    const completude = (renseigne / champs.length) * 100;
    const nbComp = Array.isArray(activeBien?.dvfTopComparables) ? activeBien.dvfTopComparables.length : 0;
    const volumeScore = Math.min(100, (nbComp / 5) * 100);
    return Math.round((completude * 0.6) + (volumeScore * 0.4));
  }, [hasRealLocation, activeBien]);

  // Date de cr\u00e9ation du bien (mode live) : utilis\u00e9e dans la banni\u00e8re
  // d\u2019historique. En mode d\u00e9mo on garde la date factice du wireframe.
  const createdAtLabel = useMemo(() => {
    if (!hasRealLocation || !activeBien?.createdAt) return '25 mars 2026';
    const d = new Date(activeBien.createdAt);
    if (Number.isNaN(d.getTime())) return '25 mars 2026';
    const months = ['janvier', 'f\u00e9vrier', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'ao\u00fbt', 'septembre', 'octobre', 'novembre', 'd\u00e9cembre'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, [hasRealLocation, activeBien]);

  // R\u00e9f\u00e9rence d\u2019estimation pour la sauvegarde. En mode d\u00e9mo on garde
  // la r\u00e9f\u00e9rence factice du wireframe (LYN-2026-00847). En mode live on
  // d\u00e9rive depuis l\u2019id du bien stock\u00e9 dans activeBien (sous forme
  // IDR-YYYY-XXXXX). Stable entre re-renders.
  const estimationReference = useMemo(() => {
    if (!hasRealLocation) return 'LYN-2026-00847';
    const id = activeBien?.id || activeBien?.createdAt || Date.now();
    const year = new Date(activeBien?.createdAt || Date.now()).getFullYear();
    const tail = String(id).replace(/[^0-9]/g, '').slice(-5).padStart(5, '0');
    return `IDR-${year}-${tail}`;
  }, [hasRealLocation, activeBien]);

  return (
    <div className="step5-page">
      <style>{cssStyles}</style>
      <PropertyCard />
      <Stepper currentStep={5} />

      <div className="step5-section">
        {/* ============ R\u00c9CAPITULATIF DES \u00c9TAPES ============ */}
        {/* Synth\u00e8se de ce qui a \u00e9t\u00e9 d\u00e9fini avant d'arriver \u00e0 la fourchette de prix. */}
        <div className="recap-section">
          <div className="recap-head">
            <div className="recap-head-title">R&eacute;capitulatif de l&apos;&eacute;tude de march&eacute;</div>
            <div className="recap-head-sub">{heroDescription}</div>
          </div>

          <div className="recap-grid">
            {/* Step 1 — Le bien */}
            <div className="recap-card">
              <div className="recap-step-label">&#9312; Le bien</div>
              <div className="recap-card-main">{recapData.bienLine || '\u2014'}</div>
              {recapData.adresse && <div className="recap-card-line">{recapData.adresse}</div>}
              <div className="recap-card-tags">
                {recapData.dpe && <span className="recap-tag">DPE {recapData.dpe}</span>}
                {recapData.etat && <span className="recap-tag">{recapData.etat}</span>}
              </div>
            </div>

            {/* Step 2 — La zone / le marché local */}
            <div className="recap-card">
              <div className="recap-step-label">&#9313; March&eacute; local</div>
              <div className="recap-card-main">
                {recapData.prixM2Zone ? `${recapData.prixM2Zone} \u20ac/m\u00b2` : '\u2014'}
              </div>
              {recapData.ville && <div className="recap-card-line">{recapData.ville}</div>}
              <div className="recap-card-tags">
                {recapData.evolution && <span className="recap-tag">{recapData.evolution}</span>}
                {recapData.delaiMoyen && <span className="recap-tag">D&eacute;lai {recapData.delaiMoyen}</span>}
              </div>
            </div>

            {/* Step 3 — Comparables retenus */}
            <div className="recap-card">
              <div className="recap-step-label">&#9314; Comparables</div>
              <div className="recap-card-main">
                {recapData.nbComps > 0 ? `${recapData.nbComps} retenu${recapData.nbComps > 1 ? 's' : ''}` : '\u2014'}
              </div>
              <div className="recap-card-line">Biens de r&eacute;f&eacute;rence du secteur</div>
            </div>

            {/* Step 4 — Estimation calculée */}
            <div className="recap-card">
              <div className="recap-step-label">&#9315; Prix calcul&eacute; (/m&sup2;)</div>
              <div className="recap-card-main">{recapData.prixM2Estim.toLocaleString('fr-FR')} &euro;/m&sup2;</div>
              <div className="recap-card-line">Base de la fourchette ci-dessous</div>
            </div>

            {/* Objectif de vente — délai souhaité par le vendeur */}
            <div className="recap-card">
              <div className="recap-step-label">&#9316; Objectif de vente</div>
              <div className="objectif-choices">
                {OBJECTIF_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`objectif-chip${objectifVente === opt.value ? ' selected' : ''}`}
                    title={opt.label}
                    onClick={() => setObjectifVente(opt.value)}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============ RANG\u00c9E HAUTE : Impact du prix + Strat\u00e9gie ============ */}
        <div
          ref={topRowRef}
          className={`top-row${activeHandle === 'top' ? ' is-resizing' : ''}`}
          style={{ '--top-l': `${topL}%`, '--top-r': `${100 - topL}%` }}
        >
        {/* ---- Impact du prix sur la demande ---- */}
        <div className="demand-section">
          <div className="demand-header">
            <div>
              <div className="demand-title">Impact du prix sur la demande acqu&eacute;reurs</div>
              <div className="demand-subtitle">Croisement en temps r&eacute;el : budget, type, surface, localisation, DPE &mdash; {totalAcquereurs} acqu&eacute;reurs dans la zone</div>
            </div>
          </div>

          <div className="demand-hero-row">
            {!hideDemo ? (
              <div className="demand-lead-block">
                <div className="demand-lead-main">
                  <div className="demand-big-number" style={{ color: demandColor }}>{budgetMatch}</div>
                  <div className="demand-big-label">projets<br/>d&apos;achat</div>
                </div>
                <div className={`tension-note ${tensionLevel}`}>
                  <span className="tension-note-dot" />
                  <span className="tension-note-text">
                    <strong>{tensionRatioLabel}</strong> acheteur{tensionRatio >= 2 ? 's' : ''} pour 1 bien. {offresImmo} bien{offresImmo > 1 ? 's' : ''} en vente. {tensionLabel}.
                  </span>
                </div>
              </div>
            ) : (
              <div className="demand-big-wrap">
                <div className="demand-big-number" style={{ color: demandColor }}>{budgetMatch}</div>
                <div className="demand-big-label">projets<br/>d&apos;achat</div>
              </div>
            )}
            <div className="demand-gauge-wrap">
              <div className="demand-price-display" style={{ color: priceColor }}>
                {formatPrice(sliderValue)}
                <span className="price-perm">{ppm.toLocaleString('fr-FR')} &euro;/m&sup2;</span>
              </div>
              <div className="demand-slider-wrap">
                <input
                  type="range"
                  className="demand-slider"
                  min={sliderBounds.min}
                  max={sliderBounds.max}
                  step={1000}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                />
                <div className="demand-slider-labels">
                  <span>{sliderBounds.min.toLocaleString('fr-FR')} &euro;</span>
                  <span className="estimation-marker">&#9660; Estimation {Math.round(priceRef.prixMedian / 1000)}k</span>
                  <span>{sliderBounds.max.toLocaleString('fr-FR')} &euro;</span>
                </div>
              </div>
            </div>
          </div>

          <div className="demand-detail-grid">
            {criteriaData.map((c) => {
              const cls = getCriteriaClass(c.pct);
              return (
                <div key={c.id} className={`demand-criteria ${cls}`}>
                  <div className="demand-criteria-icon">{c.icon}</div>
                  <div className="demand-criteria-label">{c.label}</div>
                  <div className="demand-criteria-value">{c.value}</div>
                  <div className="demand-criteria-detail">{c.detail}</div>
                  <div className="demand-criteria-bar">
                    <div className="demand-criteria-fill" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`demand-verdict ${verdictClass}`}>
            <div className="demand-verdict-icon">{verdictIcon}</div>
            <div className="demand-verdict-text">
              <div className="demand-verdict-title">{verdictTitle}</div>
              <div className="demand-verdict-desc">{verdictDesc}</div>
            </div>
          </div>
        </div>
        {/* /demand-section */}

          {/* Poign\u00e9e : entre Impact du prix et Strat\u00e9gie */}
          <div
            className={`col-resize-handle${activeHandle === 'top' ? ' is-dragging' : ''}`}
            onMouseDown={(e) => startResize(e, topRowRef, setTopL, 'top')}
            onDoubleClick={resetTop}
            title="Glisser pour redimensionner \u00b7 double-clic pour r\u00e9initialiser"
          />

          {/* ---- Strat\u00e9gie de prix (communique avec l'impact du prix) ---- */}
          <div className="card strategy">
            <div className="card-title">Strat&eacute;gie de prix</div>
            {strategies.map((s, i) => {
              const isSelected = selectedStrategy === i;
              return (
                <div
                  key={i}
                  className={`strategy-option${isSelected ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedStrategy(i);
                    // Snap du curseur (= prix de mise en vente) sur une cible
                    // ANCREE au prix de marche fixe, pas sur le prix affiche de
                    // la strategie (qui suit deja le curseur) : evite l'effet de
                    // compounding (re-cliquer ne deplace plus la cible).
                    //  - Marche  -> prix de marche fixe
                    //  - Agressif -> marche +7 %
                    //  - Prudent  -> marche -7 %
                    const marche = priceRef.prixMedian;
                    const target =
                      s.label === 'Agressif' ? marche * 1.07
                      : s.label === 'Prudent' ? marche * 0.93
                      : marche;
                    const snapped = Math.round(target / 1000) * 1000;
                    const clamped = Math.min(sliderBounds.max, Math.max(sliderBounds.min, snapped));
                    setSliderValue(clamped);
                  }}
                >
                  <div className="strategy-header-row">
                    <div className="strategy-radio">
                      <div className="strategy-radio-inner" />
                    </div>
                    <span className="strategy-name">
                      {s.label} &mdash;{' '}
                      <span style={isSelected ? { color: priceColor } : undefined}>{formatPrice(s.prix)}</span>
                    </span>
                  </div>
                  <div className="strategy-desc">{s.description}</div>
                  {confidenceScore >= 90 && (
                    <div className="strategy-duration">&#128197; {s.duration}</div>
                  )}
                  {s.recommended && <div className="badge-rec">&#10003; Recommand&eacute;</div>}
                  {isSelected && priceAboveAggressif && (
                    <div className="strategy-overcote">&#9888; Au-dessus du prix agressif &mdash; surcote, risque commercial &eacute;lev&eacute;</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* /top-row */}

        {/* ============ ACTIONS ============ */}
        <div className="content-grid single-col">
          {/* --- Actions --- */}
          <div className="content-grid-col">
            <div className="card">
              <div className="card-title">Actions</div>
              <div className="actions-card">
                <button className="action-btn secondary" onClick={() => {
                  const estimations = JSON.parse(localStorage.getItem('ideeri_estimations') || '[]');
                  // Snapshot des comparables s\u00e9lectionn\u00e9s (Step3) pour permettre
                  // la comparaison V1 vs V2 \u00e0 la prochaine \u00e9tude du m\u00eame bien.
                  // On ne garde que les champs n\u00e9cessaires (id, adresse, coords,
                  // source, prix, m2, surface, weight) pour limiter le poids.
                  const rs = getReportState();
                  const comparablesSnapshot = Array.isArray(rs.comparablesSelectionnes)
                    ? rs.comparablesSelectionnes.map((c) => ({
                        id: c.id,
                        title: c.title,
                        addr: c.addr,
                        coords: c.coords,
                        source: c.source,
                        prix: c.prix,
                        prixM2: c.prixM2,
                        surface: c.fields?.surface ?? c._dvfRaw?.surface,
                        pieces: c.fields?.pieces ?? c._dvfRaw?.pieces,
                        weight: rs.comparablesConfig?.weights?.[c.id],
                      }))
                    : [];
                  const nowIso = new Date().toISOString();
                  // Mode d\u00e9mo : payload statique du wireframe.
                  // Mode live : payload d\u00e9riv\u00e9 du bien actif (zero fake data).
                  const payload = hasRealLocation
                    ? {
                        id: Date.now(),
                        reference: estimationReference,
                        adresse: activeBien?.adresse?.label || '',
                        description: heroDescription,
                        agent: '',
                        date: new Date().toLocaleDateString('fr-FR'),
                        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                        snapshotDate: nowIso,
                        statut: 'sauvegarde',
                        prix: formatPrice(priceRef.prixMedian),
                        comparables: comparablesSnapshot,
                      }
                    : {
                        id: Date.now(),
                        reference: 'LYN-2026-00847',
                        adresse: '12 rue des Lilas, 69003 Lyon',
                        description: 'Appartement T3, 72.5 m\u00b2',
                        agent: 'Marie Dupont',
                        date: new Date().toLocaleDateString('fr-FR'),
                        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                        snapshotDate: nowIso,
                        statut: 'sauvegarde',
                        prix: '300 000 \u20ac',
                        comparables: comparablesSnapshot,
                      };
                  const exists = estimations.find((e) => e.reference === payload.reference);
                  if (!exists) {
                    estimations.unshift(payload);
                  } else {
                    exists.date = payload.date;
                    exists.heure = payload.heure;
                    exists.snapshotDate = nowIso;
                    exists.adresse = payload.adresse;
                    exists.description = payload.description;
                    exists.prix = payload.prix;
                    exists.comparables = comparablesSnapshot;
                  }
                  localStorage.setItem('ideeri_estimations', JSON.stringify(estimations));
                  navigate('/');
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: '-2px', marginRight: '6px' }}>
                    <path d="M13 11v3H3v-3M5 7l3 3 3-3M8 2v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sauvegarder l&apos;&eacute;tude de march&eacute;
                  <span className="btn-sub">Enregistre toutes les donn&eacute;es collect&eacute;es et analyses</span>
                </button>
                <button className="action-btn primary" onClick={() => navigate('/report')}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: '-2px', marginRight: '6px' }}>
                    <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                    <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  G&eacute;n&eacute;rer un compte rendu d&apos;estimation
                  <span className="btn-sub">R&eacute;sum&eacute; de l&apos;&eacute;tude de march&eacute; et avis de valeur</span>
                </button>
                <button className="action-btn primary" onClick={() => navigate('/avis-valeur')}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: '-2px', marginRight: '6px' }}>
                    <path d="M9 1H3.5A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V6L9 1z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                    <path d="M9 1v5h5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                  </svg>
                  G&eacute;n&eacute;rer le document avis de valeur
                  <span className="btn-sub">Document PDF officiel &agrave; remettre au propri&eacute;taire</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============ HISTORY BANNER ============ */}
        <div className="history-banner">
          &#128203; Ceci est la <strong>&nbsp;V1&nbsp;</strong> de l&apos;estimation &middot; Cr&eacute;&eacute;e le <strong>&nbsp;{createdAtLabel}&nbsp;</strong> &middot; Aucune version pr&eacute;c&eacute;dente
        </div>

        {/* ============ FOOTER ============ */}
        <div className="footer-buttons">
          <button className="btn btn-ghost" onClick={() => navigate('/step/4')}>
            &larr; &Eacute;tape pr&eacute;c&eacute;dente : Tension march&eacute;
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/mandat')}>
            Passer au mandat &rarr;
          </button>
        </div>

        {/* ============ PLANIFICATEUR DE RENDEZ-VOUS (apr\u00e8s le mandat) ============ */}
        <RdvPlanner />
      </div>
    </div>
  );
}
