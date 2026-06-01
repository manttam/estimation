import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { avisValeur } from '../data/propertyData';
import { getActiveBien } from '../utils/activeBien';
import { getAcquereurs } from '../utils/acquereursStore';
import { setReportState, mergeReportSection, getReportSection, getReportState } from '../utils/reportStore';

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

  .step5-section {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* ---- Hero Section ---- */
  .hero-section {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 32px 24px;
    margin-bottom: 14px;
    text-align: center;
    position: relative;
  }
  .hero-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #bbb;
    letter-spacing: 0.5px;
    margin-bottom: 20px;
  }
  /* Bouton "Masquer la démo" en mode live */
  .hide-demo-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #555;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .hide-demo-toggle:hover {
    background: #f0f0f0;
    border-color: #c0c0c0;
  }
  .hide-demo-toggle.active {
    background: #fff7e6;
    border-color: #ffd591;
    color: #d46b08;
  }
  .hero-prices {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    margin-bottom: 20px;
  }
  .price-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .price-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #bbb;
    letter-spacing: 0.5px;
  }
  .price-low {
    font-size: 20px;
    font-weight: 600;
    color: #bbb;
  }
  .price-main {
    font-size: 44px;
    font-weight: 700;
    color: var(--green);
    line-height: 1;
  }
  .price-high {
    font-size: 20px;
    font-weight: 600;
    color: #bbb;
  }
  .price-meta {
    font-size: 12px;
    color: #666;
    margin-bottom: 20px;
  }
  .price-meta-item {
    display: inline-block;
    margin: 0 16px;
  }
  .confidence-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-top: 8px;
  }
  .confidence-gauge {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
  }
  .confidence-text {
    text-align: left;
  }
  .confidence-number {
    font-size: 28px;
    font-weight: 700;
    color: var(--green);
  }
  .confidence-label {
    font-size: 10px;
    color: #888;
    font-weight: 600;
    text-transform: uppercase;
  }
  .confidence-details {
    font-size: 10px;
    color: #888;
    margin-top: 4px;
    line-height: 1.4;
  }

  /* ---- Demand Section ---- */
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
  .demand-big-number.offers {
    color: var(--blue);
  }
  .demand-vs {
    font-size: 14px;
    font-weight: 600;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 1px;
    align-self: center;
    margin-top: -10px;
  }
  .demand-big-label {
    font-size: 11px;
    color: #666;
    text-align: center;
    margin-top: 2px;
  }
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
   * 3 colonnes + 2 poignées en mode démo, 2 colonnes + 1 poignée en
   * mode "Masquer la démo". Largeurs pilotées par les CSS vars --col-N. */
  .content-grid {
    display: grid;
    grid-template-columns:
      minmax(0, var(--col-1, 40%))
      8px
      minmax(0, var(--col-2, 30%))
      8px
      minmax(0, var(--col-3, 30%));
    gap: 0;
    margin-bottom: 14px;
    align-items: start;
  }
  .content-grid.two-col {
    grid-template-columns:
      minmax(0, var(--col-2, 50%))
      8px
      minmax(0, var(--col-3, 50%));
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
  /* ---- Avis du vendeur (saisie libre) ---- */
  .seller-opinion-input {
    width: 100%;
    box-sizing: border-box;
    min-height: 90px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fafbfd;
    font-family: var(--font);
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    resize: vertical;
    transition: border-color 0.15s, background 0.15s;
  }
  .seller-opinion-input:hover {
    border-color: #cfd6e4;
  }
  .seller-opinion-input:focus {
    outline: none;
    border-color: #6c8cd5;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(108,140,213,0.12);
  }
  .seller-opinion-input::placeholder {
    color: #b5b5b5;
    font-style: italic;
  }
  .seller-opinion-meta {
    margin-top: 6px;
    font-size: 10px;
    color: #999;
    text-align: right;
  }
  .card-title {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 12px;
    color: #333;
  }
  .card-title-hint {
    font-size: 10px;
    color: #bbb;
    font-weight: 400;
  }

  /* ---- Decomposition ---- */
  .decomp-step {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f5f5f5;
    font-size: 12px;
  }
  .decomp-step:last-of-type { border-bottom: none; }
  .decomp-label {
    color: var(--text);
    font-weight: 500;
  }
  .decomp-value {
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }
  .decomp-value.pos { color: var(--green); }
  .decomp-value.neg { color: var(--red); }
  .decomp-detail {
    font-size: 10px;
    color: #666;
    padding: 2px 0 2px 14px;
    border-left: 2px solid #f0f0f0;
  }
  .decomp-divider {
    border-top: 2px solid var(--text);
    margin: 12px 0;
    padding-top: 12px;
  }
  .decomp-final {
    font-size: 13px;
    font-weight: 700;
  }
  .decomp-final-value {
    font-size: 16px;
    color: var(--green);
    font-weight: 700;
  }
  .decomp-range {
    font-size: 10px;
    color: #666;
    margin-top: 4px;
  }

  /* ---- Comparables Table ---- */
  .comp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: 12px;
  }
  .comp-table th {
    background: #f9f9f9;
    padding: 6px;
    text-align: left;
    font-weight: 600;
    color: #bbb;
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    text-transform: uppercase;
  }
  .comp-table td {
    padding: 6px;
    border-bottom: 1px solid #f5f5f5;
  }
  .comp-table .total td {
    font-weight: 600;
    background: #f9f9f9;
    border-top: 1px solid var(--border);
  }

  /* ---- List Items (Strengths / Weaknesses) ---- */
  .list-item {
    display: flex;
    gap: 8px;
    padding: 6px 0;
    font-size: 12px;
    color: var(--text);
    align-items: flex-start;
    position: relative;
  }
  .list-icon {
    font-size: 14px;
    flex-shrink: 0;
    opacity: 0.85;
  }
  .item-text {
    flex: 1;
    font-size: 12px;
    color: #333;
  }
  .item-text[contenteditable="true"] {
    outline: none;
    border-bottom: 1px dashed var(--green);
    padding-bottom: 1px;
  }
  .item-actions {
    display: none;
    gap: 4px;
    align-items: center;
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .list-item:hover .item-actions {
    display: flex;
  }
  .item-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #bbb;
    transition: all 0.15s;
  }
  .item-btn:hover {
    border-color: var(--green);
    color: var(--green);
    background: #f0fdf4;
  }
  .item-btn.delete:hover {
    border-color: var(--red);
    color: var(--red);
    background: #fef2f2;
  }
  .add-item-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    margin-top: 8px;
    border-radius: 6px;
    border: 1px dashed #ddd;
    background: transparent;
    cursor: pointer;
    font-size: 11px;
    color: #666;
    transition: all 0.2s;
    width: 100%;
    font-family: var(--font);
  }
  .add-item-btn:hover {
    border-color: var(--green);
    color: var(--green);
    background: rgba(29,186,110,0.03);
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
  .custom-input {
    width: 100%;
    margin-top: 10px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    font-family: 'Courier New', monospace;
    box-sizing: border-box;
    outline: none;
  }
  /* ---- Actions Card ---- */
  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }
  .action-btn {
    padding: 12px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 12px;
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
    font-size: 10px;
    opacity: 0.85;
    margin-top: 2px;
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

  // Prix de référence : depuis activeBien.result si dispo, sinon mock avisValeur
  const priceRef = useMemo(() => {
    if (hasRealLocation && activeBien?.result?.prix) {
      const prix = Number(activeBien.result.prix);
      const prixBas = Number(activeBien.result.prixBas) || Math.round(prix * 0.93);
      const prixHaut = Number(activeBien.result.prixHaut) || Math.round(prix * 1.07);
      return { prixMedian: prix, prixBas, prixHaut, prixM2: Math.round(prix / surface) };
    }
    return {
      prixMedian: avisValeur.prixMedian,
      prixBas: avisValeur.prixBas,
      prixHaut: avisValeur.prixHaut,
      prixM2: avisValeur.prixM2,
    };
  }, [activeBien, hasRealLocation, surface]);

  // Description hero : "Appartement T3 · 72m² · Lyon 3ème · 4ème étage"
  const heroDescription = useMemo(() => {
    return describeBien(activeBien) || 'Appartement T3 · 72.5m² · Lyon 3ème · 4ème étage';
  }, [activeBien]);

  // Décomposition de l'estimation en mode live : prix m² de base + ajustements
  // breakdown = array de { label, coef } (coef = 1.0 -> neutre, 1.05 -> +5%, 0.95 -> -5%)
  const breakdownLive = useMemo(() => {
    if (!hasRealLocation || !activeBien?.result?.breakdown) return null;
    return {
      prixM2Base: Number(activeBien.result.prixM2Base) || 0,
      coef: Number(activeBien.result.coef) || 1,
      breakdown: Array.isArray(activeBien.result.breakdown) ? activeBien.result.breakdown : [],
    };
  }, [activeBien, hasRealLocation]);

  // Comparables DVF : top 10 transactions du quartier persistées dans activeBien
  const comparablesLive = useMemo(() => {
    if (!hasRealLocation || !Array.isArray(activeBien?.dvfTopComparables)) return [];
    return activeBien.dvfTopComparables.slice(0, 5).map((c, i) => {
      const adresse = c.adresse || c.nom_voie || c.address || `Transaction #${i + 1}`;
      const prixM2 = Number(c.prix_m2 || c.prixM2 || (c.valeur_fonciere && c.surface_reelle_bati
        ? c.valeur_fonciere / c.surface_reelle_bati : 0));
      return { adresse, prixM2: Math.round(prixM2) };
    }).filter((c) => c.prixM2 > 0);
  }, [activeBien, hasRealLocation]);

  // Moyenne pondérée des comparables (pondération uniforme pour l'instant)
  const comparablesAvg = useMemo(() => {
    if (comparablesLive.length === 0) return 0;
    const sum = comparablesLive.reduce((acc, c) => acc + c.prixM2, 0);
    return Math.round(sum / comparablesLive.length);
  }, [comparablesLive]);

  // Bornes du slider de prix : -17% / +27% autour du prix médian, arrondies au millier
  const sliderBounds = useMemo(() => {
    const median = priceRef.prixMedian;
    const min = Math.max(0, Math.round((median * 0.83) / 1000) * 1000);
    const max = Math.round((median * 1.27) / 1000) * 1000;
    return { min, max };
  }, [priceRef]);

  // Points forts / vigilance auto-générés à partir des caractéristiques du bien
  // (mode live uniquement). Heuristiques simples sur DPE, étage, ascenseur,
  // exposition, parking, extérieur, état, année de construction.
  // En mode démo : on garde les listes statiques d'avisValeur.
  // En mode live : on génère depuis le bien ; si rien n'est généré, listes
  // vides (l'utilisateur ajoute ses propres points). Aucune donnée fake.
  const autoPoints = useMemo(() => {
    if (!hasRealLocation) {
      return { forts: avisValeur.pointsForts, vigilance: avisValeur.pointsVigilance };
    }
    if (!activeBien?.bien) {
      return { forts: [], vigilance: [] };
    }
    const bien = activeBien.bien;
    const forts = [];
    const vigilance = [];

    // DPE
    const dpe = bien.dpe ? String(bien.dpe).toUpperCase() : null;
    if (dpe && ['A', 'B', 'C'].includes(dpe)) {
      forts.push(`DPE ${dpe} — bien performant énergétiquement`);
    } else if (dpe && ['F', 'G'].includes(dpe)) {
      vigilance.push(`DPE ${dpe} — passoire thermique (interdiction de location 2025/2028)`);
    } else if (dpe === 'E') {
      vigilance.push(`DPE E — interdiction de location prévue en 2034`);
    }

    // Étage + ascenseur (appartement)
    if (bien.type === 'appartement') {
      if (bien.etage != null && bien.etage !== '') {
        const e = Number(bien.etage);
        if (e === 0) vigilance.push('Rez-de-chaussée — vis-à-vis et sécurité à anticiper');
        else if (e >= 6 && !bien.ascenseur) vigilance.push(`${e}e étage sans ascenseur — frein commercial fort`);
        else if (e >= 3 && bien.ascenseur) forts.push(`${e}e étage avec ascenseur — vue dégagée et confort`);
      }
    }

    // Exposition
    if (bien.exposition && /sud/i.test(bien.exposition)) {
      forts.push(`Exposition ${bien.exposition.replace('_', '-')} — luminosité optimale`);
    } else if (bien.exposition === 'nord') {
      vigilance.push('Exposition nord — luminosité réduite');
    }

    // Extérieur
    if (bien.exterieur === 'jardin') forts.push('Jardin — atout différenciant rare en zone urbaine');
    else if (bien.exterieur === 'terrasse') forts.push('Terrasse — extérieur très recherché');
    else if (bien.exterieur === 'balcon') forts.push('Balcon — extérieur appréciable');
    else if (bien.exterieur === 'aucun' && bien.type === 'appartement') {
      vigilance.push('Absence d\u2019extérieur — frein post-Covid');
    }

    // Parking
    if (bien.parking === 'box') forts.push('Box / garage fermé — valorise le bien (+5%)');
    else if (bien.parking === 'place') forts.push('Place de parking — confort apprécié en centre-ville');
    else if (bien.parking === 'aucun') vigilance.push('Pas de stationnement — frein dans certains quartiers');

    // État
    if (bien.etat === 'neuf') forts.push('État neuf — aucun travaux à prévoir');
    else if (bien.etat === 'refait') forts.push('Récemment rénové — prêt à emménager');
    else if (bien.etat === 'a_renover') vigilance.push('À rénover — anticiper budget travaux');
    else if (bien.etat === 'a_reconstruire') vigilance.push('À reconstruire — projet lourd, public restreint');

    // Année
    if (bien.annee) {
      const a = Number(bien.annee);
      if (a >= 2010) forts.push(`Construction ${a} — récent, normes thermiques actuelles`);
      else if (a < 1948) vigilance.push(`Construction ${a} — ancien, vigilance sur structure et isolation`);
    }

    // Mode live : on retourne ce qu'on a trouvé (peut être vide).
    // L'utilisateur ajoutera ses propres points si besoin.
    return { forts, vigilance };
  }, [activeBien, hasRealLocation]);

  const [sliderValue, setSliderValue] = useState(priceRef.prixMedian);
  const [selectedStrategy, setSelectedStrategy] = useState(1);
  const [pointsForts, setPointsForts] = useState(autoPoints.forts);
  const [pointsVigilance, setPointsVigilance] = useState(autoPoints.vigilance);
  const [customPrice, setCustomPrice] = useState(String(priceRef.prixMedian));

  // Avis du vendeur : zone de texte libre saisie manuellement par l'agent
  // pendant le RDV pour capter la perception / le ressenti du propriétaire
  // sur son bien (prix espéré, motivation, points qu'il souligne…).
  // Hydratation depuis le reportStore pour persister entre les sessions.
  const persistedAvisVendeur = useMemo(() => {
    const state = getReportState();
    return typeof state.avisVendeur === 'string' ? state.avisVendeur : '';
  }, []);
  const [avisVendeur, setAvisVendeur] = useState(persistedAvisVendeur);

  // Toggle "Masquer la démo" en mode live (pour cacher éléments fictifs)
  // Hydratation depuis le reportStore.displayConfig pour conserver la
  // préférence agent au refresh.
  const persistedDisplay = useMemo(() => getReportSection('displayConfig', {}), []);
  const [hideDemo, setHideDemo] = useState(
    typeof persistedDisplay.hideDemo === 'boolean' ? persistedDisplay.hideDemo : false
  );

  // Persiste les flags d'affichage dans le reportStore pour que la page
  // CompteRendu puisse masquer/afficher les sections correspondantes.
  useEffect(() => {
    mergeReportSection('displayConfig', { hideDemo });
  }, [hideDemo]);

  /* Largeurs (en %) des 3 colonnes du content-grid, redimensionnables au
   * drag des poignées entre colonnes (inspiré de Step3). Persistées dans
   * reportStore.displayConfig.step5Cols pour conserver la disposition. */
  const persistedCols = useMemo(
    () => getReportSection('displayConfig', {}).step5Cols || null,
    []
  );
  const [colWidths, setColWidths] = useState(() => ({
    c1: persistedCols?.c1 ?? 40,
    c2: persistedCols?.c2 ?? 30,
    c3: persistedCols?.c3 ?? 30,
  }));
  // Poignée active en cours de drag (1 = entre col1/col2, 2 = entre col2/col3)
  const [activeHandle, setActiveHandle] = useState(null);
  const gridRef = useRef(null);

  /* Bornes min/max (en %) — évite qu'une colonne soit trop écrasée. */
  const COL_BOUNDS = useMemo(() => ({
    c1: [22, 60],
    c2: [22, 55],
    c3: [22, 55],
  }), []);

  const clampPct = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

  /* Démarre le drag d'une poignée (idx = 1 ou 2). Attache mousemove/mouseup
   * globaux puis les retire au mouseup. Pas de carte Leaflet ici → pas
   * besoin d'invalidateSize. */
  const startResize = (e, idx) => {
    e.preventDefault();
    setActiveHandle(idx);
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;

    const handleMove = (mv) => {
      const ratio = ((mv.clientX - rect.left) / rect.width) * 100;
      setColWidths((prev) => {
        if (idx === 1) {
          // Handle entre col1 et col2 : ratio = bord droit de col1
          const newC1 = clampPct(ratio, COL_BOUNDS.c1);
          const newC2 = clampPct(100 - newC1 - prev.c3, COL_BOUNDS.c2);
          return { c1: 100 - newC2 - prev.c3, c2: newC2, c3: prev.c3 };
        }
        // idx === 2 — Handle entre col2 et col3 : ratio = bord droit de col2
        const newC3 = clampPct(100 - ratio, COL_BOUNDS.c3);
        const newC2 = clampPct(100 - prev.c1 - newC3, COL_BOUNDS.c2);
        return { c1: prev.c1, c2: newC2, c3: 100 - prev.c1 - newC2 };
      });
    };
    const handleUp = () => {
      setActiveHandle(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  /* En mode "Masquer la démo" col1 disparaît → on redimensionne col2/col3
   * uniquement. ratio = bord droit de col2 dans la zone des 2 colonnes. */
  const startResize2 = (e) => {
    e.preventDefault();
    setActiveHandle(2);
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const handleMove = (mv) => {
      const pct = ((mv.clientX - rect.left) / rect.width) * 100;
      const total = colWidths.c2 + colWidths.c3;
      setColWidths((prev) => {
        const newC2 = clampPct(pct, [22, total - 22]);
        return { ...prev, c2: newC2, c3: total - newC2 };
      });
    };
    const handleUp = () => {
      setActiveHandle(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  /* Reset des largeurs (double-clic sur une poignée → 40/30/30) */
  const resetCols = () => setColWidths({ c1: 40, c2: 30, c3: 30 });

  // Persiste les largeurs dans reportStore.displayConfig
  useEffect(() => {
    mergeReportSection('displayConfig', { step5Cols: colWidths });
  }, [colWidths]);

  // Persistance dans le reportStore pour que CompteRendu (/report) puisse
  // afficher les valeurs saisies par l'utilisateur (points forts/vigilance
  // édités, prix retenu, stratégie sélectionnée).
  useEffect(() => {
    setReportState({ pointsForts });
  }, [pointsForts]);
  useEffect(() => {
    setReportState({ pointsVigilance });
  }, [pointsVigilance]);
  useEffect(() => {
    const n = Number(customPrice);
    if (Number.isFinite(n) && n > 0) setReportState({ customPrice: n });
  }, [customPrice]);
  useEffect(() => {
    setReportState({ selectedStrategy });
  }, [selectedStrategy]);
  useEffect(() => {
    setReportState({ avisVendeur });
  }, [avisVendeur]);

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

  /* ---- Offres concurrentes : biens immo \u00e0 vendre actuellement dans la fourchette de prix ----
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
   * En mode démo : valeurs fixes du wireframe.
   * En mode live : dérivées de priceRef.
   *   - Agressif = prixHaut (haut de fourchette)
   *   - Marché   = prixMedian (recommandé)
   *   - Prudent  = prixBas (bas de fourchette)
   */
  const strategies = useMemo(() => {
    if (!hasRealLocation) {
      return [
        { label: 'Agressif', prix: 310000, description: 'Haut de fourchette. Capitalise sur la tension forte.', duration: 'Dur\u00E9e estim\u00E9e: 35-50 jours' },
        { label: 'March\u00E9', prix: 300000, description: '\u00C9quilibre valorisation et liquidit\u00E9.', duration: 'Dur\u00E9e estim\u00E9e: 40-55 jours', recommended: true },
        { label: 'Prudent', prix: 285000, description: 'Bas de fourchette. Maximise la rapidit\u00E9.', duration: 'Dur\u00E9e estim\u00E9e: 25-35 jours' },
      ];
    }
    return [
      { label: 'Agressif', prix: priceRef.prixHaut, description: 'Haut de fourchette. Pour test d\u2019app\u00e9tence avec marge de n\u00e9gociation.', duration: 'Dur\u00e9e estim\u00e9e : 35-50 jours' },
      { label: 'March\u00e9', prix: priceRef.prixMedian, description: '\u00c9quilibre valorisation / liquidit\u00e9. Aligne le bien sur la m\u00e9diane march\u00e9.', duration: 'Dur\u00e9e estim\u00e9e : 40-55 jours', recommended: true },
      { label: 'Prudent', prix: priceRef.prixBas, description: 'Bas de fourchette. Maximise la rapidit\u00e9 de transaction.', duration: 'Dur\u00e9e estim\u00e9e : 25-35 jours' },
    ];
  }, [hasRealLocation, priceRef]);

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

  const confidenceCompletude = useMemo(() => {
    if (!hasRealLocation) return 64;
    const bien = activeBien?.bien || {};
    const champs = ['type', 'surface', 'pieces', 'etat', 'dpe', 'etage', 'ascenseur', 'exposition', 'parking', 'exterieur'];
    const renseigne = champs.filter((k) => bien[k] != null && bien[k] !== '').length;
    return Math.round((renseigne / champs.length) * 100);
  }, [hasRealLocation, activeBien]);

  const confidenceVolume = useMemo(() => {
    if (!hasRealLocation) return 'Volume zone';
    const nb = Array.isArray(activeBien?.dvfTopComparables) ? activeBien.dvfTopComparables.length : 0;
    return `${nb} comparable${nb > 1 ? 's' : ''}`;
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

  /* list helpers */
  const addPointFort = () =>
    setPointsForts((prev) => [...prev, 'Nouveau point\u2026']);
  const addPointVigilance = () =>
    setPointsVigilance((prev) => [...prev, 'Nouveau point\u2026']);
  const removePointFort = (idx) =>
    setPointsForts((prev) => prev.filter((_, i) => i !== idx));
  const removePointVigilance = (idx) =>
    setPointsVigilance((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="step5-page">
      <style>{cssStyles}</style>
      <PropertyCard />
      <Stepper currentStep={5} />

      <div className="step5-section">
        {/* ============ HERO SECTION ============ */}
        <div className="hero-section">
          {hasRealLocation && (
            <button
              type="button"
              className={`hide-demo-toggle${hideDemo ? ' active' : ''}`}
              onClick={() => setHideDemo((v) => !v)}
              title={hideDemo ? 'R\u00e9afficher les sections d\u00e9mo (comparables, offres concurrentes\u2026)' : 'Masquer les sections d\u00e9mo (comparables fictifs, offres concurrentes simul\u00e9es\u2026)'}
            >
              <span aria-hidden="true">{hideDemo ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDEAB'}</span>
              {hideDemo ? ' R\u00e9afficher la d\u00e9mo' : ' Masquer la d\u00e9mo'}
            </button>
          )}
          <div className="hero-label">
            ESTIMATION &mdash; {heroDescription}
          </div>
          <div className="hero-prices">
            <div className="price-item">
              <div className="price-label">Fourchette basse</div>
              <div className="price-low">{formatPrice(priceRef.prixBas)}</div>
            </div>
            <div className="price-item">
              <div className="price-main">{formatPrice(priceRef.prixMedian)}</div>
            </div>
            <div className="price-item">
              <div className="price-label">Fourchette haute</div>
              <div className="price-high">{formatPrice(priceRef.prixHaut)}</div>
            </div>
          </div>
          <div className="price-meta">
            <span className="price-meta-item"><strong>{priceRef.prixM2.toLocaleString('fr-FR')} &euro;/m&sup2;</strong></span>
          </div>
          <div className="confidence-wrap">
            <svg className="confidence-gauge" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#eee" strokeWidth="10"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#46B962" strokeWidth="10"
                strokeDasharray="245" strokeDashoffset="54"
                strokeLinecap="round"/>
              <circle cx="60" cy="60" r="38" fill="white"/>
            </svg>
            <div className="confidence-text">
              <div className="confidence-number">{confidenceScore}</div>
              <div className="confidence-label">Indice de confiance</div>
              <div className="confidence-details">
                Compl&eacute;tude {confidenceCompletude}% &times; {confidenceVolume}
              </div>
            </div>
          </div>
        </div>

        {/* ============ DEMAND vs PRICE SLIDER ============ */}
        <div className="demand-section">
          <div className="demand-header">
            <div>
              <div className="demand-title">Impact du prix sur la demande acqu&eacute;reurs</div>
              <div className="demand-subtitle">Croisement en temps r&eacute;el : budget, type, surface, localisation, DPE &mdash; {totalAcquereurs} acqu&eacute;reurs dans la zone</div>
            </div>
          </div>

          <div className="demand-hero-row">
            <div className="demand-big-wrap">
              <div className="demand-big-number" style={{ color: demandColor }}>{budgetMatch}</div>
              <div className="demand-big-label">projets<br/>d&apos;achat</div>
            </div>
            {!hideDemo && (
              <>
                <div className="demand-vs">vs</div>
                <div className="demand-big-wrap">
                  <div className="demand-big-number offers">{offresImmo}</div>
                  <div className="demand-big-label">offres<br/>concurrentes</div>
                </div>
              </>
            )}
            <div className="demand-gauge-wrap">
              <div className="demand-price-display">
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

        {/* ============ THREE-COLUMN GRID (redimensionnable) ============ */}
        <div
          ref={gridRef}
          className={`content-grid${hideDemo ? ' two-col' : ''}${activeHandle ? ' is-resizing' : ''}`}
          style={{
            '--col-1': `${colWidths.c1}%`,
            '--col-2': `${colWidths.c2}%`,
            '--col-3': `${colWidths.c3}%`,
          }}
        >
          {/* --- Column 1: Decomposition + Comparables (mock — masqu\u00e9 en mode "Masquer la d\u00e9mo") --- */}
          {!hideDemo && (
          <div className="content-grid-col">
            <div className="card">
              <div className="card-title">Avis de valeur</div>
              {hasRealLocation ? (
                breakdownLive ? (
                  <>
                    <div className="decomp-step">
                      <span className="decomp-label">1. Prix m&eacute;dian de base</span>
                      <span className="decomp-value">{breakdownLive.prixM2Base.toLocaleString('fr-FR')} &euro;/m&sup2;</span>
                    </div>
                    <div className="decomp-detail">
                      &times; {surface}m&sup2; = {Math.round(breakdownLive.prixM2Base * surface).toLocaleString('fr-FR')} &euro;
                    </div>
                    {breakdownLive.breakdown.length > 0 && (
                      <>
                        <div className="decomp-step">
                          <span className="decomp-label">2. Ajustements du bien</span>
                          <span className={`decomp-value ${breakdownLive.coef >= 1 ? 'pos' : 'neg'}`}>
                            {breakdownLive.coef >= 1 ? '+' : ''}{((breakdownLive.coef - 1) * 100).toFixed(1)}%
                          </span>
                        </div>
                        {breakdownLive.breakdown.map((b, idx) => {
                          const pct = ((b.coef - 1) * 100).toFixed(1);
                          const sign = b.coef >= 1 ? '+' : '';
                          return (
                            <div key={idx} className="decomp-detail">
                              {b.label} {sign}{pct}%
                            </div>
                          );
                        })}
                        <div className="decomp-detail">
                          &rarr;{' '}
                          <strong style={{ color: breakdownLive.coef >= 1 ? '#46B962' : '#e74c3c' }}>
                            {breakdownLive.coef >= 1 ? '+' : '\u2212'}
                            {Math.abs(Math.round((breakdownLive.coef - 1) * breakdownLive.prixM2Base * surface)).toLocaleString('fr-FR')} &euro;
                          </strong>
                        </div>
                      </>
                    )}
                    <div className="decomp-divider" />
                    <div className="decomp-step">
                      <span className="decomp-label decomp-final">AVIS DE VALEUR</span>
                      <span className="decomp-value decomp-final-value">{formatPrice(priceRef.prixMedian)}</span>
                    </div>
                    <div className="decomp-range">
                      Fourchette: {formatPrice(priceRef.prixBas)} &mdash; {formatPrice(priceRef.prixHaut)}
                    </div>
                  </>
                ) : (
                  <div className="card-empty-state" style={{ padding: '24px 8px', color: '#6b7280', fontSize: '0.92rem', lineHeight: 1.55 }}>
                    Pas encore de d&eacute;composition d&eacute;taill&eacute;e pour ce bien.
                    Le calcul s&rsquo;effectue automatiquement &agrave; la cr&eacute;ation
                    depuis le formulaire <em>Nouveau bien</em> (m&eacute;diane DVF, ajustements
                    par caract&eacute;ristique). Si elle est manquante, recr&eacute;ez le bien
                    en compl&eacute;tant tous les champs.
                  </div>
                )
              ) : (
                <>
                  <div className="decomp-step">
                    <span className="decomp-label">1. Prix m&eacute;dian comparables</span>
                    <span className="decomp-value">4 172 &euro;/m&sup2;</span>
                  </div>
                  <div className="decomp-detail">&times; 72.5m&sup2; = 302 470 &euro;</div>
                  <div className="decomp-step">
                    <span className="decomp-label">2. Impact tension march&eacute;</span>
                    <span className="decomp-value pos">+0.7%</span>
                  </div>
                  <div className="decomp-detail">Ratio demande/offre 3.2x +0.5%</div>
                  <div className="decomp-detail">7 acqu&eacute;reurs forte compatibilit&eacute; +0.2%</div>
                  <div className="decomp-detail">&rarr; <strong style={{ color: '#46B962' }}>+2 117 &euro;</strong></div>
                  <div className="decomp-step">
                    <span className="decomp-label">3. Corrections sp&eacute;cifiques</span>
                    <span className="decomp-value neg">&minus;1.5%</span>
                  </div>
                  <div className="decomp-detail">DPE D (passoire thermique 2028) &minus;2.0%</div>
                  <div className="decomp-detail">Travaux copro vot&eacute;s (15k&euro;) &minus;0.5%</div>
                  <div className="decomp-detail">Balcon 5.2m&sup2; +1.0%</div>
                  <div className="decomp-detail">&rarr; <strong style={{ color: '#e74c3c' }}>&minus;4 537 &euro;</strong></div>
                  <div className="decomp-divider" />
                  <div className="decomp-step">
                    <span className="decomp-label decomp-final">AVIS DE VALEUR</span>
                    <span className="decomp-value decomp-final-value">300 000 &euro;</span>
                  </div>
                  <div className="decomp-range">Fourchette: 280 000 &euro; &mdash; 315 000 &euro;</div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">Comparables utilis&eacute;s</div>
              {hasRealLocation ? (
                comparablesLive.length > 0 ? (
                  <table className="comp-table">
                    <thead>
                      <tr>
                        <th>Adresse</th>
                        <th>Prix/m&sup2;</th>
                        <th>Poids</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparablesLive.map((c, i) => (
                        <tr key={i}>
                          <td>{c.adresse}</td>
                          <td>{c.prixM2.toLocaleString('fr-FR')}&euro;</td>
                          <td>{Math.round(100 / comparablesLive.length)}%</td>
                        </tr>
                      ))}
                      <tr className="total">
                        <td colSpan="2">Moyenne</td>
                        <td>{comparablesAvg.toLocaleString('fr-FR')}&euro;</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="card-empty-state" style={{ padding: '24px 8px', color: '#6b7280', fontSize: '0.92rem', lineHeight: 1.55 }}>
                    Aucune transaction DVF comparable n&rsquo;a &eacute;t&eacute; trouv&eacute;e
                    pour ce bien. V&eacute;rifiez la base DVF ou ajoutez des comparables
                    manuellement &agrave; l&rsquo;&eacute;tape 3.
                  </div>
                )
              ) : (
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th>Adresse</th>
                      <th>Prix/m&sup2;</th>
                      <th>Poids</th>
                      <th>Ajust&eacute;</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>8 rue Villeroy</td><td>4 191&euro;</td><td>35%</td><td>4 103&euro;</td></tr>
                    <tr><td>22 av. Lacassagne</td><td>4 133&euro;</td><td>40%</td><td>4 195&euro;</td></tr>
                    <tr><td>15 rue Paul Bert</td><td>4 274&euro;</td><td>25%</td><td>4 112&euro;</td></tr>
                    <tr className="total"><td colSpan="3">Moyenne pond&eacute;r&eacute;e</td><td>4 172&euro;</td></tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
          )}

          {/* Poign\u00e9e 1 : entre col1 et col2 (uniquement si la d\u00e9mo est visible) */}
          {!hideDemo && (
            <div
              className={`col-resize-handle${activeHandle === 1 ? ' is-dragging' : ''}`}
              onMouseDown={(e) => startResize(e, 1)}
              onDoubleClick={resetCols}
              title="Glisser pour redimensionner \u00b7 double-clic pour r\u00e9initialiser"
            />
          )}

          {/* --- Column 2: Points forts + Points de vigilance --- */}
          <div className="content-grid-col">
            <div className="card strengths">
              <div className="card-title">Points forts <span className="card-title-hint">(cliquer pour modifier)</span></div>
              <div>
                {pointsForts.map((p, i) => (
                  <div key={i} className="list-item">
                    <span className="list-icon">&#10004;</span>
                    <span
                      className="item-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updated = [...pointsForts];
                        updated[i] = e.currentTarget.textContent;
                        setPointsForts(updated);
                      }}
                    >
                      {p}
                    </span>
                    <div className="item-actions">
                      <button className="item-btn delete" onClick={() => removePointFort(i)} title="Supprimer">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-item-btn" onClick={addPointFort}>+ Ajouter un point fort</button>
            </div>

            <div className="card weaknesses">
              <div className="card-title">Points de vigilance <span className="card-title-hint">(cliquer pour modifier)</span></div>
              <div>
                {pointsVigilance.map((p, i) => (
                  <div key={i} className="list-item">
                    <span className="list-icon">&#9888;</span>
                    <span
                      className="item-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updated = [...pointsVigilance];
                        updated[i] = e.currentTarget.textContent;
                        setPointsVigilance(updated);
                      }}
                    >
                      {p}
                    </span>
                    <div className="item-actions">
                      <button className="item-btn delete" onClick={() => removePointVigilance(i)} title="Supprimer">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-item-btn" onClick={addPointVigilance}>+ Ajouter un point de vigilance</button>
            </div>

            <div className="card seller-opinion">
              <div className="card-title">
                Avis du vendeur <span className="card-title-hint">(perception du propri&eacute;taire)</span>
              </div>
              <textarea
                className="seller-opinion-input"
                value={avisVendeur}
                onChange={(e) => setAvisVendeur(e.target.value)}
                placeholder="Notez ici ce que le vendeur pense de son bien : ressenti, points qu'il souligne, prix qu'il espère, motivation de vente, contraintes…"
                rows={6}
              />
              {avisVendeur.trim().length > 0 && (
                <div className="seller-opinion-meta">{avisVendeur.trim().length} caract&egrave;res saisis</div>
              )}
            </div>
          </div>

          {/* Poign\u00e9e 2 : entre col2 et col3 */}
          <div
            className={`col-resize-handle${activeHandle === 2 ? ' is-dragging' : ''}`}
            onMouseDown={(e) => (hideDemo ? startResize2(e) : startResize(e, 2))}
            onDoubleClick={resetCols}
            title="Glisser pour redimensionner \u00b7 double-clic pour r\u00e9initialiser"
          />

          {/* --- Column 3: Strategy + Actions --- */}
          <div className="content-grid-col">
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
                      setCustomPrice(String(s.prix));
                    }}
                  >
                    <div className="strategy-header-row">
                      <div className="strategy-radio">
                        <div className="strategy-radio-inner" />
                      </div>
                      <span className="strategy-name">{s.label} &mdash; {formatPrice(s.prix)}</span>
                    </div>
                    <div className="strategy-desc">{s.description}</div>
                    {confidenceScore >= 90 && (
                      <div className="strategy-duration">&#128197; {s.duration}</div>
                    )}
                    {s.recommended && <div className="badge-rec">&#10003; Recommand&eacute;</div>}
                  </div>
                );
              })}
              <input
                type="text"
                className="custom-input"
                placeholder="Prix de mise en vente libre (\u20ac)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
            </div>

            <div className="card">
              <div className="card-title">Actions</div>
              <div className="actions-card">
                <button className="action-btn secondary" onClick={() => {
                  const estimations = JSON.parse(localStorage.getItem('ideeri_estimations') || '[]');
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
                        statut: 'sauvegarde',
                        prix: formatPrice(priceRef.prixMedian),
                      }
                    : {
                        id: Date.now(),
                        reference: 'LYN-2026-00847',
                        adresse: '12 rue des Lilas, 69003 Lyon',
                        description: 'Appartement T3, 72.5 m\u00b2',
                        agent: 'Marie Dupont',
                        date: new Date().toLocaleDateString('fr-FR'),
                        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                        statut: 'sauvegarde',
                        prix: '300 000 \u20ac',
                      };
                  const exists = estimations.find((e) => e.reference === payload.reference);
                  if (!exists) {
                    estimations.unshift(payload);
                  } else {
                    exists.date = payload.date;
                    exists.heure = payload.heure;
                    exists.adresse = payload.adresse;
                    exists.description = payload.description;
                    exists.prix = payload.prix;
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => navigate('/report')}>
              Compte rendu d'estimation
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/avis-valeur')}>
              G&eacute;n&eacute;rer l'avis de valeur &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
