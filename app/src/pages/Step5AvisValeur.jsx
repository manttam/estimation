import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { avisValeur } from '../data/propertyData';

const cssStyles = `
  .step5-page {
    background: #fafafa;
    min-height: 100vh;
    padding-bottom: 32px;
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    font-size: 13px;
    line-height: 1.4;
    color: #393939;
  }

  .step5-section {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* ---- Hero Section ---- */
  .hero-section {
    background: #fff;
    border: 1px solid #eee;
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
    color: #46B962;
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
    color: #46B962;
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
    border: 1px solid #eee;
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
    color: #46B962;
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
  .demand-gauge-wrap {
    flex: 1;
  }
  .demand-price-display {
    font-size: 24px;
    font-weight: 700;
    color: #393939;
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
    background: linear-gradient(to right, #46B962 0%, #f5a623 50%, #e74c3c 100%);
  }
  .demand-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    border: 2px solid #46B962;
    box-shadow: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .demand-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    border: 2px solid #46B962;
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
    color: #46B962;
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
  .demand-criteria.match .demand-criteria-icon { background: #e8f5e9; color: #46B962; }
  .demand-criteria.partial .demand-criteria-icon { background: #fff3e0; color: #f5a623; }
  .demand-criteria.low .demand-criteria-icon { background: #ffebee; color: #e74c3c; }
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
  .demand-criteria.match .demand-criteria-value { color: #46B962; }
  .demand-criteria.partial .demand-criteria-value { color: #f5a623; }
  .demand-criteria.low .demand-criteria-value { color: #e74c3c; }
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
  .demand-criteria.match .demand-criteria-fill { background: #46B962; }
  .demand-criteria.partial .demand-criteria-fill { background: #f5a623; }
  .demand-criteria.low .demand-criteria-fill { background: #e74c3c; }

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
    border: 1px solid #eee;
  }
  .demand-verdict.good { color: #46B962; }
  .demand-verdict.medium { color: #b8860b; }
  .demand-verdict.bad { color: #e74c3c; }
  .demand-verdict-icon { font-size: 20px; }
  .demand-verdict-text { flex: 1; }
  .demand-verdict-title { font-weight: 700; font-size: 13px; }
  .demand-verdict-desc { font-size: 11px; color: #666; margin-top: 2px; }

  /* ---- Content Grid (3 columns) ---- */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 0.8fr 0.8fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  .content-grid-col {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* ---- Card ---- */
  .card {
    background: #fff;
    border-radius: 10px;
    padding: 16px;
    border: 1px solid #eee;
    position: relative;
  }
  .card.strengths { border-left: 3px solid #46B962; }
  .card.weaknesses { border-left: 3px solid #e74c3c; }
  .card.strategy { border-left: 3px solid #f5a623; }
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
    color: #393939;
    font-weight: 500;
  }
  .decomp-value {
    font-weight: 600;
    font-family: 'Courier New', monospace;
  }
  .decomp-value.pos { color: #46B962; }
  .decomp-value.neg { color: #e74c3c; }
  .decomp-detail {
    font-size: 10px;
    color: #666;
    padding: 2px 0 2px 14px;
    border-left: 2px solid #f0f0f0;
  }
  .decomp-divider {
    border-top: 2px solid #393939;
    margin: 12px 0;
    padding-top: 12px;
  }
  .decomp-final {
    font-size: 13px;
    font-weight: 700;
  }
  .decomp-final-value {
    font-size: 16px;
    color: #46B962;
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
    border-bottom: 1px solid #eee;
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
    border-top: 1px solid #eee;
  }

  /* ---- List Items (Strengths / Weaknesses) ---- */
  .list-item {
    display: flex;
    gap: 8px;
    padding: 6px 0;
    font-size: 12px;
    color: #393939;
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
    border-bottom: 1px dashed #46B962;
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
    border: 1px solid #eee;
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
    border-color: #46B962;
    color: #46B962;
    background: #f0fdf4;
  }
  .item-btn.delete:hover {
    border-color: #e74c3c;
    color: #e74c3c;
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
    font-family: 'Open Sans', sans-serif;
  }
  .add-item-btn:hover {
    border-color: #46B962;
    color: #46B962;
    background: rgba(29,186,110,0.03);
  }

  /* ---- Strategy Options ---- */
  .strategy-option {
    padding: 12px;
    margin: 8px 0;
    border-radius: 8px;
    border: 1px solid #eee;
    cursor: pointer;
    transition: all 0.2s;
  }
  .strategy-option:hover {
    border-color: #ddd;
    background: #fafafa;
  }
  .strategy-option.selected {
    border-color: #46B962;
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
    border-color: #46B962;
    background: #46B962;
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
    background: #46B962;
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
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 13px;
    font-family: 'Courier New', monospace;
    box-sizing: border-box;
    outline: none;
  }
  .price-delta {
    font-size: 11px;
    margin-top: 6px;
    padding: 6px 10px;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 6px;
    text-align: center;
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
    font-family: 'Open Sans', sans-serif;
  }
  .action-btn.primary {
    background: #46B962;
    color: white;
    font-weight: 600;
  }
  .action-btn.primary:hover { background: #17a05d; }
  .action-btn.secondary {
    background: transparent;
    color: #393939;
    border: 1px solid #eee;
  }
  .action-btn.secondary:hover {
    background: #f5f5f5;
    border-color: #46B962;
    color: #46B962;
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
    border: 1px solid #eee;
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
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: 'Open Sans', sans-serif;
  }
  .btn-ghost {
    background: transparent;
    color: #393939;
    border: 1px solid #eee;
  }
  .btn-ghost:hover { background: #f5f5f5; }
  .btn-primary {
    background: #46B962;
    color: white;
  }
  .btn-primary:hover { background: #1aa564; }
`;

/* ---------- helpers ---------- */
function formatPrice(n) {
  return n.toLocaleString('fr-FR') + ' \u20ac';
}

/* ==================== Component ==================== */
export default function Step5AvisValeur() {
  const navigate = useNavigate();

  const [sliderValue, setSliderValue] = useState(avisValeur.prixMedian);
  const [selectedStrategy, setSelectedStrategy] = useState(1);
  const [pointsForts, setPointsForts] = useState([...avisValeur.pointsForts]);
  const [pointsVigilance, setPointsVigilance] = useState([...avisValeur.pointsVigilance]);
  const [customPrice, setCustomPrice] = useState('305000');

  const surface = 72.5;
  const totalAcquereurs = 23;

  /* ---- Demand computation (matching HTML wireframe logic) ---- */
  // Simulated acquéreur data matching the HTML wireframe
  const acquereurs = [
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

  let budgetMatch = 0, typeMatch = 0, surfMatch = 0, locMatch = 0, dpeMatch = 0, allMatch = 0;
  acquereurs.forEach((a) => {
    const passBudget = a.budgetMax >= sliderValue;
    if (passBudget) budgetMatch++;
    if (a.type) typeMatch++;
    if (a.surface) surfMatch++;
    if (a.loc) locMatch++;
    if (a.dpe) dpeMatch++;
    if (passBudget && a.type && a.surface && a.loc && a.dpe) allMatch++;
  });

  const ppm = Math.round(sliderValue / surface);
  // Le hero affiche les acquéreurs budget-compatibles (seul critère impacté par le prix).
  // À prix minimum, tous les acquéreurs de la zone sont potentiellement intéressés.
  const ratio = budgetMatch / totalAcquereurs;
  const budgetPct = Math.round((budgetMatch / totalAcquereurs) * 100);

  const demandColor = ratio >= 0.5 ? '#46B962' : ratio >= 0.25 ? '#f5a623' : '#e74c3c';

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
      id: 'type', label: 'Cherchent un T3', value: typeMatch,
      detail: 'T3 ou T2-T4 flexible',
      pct: Math.round((typeMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4" stroke="currentColor" strokeWidth="1.3"/><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.2"/></svg>
      ),
    },
    {
      id: 'surface', label: 'Surface 60-85m\u00B2', value: surfMatch,
      detail: 'fourchette 72.5m\u00B2',
      pct: Math.round((surfMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><path d="M2 14V4l5-2v12M9 6l5-2v12M2 14h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ),
    },
    {
      id: 'loc', label: 'Lyon 3 / proches', value: locMatch,
      detail: 'Lyon 3, 6, 7, 8',
      pct: Math.round((locMatch / totalAcquereurs) * 100),
      icon: (
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2"/></svg>
      ),
    },
    {
      id: 'dpe', label: 'Acceptent DPE D', value: dpeMatch,
      detail: 'DPE D ou sans filtre',
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

  /* ---- Strategy pricing ---- */
  const strategies = [
    { label: 'Agressif', prix: 315000, description: 'Haut de fourchette. Capitalise sur la tension forte.', duration: 'Dur\u00E9e estim\u00E9e: 35-50 jours' },
    { label: 'March\u00E9', prix: 305000, description: '\u00C9quilibre valorisation et liquidit\u00E9.', duration: 'Dur\u00E9e estim\u00E9e: 40-55 jours', recommended: true },
    { label: 'Prudent', prix: 290000, description: 'Bas de fourchette. Maximise la rapidit\u00E9.', duration: 'Dur\u00E9e estim\u00E9e: 25-35 jours' },
  ];

  const estimation = 305000;
  const customVal = parseInt((customPrice || '').replace(/\s/g, ''), 10);
  const deltaValid = !isNaN(customVal) && customVal > 0;
  const deltaPct = deltaValid ? (((customVal - estimation) / estimation) * 100).toFixed(1) : null;
  const deltaSign = deltaPct > 0 ? '+' : '';
  const deltaColor = deltaPct !== null
    ? (Math.abs(deltaPct) <= 3 ? '#46B962' : Math.abs(deltaPct) <= 8 ? '#f59e0b' : '#ef4444')
    : null;

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
          <div className="hero-label">
            ESTIMATION &mdash; Appartement T3 &middot; 72.5m&sup2; &middot; Lyon 3&egrave;me &middot; 4&egrave;me &eacute;tage
          </div>
          <div className="hero-prices">
            <div className="price-item">
              <div className="price-label">Fourchette basse</div>
              <div className="price-low">{formatPrice(avisValeur.prixBas)}</div>
            </div>
            <div className="price-item">
              <div className="price-main">{formatPrice(avisValeur.prixMedian)}</div>
            </div>
            <div className="price-item">
              <div className="price-label">Fourchette haute</div>
              <div className="price-high">{formatPrice(avisValeur.prixHaut)}</div>
            </div>
          </div>
          <div className="price-meta">
            <span className="price-meta-item"><strong>{avisValeur.prixM2.toLocaleString('fr-FR')} &euro;/m&sup2;</strong></span>
            <span className="price-meta-item">Amplitude: <strong>&plusmn;{avisValeur.amplitude}%</strong></span>
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
              <div className="confidence-number">{avisValeur.confiance}</div>
              <div className="confidence-label">Indice de confiance</div>
              <div className="confidence-details">Compl&eacute;tude 64% &times; Homog&eacute;n&eacute;it&eacute; 92% &times; Volume zone</div>
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
            <div className="demand-gauge-wrap">
              <div className="demand-price-display">
                {formatPrice(sliderValue)}
                <span className="price-perm">{ppm.toLocaleString('fr-FR')} &euro;/m&sup2;</span>
              </div>
              <div className="demand-slider-wrap">
                <input
                  type="range"
                  className="demand-slider"
                  min={250000}
                  max={380000}
                  step={1000}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                />
                <div className="demand-slider-labels">
                  <span>250 000 &euro;</span>
                  <span className="estimation-marker">&#9660; Estimation 305k</span>
                  <span>380 000 &euro;</span>
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

        {/* ============ THREE-COLUMN GRID ============ */}
        <div className="content-grid">
          {/* --- Column 1: Decomposition + Comparables --- */}
          <div className="content-grid-col">
            <div className="card">
              <div className="card-title">Avis de valeur</div>
              <div className="decomp-step">
                <span className="decomp-label">1. Prix m&eacute;dian comparables</span>
                <span className="decomp-value">4 172 &euro;/m&sup2;</span>
              </div>
              <div className="decomp-detail">&times; 72.5m&sup2; = 302 470 &euro;</div>
              <div className="decomp-step">
                <span className="decomp-label">2. Ajustement zone</span>
                <span className="decomp-value pos">+1.2%</span>
              </div>
              <div className="decomp-detail">Accessibilit&eacute; transports +0.8%</div>
              <div className="decomp-detail">Risque inondation PPRI &minus;0.5%</div>
              <div className="decomp-detail">Score socio-&eacute;co +0.4%</div>
              <div className="decomp-detail">March&eacute; en hausse +0.5%</div>
              <div className="decomp-detail">&rarr; <strong style={{ color: '#46B962' }}>+3 630 &euro;</strong></div>
              <div className="decomp-step">
                <span className="decomp-label">3. Impact tension march&eacute;</span>
                <span className="decomp-value pos">+0.7%</span>
              </div>
              <div className="decomp-detail">Ratio demande/offre 3.2x +0.5%</div>
              <div className="decomp-detail">7 acqu&eacute;reurs forte compatibilit&eacute; +0.2%</div>
              <div className="decomp-detail">&rarr; <strong style={{ color: '#46B962' }}>+2 117 &euro;</strong></div>
              <div className="decomp-step">
                <span className="decomp-label">4. Corrections sp&eacute;cifiques</span>
                <span className="decomp-value neg">&minus;1.5%</span>
              </div>
              <div className="decomp-detail">DPE D (passoire thermique 2028) &minus;2.0%</div>
              <div className="decomp-detail">Travaux copro vot&eacute;s (15k&euro;) &minus;0.5%</div>
              <div className="decomp-detail">Balcon 5.2m&sup2; +1.0%</div>
              <div className="decomp-detail">&rarr; <strong style={{ color: '#e74c3c' }}>&minus;4 537 &euro;</strong></div>
              <div className="decomp-divider" />
              <div className="decomp-step">
                <span className="decomp-label decomp-final">AVIS DE VALEUR</span>
                <span className="decomp-value decomp-final-value">305 000 &euro;</span>
              </div>
              <div className="decomp-range">Fourchette: 285 000 &euro; &mdash; 320 000 &euro;</div>
            </div>

            <div className="card">
              <div className="card-title">Comparables utilis&eacute;s</div>
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
            </div>
          </div>

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
          </div>

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
                    <div className="strategy-duration">&#128197; {s.duration}</div>
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
              <div className="price-delta">
                &Eacute;cart vs estimation:{' '}
                {deltaValid ? (
                  <strong style={{ color: deltaColor }}>{deltaSign}{deltaPct}%</strong>
                ) : (
                  <strong>&mdash;</strong>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Actions</div>
              <div className="actions-card">
                <button className="action-btn secondary" onClick={() => {
                  const estimations = JSON.parse(localStorage.getItem('ideeri_estimations') || '[]');
                  const exists = estimations.find(e => e.reference === 'LYN-2026-00847');
                  if (!exists) {
                    estimations.unshift({
                      id: Date.now(),
                      reference: 'LYN-2026-00847',
                      adresse: '12 rue des Lilas, 69003 Lyon',
                      description: 'Appartement T3, 72.5 m\u00b2',
                      agent: 'Marie Dupont',
                      date: new Date().toLocaleDateString('fr-FR'),
                      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                      statut: 'sauvegarde',
                      prix: '305 000 \u20ac',
                    });
                  } else {
                    exists.date = new Date().toLocaleDateString('fr-FR');
                    exists.heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
          &#128203; Ceci est la <strong>&nbsp;V1&nbsp;</strong> de l&apos;estimation &middot; Cr&eacute;&eacute;e le <strong>&nbsp;25 mars 2026&nbsp;</strong> &middot; Aucune version pr&eacute;c&eacute;dente
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
