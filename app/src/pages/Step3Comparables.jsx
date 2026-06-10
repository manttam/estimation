import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import ComparableDrawer from '../components/ComparableDrawer';
import { getActiveBien, buildBienCibleCategories } from '../utils/activeBien';
import { bienCibleCategories as bienCibleCategoriesBase } from '../data/propertyData';
import {
  getTargetFilledFieldKeys,
  computeDataCoverage,
  dataCoverageClass,
} from '../utils/comparableFields';
import { setReportState, mergeReportSection, getReportSection } from '../utils/reportStore';
import { getCompPhotos } from '../utils/compPhotos';
import { computeWeightedM2, defaultWeightFor } from '../utils/weightedM2';

/* Clé localStorage des overrides de similarité.
 * Format : { [compId: string]: number 0-100 }
 */
const SIM_OVERRIDES_KEY = 'ideeri_sim_overrides';

function loadSimOverrides() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SIM_OVERRIDES_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Sanitize : on garde uniquement les valeurs numériques 0-100.
    const out = {};
    Object.keys(parsed).forEach((id) => {
      const v = Number(parsed[id]);
      if (!Number.isNaN(v) && v >= 0 && v <= 100) out[id] = Math.round(v);
    });
    return out;
  } catch {
    return {};
  }
}

/* Applique un éventuel override de similarité au comparable.
 * - Conserve la valeur auto dans `_autoSim`
 * - Marque `_hasSimOverride` true si override actif
 * - Met à jour les champs dérivés (simScore, simClass) pour cohérence d'affichage
 */
function applySimOverride(comp, overrides) {
  if (!comp) return comp;
  const auto = Number(comp.similarite) || 0;
  const ovRaw = overrides ? overrides[comp.id] : undefined;
  if (ovRaw === undefined || ovRaw === null) {
    return { ...comp, _autoSim: auto, _hasSimOverride: false };
  }
  const eff = Math.max(0, Math.min(100, Math.round(Number(ovRaw))));
  const simClass = eff >= 80 ? 'high' : eff >= 60 ? 'mid' : 'low';
  return {
    ...comp,
    similarite: eff,
    simScore: `${eff}% sim.`,
    simClass,
    _autoSim: auto,
    _hasSimOverride: true,
  };
}

/* Applique le calcul dynamique de couverture données à un comparable.
 * Remplace donCount / donScore / donClass par des valeurs calculées sur la
 * base de l'intersection (champs renseignés Step 1) ∩ (champs comparable).
 * Si le comp porte déjà ces champs en dur, ils sont écrasés par le calcul.
 */
function enrichWithCoverage(comp, targetSet) {
  if (!comp || !targetSet) return comp;
  const cov = computeDataCoverage(targetSet, comp);
  return {
    ...comp,
    donCount: `${cov.count}/${cov.total}`,
    donScore: `${cov.percent}% données`,
    donClass: dataCoverageClass(cov.percent),
    _coverage: cov,
  };
}

/* Clé localStorage des comparables saisis manuellement (par bien actif).
 * On les stocke globalement pour l'instant — un futur travail pourra les
 * indexer par citycode/adresse cible si besoin. */
const MANUAL_COMPS_KEY = 'ideeri_manual_comps';

function loadManualComps() {
  try {
    const raw = localStorage.getItem(MANUAL_COMPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* Transforme la sortie riche du ManualComparableDrawer en card "compact"
 * compatible avec OTHERS / CompactCompCard (champs : meta, simScore,
 * simClass, donScore, donClass, donCount). On garde toutes les données
 * riches en surcharge pour que le ComparableDrawer (détail) puisse
 * encore les afficher. */
function manualOtherToCompact(manual, targetCoords) {
  const distance = (manual.coords && targetCoords)
    ? haversineMeters(targetCoords, manual.coords)
    : null;
  const distanceLabel = distance != null
    ? (distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`)
    : '—';
  const sourceLabelCompact = manual.source === 'dvf' ? 'DVF'
    : manual.source === 'ideeri' ? 'Ideeri'
    : manual.source === 'encours' ? 'En cours'
    : manual.portalName || 'Portail';
  const meta = `${sourceLabelCompact} · ${manual.prix}€ · ${manual.prixM2 ? `${manual.prixM2}€/m²` : '—'} · ${distanceLabel}`;
  // On fabrique un `fields` agrégé à partir des données manuelles.
  // Les helpers de couverture calculeront M/N à partir de ce fields.
  const fields = {
    type: manual.type,
    surface: manual.surface,
    pieces: manual.pieces,
    chambres: manual.chambres,
    etage: manual.etage,
    orientation: manual.orientation,
    ascenseur: manual.ascenseur,
    cave: manual.cave,
    garage: manual.garage,
    parking: manual.parking,
    terrasse: manual.terrasse,
    balcon: manual.balcon,
    jardin: manual.jardin,
    anneeConstruction: manual.anneeConstruction || manual.annee,
    epoqueConstruction: manual.epoqueConstruction || manual.epoque,
    chauffageType: manual.chauffageType || manual.chauffage,
    chauffageEnergie: manual.chauffageEnergie || manual.energie,
    dpe: manual.dpe,
    ges: manual.ges,
    cuisineEquipee: manual.cuisineEquipee,
    etatCuisine: manual.etatCuisine,
    prix: manual.prix,
    prixM2: manual.prixM2,
  };
  return {
    ...manual,
    meta,
    simScore: '— sim.',
    simClass: 'mid',
    fields,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers DVF live
 * ────────────────────────────────────────────────────────────────────────────*/

/* Distance haversine en mètres entre deux paires [lat, lon]. */
function haversineMeters(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* Libellé de commune/quartier d'un comparable, quelle que soit la source.
 * - DVF live : nom de commune (_dvfRaw.commune)
 * - Manuel : champ commune saisi
 * - Démo : champ addr (ex. "Lyon 3ème") ou, à défaut, dernier segment du
 *   titre après la virgule (ex. "T3 70m² — 5 rue Duguesclin, Lyon 3")
 * Retourne null si rien d'exploitable (le comparable ne sera alors pas
 * filtrable par commune). */
function getCompCommune(c) {
  if (!c) return null;
  let raw =
    c.fields?.commune ||
    c._dvfRaw?.commune ||
    c.commune ||
    c.addr ||
    null;
  // Fallback : extraire la commune du titre ("… , Lyon 3")
  if (!raw && typeof c.title === 'string' && c.title.includes(',')) {
    raw = c.title.split(',').pop();
  }
  if (!raw) return null;
  return String(raw).trim();
}

/* Format compact prix "295 000" ou "295k". */
function fmtPrix(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

/* Format date ISO "YYYY-MM-DD" → "Mar. 2025" (mois court FR). */
function fmtMoisAnnee(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mois = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  return `${mois[d.getMonth()]} ${d.getFullYear()}`;
}

/* Construit un titre type "T3 70m² — 5 rue Duguesclin" à partir d'une transaction DVF. */
function buildDvfTitle(tx) {
  const typeLabel = tx.type === 'maison' ? 'Maison' : tx.type === 'appartement' ? 'T' : '';
  const piecesLabel = tx.pieces && tx.type === 'appartement' ? `T${tx.pieces}` : tx.type === 'maison' ? 'Maison' : 'Bien';
  const surfaceLabel = tx.surface ? `${Math.round(tx.surface)}m²` : '';
  const adr = tx.adresse || '';
  return `${piecesLabel} ${surfaceLabel} — ${adr}`.trim().replace(/\s+/g, ' ');
}

/* Transforme une transaction DVF brute (issue de /api/dvf) en "comparable card OTHERS". */
function dvfTxToOther(tx, idx, targetCoords) {
  const distance = (tx.lat && tx.lon && targetCoords)
    ? haversineMeters(targetCoords, [tx.lat, tx.lon])
    : null;
  const distanceLabel = distance != null ? (distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`) : '—';
  const title = buildDvfTitle(tx);
  const meta = `DVF · ${fmtPrix(tx.prix)}€ · ${tx.prixM2 ? tx.prixM2.toLocaleString('fr-FR') : '—'}€/m² · ${distanceLabel}${tx.date ? ' · ' + fmtMoisAnnee(tx.date) : ''}`;
  // Heuristique scoring par défaut : la similarité dépend du type, distance, surface
  // (on ne peut pas la calculer finement sans le bien cible complet — placeholder doux)
  const sim = distance != null && distance < 500 ? 80 : distance < 1500 ? 65 : 50;
  const simClass = sim >= 80 ? 'high' : sim >= 60 ? 'mid' : 'low';
  // DVF expose un sous-ensemble fixe : type, surface, pieces, prix, prixM2 (+ date).
  // Le calcul de couverture est branché à l'extérieur via enrichWithCoverage.
  return {
    id: `dvf-${idx}`,
    title,
    source: 'dvf',
    sourceLabel: 'DVF',
    meta,
    simScore: `${sim}% sim.`,
    simClass,
    coords: tx.lat && tx.lon ? [tx.lat, tx.lon] : null,
    // Propriétés racine lues par le drawer (KeyFacts) — sinon vides en live.
    addr: tx.commune || tx.adresse || '—',
    prix: Number.isFinite(tx.prix) ? tx.prix.toLocaleString('fr-FR') : '—',
    prixM2: tx.prixM2 ? tx.prixM2.toLocaleString('fr-FR') : '—',
    surface: tx.surface || null,
    pieces: tx.pieces || null,
    distance: distanceLabel,
    fields: {
      type: tx.type,
      surface: tx.surface,
      pieces: tx.pieces,
      prix: tx.prix,
      prixM2: tx.prixM2,
    },
    // Méta brute conservée pour la sélection / drawer
    _dvfRaw: tx,
  };
}

/* Construit un titre depuis une annonce Leboncoin : "T3 70m² — adresse".
 * Helper conservé pour ré-activation future du proxy /api/leboncoin
 * (actuellement débranché du front car Datadome bloque l'IP Vercel). */
function buildLbcTitle(ad) {
  const piecesLabel = ad.pieces && ad.type === 'appartement' ? `T${ad.pieces}` : ad.type === 'maison' ? 'Maison' : 'Bien';
  const surfaceLabel = ad.surface ? `${Math.round(ad.surface)}m²` : '';
  const adr = ad.adresse || ad.commune || '';
  return `${piecesLabel} ${surfaceLabel} — ${adr}`.trim().replace(/\s+/g, ' ');
}

/* Transforme une annonce Leboncoin (issue de /api/leboncoin) en card OTHERS.
 * Helper conservé pour ré-activation future du proxy. */
// eslint-disable-next-line no-unused-vars
function lbcAdToOther(ad, idx, targetCoords) {
  const distance = (ad.lat && ad.lon && targetCoords)
    ? haversineMeters(targetCoords, [ad.lat, ad.lon])
    : null;
  const distanceLabel = distance != null ? (distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`) : '—';
  const title = buildLbcTitle(ad);
  const meta = `Leboncoin · ${fmtPrix(ad.prix)}€ · ${ad.prixM2 ? ad.prixM2.toLocaleString('fr-FR') : '—'}€/m² · ${distanceLabel}${ad.date ? ' · ' + fmtMoisAnnee(ad.date) : ''}`;
  // Heuristique scoring : annonce active = signal d'offre, distance prime
  const sim = distance != null && distance < 500 ? 75 : distance < 1500 ? 60 : 45;
  const simClass = sim >= 80 ? 'high' : sim >= 60 ? 'mid' : 'low';
  // Leboncoin expose : type, surface, pieces, prix, prixM2 + parfois etage/dpe.
  // Le calcul de couverture est branché à l'extérieur via enrichWithCoverage.
  return {
    id: ad.id || `lbc-${idx}`,
    title,
    source: 'portail',
    portalName: 'Leboncoin',
    meta,
    simScore: `${sim}% sim.`,
    simClass,
    coords: ad.lat && ad.lon ? [ad.lat, ad.lon] : null,
    fields: {
      type: ad.type,
      surface: ad.surface,
      pieces: ad.pieces,
      etage: ad.etage,
      dpe: ad.dpe,
      prix: ad.prix,
      prixM2: ad.prixM2,
    },
    _lbcRaw: ad,
    photoUrl: ad.photo || null,
    url: ad.url || null,
  };
}

const SOURCE_COLORS = {
  DVF: '#4a6cf7',
  IDEERI: '#46B962',
  EN_COURS: '#f5a623',
  PORTAIL: '#e87722',
};

const SOURCE_LABELS = {
  DVF: 'DVF',
  IDEERI: 'Ideeri',
  EN_COURS: 'En cours',
  PORTAIL: 'Portail',
};

const cssStyles = `
  .step3-page {
    font-family: var(--font);
  }

  /* ═══ FILTER PANEL ═══ */
  .filter-panel {
    background: #fff;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 14px;
    border: 1px solid #eee;
  }
  .filter-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .filter-top-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .filter-top-left h3 {
    font-size: 13px;
    font-weight: 500;
    margin: 0;
  }
  .result-count {
    font-size: 11px;
    color: #666;
    font-weight: 500;
    background: #f5f5f5;
    padding: 4px 10px;
    border-radius: 12px;
  }
  .btn-reset-filters {
    font-size: 11px;
    color: var(--muted);
    background: none;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: var(--font);
  }
  .btn-reset-filters:hover {
    background: #fafafa;
  }

  /* RADIUS SLIDER ROW */
  /* Rayon en overlay flottant par-dessus la carte (haut, centré) */
  .radius-overlay {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 600;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    width: min(440px, calc(100% - 110px));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(4px);
    border-radius: 10px;
    border: 1px solid #e6e6e6;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  .radius-label {
    font-size: 12px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
  }
  .commune-badge {
    background: #f0f0f0;
    color: #333;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .radius-slider-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  /* (Ancien .radius-slider remplacé par .cs-slider — voir plus bas) */
  .radius-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--green);
    min-width: 52px;
    text-align: right;
  }

  /* ZONES COUVERTES — mini-tags communes/quartiers dans le rayon */
  .zone-tags-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .zone-tags-label {
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    padding-top: 4px;
  }
  .zone-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .zone-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #f0f8f5;
    border: 1px solid #d4ead8;
    color: #2a6b41;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 4px 3px 9px;
    border-radius: 12px;
    line-height: 1.4;
    white-space: nowrap;
  }
  .zone-tag-count {
    background: #fff;
    color: var(--green);
    font-weight: 700;
    font-size: 10px;
    border-radius: 8px;
    padding: 0 5px;
    min-width: 16px;
    text-align: center;
  }
  .zone-tag-remove,
  .zone-tag-restore {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #6b8a76;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: background 0.12s, color 0.12s;
  }
  .zone-tag-remove:hover {
    background: var(--red, #e74c3c);
    color: #fff;
  }
  .zone-tag.is-excluded {
    background: #f5f5f5;
    border-color: #e2e2e2;
    color: #aaa;
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }
  .zone-tag.is-excluded .zone-tag-restore {
    color: #999;
    text-decoration: none;
  }
  .zone-tag-restore:hover {
    background: var(--green);
    color: #fff;
  }

  /* FILTER GRID */
  .filter-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }
  .filter-item {
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px 14px;
  }
  .filter-item-label {
    font-size: 11px;
    font-weight: 500;
    color: #333;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .filter-item-label .chip-close {
    font-size: 14px;
    color: #ccc;
    cursor: pointer;
  }
  .filter-item-label .chip-close:hover {
    color: var(--red);
  }
  .source-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  /* ═══════════════════════════════════════════════════════════════
   * Sources modernes : card row cliquable + checkbox custom + slider
   * ═══════════════════════════════════════════════════════════════ */
  .source-row {
    display: grid;
    grid-template-columns: 22px 130px 1fr;
    align-items: center;
    gap: 10px 10px;
    padding: 9px 12px;
    background: #fff;
    border: 1.5px solid #ececec;
    border-radius: 10px;
    margin-bottom: 6px;
    transition: all 0.15s ease;
    cursor: pointer;
  }
  .source-row:hover {
    border-color: #cfd6df;
    background: #fcfdfe;
  }
  .source-row:not(.disabled) {
    border-color: #d4ead8;
    background: #f7fbf8;
  }
  .source-row:not(.disabled):hover {
    border-color: var(--green);
    background: #effaf2;
  }
  .source-row.disabled {
    opacity: 0.55;
    background: #fafafa;
    border-color: #ececec;
  }
  /* Checkbox custom — carré arrondi avec coche quand checked */
  .source-cb-label {
    display: flex;
    align-items: center;
    margin: 0;
    cursor: pointer;
  }
  .source-cb-label input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }
  .source-check-box {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid #d0d6dd;
    background: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    position: relative;
    flex-shrink: 0;
  }
  .source-cb-label input[type="checkbox"]:checked + .source-check-box {
    background: var(--green);
    border-color: var(--green);
    box-shadow: 0 2px 5px rgba(70, 185, 98, 0.25);
  }
  .source-check-box::after {
    content: '';
    width: 5px;
    height: 10px;
    border: solid #fff;
    border-width: 0 2.5px 2.5px 0;
    transform: rotate(45deg) scale(0);
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    margin-top: -2px;
  }
  .source-cb-label input[type="checkbox"]:checked + .source-check-box::after {
    transform: rotate(45deg) scale(1);
  }
  .source-row:hover .source-check-box {
    border-color: var(--green);
  }
  /* Label dot + nom */
  .source-label-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #1a1a1a;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* ═══════════════════════════════════════════════════════════════
   * Slider custom 100% — pas d'input range visuel (qui ajoutait toujours
   * un contour gris natif quoi qu'on fasse). À la place :
   * - <div class="cs-track"> = barre de fond grise arrondie
   * - <div class="cs-fill"> = portion remplie verte (width: pct%)
   * - <div class="cs-thumb"> = cercle blanc à bord vert (left: pct%)
   * - <input type="range"> invisible (opacity 0) gère drag + clavier
   * --cs-pct = pourcentage 0-100 passé en CSS variable (sans %)
   * ═══════════════════════════════════════════════════════════════ */
  .cs-slider {
    position: relative;
    width: 100%;
    height: 22px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .cs-track {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 8px;
    border-radius: 9999px;
    background: #ececec;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .cs-fill {
    position: absolute;
    left: 0;
    top: 50%;
    height: 8px;
    width: calc(var(--cs-pct, 0) * 1%);
    border-radius: 9999px;
    background: var(--green);
    transform: translateY(-50%);
    pointer-events: none;
    transition: width 0.05s linear;
  }
  /* Thumb : centré sur la position du thumb natif (10px à value=min,
   * 100%-10px à value=max → formule calc avec 20px = thumb width) */
  .cs-thumb {
    position: absolute;
    top: 50%;
    left: calc(10px + (var(--cs-pct, 0) / 100) * (100% - 20px));
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--green);
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition: left 0.05s linear, transform 0.1s;
    z-index: 2;
  }
  .cs-slider:active .cs-thumb {
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: inset 0 0 0 3px var(--green), 0 2px 6px rgba(70, 185, 98, 0.30);
  }
  /* Input range invisible mais cliquable / draggable / clavier */
  .cs-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    opacity: 0;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    -webkit-tap-highlight-color: transparent;
  }
  .cs-input:disabled { cursor: not-allowed; }
  /* États désactivés */
  .source-row.disabled .cs-slider { cursor: not-allowed; }
  .source-row.disabled .cs-fill { background: #d4dcdf; }
  .source-row.disabled .cs-thumb { box-shadow: inset 0 0 0 3px #b8c5cf; }
  /* Deux jauges empilées (ancienneté + prix) dans la colonne droite */
  .source-gauges {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }
  .source-gauge {
    display: grid;
    grid-template-columns: 16px 1fr 58px;
    align-items: center;
    gap: 8px;
  }
  .source-gauge-icon {
    font-size: 12px;
    color: #8a949e;
    text-align: center;
    line-height: 1;
  }
  /* Valeur en pill */
  .source-gauge-value {
    font-size: 11px;
    font-weight: 700;
    color: #2d8856;
    background: #e4f3e8;
    padding: 3px 8px;
    border-radius: 12px;
    text-align: center;
    white-space: nowrap;
    border: 1px solid #c8e6cf;
    transition: all 0.15s;
  }
  .source-row.disabled .source-gauge-value {
    color: #aaa;
    background: #f0f0f0;
    border-color: #e6e6e6;
  }
  .source-row.disabled .source-gauge-icon { color: #c2c2c2; }
  /* Rangée fourchette de prix : pleine largeur de la card (ligne 2 de la grille).
   * Réutilise le composant .price-dual identique à la section du dessous. */
  .source-price-row {
    grid-column: 1 / -1;
    min-width: 0;
    padding: 2px 10px 0;
    box-sizing: border-box;
  }
  .source-price-row .price-dual { margin-top: 0; }
  .source-row.disabled .price-dual-selected { background: transparent; border-color: #c2c2c2; }
  .source-row.disabled .price-dual input[type="range"]::-webkit-slider-thumb { border-color: #c2c2c2; }
  .source-row.disabled .price-dual input[type="range"]::-moz-range-thumb { border-color: #c2c2c2; }
  /* ─── Catégories de diffuseurs repliables (Papiris / Ideeri / DVF / Portails) ─── */
  .source-cat {
    border: 1px solid #ececec;
    border-radius: 10px;
    overflow: hidden;
    background: #fafbfc;
  }
  .source-cat + .source-cat { margin-top: 8px; }
  .source-cat-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border: none;
    background: #f2f5f8;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background 0.12s;
  }
  .source-cat-head:hover { background: #e9eef3; }
  .source-cat-caret {
    font-size: 14px;
    color: #6b7682;
    transition: transform 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }
  .source-cat-caret.is-open { transform: rotate(90deg); }
  .source-cat-title {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #34404b;
  }
  .source-cat .source-row { margin: 6px 8px; }
  .source-cat .source-row:last-child { margin-bottom: 8px; }
  .source-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }
  .dot-dvf { background: var(--blue); }
  .dot-ideeri { background: var(--green); }
  .dot-encours { background: var(--orange); }
  .dot-portail { background: var(--red); }
  /* Sources Papiris additionnelles */
  .dot-estimation { background: #9b59b6; }
  .dot-mandat-clos { background: #7f8c8d; }
  .dot-autre-agence { background: #16a085; }
  /* Invendu depuis 3 mois : marron pour signaler la longue durée sans activité */
  .dot-invendu-3m { background: #b86e3a; }
  /* Sous-groupe Papiris dans le panneau Source & ancienneté */
  .source-subgroup-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    font-weight: 600;
    padding: 6px 0 2px;
    margin-top: 4px;
    border-top: 1px dashed #eee;
  }
  .source-subgroup-label:first-of-type { border-top: none; margin-top: 0; }
  .source-cb-count {
    font-size: 10px;
    color: #888;
    font-weight: 400;
    margin-left: auto;
  }
  .filter-range {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .filter-range input[type="number"] {
    width: 80px;
    padding: 5px 8px;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    text-align: center;
    background: white;
  }
  .filter-range input[type="number"]:focus {
    border-color: var(--green);
    outline: none;
    box-shadow: 0 0 0 2px rgba(70,185,98,0.15);
  }
  .filter-range .sep {
    font-size: 11px;
    color: #bbb;
  }
  .filter-range .unit {
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
  }
  .filter-select {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    background: white;
    cursor: pointer;
  }
  .filter-select:focus {
    border-color: var(--green);
    outline: none;
  }
  /* Multiselect "Type de bien" — dropdown avec checkboxes */
  .type-multi {
    position: relative;
    width: 100%;
  }
  .type-multi-trigger {
    width: 100%;
    padding: 5px 28px 5px 8px;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    background: #fff;
    cursor: pointer;
    text-align: left;
    color: #333;
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .type-multi-trigger:hover { border-color: #ccc; }
  .type-multi-trigger.is-open { border-color: var(--green); }
  .type-multi-trigger::after {
    content: '▾';
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #888;
    font-size: 10px;
    pointer-events: none;
  }
  .type-multi-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 50;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    max-height: 280px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .type-multi-panel-header {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid #f0f0f0;
    background: #fafafa;
  }
  .type-multi-action {
    flex: 1;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 5px;
    padding: 4px 6px;
    font-size: 11px;
    cursor: pointer;
    color: #555;
    font-family: inherit;
    transition: all 0.12s;
  }
  .type-multi-action:hover { background: var(--green); color: #fff; border-color: var(--green); }
  .type-multi-list {
    overflow-y: auto;
    padding: 4px 0;
  }
  .type-multi-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 12px;
    color: #333;
    cursor: pointer;
    user-select: none;
  }
  .type-multi-option:hover { background: #f5f9f6; }
  .type-multi-option input[type="checkbox"] {
    cursor: pointer;
    accent-color: var(--green);
    margin: 0;
  }
  .filter-hint {
    font-size: 10px;
    color: #888;
    margin-top: 4px;
  }
  .filter-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 5px;
    border-radius: 3px;
    background: #eee;
    outline: none;
    cursor: pointer;
    margin-top: 6px;
    flex: 1;
  }
  .filter-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--green);
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    cursor: pointer;
  }

  /* ── Double-range slider (prix) ──────────────────────── */
  .price-dual {
    position: relative;
    height: 46px;
    padding: 0;
    margin-top: 4px;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
  }
  .price-dual-track {
    position: absolute;
    top: 18px;
    left: 12px;
    right: 12px;
    height: 10px;
    border-radius: 5px;
    /* dégradé = densité de biens par tranche de prix */
    background: linear-gradient(
      to right,
      #fdecec 0%,
      #fef5e6 10%,
      #e8f6ec 25%,
      var(--green) 40%,
      var(--green) 55%,
      #e8f6ec 70%,
      #fef5e6 85%,
      #fdecec 100%
    );
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .price-dual-selected {
    position: absolute;
    top: 18px;
    height: 10px;
    border-radius: 5px;
    border: 2px solid var(--green);
    background: transparent;
    pointer-events: none;
    box-sizing: border-box;
  }
  /* Les inputs sont décalés de 3px (= 12px piste − 9px demi-poignée) pour que,
   * en butée min/max, le bord de la poignée tombe pile au bord intérieur du
   * composant sans jamais dépasser. */
  .price-dual input[type="range"] {
    position: absolute;
    top: 18px;
    left: 3px;
    right: 3px;
    width: auto;
    height: 10px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    pointer-events: none;
    margin: 0;
    padding: 0;
  }
  .price-dual input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--green);
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    cursor: pointer;
    pointer-events: auto;
    position: relative;
    z-index: 2;
  }
  .price-dual input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--green);
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    cursor: pointer;
    pointer-events: auto;
  }
  .price-dual-labels {
    position: absolute;
    top: 34px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 10px;
    color: #666;
    padding: 0 6px;
    box-sizing: border-box;
    overflow: hidden;
  }
  .price-dual-labels > span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .price-dual-labels > span:last-child { text-align: right; }
  .price-dual-labels strong {
    color: var(--text);
    font-weight: 700;
  }
  .price-dual-labels .count {
    color: var(--green);
    font-weight: 600;
  }

  /* ADD FILTER CHIPS */
  .filter-add-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 10px;
  }
  .filter-chip-add {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    border: 1px dashed #eee;
    background: #fff;
    color: var(--muted);
    transition: all 0.15s;
    font-family: var(--font);
  }
  .filter-chip-add:hover {
    border-color: var(--blue);
    color: var(--blue);
    background: #f0f4ff;
  }

  /* SOURCE LEGEND */
  .source-legend {
    display: flex;
    gap: 14px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #f0f0f0;
  }
  .source-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--muted);
  }

  /* ═══ WORKSPACE 3 COLONNES (Carte / Pool / Panier) ═══
   * Layout CSS Grid avec 2 poignées de redimensionnement entre colonnes.
   * Les largeurs sont des CSS variables modifiées au drag des poignées.
   * Inspiration : VSCode / Figma side panels. */
  /* ═══════════════════════════════════════════════════════════════
   * Barre tags caractéristiques du bien cible (au-dessus du workspace)
   * Clic sur un bien comparable → tags colorés selon match.
   * ═══════════════════════════════════════════════════════════════ */
  .target-tags-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .target-tags-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    font-weight: 700;
    flex-shrink: 0;
  }
  .target-tags-list {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
  }
  .target-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 600;
    border: 1.5px solid;
    transition: all 0.2s;
    line-height: 1.2;
  }
  .target-tag.is-neutral {
    background: #fafafa;
    border-color: #e8e8e8;
    color: #555;
  }
  .target-tag.is-match {
    background: #e4f3e8;
    border-color: #46B962;
    color: #2d8856;
    box-shadow: 0 0 0 2px rgba(70, 185, 98, 0.08);
  }
  .target-tag.is-nomatch {
    background: #fef6f6;
    border-color: #f3d4d4;
    color: #c0392b;
  }
  .target-tag.is-na {
    background: #fafafa;
    border-color: #e8e8e8;
    color: #b0b0b0;
    border-style: dashed;
    font-weight: 500;
  }
  .target-tag .tag-tick {
    font-weight: 800;
    font-size: 12px;
    line-height: 1;
  }
  .target-tags-focused-label {
    font-size: 11px;
    color: #888;
    font-style: italic;
    flex-shrink: 0;
    margin-right: 4px;
  }
  .target-tags-focused-label strong {
    color: #1a1a1a;
    font-style: normal;
    font-weight: 700;
  }
  .target-tags-clear {
    background: transparent;
    border: 1px solid #ddd;
    color: #666;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .target-tags-clear:hover { background: #f5f5f5; border-color: #ccc; color: #1a1a1a; }

  .workspace-2col {
    display: grid;
    grid-template-columns:
      minmax(0, var(--col-map, 38%))
      8px
      minmax(0, var(--col-pool, 62%));
    gap: 0;
    margin-bottom: 14px;
    height: 75vh;
    min-height: 600px;
    max-height: 900px;
  }
  .workspace-col {
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #eee;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
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
    background: rgba(74, 108, 247, 0.06);
  }
  .col-resize-handle:hover::before {
    background: var(--blue);
    height: 64px;
  }
  .col-resize-handle.is-dragging {
    background: rgba(74, 108, 247, 0.12);
  }
  .col-resize-handle.is-dragging::before {
    background: var(--blue);
    height: 96px;
  }
  .workspace-2col.is-resizing {
    cursor: col-resize;
    user-select: none;
  }
  .workspace-2col.is-resizing .map-container,
  .workspace-2col.is-resizing .pool-grid {
    pointer-events: none;
  }

  /* MAP CARD — colonne 1 du workspace */
  .map-card-comp {
    min-width: 0;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #eee;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .map-card-comp .map-container {
    flex: 1;
    z-index: 1;
  }

  /* MAP BOTTOM INFO BAR — wrap pour rester lisible en colonne étroite */
  .map-info-bar {
    position: absolute;
    bottom: 12px;
    left: 12px;
    right: 12px;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255,255,255,0.98);
    backdrop-filter: blur(8px);
    border-radius: 10px;
    padding: 10px 14px;
    border: 1px solid rgba(238,238,238,0.8);
    flex-wrap: wrap;
    gap: 10px;
  }
  .map-info-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .map-info-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .map-info-stat-val {
    font-size: 16px;
    font-weight: 700;
    color: var(--green);
  }
  .map-info-stat-label {
    font-size: 10px;
    color: var(--muted);
  }
  .map-info-divider {
    width: 1px;
    height: 28px;
    background: var(--border);
  }
  /* Légende des sources — chips toggle clairs avec checkbox visible.
   * Wrap automatique sur 2 lignes si la colonne est étroite. */
  .map-legend-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  .map-legend-label-hint {
    font-size: 9px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    margin-right: 2px;
    white-space: nowrap;
  }
  .map-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font);
    color: #1a1a1a;
    cursor: pointer;
    padding: 4px 10px 4px 8px;
    border-radius: 14px;
    border: 1.5px solid #d4d4d4;
    background: #fff;
    transition: all 0.15s;
    user-select: none;
    line-height: 1.2;
    white-space: nowrap;
  }
  /* Pseudo "checkbox" devant chaque chip */
  .map-legend-item::before {
    content: '✓';
    width: 13px;
    height: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 800;
    color: #fff;
    background: var(--green);
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    flex-shrink: 0;
  }
  .map-legend-item.is-inactive::before {
    content: '';
    background: #fff;
    border: 1.5px solid #d4d4d4;
    box-shadow: none;
  }
  .map-legend-item:hover {
    border-color: var(--green);
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  }
  .map-legend-item:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: 1px;
  }
  .map-legend-item.is-inactive {
    color: #888;
    background: #f7f7f7;
    border-color: #e0e0e0;
  }
  .map-legend-item.is-inactive:hover {
    color: #1a1a1a;
    background: #fafafa;
    border-color: var(--green);
  }
  .map-legend-item.is-inactive .legend-dot {
    opacity: 0.4;
  }
  .legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid white;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.12);
    display: inline-block;
    flex-shrink: 0;
  }

  /* MAP STYLE TOGGLE */
  .map-style-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1000;
    display: flex;
    background: #fff;
    border-radius: 8px;
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .map-style-btn {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--muted);
    transition: all 0.15s;
    font-family: var(--font);
  }
  .map-style-btn.active {
    background: var(--green);
    color: white;
  }

  /* MAP DRAW CONTROLS */
  .map-draw-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .map-draw-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    color: #555;
    font-family: var(--font);
    transition: all 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .map-draw-btn:hover {
    border-color: var(--blue);
    color: var(--blue);
    background: #f8f9ff;
  }
  .map-draw-btn.active {
    background: var(--blue);
    color: white;
    border-color: var(--blue);
  }
  .map-draw-btn.danger {
    color: var(--red);
    border-color: #fdd;
  }
  .map-draw-btn.danger:hover {
    background: #fef2f2;
    border-color: var(--red);
  }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.5); opacity: 0; }
    100% { transform: scale(1); opacity: 0; }
  }

  /* ─── POOL (colonne 2 — biens disponibles) ─── */
  .pool-panel {
    display: flex;
    flex-direction: column;
  }
  .pool-header {
    padding: 11px 14px 9px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: #fafbfc;
    flex-shrink: 0;
  }
  .pool-header-title {
    font-size: 12px;
    font-weight: 700;
    color: #2c3e50;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .pool-header-count {
    font-size: 11px;
    font-weight: 600;
    color: #777;
    background: #fff;
    padding: 2px 9px;
    border-radius: 12px;
    border: 1px solid #e8e8e8;
  }
  .pool-grid {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
    align-content: flex-start;
  }
  .pool-grid::-webkit-scrollbar { width: 6px; }
  .pool-grid::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }

  /* ═══════════════════════════════════════════════════════════════
   * Pool en sections classées : Marché théorique (haut) → Marché réel
   * (bas). Chaque section a un header marqué (couleur, sous-titre),
   * et contient des sous-sections par source (DVF, En cours, etc.)
   * ═══════════════════════════════════════════════════════════════ */
  .pool-sections {
    /* Se dimensionne à son contenu (drops fermés = court), peut rétrécir et
     * scroller quand un drop est ouvert. Le panier ci-dessous absorbe la
     * hauteur restante. */
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .pool-sections::-webkit-scrollbar { width: 6px; }
  .pool-sections::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
  .pool-section-block {
    display: flex;
    flex-direction: column;
  }
  .pool-section-block:not(:last-child) {
    border-bottom: 3px solid #ececec;
  }
  /* Header de section = bouton repliable (dropdown), sticky au scroll. */
  .pool-section-header {
    position: sticky;
    top: 0;
    z-index: 5;
    width: 100%;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: filter 0.12s;
  }
  .pool-section-header:hover { filter: brightness(0.97); }
  /* Fonds gradient (charte ideeri) : une variante de couleur par catégorie */
  .pool-section-block.theorique .pool-section-header {
    background: linear-gradient(120deg, #FFCF30 0%, #FFDB66 45%, #FFF6CB 100%);
  }
  .pool-section-block.reel .pool-section-header {
    background: linear-gradient(120deg, #27AA66 0%, #50BD77 45%, #A8E2C0 100%);
  }
  .pool-section-block.invendus .pool-section-header {
    background: linear-gradient(120deg, #FD3F17 0%, #FF8A3C 50%, #FFD06A 100%);
  }
  /* Caret indiquant l'état ouvert/fermé du dropdown */
  .pool-section-caret {
    font-size: 18px;
    transition: transform 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }
  .pool-section-block.theorique .pool-section-caret { color: #8a5a10; }
  .pool-section-block.reel .pool-section-caret { color: #15633a; }
  .pool-section-block.invendus .pool-section-caret { color: #8c2408; }
  .pool-section-caret.is-open { transform: rotate(90deg); }
  .pool-section-title {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    line-height: 1.1;
    margin-right: auto;
  }
  .pool-section-block.theorique .pool-section-title { color: #5c3d08; }
  .pool-section-block.reel .pool-section-title { color: #0e4a2b; }
  .pool-section-block.invendus .pool-section-title { color: #7a1e06; }
  .pool-section-count {
    background: rgba(255, 255, 255, 0.85);
    padding: 3px 9px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .pool-section-block.theorique .pool-section-count {
    color: #5c3d08; border: 1px solid rgba(140, 90, 16, 0.25);
  }
  .pool-section-block.reel .pool-section-count {
    color: #0e4a2b; border: 1px solid rgba(14, 74, 43, 0.22);
  }
  .pool-section-block.invendus .pool-section-count {
    color: #7a1e06; border: 1px solid rgba(122, 30, 6, 0.22);
  }
  /* Quand replié : pas de bordure 3px séparatrice résiduelle gênante */
  .pool-section-block.is-collapsed .pool-section-header { border-bottom: none; }

  /* Sous-section par source (En cours, DVF, etc.) */
  .pool-subsection {
    padding: 10px 12px 12px;
    border-top: 1px solid #f3f3f3;
  }
  .pool-subsection:first-of-type { border-top: none; }
  .pool-subsection.is-empty { padding-bottom: 8px; }
  .pool-subsection-head {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 7px;
  }
  .pool-subsection-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.12);
    flex-shrink: 0;
  }
  .pool-subsection-label {
    font-size: 11px;
    font-weight: 700;
    color: #1a1a1a;
    letter-spacing: 0.2px;
  }
  .pool-subsection-count {
    font-size: 10px;
    color: #888;
    margin-left: auto;
    background: #f5f5f5;
    padding: 1px 7px;
    border-radius: 8px;
    font-weight: 600;
  }
  .pool-subsection-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .pool-subsection-empty {
    font-size: 10px;
    color: #c0c0c0;
    font-style: italic;
    padding: 2px 0 0 16px;
  }

  /* Carte miniature draggable d'un bien du pool */
  .pool-card {
    position: relative;
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    overflow: hidden;
    cursor: grab;
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s, opacity 0.15s;
    user-select: none;
  }
  .pool-card:hover {
    box-shadow: 0 4px 14px rgba(0,0,0,0.08);
    border-color: var(--blue);
    transform: translateY(-1px);
  }
  .pool-card:active { cursor: grabbing; }
  .pool-card.is-dragging {
    opacity: 0.45;
    transform: scale(0.97);
    border-style: dashed;
  }
  .pool-card-photo {
    width: 100%;
    height: 88px;
    background-size: cover;
    background-position: center;
    position: relative;
    background-color: #f3f4f6;
    flex-shrink: 0;
  }
  .pool-card-photo.no-photo {
    background: linear-gradient(135deg, #e6e9ef 0%, #cfd5e0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 26px;
  }
  .pool-card-photo.source-dvf.no-photo {
    background: linear-gradient(135deg, #d8e3f4 0%, #b8c8e6 100%);
    color: var(--blue);
  }
  .pool-card-photo.source-ideeri.no-photo {
    background: linear-gradient(135deg, #d6efdf 0%, #a8d8b8 100%);
    color: #2d8856;
  }
  /* Carrousel vignette : flèches + dots visibles au hover de la carte. */
  .pool-carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(255,255,255,0.9);
    color: #333;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    z-index: 2;
  }
  .pool-carousel-arrow.left { left: 6px; }
  .pool-carousel-arrow.right { right: 6px; }
  .pool-card:hover .pool-carousel-arrow { opacity: 1; }
  .pool-carousel-arrow:hover { background: #fff; }
  .pool-carousel-dots {
    position: absolute;
    bottom: 5px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 4px;
    z-index: 2;
  }
  .pool-carousel-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255,255,255,0.6);
    box-shadow: 0 0 2px rgba(0,0,0,0.4);
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }
  .pool-carousel-dot.active {
    background: #fff;
    transform: scale(1.25);
  }
  .pool-card-source-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px 2px 6px;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(4px);
    border-radius: 10px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #444;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .pool-card-score-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 2px 7px;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(4px);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .pool-card-score-badge.score-high { color: #15803d; }
  .pool-card-score-badge.score-mid { color: #c2410c; }
  .pool-card-score-badge.score-low { color: #b91c1c; }
  .pool-card-body {
    padding: 8px 10px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-height: 0;
  }
  .pool-card-title {
    font-size: 12.5px;
    font-weight: 700;
    color: #222;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pool-card-meta {
    font-size: 10.5px;
    color: #888;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pool-card-price {
    font-size: 13px;
    font-weight: 700;
    color: var(--green);
    margin-top: 3px;
    line-height: 1.2;
  }
  .pool-card-price-m2 {
    font-size: 10px;
    font-weight: 500;
    color: #999;
    margin-left: 3px;
  }
  /* Badge V1 — biens qui étaient dans l'étude précédente.
   * Position : coin haut-gauche de la card (sur la photo).
   * Couleur fond = statut d'évolution (vendu, encore en vente, etc.) */
  .pool-card-v1-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #fff;
    color: #1a1a1a;
    border: 1.5px solid;
    padding: 2px 7px 2px 6px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    line-height: 1.2;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    pointer-events: auto;
    cursor: help;
  }
  .pool-card-v1-badge .v1-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .pool-card-v1-badge .v1-delta {
    font-weight: 600;
    color: inherit;
  }
  /* Toggle on/off de la comparaison V1 */
  .v1-toggle-bar {
    background: #fff;
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .v1-toggle-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #555;
  }
  .v1-toggle-info strong { color: #1a1a1a; font-weight: 700; }
  .v1-toggle-icon {
    font-size: 14px;
    line-height: 1;
  }
  .v1-toggle-date,
  .v1-toggle-count {
    color: #888;
    font-weight: 500;
  }
  /* Switch toggle (style iOS-like) */
  .v1-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .v1-switch input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }
  .v1-switch-track {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    background: #d0d6dd;
    border-radius: 10px;
    transition: background 0.18s ease;
  }
  .v1-switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.18);
    transition: transform 0.18s ease;
  }
  .v1-switch.is-on .v1-switch-track {
    background: #46B962;
  }
  .v1-switch.is-on .v1-switch-thumb {
    transform: translateX(16px);
  }

  /* Bandeau "biens disparus de l'offre" au-dessus du workspace */
  .previous-missing-bar {
    background: linear-gradient(90deg, #fff8e1 0%, #fffdf6 100%);
    border: 1px solid #ffe082;
    border-left: 4px solid #f5a623;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .previous-missing-bar-text {
    flex: 1;
    font-size: 12px;
    color: #8a5a30;
    font-weight: 500;
  }
  .previous-missing-bar-text strong { font-weight: 700; }
  .previous-missing-bar-toggle {
    background: rgba(255,255,255,0.7);
    border: 1px solid #ffd97a;
    color: #8a5a30;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .previous-missing-bar-toggle:hover { background: #fff; border-color: #f5a623; }
  .previous-missing-list {
    width: 100%;
    margin-top: 6px;
    padding-top: 10px;
    border-top: 1px dashed #ffe082;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .previous-missing-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: #555;
    padding: 4px 0;
  }
  .previous-missing-item-source {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .previous-missing-item-title {
    flex: 1;
    color: #1a1a1a;
    font-weight: 600;
  }
  .previous-missing-item-price {
    color: #8a5a30;
    font-weight: 600;
  }
  /* Bouton "Sélectionner" en pied de carte du pool : ajoute le bien
   * à la sélection (le retire du pool, le fait apparaître dans le récap). */
  .pool-card-select-btn {
    width: 100%;
    padding: 6px 0;
    border: none;
    border-top: 1px solid #eee;
    background: #f6faf7;
    color: #2d8856;
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
  }
  .pool-card-select-btn:hover {
    background: var(--green);
    color: #fff;
  }

  /* ─── Panier de sélection (bas de la colonne pool) ───
   * flex:1 → absorbe la hauteur restante : prend toute la place quand les
   * drops sont fermés, rétrécit quand un drop s'ouvre. */
  .pool-basket {
    flex: 1 1 auto;
    min-height: 120px;
    margin: 10px;
    border: 1px solid #d4ead8;
    border-radius: 10px;
    background: #f7fcf9;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .pool-basket-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #ecf7f0;
    border-bottom: 1px solid #d4ead8;
  }
  .pool-basket-title {
    font-size: 12px;
    font-weight: 700;
    color: #1f6e44;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .pool-basket-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--green);
    background: #fff;
    padding: 2px 9px;
    border-radius: 11px;
    border: 1px solid #d4ead8;
  }
  .pool-basket-empty {
    padding: 16px 14px;
    text-align: center;
    font-size: 12px;
    font-style: italic;
    color: #9aa;
  }
  /* Liste = grille de mini-vignettes ; scroll interne quand ça déborde. */
  .pool-basket-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 8px;
    padding: 8px;
    align-content: start;
  }
  .pool-basket-item {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #e8efe9;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .pool-basket-item:hover {
    border-color: var(--green);
    box-shadow: 0 2px 6px rgba(70,185,98,0.16);
  }
  .pool-basket-thumb {
    width: 100%;
    height: 58px;
    background-size: cover;
    background-position: center;
    background-color: #f3f4f6;
    position: relative;
  }
  .pool-basket-thumb.no-photo {
    background: linear-gradient(135deg, #e6e9ef 0%, #cfd5e0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 20px;
  }
  .pool-basket-thumb.source-dvf.no-photo {
    background: linear-gradient(135deg, #d8e3f4 0%, #b8c8e6 100%);
    color: var(--blue);
  }
  .pool-basket-thumb.source-ideeri.no-photo {
    background: linear-gradient(135deg, #d6efdf 0%, #a8d8b8 100%);
    color: #2d8856;
  }
  .pool-basket-item-body {
    padding: 6px 7px 7px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pool-basket-item-title {
    font-size: 11px;
    color: var(--text);
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pool-basket-item-m2 {
    font-size: 11.5px;
    font-weight: 700;
    color: #2d8856;
    white-space: nowrap;
  }
  .pool-basket-item-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: none;
    background: rgba(255,255,255,0.92);
    color: #888;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    transition: all 0.15s;
  }
  .pool-basket-item-remove:hover {
    background: #fde8e8;
    color: #d9534f;
  }
  .pool-basket-dot {
    position: absolute;
    bottom: 4px;
    left: 4px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 0 2px rgba(0,0,0,0.25);
  }

  .section-label {
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
    padding: 4px 0;
  }
  .section-label.others {
    color: var(--muted);
  }

  /* COMP CARD */
  .step3-page .comp-card {
    background: #fff;
    border-radius: var(--radius-card);
    padding: 14px;
    border: 1px solid var(--border);
    position: relative;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .step3-page .comp-card.selected {
    border-color: #ddd;
  }
  .comp-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .comp-card-title {
    font-size: 13px;
    font-weight: 600;
  }
  .comp-card-addr {
    font-size: 11px;
    color: var(--muted);
  }
  .portal-tag {
    font-size: 9px;
    font-weight: 600;
    color: #e87722;
    background: #fff5ee;
    border: 1px solid #fdd8b8;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 4px;
    white-space: nowrap;
  }
  .btn-view-ad {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #e87722;
    background: none;
    border: 1px solid #fdd8b8;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s;
    text-decoration: none;
  }
  .btn-view-ad:hover {
    background: #fff5ee;
    border-color: #e87722;
  }

  .comp-prices {
    display: flex;
    gap: 16px;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 8px;
    font-size: 12px;
  }
  .comp-prices .p-item {
    flex: 1;
  }
  .comp-prices .p-label {
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .comp-prices .p-val {
    font-weight: 600;
  }

  .comp-description {
    font-size: 11px;
    color: #666;
    line-height: 1.5;
    padding: 8px 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
    margin-bottom: 8px;
  }
  .comp-description-label {
    font-size: 10px;
    font-weight: 600;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
  }

  .comp-meta {
    font-size: 11px;
    color: #555;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .reliability {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 500;
    margin-bottom: 8px;
  }
  .reliability.real { background: #f0f8f5; color: #666; }
  .reliability.listed { background: #fffbf0; color: #666; }

  /* SCORING BADGES */
  .scoring-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .score-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12px;
    flex: 1;
    min-width: 0;
  }
  .score-high {
    background: #f0f8f3;
    border: 1.5px solid var(--green);
  }
  .score-mid {
    background: #fef9f0;
    border: 1.5px solid #d97706;
  }
  .score-low {
    background: #fef2f2;
    border: 1.5px solid var(--red);
  }
  .score-badge-label {
    color: #555;
    font-weight: 600;
    font-size: 11px;
  }
  .score-badge-value {
    font-weight: 700;
    font-size: 16px;
  }
  .score-badge-bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .score-badge-fill {
    height: 100%;
    border-radius: 3px;
  }
  .score-high .score-badge-value { color: #2d8a47; }
  .score-high .score-badge-fill { background: var(--green); }
  .score-mid .score-badge-value { color: #b45309; }
  .score-mid .score-badge-fill { background: #d97706; }
  .score-low .score-badge-value { color: #c0392b; }
  .score-low .score-badge-fill { background: var(--red); }
  .data-count {
    font-size: 10px;
    color: #888;
    font-weight: 500;
  }

  /* PERTINENCE DROPDOWN */
  .pertinence-toggle {
    flex: 1;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: filter 0.15s, transform 0.15s;
  }
  .pertinence-toggle:hover { filter: brightness(0.97); }
  .pertinence-chevron {
    color: #555;
    font-size: 10px;
    transition: transform 0.18s ease;
    margin-left: 4px;
  }
  .pertinence-chevron.open { transform: rotate(180deg); }
  .pertinence-detail {
    background: #fafafa;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
    margin-top: -2px;
  }
  .pertinence-detail-row {
    margin-bottom: 12px;
  }
  .pertinence-detail-row:last-of-type { margin-bottom: 8px; }
  .pertinence-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .pertinence-detail-label {
    font-size: 11px;
    font-weight: 600;
    color: #333;
  }
  .pertinence-detail-value {
    font-size: 13px;
    font-weight: 700;
  }
  .pertinence-detail-value.score-high { color: #2d8a47; }
  .pertinence-detail-value.score-mid { color: #b45309; }
  .pertinence-detail-value.score-low { color: #c0392b; }
  .pertinence-detail-bar {
    height: 5px;
    border-radius: 3px;
    background: rgba(0,0,0,0.06);
    overflow: hidden;
    margin-bottom: 4px;
  }
  .pertinence-detail-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
  }
  .pertinence-detail-fill.score-high { background: var(--green); }
  .pertinence-detail-fill.score-mid { background: #d97706; }
  .pertinence-detail-fill.score-low { background: var(--red); }
  .pertinence-detail-hint {
    font-size: 10px;
    color: #888;
    line-height: 1.3;
  }
  .pertinence-detail-formula {
    font-size: 11px;
    color: #555;
    border-top: 1px dashed #d8d8d8;
    padding-top: 8px;
    margin-top: 6px;
  }
  .pertinence-detail-formula strong {
    color: #2d8a47;
    font-weight: 700;
  }

  /* COMP CARD CLICKABLE */
  .step3-page .comp-card.selected.clickable {
    cursor: pointer;
    transition: border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  }
  .step3-page .comp-card.selected.clickable:hover {
    border-color: var(--green);
    box-shadow: 0 4px 14px rgba(70, 185, 98, 0.12);
  }

  /* WEIGHT CONTROL */
  .weight-control {
    background: #f6faf7;
    border: 1px solid #d4ead8;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .weight-control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .weight-control-label {
    font-size: 11px;
    font-weight: 600;
    color: #333;
  }
  .weight-control-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--green);
  }
  .weight-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: #e3eee6;
    outline: none;
    cursor: pointer;
    margin: 0;
  }
  .weight-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--green);
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }
  .weight-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--green);
    border: 2px solid white;
    cursor: pointer;
  }

  /* ADJUSTMENTS */
  .adj-section {
    background: #fafafa;
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid #eee;
  }
  .adj-title {
    font-size: 11px;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .adj-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    padding: 3px 0;
  }
  .adj-row .lbl {
    color: var(--muted);
  }
  .adj-val {
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
  }
  .adj-val.pos { background: rgba(70,185,98,0.1); color: var(--green); }
  .adj-val.neg { background: rgba(231,76,60,0.1); color: var(--red); }

  .comp-actions {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
    align-items: center;
  }
  .link-edit {
    color: var(--blue);
    font-size: 11px;
    text-decoration: none;
    cursor: pointer;
  }
  .btn-remove {
    background: none;
    border: none;
    color: var(--red);
    font-size: 11px;
    cursor: pointer;
    margin-left: auto;
    font-family: var(--font);
  }

  /* ═══════════════════════════════════════════════════════════════
   * Récapitulatif du calcul — version sobre, sans hero.
   * Le prix au m² apparaît dans la ligne "Moyenne pondérée" du tableau,
   * pas en gros chiffre. Carte discrète avec fond blanc + bord neutre.
   * ═══════════════════════════════════════════════════════════════ */
  .estimation-final-card {
    background: #fff;
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 14px 16px;
    margin: 8px 0 18px;
  }
  .estimation-final-card.empty {
    background: #fafafa;
    border: 1px dashed #e0e0e0;
  }
  .estimation-final-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .estimation-final-title-hint {
    font-size: 10px;
    color: #aaa;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }
  .estimation-final-empty {
    font-size: 12px;
    color: #999;
    font-style: italic;
    padding: 8px 0;
  }
  /* Tableau détaillé du calcul (prix/m² brut → correction → ajusté × poids) */
  .estimation-recap-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 12px;
    text-align: center;
  }
  .estimation-recap-table th {
    background: #fafafa;
    padding: 8px 10px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #888;
    font-weight: 600;
    border-bottom: 1px solid #eee;
  }
  .estimation-recap-table td {
    padding: 9px 10px;
    border-bottom: 1px solid #f5f5f5;
    color: #333;
  }
  .estimation-recap-table .t-left { text-align: left; }
  .estimation-recap-table tbody tr:last-child td { border-bottom: none; }
  .estimation-recap-table .t-adj.pos { color: var(--green); font-weight: 600; }
  .estimation-recap-table .t-adj.neg { color: var(--red); font-weight: 600; }
  .estimation-recap-table .t-row-total td {
    background: #f7fbf8;
    border-top: 1.5px solid var(--green);
    color: #1a1a1a;
    font-size: 12px;
    font-weight: 600;
  }
  .t-price {
    font-weight: 600;
    text-align: right;
  }
  .t-adj {
    text-align: center;
    font-weight: 600;
  }
  .t-adj.pos { color: var(--green); }
  .t-adj.neg { color: var(--red); }
  .t-avg {
    background: #f7f7f8;
    font-weight: 600;
  }
  .t-avg td {
    color: #333;
    padding: 11px 10px;
  }
  .t-weight-input {
    width: 48px;
    padding: 3px 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    text-align: center;
    background: white;
    color: var(--green);
    font-weight: 600;
  }
  .t-weight-input:focus {
    border-color: var(--green);
    outline: none;
    box-shadow: 0 0 0 2px rgba(70, 185, 98, 0.15);
  }
  .btn-trash {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #aaa;
    padding: 4px 6px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .btn-trash:hover {
    color: var(--red);
    background: #fef2f2;
  }

  /* FOOTER */
  .footer-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
  }
  .step3-page .btn {
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
    text-decoration: none;
  }
  .step3-page .btn-primary {
    background: var(--green);
    color: white;
  }
  .step3-page .btn-primary:hover {
    background: var(--green-dark);
  }
  .step3-page .btn-ghost {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .step3-page .btn-ghost:hover {
    background: #fafafa;
  }
  .min-note {
    font-size: 11px;
    color: var(--green);
    margin-top: 4px;
  }

  /* COMP CARD PHOTO */
  .comp-card-photo {
    width: 100%;
    height: 120px;
    border-radius: 8px;
    margin-bottom: 10px;
    overflow: hidden;
    position: relative;
  }
  .comp-card-photo.no-photo {
    height: 48px;
    background: #f5f5f5;
    border-radius: 8px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .comp-card-photo.no-photo span {
    font-size: 10px;
    color: #bbb;
  }

  /* COMPACT CARD */
  .step3-page .comp-card.compact {
    padding: 10px 14px;
  }
  .compact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .compact-left {
    flex: 1;
  }
  .compact-title {
    font-size: 12px;
    font-weight: 500;
  }
  .compact-meta {
    font-size: 10px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .compact-scores {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 3px;
  }
  .compact-score {
    font-size: 10px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .compact-score.high { background: #f0f8f5; color: #666; }
  .compact-score.mid { background: #fffbf0; color: #666; }
  .compact-score.low { background: #fff0f0; color: #666; }
  .btn-add {
    background: none;
    border: none;
    color: var(--green);
    font-size: 11px;
    cursor: pointer;
    font-weight: 600;
    margin-left: auto;
    font-family: var(--font);
  }

  /* VALUATIONS */
  .comp-valuations {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #f5f5f5;
    margin-bottom: 8px;
  }
  .val-item {
    flex: 1;
    padding: 8px 12px;
    border-radius: 8px;
    background: #fafafa;
    border: 1px solid #eee;
  }
  .val-item-label {
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 3px;
  }
  .val-item-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }
  .val-item-value.highlight { color: var(--green); }
  .val-item-value.na { font-size: 12px; color: #ccc; font-weight: 500; }
  .val-delta {
    font-size: 10px;
    font-weight: 600;
    margin-top: 2px;
  }
  .val-delta.pos { color: var(--green); }
  .val-delta.neg { color: var(--red); }

  /* ═══════════════════════════════════════════════════════════════
   * BOUTON FILTRES + DRAWER LATÉRAL
   * Tous les filtres détaillés sont dans le drawer. La barre principale
   * ne montre qu'un bouton "Configurer les filtres" + compteur d'actifs.
   * ═══════════════════════════════════════════════════════════════ */
  .filter-panel-compact {
    background: #fff;
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    border: 1px solid #eee;
  }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 10px 14px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .filter-bar h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: #1a1a1a;
  }
  .filter-bar-results {
    font-size: 12px;
    color: var(--green);
    font-weight: 600;
    background: #f0f8f5;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid #d4ead8;
  }
  .filter-bar-spacer { flex: 1; }
  .btn-open-filters {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-open-filters:hover { background: #333; }
  .btn-open-filters .filters-badge {
    background: var(--green);
    color: #fff;
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 11px;
    font-weight: 700;
    min-width: 18px;
    text-align: center;
  }
  .btn-reset-compact {
    background: transparent;
    border: 1px solid #ddd;
    color: #666;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .btn-reset-compact:hover { background: #f5f5f5; border-color: #ccc; color: #333; }
  .filter-bar-second {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  /* Légende sources compactée (7 sources colorées) */
  .filter-legend-7 {
    display: flex;
    gap: 10px 14px;
    flex-wrap: wrap;
    align-items: center;
    font-size: 11px;
    color: #666;
  }
  .filter-legend-7 .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .filter-legend-7 .legend-dot-sm {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  /* Drawer overlay + panel (latéral gauche, slide-in) */
  .filters-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    z-index: 9998;
    display: flex;
    justify-content: flex-start;
    animation: filters-drawer-fade 0.18s ease;
  }
  @keyframes filters-drawer-fade {
    from { background: rgba(0, 0, 0, 0); }
    to { background: rgba(0, 0, 0, 0.42); }
  }
  .filters-drawer-panel {
    position: relative;
    width: 460px;
    max-width: 95vw;
    height: 100vh;
    background: #fff;
    overflow-y: auto;
    overflow-x: hidden;
    animation: filters-drawer-slide 0.25s ease;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.12);
    font-family: var(--font);
    display: flex;
    flex-direction: column;
  }
  .filters-drawer-resize {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    z-index: 20;
    background: transparent;
    transition: background 0.15s;
  }
  .filters-drawer-resize::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 2px;
    transform: translateY(-50%);
    width: 4px;
    height: 44px;
    border-radius: 3px;
    background: #d8d8d8;
    transition: background 0.15s;
  }
  .filters-drawer-resize:hover { background: rgba(70, 185, 98, 0.06); }
  .filters-drawer-resize:hover::after { background: var(--green); }
  @keyframes filters-drawer-slide {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
  .filters-drawer-header {
    position: sticky;
    top: 0;
    background: #fff;
    padding: 18px 22px 14px;
    border-bottom: 1px solid #eee;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .filters-drawer-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: #1a1a1a;
    flex: 1;
  }
  .filters-drawer-results {
    font-size: 12px;
    color: var(--green);
    font-weight: 600;
    background: #f0f8f5;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid #d4ead8;
  }
  .filters-drawer-close {
    background: #f5f5f5;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .filters-drawer-close:hover { background: #ececec; color: #1a1a1a; }
  .filters-drawer-body {
    padding: 14px 22px 28px;
    flex: 1;
  }
  .filters-drawer-section {
    margin-bottom: 22px;
  }
  .filters-drawer-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .filters-drawer-section-hint {
    font-size: 10px;
    color: #aaa;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }
  .filters-drawer-section-body {
    background: #fafafa;
    border-radius: 10px;
    padding: 12px 14px;
    border: 1px solid #eee;
  }
  /* Footer drawer avec actions (réinitialiser + appliquer) */
  .filters-drawer-footer {
    position: sticky;
    bottom: 0;
    background: #fff;
    padding: 14px 22px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    align-items: center;
  }
  .filters-drawer-footer .btn-reset {
    background: transparent;
    border: 1px solid #ddd;
    color: #666;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .filters-drawer-footer .btn-reset:hover { background: #f5f5f5; }
  .filters-drawer-footer .btn-apply {
    background: var(--green);
    color: #fff;
    border: none;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .filters-drawer-footer .btn-apply:hover { background: #3da653; }
`;

// Coordinates for comparables (Lyon 3ème area)
const COMP_COORDS = {
  villeroy: [45.7565, 4.8635],
  lacassagne: [45.7545, 4.8680],
  paulbert: [45.7600, 4.8560],
  duguesclin: [45.7530, 4.8550],
  lafayette: [45.7590, 4.8720],
  mazenod: [45.7575, 4.8510],
  guichard: [45.7610, 4.8600],
  felixfaure: [45.7540, 4.8470],
};

// Target property coords
const TARGET_COORDS = [45.7578, 4.8590];

const PORTAL_NAMES = ['Leboncoin', 'SeLoger', 'Bien Ici', 'Belles Demeures'];
const randomPortalName = () => PORTAL_NAMES[Math.floor(Math.random() * PORTAL_NAMES.length)];

// Selected comparable data matching the wireframe
const INITIAL_SELECTED = [
  {
    id: 'villeroy',
    title: 'T3 68m\u00b2 \u2014 8 rue Villeroy',
    addr: 'Lyon 3\u00e8me',
    source: 'dvf',
    sourceLabel: 'DVF',
    prix: '285 000',
    prixM2: '4 191',
    prixNum: 285000,
    distance: '380m',
    venteLabel: '285 000 \u20ac',
    venteDetail: '3 926 \u20ac/m\u00b2 net vendeur',
    avisLabel: '\u2014 Non disponible',
    avisDetail: 'Source DVF : pas d\'avis agent',
    avisNa: true,
    meta: '\u00c9tage 3/5 \u00b7 DPE C \u00b7 Vendu il y a 4 mois',
    similarite: 87,
    simClass: 'score-high',
    donnees: 68,
    donClass: 'score-mid',
    donCount: '124 / 182',
    reliability: 'real',
    reliabilityLabel: '\ud83d\udfe2 Transaction r\u00e9elle',
    adjTotal: '\u22122.1%',
    adjTotalClass: 'neg',
    adjustments: [
      { lbl: 'Surface (\u22124.5m\u00b2)', val: '+1.8%', cls: 'pos' },
      { lbl: 'DPE (C vs D)', val: '\u22122.5%', cls: 'neg' },
      { lbl: '\u00c9tage (3 vs 4)', val: '\u22120.8%', cls: 'neg' },
      { lbl: 'Ext\u00e9rieurs', val: '\u22120.6%', cls: 'neg' },
    ],
    description: '',
    noPhoto: true,
    surface: 68,
    pieces: 3,
    // DVF : données minimales (pas de description, pas de photos, pas d'historique de commercialisation)
    dateMutationISO: '2025-12-12',
    coords: [45.7565, 4.8635],
    parcelleRef: '69383 BL 0142',
  },
  {
    id: 'lacassagne',
    title: 'T3 75m\u00b2 \u2014 22 av. Lacassagne',
    addr: 'Lyon 3\u00e8me',
    source: 'ideeri',
    sourceLabel: 'Ideeri vendu',
    prix: '310 000',
    prixM2: '4 133',
    prixNum: 310000,
    distance: '520m',
    venteLabel: '310 000 \u20ac',
    venteDetail: '4 133 \u20ac/m\u00b2 net vendeur',
    avisLabel: '300 000 \u20ac',
    avisDetail: '\u25b2 \u22123.2% vs vente \u2014 Estimation pr\u00e9cise',
    avisHighlight: true,
    avisPos: true,
    meta: '\u00c9tage 5/6 \u00b7 DPE D \u00b7 Vendu il y a 2 mois',
    similarite: 92,
    simClass: 'score-high',
    donnees: 95,
    donClass: 'score-high',
    donCount: '545 / 575',
    reliability: 'real',
    reliabilityLabel: '\ud83d\udfe2 Transaction r\u00e9elle',
    adjTotal: '+1.5%',
    adjTotalClass: 'pos',
    adjustments: [
      { lbl: 'Surface (+2.5m\u00b2)', val: '\u22120.9%', cls: 'neg' },
      { lbl: '\u00c9tage (5 vs 4)', val: '+1.2%', cls: 'pos' },
      { lbl: 'Terrasse 8m\u00b2', val: '+1.2%', cls: 'pos' },
    ],
    description: 'Appartement T3 rénové de 75m² au 5ème étage avec terrasse de 8m². Vue dégagée, séjour double exposition, cuisine ouverte aménagée, salle de bain avec douche italienne. Copropriété bien entretenue, gardien.',
    noPhoto: false,
    photoUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=520&h=140&fit=crop&crop=bottom',
    surface: 75,
    pieces: 3,
    // Ideeri vendu : jeu complet
    photos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=900&h=600&fit=crop',
    ],
    rooms: [
      { nom: 'Salon / S\u00e9jour', surface: 26, etage: 5, etat: 'R\u00e9nov\u00e9 2022' },
      { nom: 'Cuisine ouverte', surface: 11, etage: 5, etat: 'Refaite \u00e0 neuf' },
      { nom: 'Chambre 1', surface: 14, etage: 5, etat: 'Bon \u00e9tat' },
      { nom: 'Chambre 2', surface: 11, etage: 5, etat: 'Bon \u00e9tat' },
      { nom: 'Salle de bain', surface: 6, etage: 5, etat: 'Refaite (douche italienne)' },
      { nom: 'WC s\u00e9par\u00e9', surface: 2, etage: 5, etat: 'Bon \u00e9tat' },
      { nom: 'Entr\u00e9e / D\u00e9gagement', surface: 5, etage: 5, etat: 'Bon \u00e9tat' },
      { nom: 'Terrasse', surface: 8, etage: 5, etat: 'Carrel\u00e9e, expos\u00e9e Sud' },
    ],
    infosGenerales: {
      chauffage: 'Gaz individuel \u2014 chaudi\u00e8re Frisquet 2019',
      rafraichissement: 'Aucun (orient\u00e9 Est)',
      surfaceHabitable: 75,
      surfaceExterieurs: 8,
      dependances: 'Cave priv\u00e9e 5 m\u00b2',
      sol: 'Parquet ch\u00eane massif (s\u00e9jour, chambres) + carrelage gr\u00e8s c\u00e9rame (cuisine, sdb)',
      menuiseries: 'PVC double vitrage 2018',
      toitureCharpente: 'Toiture terrasse \u00e9tanch\u00e9it\u00e9 refaite 2020',
      dpe: 'D',
      ges: 'D',
      anneeConstruction: 1975,
      renovationAnnee: 2022,
      etatGeneral: 'Tr\u00e8s bon \u00e9tat \u2014 r\u00e9nov\u00e9 2022',
      emplacement: 'Centre-ville Lyon 3\u00e8me, vue d\u00e9gag\u00e9e sur jardin int\u00e9rieur, calme, vis-\u00e0-vis nul',
    },
    atoutsQualitatifs: ['Lumineux double exposition', 'Terrasse 8m\u00b2', 'R\u00e9nov\u00e9 r\u00e9cemment', 'Calme', 'Cave', 'Gardien', 'Proche m\u00e9tro Sans-Souci'],
    pointsContraintes: ['Pas de parking', 'Pas d\'ascenseur dispens\u00e9 (B\u00e2ti des ann\u00e9es 70)'],
    historique: [
      { date: '2025-09-12', evenement: 'Estimation agent', prix: 320000 },
      { date: '2025-09-25', evenement: 'Mise en commercialisation', prix: 325000 },
      { date: '2025-11-10', evenement: 'Baisse de prix', prix: 315000 },
      { date: '2025-12-18', evenement: 'Compromis sign\u00e9', prix: 310000 },
      { date: '2026-02-10', evenement: 'Vente conclue', prix: 310000 },
    ],
    joursEnCommercialisation: 84,
  },
  {
    id: 'paulbert',
    title: 'T2 62m\u00b2 \u2014 15 rue Paul Bert',
    addr: 'Lyon 3\u00e8me',
    source: 'encours',
    sourceLabel: 'En cours',
    prix: '265 000',
    prixM2: '4 274',
    prixNum: 265000,
    distance: '290m',
    venteLabel: '\u2014 En cours de vente',
    venteDetail: 'Prix affich\u00e9 : 265 000 \u20ac',
    venteNa: true,
    avisLabel: '258 000 \u20ac',
    avisDetail: '\u25bc \u22122.6% vs prix affich\u00e9',
    avisHighlight: true,
    avisNeg: true,
    meta: '\u00c9tage 2/4 \u00b7 DPE E \u00b7 En vente 45 jours',
    similarite: 61,
    simClass: 'score-mid',
    donnees: 7,
    donClass: 'score-low',
    donCount: '13 / 182',
    reliability: 'listed',
    reliabilityLabel: '\ud83d\udfe0 Prix affich\u00e9',
    adjTotal: '\u22123.8%',
    adjTotalClass: 'neg',
    adjustments: [
      { lbl: 'Surface (\u221210.5m\u00b2)', val: '+3.1%', cls: 'pos' },
      { lbl: 'Type (T2 vs T3)', val: '\u22124.2%', cls: 'neg' },
      { lbl: 'DPE (E vs D)', val: '\u22122.7%', cls: 'neg' },
    ],
    description: 'T2 de 62m² au 2ème étage, en cours de vente. Séjour avec balcon côté rue, chambre calme sur cour, cuisine semi-équipée. DPE E, travaux d\'isolation à prévoir. Proche transports et commerces Paul Bert.',
    noPhoto: false,
    photoUrl: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=520&h=140&fit=crop&crop=center',
    surface: 62,
    pieces: 2,
    // Ideeri en cours : jeu complet sans vente finale
    photos: [
      'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=900&h=600&fit=crop',
    ],
    rooms: [
      { nom: 'S\u00e9jour avec balcon', surface: 22, etage: 2, etat: 'Bon \u00e9tat' },
      { nom: 'Cuisine semi-\u00e9quip\u00e9e', surface: 8, etage: 2, etat: 'Correct' },
      { nom: 'Chambre', surface: 13, etage: 2, etat: 'Bon \u00e9tat' },
      { nom: 'Salle de bain', surface: 5, etage: 2, etat: '\u00c0 rafra\u00eechir' },
      { nom: 'WC', surface: 1.5, etage: 2, etat: 'Correct' },
      { nom: 'Entr\u00e9e', surface: 4, etage: 2, etat: 'Correct' },
      { nom: 'Balcon', surface: 4, etage: 2, etat: 'C\u00f4t\u00e9 rue' },
    ],
    infosGenerales: {
      chauffage: 'Chauffage collectif gaz',
      rafraichissement: 'Aucun',
      surfaceHabitable: 62,
      surfaceExterieurs: 4,
      dependances: 'Local v\u00e9lo commun',
      sol: 'Parquet stratifi\u00e9 (s\u00e9jour, chambre) + lino (cuisine, sdb)',
      menuiseries: 'Bois simple vitrage \u2014 \u00e0 r\u00e9nover',
      toitureCharpente: 'Toiture commune correcte',
      dpe: 'E',
      ges: 'E',
      anneeConstruction: 1968,
      renovationAnnee: null,
      etatGeneral: 'Correct \u2014 travaux d\'isolation \u00e0 pr\u00e9voir',
      emplacement: 'Quartier Paul Bert, proche commerces, balcon c\u00f4t\u00e9 rue (passages), chambre c\u00f4t\u00e9 cour calme',
    },
    atoutsQualitatifs: ['Balcon', 'Proche transports', 'Quartier vivant', 'Chambre calme c\u00f4t\u00e9 cour'],
    pointsContraintes: ['Pas d\'ascenseur', 'DPE E', 'Stationnement difficile', 'Travaux d\'isolation \u00e0 pr\u00e9voir'],
    historique: [
      { date: '2025-12-15', evenement: 'Estimation agent', prix: 270000 },
      { date: '2026-01-05', evenement: 'Mise en commercialisation', prix: 275000 },
      { date: '2026-02-20', evenement: 'Baisse de prix', prix: 265000 },
    ],
    joursEnCommercialisation: 90,
  },
  {
    id: 'felixfaure',
    title: 'T3 69m\u00b2 \u2014 42 av. F\u00e9lix Faure',
    addr: 'Lyon 3\u00e8me',
    source: 'portail',
    sourceLabel: 'Annonce portail',
    portalName: 'Leboncoin',
    prix: '289 000',
    prixM2: '4 188',
    prixNum: 289000,
    distance: '1.1km',
    venteLabel: '\u2014 En ligne',
    venteDetail: 'Prix affich\u00e9 : 289 000 \u20ac',
    venteNa: true,
    avisLabel: '\u2014',
    avisDetail: 'Pas d\'avis agent (annonce externe)',
    avisNa: true,
    meta: '\u00c9tage 4/5 \u00b7 DPE D \u00b7 En ligne 62 jours',
    similarite: 76,
    simClass: 'score-mid',
    donnees: 38,
    donClass: 'score-low',
    donCount: '69 / 182',
    reliability: 'listed',
    reliabilityLabel: '\ud83d\udfe0 Prix affich\u00e9',
    adjTotal: '\u22121.5%',
    adjTotalClass: 'neg',
    adjustments: [
      { lbl: 'Surface (-3.5m\u00b2)', val: '\u22121.6%', cls: 'neg' },
      { lbl: '\u00c9tage (4 vs 4)', val: '0%', cls: 'pos' },
      { lbl: 'DPE \u00e9quivalent', val: '+0.1%', cls: 'pos' },
    ],
    description: '',
    noPhoto: false,
    photoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=520&h=140&fit=crop',
    surface: 69,
    pieces: 3,
    // Donn\u00e9es propres aux annonces de portails
    photos: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=900&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=900&h=600&fit=crop',
    ],
    descriptifAnnonce: "Bel appartement T3 de 69 m\u00b2 situ\u00e9 dans une copropri\u00e9t\u00e9 de standing avenue F\u00e9lix Faure. Au 4\u00e8me \u00e9tage avec ascenseur, cet appartement traversant b\u00e9n\u00e9ficie d'une belle luminosit\u00e9 naturelle gr\u00e2ce \u00e0 sa double exposition Est/Ouest.\n\nIl se compose d'une entr\u00e9e avec rangement, d'un s\u00e9jour spacieux donnant sur balcon, d'une cuisine s\u00e9par\u00e9e am\u00e9nag\u00e9e et \u00e9quip\u00e9e, de deux chambres avec placards, d'une salle de bain et de WC s\u00e9par\u00e9s.\n\nProche de toutes commodit\u00e9s : commerces, transports (M\u00e9tro Sans-Souci \u00e0 200m, Tram T3 \u00e0 300m), \u00e9coles. Cave et possibilit\u00e9 de location de parking en sous-sol.\n\nDPE D \u2014 GES D. Charges de copropri\u00e9t\u00e9 : 145 \u20ac/mois. Taxe fonci\u00e8re : 1 240 \u20ac/an. Bien soumis au statut de la copropri\u00e9t\u00e9.",
    // Crit\u00e8res structur\u00e9s tels qu'ils apparaissent sur Leboncoin / SeLoger / BienIci
    criteresPortail: [
      { label: 'Type de bien', value: 'Appartement' },
      { label: 'Surface habitable', value: '69 m\u00b2' },
      { label: 'Nombre de pi\u00e8ces', value: '3' },
      { label: 'Nombre de chambres', value: '2 ch.' },
      { label: '\u00c9tage', value: '4\u1d49' },
      { label: 'Nombre d\u2019\u00e9tages dans l\u2019immeuble', value: '5' },
      { label: 'Ascenseur', value: 'Oui' },
      { label: 'Ext\u00e9rieur', value: 'Balcon' },
      { label: 'Caract\u00e9ristiques', value: 'Cuisine \u00e9quip\u00e9e' },
      { label: '\u00c9tat du bien', value: 'Bon \u00e9tat' },
      { label: 'Cave', value: 'Oui' },
      { label: 'Parking', value: 'En location (sous-sol)' },
      { label: 'Exposition', value: 'Est / Ouest (double)' },
      { label: 'Chauffage', value: 'Gaz collectif' },
      { label: 'Charges de copropri\u00e9t\u00e9', value: '145 \u20ac / mois' },
      { label: 'Taxe fonci\u00e8re', value: '1 240 \u20ac / an' },
      { label: 'Date de r\u00e9alisation du DPE', value: '12 d\u00e9cembre 2025' },
      { label: 'R\u00e9f\u00e9rence annonce', value: 'LBC-1949642' },
    ],
    agence: {
      nom: 'Century 21 Lyon Part-Dieu',
      agent: 'Marc Dupont',
      telephone: '04 78 XX XX XX',
    },
    urlAnnonce: '#',
    datePublication: '2025-12-28',
    historique: [
      { date: '2025-12-28', evenement: 'Mise en ligne', prix: 305000 },
      { date: '2026-01-25', evenement: 'Baisse de prix', prix: 295000 },
      { date: '2026-02-18', evenement: 'Baisse de prix', prix: 289000 },
    ],
    joursEnCommercialisation: 62,
    // Infos partielles disponibles via le portail
    infosGenerales: {
      surfaceHabitable: 69,
      surfaceExterieurs: 4,
      dependances: 'Cave',
      chauffage: 'Gaz collectif',
      rafraichissement: null,
      dpe: 'D',
      ges: 'D',
      anneeConstruction: 1980,
      etatGeneral: 'Bon \u00e9tat g\u00e9n\u00e9ral (selon annonce)',
      emplacement: 'Avenue F\u00e9lix Faure, Lyon 3\u00e8me, proche m\u00e9tro Sans-Souci',
    },
  },
];

/* Mocks comparables démo (Lyon 3). Le `fields` ↓ porte les valeurs réellement
 * renseignées sur chaque comparable. Le compteur "X/Y champs" n'est PAS figé :
 * il est calculé dynamiquement (cf. enrichWithCoverage) en intersection avec
 * les champs renseignés sur le bien cible (Step 1).
 *
 * Variabilité voulue :
 * - DVF : ~5 champs (donnée publique brute)
 * - Ideeri complet : ~25-28 champs (mandat saisi à fond par l'agent)
 * - Ideeri partiel : ~14-18 champs (saisie incomplète)
 * - En cours : ~14-20 champs (mandat actif, saisie en cours)
 * - Portails : ~7-9 champs (titre annonce + DPE + prix)
 */
const INITIAL_OTHERS = [
  /* DVF (vente publique, données limitées). */
  {
    id: 'duguesclin', title: 'T3 70m\u00b2 \u2014 5 rue Duguesclin, Lyon 3',
    source: 'dvf', meta: 'DVF \u00b7 295k\u20ac \u00b7 4 214\u20ac/m\u00b2 \u00b7 750m',
    simScore: '84% sim.', simClass: 'high',
    fields: { type: 'appartement', surface: 70, pieces: 3, prix: 295000, prixM2: 4214 },
  },
  {
    id: 'mazenod', title: 'T2 55m\u00b2 \u2014 33 rue Mazenod, Lyon 3',
    source: 'dvf', meta: 'DVF \u00b7 240k\u20ac \u00b7 4 363\u20ac/m\u00b2 \u00b7 420m',
    simScore: '71% sim.', simClass: 'mid',
    fields: { type: 'appartement', surface: 55, pieces: 2, prix: 240000, prixM2: 4363 },
  },
  /* Vendu par Ideeri (forte qualité données). */
  {
    id: 'guichard', title: 'T3 71m\u00b2 \u2014 7 place Guichard, Lyon 3',
    source: 'ideeri', meta: 'Ideeri \u00b7 298k\u20ac \u00b7 4 197\u20ac/m\u00b2 \u00b7 310m',
    simScore: '89% sim.', simClass: 'high',
    fields: {
      type: 'appartement', surface: 71, surfaceUtile: 71, pieces: 3, chambres: 2,
      sdb: 1, wc: 1, etage: 4, etagesTotal: 6, orientation: 'Sud-Ouest',
      ascenseur: true, cave: 4, balcon: 6,
      anneeConstruction: 1972, epoqueConstruction: 'Ann\u00e9es 70',
      facadesEtat: 'Bon \u00e9tat', vitrage: 'Double vitrage r\u00e9cent',
      chauffageType: 'Individuel', chauffageEnergie: 'Gaz',
      dpe: 'D', dpeConsommation: 195, ges: 'D',
      cuisineEquipee: true, etatCuisine: 'R\u00e9cente',
      prix: 298000, prixM2: 4197,
    },
  },
  {
    id: 'paulbert', title: 'T4 92m\u00b2 \u2014 14 rue Paul Bert, Lyon 3',
    source: 'ideeri', meta: 'Ideeri \u00b7 410k\u20ac \u00b7 4 456\u20ac/m\u00b2 \u00b7 680m',
    simScore: '76% sim.', simClass: 'mid',
    fields: {
      type: 'appartement', surface: 92, pieces: 4, chambres: 3, sdb: 1, wc: 2,
      etage: 2, etagesTotal: 5, orientation: 'Est', ascenseur: false, balcon: 4,
      anneeConstruction: 1965, chauffageType: 'Collectif',
      dpe: 'E', ges: 'E', cuisineEquipee: true,
      prix: 410000, prixM2: 4456,
    },
  },
  /* En cours de commercialisation (mandats actifs Ideeri). */
  {
    id: 'rambaud', title: 'T3 68m\u00b2 \u2014 22 avenue Rambaud, Lyon 3',
    source: 'encours', meta: 'En cours \u00b7 285k\u20ac \u00b7 4 191\u20ac/m\u00b2 \u00b7 540m',
    simScore: '82% sim.', simClass: 'high',
    fields: {
      type: 'appartement', surface: 68, pieces: 3, chambres: 2, sdb: 1, wc: 1,
      etage: 3, etagesTotal: 7, orientation: 'Sud', ascenseur: true,
      cave: 3, balcon: 5,
      anneeConstruction: 1980, epoqueConstruction: 'Ann\u00e9es 80',
      vitrage: 'Double vitrage',
      chauffageType: 'Individuel', chauffageEnergie: '\u00c9lectrique',
      dpe: 'D', ges: 'C', cuisineEquipee: true, etatCuisine: '\u00c0 r\u00e9nover',
      prix: 285000, prixM2: 4191,
    },
  },
  {
    id: 'felixfaure', title: 'T2 48m\u00b2 \u2014 9 avenue F\u00e9lix Faure, Lyon 3',
    source: 'encours', meta: 'En cours \u00b7 215k\u20ac \u00b7 4 479\u20ac/m\u00b2 \u00b7 920m',
    simScore: '64% sim.', simClass: 'mid',
    fields: {
      type: 'appartement', surface: 48, pieces: 2, chambres: 1, sdb: 1, wc: 1,
      etage: 1, etagesTotal: 4, anneeConstruction: 1980,
      chauffageType: 'Collectif', chauffageEnergie: 'Gaz',
      dpe: 'D', ges: 'D',
      prix: 215000, prixM2: 4479,
    },
  },
  /* Portails (SeLoger, Leboncoin, Bien'ici) — données partielles, public. */
  {
    id: 'lafayette', title: 'T4 85m\u00b2 \u2014 18 cours Lafayette, Lyon 3',
    source: 'portail', portalName: 'SeLoger',
    meta: 'SeLoger \u00b7 340k\u20ac \u00b7 4 000\u20ac/m\u00b2 \u00b7 890m',
    simScore: '58% sim.', simClass: 'mid',
    fields: {
      type: 'appartement', surface: 85, pieces: 4, chambres: 3,
      etage: 2, dpe: 'D', prix: 340000, prixM2: 4000,
    },
  },
  {
    id: 'villeroy', title: 'T3 65m\u00b2 \u2014 41 rue de Villeroy, Lyon 3',
    source: 'portail', portalName: 'Leboncoin',
    meta: 'Leboncoin \u00b7 275k\u20ac \u00b7 4 230\u20ac/m\u00b2 \u00b7 470m',
    simScore: '69% sim.', simClass: 'mid',
    fields: {
      type: 'appartement', surface: 65, pieces: 3, etage: 3, dpe: 'E',
      prix: 275000, prixM2: 4230,
    },
  },
  {
    id: 'lacassagne', title: 'T3 74m\u00b2 \u2014 65 cours Lacassagne, Lyon 3',
    source: 'portail', portalName: "Bien'ici",
    meta: "Bien'ici \u00b7 320k\u20ac \u00b7 4 324\u20ac/m\u00b2 \u00b7 1.1km",
    simScore: '54% sim.', simClass: 'mid',
    fields: {
      type: 'appartement', surface: 74, pieces: 3, chambres: 2,
      balcon: 3, dpe: 'D', prix: 320000, prixM2: 4324,
    },
  },
];

/* Sous-ensemble des mocks INITIAL_OTHERS qui ne sont pas issus de DVF
 * (mandats Ideeri, transactions en cours, annonces portails SeLoger/Leboncoin/
 * Bien'ici). En mode live on les conserve tant que les sources live correspon-
 * dantes ne sont pas opérationnelles (Datadome bloque actuellement
 * /api/leboncoin, pas de flux live mandats Ideeri ni en cours), pour ne pas
 * avoir de zone vide à côté des résultats DVF réels. */
const INITIAL_NON_DVF_MOCKS = INITIAL_OTHERS.filter((c) => c.source !== 'dvf');

/* Projette un mock non-DVF (coordonnées Lyon 3 hardcodées) autour du bien actif
 * réel, en spirale dorée, à 250m -> ~1000m du target. Permet en mode live de
 * voir les markers démo près du bien testé plutôt qu'à 50km à Lyon. La distance
 * affichée est recalculée pour rester cohérente avec la nouvelle position. */
function projectMockNearTarget(comp, targetCoords, idx) {
  if (!comp) return comp;
  if (!targetCoords || !Array.isArray(targetCoords) || targetCoords.length < 2) return comp;
  // Angle d'or (137.508°) → répartition équilibrée même avec peu de points
  const angle = (idx * 137.508) * Math.PI / 180;
  const distMeters = 250 + idx * 120;
  const lat = targetCoords[0];
  const lng = targetCoords[1];
  const dLat = (distMeters / 111320) * Math.cos(angle);
  const dLng = (distMeters / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
  return {
    ...comp,
    coords: [lat + dLat, lng + dLng],
    distance: `${Math.round(distMeters)}m`,
    // KeyFacts (drawer détail) lit les propriétés racine. Ces mocks ne portent
    // leurs valeurs que dans `fields` → on les remonte à la racine si absentes,
    // sinon le détail est vide (tout sauf la distance).
    ...rootFactsFromFields(comp),
  };
}

/* Dérive les propriétés racine attendues par le drawer (KeyFacts + sections
 * riches) depuis `comp.fields`, sans écraser celles déjà présentes à la racine.
 * Les mocks INITIAL_OTHERS ne portent leurs caractéristiques que dans `fields`
 * (chambres, sdb, étage, dpe, chauffage…) ; on les remonte au format attendu
 * par GeneralInfo / RoomsTable / ProsCons. Prix/prixM2 formatés fr-FR pour
 * rester homogènes avec les mocks INITIAL_SELECTED ("285 000"). */
function rootFactsFromFields(comp) {
  const f = comp.fields || {};
  const out = {};
  // KeyFacts (résumé)
  if (comp.prix == null && Number.isFinite(f.prix)) out.prix = f.prix.toLocaleString('fr-FR');
  if (comp.prixM2 == null && Number.isFinite(f.prixM2)) out.prixM2 = f.prixM2.toLocaleString('fr-FR');
  if (comp.surface == null && f.surface != null) out.surface = f.surface;
  if (comp.pieces == null && f.pieces != null) out.pieces = f.pieces;
  if (comp.sourceLabel == null) {
    out.sourceLabel = comp.source === 'ideeri' ? 'Ideeri'
      : comp.source === 'encours' ? 'En cours'
      : comp.source === 'portail' ? (comp.portalName || 'Portail')
      : comp.source === 'dvf' ? 'DVF'
      : comp.source || '—';
  }
  // addr : pas de commune réelle sur ces mocks → dernier segment du titre.
  if (comp.addr == null && typeof comp.title === 'string' && comp.title.includes(',')) {
    out.addr = comp.title.split(',').pop().trim();
  }

  // Informations générales (section principale du détail) : construites depuis
  // les fields réels du mock. GeneralInfo n'affiche que les lignes renseignées.
  if (comp.infosGenerales == null && (f.chauffageType || f.anneeConstruction || f.dpe || f.surface)) {
    const chauffage = [f.chauffageType, f.chauffageEnergie].filter(Boolean).join(' \u2014 ') || null;
    const dependances = [
      f.cave ? `Cave ${f.cave} m\u00b2` : null,
      f.balcon ? `Balcon ${f.balcon} m\u00b2` : null,
    ].filter(Boolean).join(' \u00b7 ') || null;
    out.infosGenerales = {
      surfaceHabitable: f.surfaceUtile || f.surface || null,
      surfaceExterieurs: f.balcon || null,
      dependances,
      chauffage,
      menuiseries: f.vitrage || null,
      anneeConstruction: f.anneeConstruction || null,
      etatGeneral: f.facadesEtat || f.epoqueConstruction || null,
      dpe: f.dpe || null,
      ges: f.ges || null,
    };
  }

  // Détail des pièces : tableau synthétique reconstruit depuis le nombre de
  // pièces / chambres / sdb / wc (les mocks ne portent pas le détail pièce
  // par pièce). Surfaces approximées proportionnellement à la surface totale.
  if (comp.rooms == null && f.surface && (f.pieces || f.chambres)) {
    out.rooms = buildRoomsFromFields(f);
  }

  // Atouts / contraintes déduits des caractéristiques objectives du field.
  if (comp.atoutsQualitatifs == null && comp.pointsContraintes == null) {
    const { atouts, contraintes } = deriveProsCons(f);
    if (atouts.length) out.atoutsQualitatifs = atouts;
    if (contraintes.length) out.pointsContraintes = contraintes;
  }

  return out;
}

/* Reconstruit un tableau de pièces plausible à partir des compteurs du mock
 * (chambres, sdb, wc) et de la surface totale, en réservant ~45% au séjour. */
function buildRoomsFromFields(f) {
  const surfTot = Number(f.surface) || 0;
  const nbChambres = Number(f.chambres) || Math.max(0, (Number(f.pieces) || 1) - 1);
  const nbSdb = Number(f.sdb) || 1;
  const nbWc = Number(f.wc) || 0;
  const etage = f.etage != null ? f.etage : undefined;
  const etat = f.etatCuisine || (f.epoqueConstruction ? `${f.epoqueConstruction}` : 'Bon \u00e9tat');
  const rooms = [];
  const sejour = Math.round(surfTot * 0.42);
  rooms.push({ nom: 'S\u00e9jour / Salon', surface: sejour, etage, etat });
  const cuisine = Math.round(surfTot * 0.12);
  rooms.push({ nom: f.cuisineEquipee ? 'Cuisine \u00e9quip\u00e9e' : 'Cuisine', surface: cuisine, etage, etat: f.etatCuisine || 'Bon \u00e9tat' });
  const resteChambres = Math.max(0, surfTot - sejour - cuisine - nbSdb * 5 - nbWc * 2);
  const surfParChambre = nbChambres > 0 ? Math.round(resteChambres / nbChambres) : 0;
  for (let i = 0; i < nbChambres; i += 1) {
    rooms.push({ nom: `Chambre ${i + 1}`, surface: surfParChambre, etage, etat: 'Bon \u00e9tat' });
  }
  for (let i = 0; i < nbSdb; i += 1) {
    rooms.push({ nom: nbSdb > 1 ? `Salle de bain ${i + 1}` : 'Salle de bain', surface: 5, etage, etat: 'Bon \u00e9tat' });
  }
  for (let i = 0; i < nbWc; i += 1) {
    rooms.push({ nom: nbWc > 1 ? `WC ${i + 1}` : 'WC s\u00e9par\u00e9', surface: 2, etage, etat: 'Bon \u00e9tat' });
  }
  return rooms;
}

/* Déduit des atouts / contraintes à partir des caractéristiques objectives
 * (ascenseur, balcon, orientation, DPE, étage, état cuisine). Aucun jugement
 * inventé : seulement des faits présents dans le field. */
function deriveProsCons(f) {
  const atouts = [];
  const contraintes = [];
  if (f.ascenseur === true) atouts.push('Ascenseur'); else if (f.ascenseur === false) contraintes.push('Pas d\u2019ascenseur');
  if (f.balcon) atouts.push(`Balcon ${f.balcon} m\u00b2`);
  if (f.cave) atouts.push(`Cave ${f.cave} m\u00b2`);
  if (f.orientation) atouts.push(`Orientation ${f.orientation}`);
  if (f.cuisineEquipee) atouts.push('Cuisine \u00e9quip\u00e9e');
  if (f.vitrage && /double/i.test(f.vitrage)) atouts.push(f.vitrage);
  if (f.etatCuisine && /r\u00e9nover/i.test(f.etatCuisine)) contraintes.push('Cuisine \u00e0 r\u00e9nover');
  if (['E', 'F', 'G'].includes(f.dpe)) contraintes.push(`DPE ${f.dpe} \u2014 passoire \u00e9nerg\u00e9tique`);
  else if (['A', 'B'].includes(f.dpe)) atouts.push(`DPE ${f.dpe} \u2014 performant`);
  if (f.etage === 0) contraintes.push('Rez-de-chauss\u00e9e');
  if (f.etagesTotal && f.etage === f.etagesTotal && f.ascenseur === false) contraintes.push('Dernier \u00e9tage sans ascenseur');
  return { atouts, contraintes };
}

function SelectedCompCard({ comp, onRemove, onOpenDrawer, weight, onWeightChange }) {
  const pertinence = Math.round((comp.similarite || 0) * 0.6 + (comp.donnees || 0) * 0.4);
  const pertinenceClass = pertinence >= 80 ? 'score-high' : pertinence >= 60 ? 'score-mid' : 'score-low';
  const simClass = comp.similarite >= 80 ? 'score-high' : comp.similarite >= 60 ? 'score-mid' : 'score-low';
  const donClass = comp.donnees >= 80 ? 'score-high' : comp.donnees >= 40 ? 'score-mid' : 'score-low';
  const [pertinenceOpen, setPertinenceOpen] = useState(false);
  const stop = (e) => e.stopPropagation();
  const openDrawer = () => onOpenDrawer && onOpenDrawer(comp);
  return (
    <div className="comp-card selected clickable" onClick={openDrawer}>
      {comp.source === 'dvf' ? (
        <div className="comp-card-photo no-photo">
          <span>Pas de photo &mdash; source {comp.sourceLabel}</span>
        </div>
      ) : (
        <div className="comp-card-photo" style={{ overflow: 'hidden' }}>
          <img
            src={comp.photoUrl}
            alt={comp.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 8 }}
            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'linear-gradient(135deg, #e8f5ee 0%, #d1ecdb 50%, #b8e0c8 100%)'; }}
          />
        </div>
      )}
      <div className="comp-card-header">
        <div>
          <div className="comp-card-title">{comp.title}</div>
          <div className="comp-card-addr">{comp.addr}</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className={`source-badge ${comp.source}`}>{comp.sourceLabel}</span>
          {comp.portalName && <span className="portal-tag">{comp.portalName}</span>}
        </span>
      </div>
      <div className="comp-prices">
        <div className="p-item"><div className="p-label">Prix</div><div className="p-val">{comp.prix} &euro;</div></div>
        <div className="p-item"><div className="p-label">Prix/m&sup2;</div><div className="p-val">{comp.prixM2} &euro;</div></div>
        <div className="p-item"><div className="p-label">Distance</div><div className="p-val" style={{ color: '#4a6cf7' }}>{comp.distance}</div></div>
      </div>
      {comp.source !== 'dvf' && comp.description && (
        <div className="comp-description">
          <div className="comp-description-label">Description du bien</div>
          {comp.description}
        </div>
      )}
      <div className="comp-valuations">
        <div className="val-item">
          <div className="val-item-label">Prix de vente</div>
          <div className={`val-item-value ${comp.venteNa ? 'na' : ''}`}>{comp.venteLabel}</div>
          <div className="val-delta" style={{ color: comp.venteNa ? '#d97706' : '#999', fontSize: 10 }}>{comp.venteDetail}</div>
        </div>
        <div className="val-item">
          <div className="val-item-label">Avis de valeur pro</div>
          <div className={`val-item-value ${comp.avisNa ? 'na' : ''} ${comp.avisHighlight ? 'highlight' : ''}`}>{comp.avisLabel}</div>
          <div className={`val-delta ${comp.avisPos ? 'pos' : ''} ${comp.avisNeg ? 'neg' : ''}`} style={!comp.avisPos && !comp.avisNeg ? { color: '#ccc', fontSize: 10 } : { fontSize: 10 }}>{comp.avisDetail}</div>
        </div>
      </div>
      <div className="comp-meta">{comp.meta}</div>

      {/* Pertinence : score unique avec dropdown d\u00e9tail Similarit\u00e9 + Donn\u00e9es */}
      <div className="scoring-row" onClick={stop}>
        <button
          type="button"
          className={`score-badge pertinence-toggle ${pertinenceClass}`}
          aria-expanded={pertinenceOpen}
          onClick={(e) => { e.stopPropagation(); setPertinenceOpen((v) => !v); }}
        >
          <span className="score-badge-label">Pertinence</span>
          <span className="score-badge-value">{pertinence}%</span>
          <span className="score-badge-bar"><span className="score-badge-fill" style={{ width: `${pertinence}%` }} /></span>
          <span className={`pertinence-chevron ${pertinenceOpen ? 'open' : ''}`}>&#9662;</span>
        </button>
      </div>
      {pertinenceOpen && (
        <div className="pertinence-detail" onClick={stop}>
          <div className="pertinence-detail-row">
            <div className="pertinence-detail-header">
              <span className="pertinence-detail-label">Similarit&eacute;</span>
              <span className={`pertinence-detail-value ${simClass}`}>{comp.similarite}%</span>
            </div>
            <div className="pertinence-detail-bar"><span className={`pertinence-detail-fill ${simClass}`} style={{ width: `${comp.similarite}%` }} /></div>
            <div className="pertinence-detail-hint">Proximit&eacute; typologique &amp; g&eacute;ographique &mdash; pond&eacute;ration 60%</div>
          </div>
          <div className="pertinence-detail-row">
            <div className="pertinence-detail-header">
              <span className="pertinence-detail-label">Donn&eacute;es disponibles</span>
              <span className={`pertinence-detail-value ${donClass}`}>{comp.donnees}%</span>
            </div>
            <div className="pertinence-detail-bar"><span className={`pertinence-detail-fill ${donClass}`} style={{ width: `${comp.donnees}%` }} /></div>
            <div className="pertinence-detail-hint">{comp.donCount ? `${comp.donCount} champs renseign\u00e9s` : 'Compl\u00e9tude des champs renseign\u00e9s'} &mdash; pond&eacute;ration 40%</div>
          </div>
          <div className="pertinence-detail-formula">
            Score Pertinence = Similarit&eacute; &times; 0,6 + Donn&eacute;es &times; 0,4 = <strong>{pertinence}%</strong>
          </div>
        </div>
      )}

      {/* Pond\u00e9ration manuelle */}
      <div
        className="weight-control"
        onClick={stop}
        onMouseDown={stop}
        onMouseUp={stop}
        onPointerDown={stop}
        onTouchStart={stop}
      >
        <div className="weight-control-header">
          <span className="weight-control-label">Poids dans l&rsquo;estimation</span>
          <span className="weight-control-value">{weight}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={weight}
          onChange={(e) => onWeightChange && onWeightChange(comp.id, Number(e.target.value))}
          onClick={stop}
          onMouseDown={stop}
          className="weight-slider"
        />
      </div>

      <div className={`reliability ${comp.reliability}`}>{comp.reliabilityLabel}</div>
      <div className="adj-section">
        <div className="adj-title">
          Ajustement vs cible <span className={`adj-val ${comp.adjTotalClass}`}>{comp.adjTotal}</span>
        </div>
        {comp.adjustments.map((a, i) => (
          <div key={i} className="adj-row">
            <span className="lbl">{a.lbl}</span>
            <span className={`adj-val ${a.cls}`}>{a.val}</span>
          </div>
        ))}
      </div>
      <div className="comp-actions" onClick={stop}>
        <a className="link-edit" onClick={stop}>&#9998; Modifier ajustement</a>
        {comp.portalName && <a className="btn-view-ad" href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>&#8599; Voir l&rsquo;annonce {comp.portalName}</a>}
        <button className="btn-remove" onClick={(e) => { e.stopPropagation(); onRemove && onRemove(comp.id); }}>&times; Retirer</button>
      </div>
    </div>
  );
}

function CompactCompCard({ comp, onAdd, onOpenEdit }) {
  const dotClass = comp.source === 'dvf' ? 'dot-dvf' : comp.source === 'ideeri' ? 'dot-ideeri' : comp.source === 'encours' ? 'dot-encours' : 'dot-portail';
  const handleCardClick = () => { if (onOpenEdit) onOpenEdit(comp); };
  const stop = (e) => e.stopPropagation();
  return (
    <div
      className={`comp-card compact${onOpenEdit ? ' clickable' : ''}`}
      onClick={onOpenEdit ? handleCardClick : undefined}
      role={onOpenEdit ? 'button' : undefined}
      tabIndex={onOpenEdit ? 0 : undefined}
      onKeyDown={onOpenEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } } : undefined}
    >
      <div className="compact-row">
        <div className="compact-left">
          <div className="compact-title">{comp.title}</div>
          <div className="compact-meta"><span className={`source-dot ${dotClass}`} /> {comp.meta}{comp.portalName && <span className="portal-tag" style={{ marginLeft: 6 }}>{comp.portalName}</span>}</div>
          <div className="compact-scores">
            <span className={`compact-score ${comp.simClass}`}>{comp.simScore}</span>
            <span className={`compact-score ${comp.donClass}`}>{comp.donScore}</span>
            <span className="data-count">{comp.donCount}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }} onClick={stop}>
          {comp.portalName && <a className="btn-view-ad" href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>&#8599; Annonce</a>}
          <button className="btn-add" onClick={(e) => { e.stopPropagation(); onAdd && onAdd(comp.id); }}>+ Ajouter</button>
        </div>
      </div>
    </div>
  );
}

/* PoolCardCarousel — carrousel d'images de couverture pour la vignette d'une
 * pool-card. Affiche la photo courante en background-image (cover), avec
 * flèches ‹ › + dots + compteur si plusieurs photos. Les contrôles stoppent
 * la propagation pour ne pas déclencher le clic carte (ouverture du drawer)
 * ni le drag. Le children (badges source/score) est superposé. */
function PoolCardCarousel({ photos, children }) {
  const [idx, setIdx] = useState(0);
  const n = photos.length;
  const prev = (e) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => (i - 1 + n) % n); };
  const next = (e) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => (i + 1) % n); };
  return (
    <div
      className="pool-card-photo"
      style={{ backgroundImage: `url(${photos[idx]})` }}
    >
      {children}
      {n > 1 && (
        <>
          <button className="pool-carousel-arrow left" onClick={prev} draggable={false} aria-label="Photo précédente">&#8249;</button>
          <button className="pool-carousel-arrow right" onClick={next} draggable={false} aria-label="Photo suivante">&#8250;</button>
          <div className="pool-carousel-dots">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`pool-carousel-dot ${i === idx ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx(i); }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* PoolCompCard — carte miniature d'un bien disponible (colonne Pool du
 * workspace). Affiche une vignette photo (ou gradient fallback par source
 * pour DVF/Ideeri), un badge source, un badge score de similarité, le prix.
 * Le clic ouvre le détail ; le bouton « Sélectionner » (onSelect) ajoute le
 * bien à la sélection (le retire du pool, le fait remonter dans le récap). */
function PoolCompCard({ comp, onOpenEdit, onFocusOnMap, onSelect, v1Status }) {
  // Extrait un score numérique 0-100 depuis "85% sim." pour le badge.
  const simNum = parseInt(String(comp.simScore || '').replace(/\D/g, ''), 10) || 0;
  const scoreClass = simNum >= 80 ? 'score-high' : simNum >= 60 ? 'score-mid' : 'score-low';
  const sourceLabel = comp.source === 'dvf'
    ? 'DVF'
    : comp.source === 'ideeri'
    ? 'Ideeri'
    : comp.source === 'encours'
    ? 'En cours'
    : 'Portail';
  const dotClass = comp.source === 'dvf'
    ? 'dot-dvf'
    : comp.source === 'ideeri'
    ? 'dot-ideeri'
    : comp.source === 'encours'
    ? 'dot-encours'
    : 'dot-portail';
  // Photo : priorité comp.photos[0], sinon photo stock Unsplash (libre de
  // droit, déterministe par id). DVF reste sans photo (anonymisé) → fallback
  // gradient + icon, cohérent avec sa nature de transaction officielle.
  const photos = getCompPhotos(comp);
  // Pour les sources DVF / Ideeri vendu, le placeholder a une teinte spécifique.
  const noPhotoClass = `pool-card-photo no-photo source-${comp.source}`;
  const photoIcon = comp.source === 'dvf' ? '\ud83d\udcca' : '\ud83c\udfe0';
  // Parse meta "DVF · 295k€ · 4 214€/m² · 750m" pour extraire prix et m².
  const parts = String(comp.meta || '').split(' \u00b7 ');
  const prixLabel = parts[1] || '';
  const m2Label = parts[2] || '';
  const distLabel = parts[3] || '';

  const handleCardClick = () => {
    // Zoom carte sur le bien (action visuelle immédiate) + ouvre le drawer
    // détails. À la fermeture du drawer, la carte sera déjà positionnée.
    if (onFocusOnMap) onFocusOnMap(comp);
    if (onOpenEdit) onOpenEdit(comp);
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  // Badge V1 si le bien était dans l'étude précédente (calque visuel)
  const v1Badge = v1Status ? (
    <span
      className="pool-card-v1-badge"
      style={{ borderColor: v1Status.color, color: v1Status.color }}
      title={`Bien déjà présent dans votre étude précédente · ${v1Status.label}${v1Status.delta != null ? ` · ${v1Status.delta > 0 ? '+' : ''}${v1Status.delta}%` : ''}`}
    >
      <span className="v1-dot" style={{ background: v1Status.color }} />
      V1 · {v1Status.label}
      {v1Status.delta != null && v1Status.delta !== 0 && (
        <span className="v1-delta">{v1Status.delta > 0 ? '+' : ''}{v1Status.delta}%</span>
      )}
    </span>
  ) : null;

  return (
    <div
      className="pool-card"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      title="Cliquez pour le détail"
      style={{ position: 'relative' }}
    >
      {v1Badge}
      {photos.length > 0 ? (
        <PoolCardCarousel photos={photos}>
          <span className="pool-card-source-badge">
            <span className={`source-dot ${dotClass}`} /> {sourceLabel}
          </span>
          <span className={`pool-card-score-badge ${scoreClass}`}>{simNum}%</span>
        </PoolCardCarousel>
      ) : (
        <div className={noPhotoClass}>
          <span>{photoIcon}</span>
          <span className="pool-card-source-badge">
            <span className={`source-dot ${dotClass}`} /> {sourceLabel}
          </span>
          <span className={`pool-card-score-badge ${scoreClass}`}>{simNum}%</span>
        </div>
      )}
      <div className="pool-card-body">
        <div className="pool-card-title">{comp.title}</div>
        <div className="pool-card-meta">{distLabel || comp.meta}</div>
        {prixLabel && (
          <div className="pool-card-price">
            {prixLabel}
            {m2Label && <span className="pool-card-price-m2">&middot; {m2Label}</span>}
          </div>
        )}
      </div>
      <button
        type="button"
        className="pool-card-select-btn"
        onClick={(e) => { e.stopPropagation(); if (onSelect) onSelect(comp.id); }}
        title="Ajouter ce bien à la sélection"
      >
        + Sélectionner
      </button>
    </div>
  );
}

// All 47 mock comparables for filtering simulation
const ALL_COMPS_COUNT = 47;

/* Liste exhaustive des types de bien pour le filtre "Type de bien"
 * (multiselect). value = identifiant interne lowercase sans accent,
 * label = libellé affiché à l'utilisateur. */
const TYPES_BIEN = [
  { value: 'appartement',         label: 'Appartement' },
  { value: 'appartement_duplex',  label: 'Appartement Duplex' },
  { value: 'appartement_triplex', label: 'Appartement Triplex' },
  { value: 'autres',              label: 'Autres' },
  { value: 'batiment',            label: 'Bâtiment' },
  { value: 'cave',                label: 'Cave' },
  { value: 'chateau',             label: 'Château' },
  { value: 'ferme',               label: 'Ferme' },
  { value: 'fond_commerce',       label: 'Fond de commerce' },
  { value: 'garages',             label: 'Garages' },
  { value: 'grange',              label: 'Grange' },
  { value: 'immeuble',            label: 'Immeuble' },
  { value: 'local_commercial',    label: 'Local commercial' },
  { value: 'local_industriel',    label: 'Local industriel' },
  { value: 'loft',                label: 'Loft' },
  { value: 'maison',              label: 'Maison' },
  { value: 'maison_village',      label: 'Maison de village' },
  { value: 'parking',             label: 'Parking' },
  { value: 'plateau',             label: 'Plateau' },
  { value: 'terrain',             label: 'Terrain' },
  { value: 'villa',               label: 'Villa' },
];
const TYPES_BIEN_VALUES = TYPES_BIEN.map((t) => t.value);

/* TypeMultiSelect — dropdown multiselect pour le filtre Type de bien.
 * - `selected` : array de values (identifiants lowercase)
 * - `onChange` : (newValues: string[]) => void
 * - Si selected.length === 0 ou === TYPES_BIEN.length → affiche "Tous types"
 * - Sinon : "Appartement" (1 sel) ou "3 types sélectionnés" (n sel) */
function TypeMultiSelect({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Fermer si clic en dehors
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleOne = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  const selectAll = () => onChange([...TYPES_BIEN_VALUES]);
  const clearAll = () => onChange([]);

  const allSelected = selected.length === TYPES_BIEN_VALUES.length;
  const noneSelected = selected.length === 0;
  let triggerLabel;
  if (noneSelected || allSelected) {
    triggerLabel = 'Tous types';
  } else if (selected.length === 1) {
    const t = TYPES_BIEN.find((x) => x.value === selected[0]);
    triggerLabel = t ? t.label : '1 type sélectionné';
  } else {
    triggerLabel = `${selected.length} types sélectionnés`;
  }

  return (
    <div className="type-multi" ref={wrapRef}>
      <button
        type="button"
        className={`type-multi-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="type-multi-panel" role="listbox">
          <div className="type-multi-panel-header">
            <button type="button" className="type-multi-action" onClick={selectAll}>
              Tout cocher
            </button>
            <button type="button" className="type-multi-action" onClick={clearAll}>
              Tout décocher
            </button>
          </div>
          <div className="type-multi-list">
            {TYPES_BIEN.map((t) => (
              <label key={t.value} className="type-multi-option">
                <input
                  type="checkbox"
                  checked={selected.includes(t.value)}
                  onChange={() => toggleOne(t.value)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* SourceRow — rangée moderne d'une source dans le drawer Filtres.
 * Card cliquable (toggle au clic sur toute la zone sauf le slider et la
 * pill de valeur), checkbox custom carrée arrondie, slider épais avec fill
 * vert progressif, valeur en pill verte à droite. */
function SourceRow({
  dotClass, label, checked, onToggle, delay, setDelay, maxMonths = 36,
  priceMin, priceMax, setPriceMin, setPriceMax, priceFloor = 50000, priceCeil = 1500000,
  prices = [],
}) {
  const pct = ((delay - 1) / (maxMonths - 1)) * 100;
  // Même échelle que la section "Fourchette de prix" du dessous.
  const PRICE_MIN_SCALE = priceFloor;
  const PRICE_MAX_SCALE = priceCeil;
  const PRICE_STEP = 5000;
  const leftPct = ((priceMin - PRICE_MIN_SCALE) / (PRICE_MAX_SCALE - PRICE_MIN_SCALE)) * 100;
  const rightPct = ((priceMax - PRICE_MIN_SCALE) / (PRICE_MAX_SCALE - PRICE_MIN_SCALE)) * 100;
  // Comptage MONOTONE : nb de biens (de cette source) dont le prix <= borne.
  const biensUpTo = (p) => prices.filter((v) => v <= p).length;
  const biensInRange = prices.filter((v) => v >= priceMin && v <= priceMax).length;
  const nBelow = biensUpTo(priceMin);
  const nUpToMax = biensUpTo(priceMax);
  const stopProp = (e) => e.stopPropagation();
  return (
    <div
      className={`source-row${checked ? '' : ' disabled'}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <label className="source-cb-label" onClick={stopProp}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
        />
        <span className="source-check-box" />
      </label>
      <span className="source-label-text">
        <span className={`source-dot ${dotClass}`} />
        {label}
      </span>
      {/* Jauge ancienneté (mois) — ligne 1, dans la 3e colonne.
       * Slider 100% custom — track/fill/thumb sont des div HTML normaux,
       * l'input range est invisible (opacity 0) et gère uniquement
       * l'interaction drag/clavier. */}
      <div className="source-gauges" onClick={stopProp} onMouseDown={stopProp}>
        <div className="source-gauge">
          <span className="source-gauge-icon" title="Ancienneté max">⏱</span>
          <div className="cs-slider" style={{ '--cs-pct': pct }}>
            <div className="cs-track" />
            <div className="cs-fill" />
            <div className="cs-thumb" />
            <input
              type="range"
              className="cs-input"
              min="1"
              max={maxMonths}
              value={delay}
              disabled={!checked}
              onChange={(e) => setDelay(Number(e.target.value))}
              aria-label={`Ancienneté max ${label}`}
            />
          </div>
          <span className="source-gauge-value">{delay} mois</span>
        </div>
      </div>
      {/* Fourchette de prix — ligne 2, pleine largeur de la card.
       * Markup identique à la section "Fourchette de prix" du dessous
       * (track dégradé, 2 poignées, labels avec nb de biens + hint). */}
      <div className="source-price-row" onClick={stopProp} onMouseDown={stopProp}>
        <div className="price-dual">
          <div className="price-dual-track" />
          <div
            className="price-dual-selected"
            style={{
              left: `calc(12px + ${(Math.max(0, Math.min(100, leftPct)) / 100).toFixed(4)} * (100% - 24px))`,
              width: `calc(${((Math.max(0, Math.min(100, rightPct)) - Math.max(0, Math.min(100, leftPct))) / 100).toFixed(4)} * (100% - 24px))`,
            }}
          />
          <input
            type="range"
            min={PRICE_MIN_SCALE}
            max={PRICE_MAX_SCALE}
            step={PRICE_STEP}
            value={priceMin}
            disabled={!checked}
            onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax - PRICE_STEP))}
            aria-label={`Prix minimum ${label}`}
          />
          <input
            type="range"
            min={PRICE_MIN_SCALE}
            max={PRICE_MAX_SCALE}
            step={PRICE_STEP}
            value={priceMax}
            disabled={!checked}
            onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin + PRICE_STEP))}
            aria-label={`Prix maximum ${label}`}
          />
          <div className="price-dual-labels">
            <span>
              <strong>{(priceMin / 1000).toFixed(0)} k€</strong> · <span className="count">{nBelow} en dessous</span>
            </span>
            <span>
              <strong>{(priceMax / 1000).toFixed(0)} k€</strong> · <span className="count">{nUpToMax} jusqu'ici</span>
            </span>
          </div>
        </div>
        <div className="filter-hint" style={{ marginTop: 10 }}>
          <strong style={{ color: '#46B962' }}>{biensInRange} biens</strong> dans la fourchette
        </div>
      </div>
    </div>
  );
}

export default function Step3Comparables() {
  const navigate = useNavigate();

  /* Bien actif (Step1) — donne le citycode + coords pour brancher DVF live.
   * Si pas de bien actif → fallback démo 12 rue des Lilas Lyon 3 (TARGET_COORDS). */
  const activeBien = useMemo(() => getActiveBien(), []);
  const targetCoords = useMemo(() => {
    if (activeBien?.adresse?.coords && Array.isArray(activeBien.adresse.coords)) {
      return activeBien.adresse.coords;
    }
    return TARGET_COORDS;
  }, [activeBien]);
  const targetLabel = activeBien?.adresse?.label || '12 rue des Lilas';
  const targetCityLine = activeBien?.adresse
    ? `${activeBien.adresse.postcode || ''} ${activeBien.adresse.city || ''}`.trim()
    : '69003 Lyon 3ème';
  const targetCityShort = activeBien?.adresse?.city || 'Lyon 3ème';
  const hasRealLocation = !!activeBien?.adresse?.citycode;

  /* ─── Étude précédente : charge la dernière estimation antérieure pour
   * le même bien, si elle existe. Permet la comparaison V1 vs V2 dans
   * Step3 (badge "⏱ V1" sur les biens du pool actuel + statut + delta).
   *
   * Stratégie de matching tolérante :
   *   1. par adresse complète normalisée (lowercase + trim + no accents)
   *   2. sinon par adresse partielle (l'une contient l'autre)
   *   3. sinon (mode démo) : adresse fallback Lyon 3
   *   4. en dernier recours : la dernière étude AVEC comparables snapshot
   *      (pour qu'on voie quelque chose même si l'adresse a changé) */
  const previousStudy = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem('ideeri_estimations') || '[]');
      if (!Array.isArray(list) || list.length === 0) return null;

      // Normalisation : lower, trim, sans accents, espaces unifiés
      const norm = (s) => String(s || '')
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

      const onlyWithComparables = list.filter(
        (e) => e && Array.isArray(e.comparables) && e.comparables.length > 0
      );
      if (onlyWithComparables.length === 0) return null;

      // Adresse actuelle. En mode démo (pas d'activeBien), on utilise
      // l'adresse fallback Lyon 3 — c'est celle utilisée par la sauvegarde
      // Step5 quand hasRealLocation est false.
      const currentAddrRaw = activeBien?.adresse?.label
        || (hasRealLocation ? '' : '12 rue des Lilas, 69003 Lyon');
      const currentAddr = norm(currentAddrRaw);

      const sortByDateDesc = (a, b) => {
        const ta = new Date(a.snapshotDate || a.date || 0).getTime();
        const tb = new Date(b.snapshotDate || b.date || 0).getTime();
        return tb - ta;
      };

      // 1) Match exact (normalisé)
      let matches = onlyWithComparables.filter(
        (e) => norm(e.adresse) === currentAddr
      );
      // 2) Match partiel : l'une contient l'autre
      if (matches.length === 0 && currentAddr) {
        matches = onlyWithComparables.filter((e) => {
          const a = norm(e.adresse);
          return a && (a.includes(currentAddr) || currentAddr.includes(a));
        });
      }
      // 3) Fallback ultime : on prend juste la dernière étude avec comparables
      // (permet de voir la feature à l'œuvre même si l'adresse a changé).
      if (matches.length === 0) {
        matches = [...onlyWithComparables];
      }
      matches.sort(sortByDateDesc);
      return matches[0] || null;
    } catch {
      return null;
    }
  }, [activeBien, hasRealLocation]);

  /* Map id → snapshot du comparable précédent, pour lookup rapide
   * pendant le rendu des cards du pool/panier. */
  const previousById = useMemo(() => {
    const m = {};
    if (previousStudy?.comparables) {
      previousStudy.comparables.forEach((c) => { if (c.id) m[c.id] = c; });
    }
    return m;
  }, [previousStudy]);

  /* Calcule le statut d'évolution d'un bien depuis l'étude précédente.
   * Renvoie un objet { state, label, color, delta } avec state ∈ :
   *   - 'vendu'         : passé en source DVF ou ideeri (transaction)
   *   - 'compromis'     : statut explicite "sous compromis" sur le comp actuel
   *   - 'baisse'        : encore en vente mais prix < prix initial
   *   - 'en_vente'      : encore en vente, prix stable ou +
   *   - 'retire'        : plus dans le pool actuel (non passé en param)
   * Pour 'retire', appeler avec currentComp = null. */
  const getPreviousStatus = (currentComp, prev) => {
    if (!prev) return null;
    // Bien disparu du pool actuel
    if (!currentComp) {
      return { state: 'retire', label: 'Retiré du marché', color: '#888', delta: null };
    }
    const prevPrix = parseInt(String(prev.prix || '').replace(/\D/g, ''), 10) || 0;
    const currPrix = parseInt(String(currentComp.prix || '').replace(/\D/g, ''), 10) || 0;
    const delta = (prevPrix > 0 && currPrix > 0)
      ? Math.round(((currPrix - prevPrix) / prevPrix) * 1000) / 10
      : null;
    // Vendu : passé en source DVF ou Ideeri vendu (depuis encours/portail)
    if ((currentComp.source === 'dvf' || currentComp.source === 'ideeri'
        || currentComp.source === 'autre_agence')
        && (prev.source === 'encours' || prev.source === 'portail')) {
      return { state: 'vendu', label: 'Vendu', color: '#2d8856', delta };
    }
    // Compromis (si donnée disponible)
    if (currentComp.statut === 'compromis' || currentComp.statutVente === 'compromis') {
      return { state: 'compromis', label: 'Sous compromis', color: '#2a3f8a', delta };
    }
    // Baisse de prix
    if (delta != null && delta <= -1) {
      return { state: 'baisse', label: 'Prix baissé', color: '#d97706', delta };
    }
    // Encore en vente (par défaut)
    return { state: 'en_vente', label: 'Encore en vente', color: '#4a6cf7', delta };
  };

  /* Note : le calcul des biens "disparus" (présents dans l'étude
   * précédente mais plus dans le pool actuel) est fait inline dans le
   * JSX du bandeau, où `others` est disponible. */

  /* targetFields = Set des clés (parmi COMPARABLE_FIELDS) renseignées sur le
   * bien cible (Step 1). C'est le DÉNOMINATEUR du ratio "M/N" affiché sur
   * chaque carte comparable. Reflète le périmètre réel de comparaison. */
  const targetFields = useMemo(() => {
    const cats = buildBienCibleCategories(bienCibleCategoriesBase, activeBien);
    return getTargetFilledFieldKeys(cats);
  }, [activeBien]);

  /* ─── Tags caractéristiques du bien cible (au-dessus du workspace) ───
   * Affichage en chips colorés selon le match avec le comparable focusé :
   *   neutre = pas de comp focusé
   *   match  = le comp a la même valeur (avec tolérance pour les numériques)
   *   nomatch= le comp a une valeur différente
   *   na     = le comp n'a pas cette info
   *
   * Source : on construit les features depuis bienCibleCategories enrichi
   * (buildBienCibleCategories), qui contient les valeurs par défaut + les
   * saisies utilisateur résolues. */
  const [focusedComp, setFocusedComp] = useState(null);
  // Toggle d'affichage de la liste des biens "disparus de l'offre"
  // (présents dans l'étude précédente mais plus dans le pool actuel)
  const [previousMissingOpen, setPreviousMissingOpen] = useState(false);
  // Toggle global d'affichage de la comparaison avec l'étude V1
  // (badges V1 sur les cards + bandeau biens disparus). Activé par défaut.
  const [showV1, setShowV1] = useState(true);
  const bienCats = useMemo(
    () => buildBienCibleCategories(bienCibleCategoriesBase, activeBien),
    [activeBien]
  );

  /* Helper : récupère la valeur d'un field (par title de catégorie + label). */
  const getCatField = (cats, catTitle, fieldLabel) => {
    const cat = cats?.find((c) => c.title === catTitle);
    if (!cat) return undefined;
    const f = cat.fields?.find((x) => x.label === fieldLabel);
    if (!f) return undefined;
    if (f.type === 'toggle') return f.on;
    return f.value;
  };

  /* Extrait un nombre d'étage depuis une string ("4ème étage" → 4, "RDC" → 0). */
  const parseEtage = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const s = String(v).toLowerCase();
    if (s.includes('rez') || s.includes('rdc')) return 0;
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const targetFeatures = useMemo(() => {
    if (!bienCats) return [];
    const features = [];
    const isEmpty = (v) => v === null || v === undefined || v === ''
      || v === false || v === '0' || v === 0
      || (typeof v === 'string' && v.startsWith('\u2014'));
    const push = (key, label, targetVal, getCompVal, equals) => {
      if (isEmpty(targetVal)) return;
      features.push({ key, label, targetVal, getCompVal, equals });
    };

    // ─── Identification ───────────────────────────────────────────
    const type = getCatField(bienCats, 'Identification et Statut Juridique', 'Type de bien');
    push('type', String(type || ''),
      String(type || '').toLowerCase(),
      (c) => c.fields?.type || c._dvfRaw?.type,
      (cv, tv) => String(cv).toLowerCase() === tv
    );

    // ─── Caractéristiques Générales ───────────────────────────────
    const surface = getCatField(bienCats, 'Caractéristiques Générales', 'Surface Carrez (m²)');
    push('surface', `${surface} m²`, Number(surface),
      (c) => c.fields?.surface ?? c._dvfRaw?.surface,
      (cv, tv) => cv != null && Math.abs(Number(cv) - tv) <= 10
    );
    const pieces = getCatField(bienCats, 'Caractéristiques Générales', 'Nombre de pièces');
    push('pieces', `T${pieces}`, Number(pieces),
      (c) => c.fields?.pieces ?? c._dvfRaw?.pieces,
      (cv, tv) => cv != null && Number(cv) === tv
    );
    const chambres = getCatField(bienCats, 'Caractéristiques Générales', 'Nombre de chambres');
    push('chambres', `${chambres} ch.`, Number(chambres),
      (c) => c.fields?.chambres ?? c._dvfRaw?.chambres,
      (cv, tv) => cv != null && Number(cv) === tv
    );
    const sdb = getCatField(bienCats, 'Caractéristiques Générales', 'Nombre SDB');
    push('sdb', `${sdb} SDB`, Number(sdb),
      (c) => c.fields?.sdb,
      (cv, tv) => cv != null && Number(cv) === tv
    );
    const wc = getCatField(bienCats, 'Caractéristiques Générales', 'Nombre WC');
    push('wc', `${wc} WC`, Number(wc),
      (c) => c.fields?.wc,
      (cv, tv) => cv != null && Number(cv) === tv
    );
    const etage = getCatField(bienCats, 'Caractéristiques Générales', 'Étage du bien');
    const etageNum = parseEtage(etage);
    if (etageNum != null) {
      push('etage', etageNum === 0 ? 'RDC' : `Étage ${etageNum}`, etageNum,
        (c) => parseEtage(c.fields?.etage),
        (cv, tv) => cv != null && Math.abs(cv - tv) <= 1
      );
    }
    const orientation = getCatField(bienCats, 'Caractéristiques Générales', 'Orientation');
    push('orientation', String(orientation || ''), String(orientation || '').toLowerCase(),
      (c) => c.fields?.orientation || c.fields?.exposition,
      (cv, tv) => String(cv).toLowerCase() === tv
    );
    const ascenseur = getCatField(bienCats, 'Caractéristiques Générales', 'Ascenseur');
    push('ascenseur', 'Ascenseur', ascenseur === true,
      (c) => Boolean(c.fields?.ascenseur),
      (cv) => cv === true
    );
    const cave = getCatField(bienCats, 'Caractéristiques Générales', 'Cave (m²)');
    push('cave', 'Cave', Number(cave) > 0,
      (c) => Number(c.fields?.cave) > 0 || Boolean(c.fields?.cave),
      (cv) => Boolean(cv)
    );
    const parkingExt = getCatField(bienCats, 'Caractéristiques Générales', 'Parking extérieur');
    push('parking_ext', 'Parking', parkingExt === true,
      (c) => Boolean(c.fields?.parking),
      (cv) => cv === true
    );
    const garage = getCatField(bienCats, 'Caractéristiques Générales', 'Garage / Box fermé');
    push('garage', 'Garage', Number(garage) > 0,
      (c) => Number(c.fields?.garage) > 0,
      (cv) => Boolean(cv)
    );
    const balcon = getCatField(bienCats, 'Caractéristiques Générales', 'Balcon (m²)');
    push('balcon', `Balcon ${balcon} m²`, Number(balcon) > 0 ? Number(balcon) : null,
      (c) => Number(c.fields?.balcon) || 0,
      (cv, tv) => cv > 0 && Math.abs(cv - tv) <= 5
    );
    const terrasse = getCatField(bienCats, 'Caractéristiques Générales', 'Terrasse (m²)');
    push('terrasse', `Terrasse ${terrasse} m²`, Number(terrasse) > 0 ? Number(terrasse) : null,
      (c) => Number(c.fields?.terrasse) || 0,
      (cv, tv) => cv > 0 && Math.abs(cv - tv) <= 5
    );
    const jardin = getCatField(bienCats, 'Caractéristiques Générales', 'Jardin privatif (m²)');
    push('jardin', `Jardin ${jardin} m²`, Number(jardin) > 0 ? Number(jardin) : null,
      (c) => Number(c.fields?.jardin) || 0,
      (cv, tv) => cv > 0 && Math.abs(cv - tv) <= 20
    );

    // ─── Structure / Gros Œuvre ───────────────────────────────────
    const annee = getCatField(bienCats, 'Structure et Gros Œuvre', 'Année de construction');
    push('annee', `Année ${annee}`, Number(annee),
      (c) => c.fields?.anneeConstruction ?? c._dvfRaw?.anneeConstruction,
      (cv, tv) => cv != null && Math.abs(Number(cv) - tv) <= 10
    );
    const epoque = getCatField(bienCats, 'Structure et Gros Œuvre', 'Époque de construction');
    push('epoque', String(epoque || ''), String(epoque || ''),
      (c) => c.fields?.epoque,
      (cv, tv) => String(cv) === tv
    );
    const facades = getCatField(bienCats, 'Structure et Gros Œuvre', 'Façades — Matériaux');
    push('facades', `Façade ${facades}`, String(facades || '').toLowerCase(),
      (c) => c.fields?.facades || c.fields?.facadesMateriaux,
      (cv, tv) => String(cv).toLowerCase() === tv
    );

    // ─── Choix explicites « négatifs » du formulaire (/nouveau-bien) ──
    // Ces champs sont saisis volontairement par l'utilisateur (et comptés
    // dans la complétude) mais valent "aucun"/false, donc ignorés par
    // buildBienCibleCategories + isEmpty plus haut. Leur forme POSITIVE est
    // déjà gérée par les push() ci-dessus (Ascenseur, Parking, Balcon...).
    // On n'ajoute ici QUE la forme négative explicite ("Sans ascenseur",
    // "Sans parking", "Sans extérieur") pour ne pas créer de doublon.
    const ab = activeBien?.bien;
    if (ab) {
      const hasKey = (k) => features.some((f) => f.key === k);
      if (ab.ascenseur === false && !hasKey('ascenseur')) {
        features.push({
          key: 'ascenseur',
          label: 'Sans ascenseur',
          targetVal: false,
          getCompVal: (c) => (typeof c.fields?.ascenseur === 'boolean' ? c.fields.ascenseur : undefined),
          equals: (cv, tv) => cv === tv,
        });
      }
      if (ab.parking === 'aucun' && !hasKey('parking_ext') && !hasKey('garage')) {
        features.push({
          key: 'parking',
          label: 'Sans parking',
          targetVal: 'aucun',
          getCompVal: (c) => c.fields?.parkingType,
          equals: (cv) => cv === 'aucun' || cv == null,
        });
      }
      if (ab.exterieur === 'aucun' && !hasKey('balcon') && !hasKey('terrasse') && !hasKey('jardin')) {
        features.push({
          key: 'exterieur',
          label: 'Sans extérieur',
          targetVal: 'aucun',
          getCompVal: (c) => c.fields?.exterieurType,
          equals: (cv) => cv === 'aucun' || cv == null,
        });
      }
    }

    return features;
  }, [bienCats, activeBien]);

  /* Calcule l'état du tag pour une feature donnée selon le focusedComp. */
  const tagState = (feature, comp) => {
    if (!comp) return 'neutral';
    const cv = feature.getCompVal(comp);
    if (cv == null || cv === '' || (typeof cv === 'number' && Number.isNaN(cv))) return 'na';
    return feature.equals(cv, feature.targetVal) ? 'match' : 'nomatch';
  };

  const [radius, setRadius] = useState(1000);
  // Communes/quartiers exclus du périmètre par l'utilisateur (croix sur le tag).
  // Clé = libellé normalisé de la commune (cf. getCompCommune).
  const [excludedCommunes, setExcludedCommunes] = useState([]);
  const [mapStyle, setMapStyle] = useState('plan');
  // Délai max par source (en mois) — 3 ans (36 mois) pour "En cours" et "Portail", 8 ans (96 mois) pour DVF et Ideeri/Bien vendus
  const [delayDvf, setDelayDvf] = useState(36);
  const [delayIdeeri, setDelayIdeeri] = useState(36);
  const [delayEncours, setDelayEncours] = useState(12);
  const [delayPortail, setDelayPortail] = useState(12);
  // Délais Papiris additionnels — estimation (court terme), mandat clos (moyen
  // terme : un mandat sans vente), vendu autre agence (info marché)
  const [delayEstimation, setDelayEstimation] = useState(12);
  const [delayMandatClos, setDelayMandatClos] = useState(24);
  const [delayAutreAgence, setDelayAutreAgence] = useState(24);
  // Catégories diffuseurs repliables dans le drawer filtres
  const [openSourceCats, setOpenSourceCats] = useState({
    papiris: true, ideeri: true, dvf: true, portails: true,
  });
  const toggleSourceCat = (key) =>
    setOpenSourceCats((prev) => ({ ...prev, [key]: !prev[key] }));
  const [drawMode, setDrawMode] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const drawLayerRef = useRef(null);
  const radiusCircleRef = useRef(null);
  // Layer dédiée aux markers comparables (selected + others). Permet de re-render
  // dynamiquement les markers quand DVF live arrive sans tout recréer.
  const compMarkersLayerRef = useRef(null);
  // Map id → marker pour permettre le zoom programmatique au clic sur une card.
  const markersByIdRef = useRef({});
  const freehandPointsRef = useRef([]);
  const freehandLineRef = useRef(null);
  const isDrawingRef = useRef(false);
  const addCompRef = useRef(null);

  // Selected / Others comparable lists (dynamic)
  // ─── Mode démo (pas de bien actif) : garder les mocks Lyon 3 (4 selected + 4 others)
  // ─── Mode live (bien actif avec citycode) : démarrer vide, peupler via DVF /api/dvf
  const [selected, setSelected] = useState(() => (hasRealLocation ? [] : INITIAL_SELECTED));
  // Mode démo : full mocks. Mode live : on garde tous les mocks non-DVF (mandats
  // Ideeri, en cours, portails) en attendant les branchements live correspondants,
  // et on projette leurs coordonnées Lyon 3 autour du bien actif réel pour la carte.
  const [others, setOthers] = useState(() => {
    if (!hasRealLocation) return INITIAL_OTHERS;
    return INITIAL_NON_DVF_MOCKS.map((m, i) => projectMockNearTarget(m, targetCoords, i));
  });

  // Comparables saisis manuellement précédemment (persistés en localStorage).
  // Lecture seule : la saisie manuelle a été retirée, mais d'éventuels
  // comparables déjà enregistrés restent re-mergés dans `others`.
  const [manualComps] = useState(() => loadManualComps());

  /* ─── Fetch DVF live → peuple "others" avec transactions réelles ──────
   * Pattern Step2 : appel /api/dvf?citycode=XXX&type=YYY (proxy Vercel),
   * transformation transactions → shape comparable card OTHERS, override état.
   *
   * Note : le proxy /api/leboncoin existe mais n'est plus appelé ici (Datadome
   * bloque l'IP Vercel). Les annonces de portails arrivent désormais via le
   * formulaire de saisie manuelle (ManualComparableDrawer).
   *
   * Retombe gracieusement sur les mocks Lyon 3 si pas de citycode.
   */
  useEffect(() => {
    const citycode = activeBien?.adresse?.citycode;
    /* Helper : merge des comps manuels (compactés) avec une base donnée. */
    const mergeManual = (base) => {
      const manualCards = manualComps.map((m) => manualOtherToCompact(m, targetCoords));
      return [...manualCards, ...base];
    };

    if (!citycode) {
      console.log('[Step3 live] pas de citycode → mode démo (mocks Lyon 3)');
      // En démo : garder les mocks INITIAL_OTHERS et y ajouter les comps manuels
      setOthers(mergeManual(INITIAL_OTHERS));
      return undefined;
    }
    let cancelled = false;
    const type = activeBien?.bien?.type || activeBien?.type || '';
    // Zone multi-communes : on fetche toujours le rayon MAX du slider (5km) une
    // seule fois ; le filtrage par rayon courant se fait ensuite côté front
    // (passesLiveFilters + communesInRadius), sans re-fetch au drag du curseur.
    const [tLat, tLon] = targetCoords || [];
    const dvfUrl = `/api/dvf-zone?lat=${encodeURIComponent(tLat)}&lon=${encodeURIComponent(tLon)}&radius=10000${type ? `&type=${encodeURIComponent(type)}` : ''}`;
    console.log('[Step3 live] fetch DVF zone', dvfUrl);

    fetch(dvfUrl)
      .then((r) => r.json())
      .catch((e) => ({ ok: false, error: e.message }))
      .then((dvfData) => {
        if (cancelled) return;
        const dvfCards = (dvfData && dvfData.ok && Array.isArray(dvfData.transactions))
          ? dvfData.transactions
              .map((tx, i) => dvfTxToOther(tx, i, targetCoords))
              .filter((c) => c && c.coords)
          : [];
        console.log(
          '[Step3 live] DVF zone →', dvfCards.length, 'cards',
          dvfData?.communes ? `· ${dvfData.communes.length} communes` : '',
          dvfData?.communesScanned ? `(${dvfData.communesScanned} scannées)` : ''
        );
        if (!dvfData?.ok) {
          console.warn('[Step3 live] DVF zone NOK', dvfData?.error || 'unknown');
        }
        dvfCards.sort((a, b) => {
          const da = haversineMeters(targetCoords, a.coords);
          const db = haversineMeters(targetCoords, b.coords);
          return (da ?? 1e9) - (db ?? 1e9);
        });
        // En mode live on conserve aussi les mocks non-DVF (mandats Ideeri, en cours,
        // portails SeLoger/Leboncoin/Bien'ici) tant que les sources live correspondantes
        // ne sont pas opérationnelles. On les place AVANT les cartes DVF pour qu'ils
        // soient visibles d'emblée (sinon les 100+ DVF les poussent en fin de liste).
        // Et on projette leurs coordonnées Lyon 3 hardcodées AUTOUR du bien actif
        // pour qu'ils apparaissent sur la carte (sinon ils sont à 50km du target).
        const projectedMocks = INITIAL_NON_DVF_MOCKS.map((m, i) => projectMockNearTarget(m, targetCoords, i));
        setOthers(mergeManual([...projectedMocks, ...dvfCards]));
      });

    return () => { cancelled = true; };
  }, [activeBien, targetCoords, manualComps]);

  // Drawer pour afficher le détail d'un comparable (clic sur la carte
  // ou clic sur un comparable dans la liste "Autres")
  const [drawerComp, setDrawerComp] = useState(null);

  // Sections repliables du pool (Marché théorique / réel / Invendus).
  // Ouvertes par défaut. Permet de gagner de l'espace vertical.
  // Tous les dropdowns du pool sont fermés par défaut : on voit d'emblée
  // les 3 catégories repliées + le panier de sélection en bas de colonne.
  const [openPoolSections, setOpenPoolSections] = useState({
    theorique: false,
    reel: false,
    invendus: false,
  });
  const togglePoolSection = (key) =>
    setOpenPoolSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Overrides de similarit\u00e9 par comparable (id \u2192 valeur 0-100).
  // Chargement initial depuis localStorage (cl\u00e9 ideeri_sim_overrides).
  const [simOverrides, setSimOverrides] = useState(() => loadSimOverrides());

  // Persistance localStorage à chaque modification.
  useEffect(() => {
    try {
      window.localStorage.setItem(SIM_OVERRIDES_KEY, JSON.stringify(simOverrides));
    } catch {
      // localStorage indisponible (mode privé, quota plein...) → silent fail
    }
  }, [simOverrides]);

  // Persiste les comparables sélectionnés (Top 3) dans le reportStore pour
  // qu'ils remontent dans la page CompteRendu (/report).
  useEffect(() => {
    setReportState({ comparablesSelectionnes: selected });
  }, [selected]);

  /* ═══════════════════════════════════════════════════════════════
   * WORKSPACE 3 COLONNES — état + handlers
   * ═══════════════════════════════════════════════════════════════
   * Largeurs des 3 colonnes (carte / pool / panier) en % de la rect
   * du workspace. Modifiées au drag des 2 poignées entre colonnes.
   * Persistées dans reportStore.comparablesConfig.step3Cols. */
  const persistedCols = useMemo(
    () => getReportSection('comparablesConfig', {}).step3Cols || null,
    []
  );
  const [colWidths, setColWidths] = useState(() => ({
    map: persistedCols?.map ?? 38,
    pool: persistedCols?.pool ?? 62,
    cart: 0,
  }));
  // Poignée active en cours de drag (1 = entre carte et pool)
  const [activeHandle, setActiveHandle] = useState(null);
  const workspaceRef = useRef(null);

  /* Bornes min/max (en %) pour chaque colonne — évite qu'une colonne soit
   * trop écrasée et donc inutilisable. Réglées pour rester lisibles : la
   * carte garde au moins 15%, le pool 22%, le panier 18%. */
  const COL_BOUNDS = useMemo(() => ({
    map: [20, 65],
    pool: [35, 80],
  }), []);

  const clampPct = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

  /* Démarre le drag d'une poignée (idx = 1 ou 2). Attache mousemove/mouseup
   * globaux pour suivre la souris hors du handle, puis les retire au mouseup. */
  const startResize = (e, idx) => {
    e.preventDefault();
    setActiveHandle(idx);
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    /* Pendant le drag, on demande \u00e0 Leaflet de recalculer sa taille \u00e0
     * chaque frame pour \u00e9viter la zone grise (tuiles non charg\u00e9es). On
     * throttle via requestAnimationFrame pour ne pas spammer. */
    let rafId = null;
    const requestMapInvalidate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const m = mapInstanceRef.current;
        if (m) {
          try { m.invalidateSize({ animate: false, pan: false }); } catch { /* noop */ }
        }
      });
    };

    const handleMove = (mv) => {
      if (!rect.width) return;
      const ratio = ((mv.clientX - rect.left) / rect.width) * 100;
      setColWidths((prev) => {
        // Une seule poignée (idx 1) entre Carte et Pool : ratio = bord droit
        // de la carte. Le pool prend le reste (100 - map) côté rendu.
        const newMap = clampPct(ratio, COL_BOUNDS.map);
        return { ...prev, map: newMap, pool: 100 - newMap };
      });
      requestMapInvalidate();
    };
    const handleUp = () => {
      setActiveHandle(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
      // Appel final pour bien recharger les tuiles \u00e0 la nouvelle taille
      const m = mapInstanceRef.current;
      if (m) {
        try { m.invalidateSize({ animate: false }); } catch { /* noop */ }
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  /* Reset des largeurs (double-clic sur une poignée → retour à 38/62) */
  const resetCols = () => setColWidths({ map: 38, pool: 62, cart: 0 });

  // Persiste les largeurs dans reportStore (debounced naturel via useEffect)
  // + invalide la taille de la map pour les changements via reset / state load
  useEffect(() => {
    mergeReportSection('comparablesConfig', { step3Cols: colWidths });
    const t = setTimeout(() => {
      const m = mapInstanceRef.current;
      if (m) {
        try { m.invalidateSize({ animate: false }); } catch { /* noop */ }
      }
    }, 60);
    return () => clearTimeout(t);
  }, [colWidths]);

  // Met \u00e0 jour ou supprime l'override pour un id donn\u00e9.
  const setSimOverrideFor = (id, value) => {
    setSimOverrides((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null) {
        delete next[id];
      } else {
        const v = Math.max(0, Math.min(100, Math.round(Number(value))));
        if (Number.isNaN(v)) delete next[id];
        else next[id] = v;
      }
      return next;
    });
  };

  const clearSimOverrideFor = (id) => setSimOverrideFor(id, null);

  // Pond\u00e9ration manuelle des comparables : chaque comparable a son propre
  // poids (0-100) ind\u00e9pendant des autres. La moyenne pond\u00e9r\u00e9e finale est
  // calcul\u00e9e en normalisant \u00e0 la somme (peu importe qu'elle vaille 100% ou non).
  // En mode live (selected vide au start), reste vide jusqu'à ce que l'user ajoute des comparables.
  const [weights, setWeights] = useState(() => {
    // Hydratation depuis reportStore si dispo
    const persisted = getReportSection('comparablesConfig', {}).weights;
    if (persisted && typeof persisted === 'object' && Object.keys(persisted).length > 0) {
      return persisted;
    }
    if (hasRealLocation) return {};
    // Poids par défaut = pertinence (similarité × 0.6 + données × 0.4)
    // Chaque comparable part avec son propre score, pas une répartition uniforme.
    const obj = {};
    INITIAL_SELECTED.forEach((c) => {
      obj[c.id] = Math.round((c.similarite || 0) * 0.6 + (c.donnees || 0) * 0.4);
    });
    return obj;
  });

  // Persiste les weights dans le reportStore
  useEffect(() => {
    mergeReportSection('comparablesConfig', { weights });
  }, [weights]);

  // Poids effectif : poids explicite (weights[id]) sinon poids par défaut
  // (pertinence Sim x0.6 + Donn x0.4, cf. defaultWeightFor partagé).
  const effectiveWeight = (c) =>
    weights[c.id] !== undefined ? weights[c.id] : defaultWeightFor(c);

  // Modifier le poids d'un comparable : poids ind\u00e9pendant, pas de
  // re-normalisation des autres. Le total des poids n'est pas contraint
  // \u00e0 100% \u2014 la moyenne pond\u00e9r\u00e9e finale normalise par sumW.
  const handleWeightChange = (id, newValue) => {
    const clamped = Math.max(0, Math.min(100, Number(newValue) || 0));
    setWeights((prev) => ({ ...prev, [id]: clamped }));
  };

  // Nettoyage du poids associ\u00e9 \u00e0 un comparable supprim\u00e9.
  // Pas de re-normalisation \u2014 les autres poids restent inchang\u00e9s.
  const cleanupWeight = (id) => {
    setWeights((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const addToSelected = (compId) => {
    const comp = others.find(c => c.id === compId);
    if (!comp) return;
    // Parse price/m2 from meta (e.g. "DVF · 295k€ · 4 214€/m² · 750m")
    const metaParts = comp.meta.split(' · ');
    const prixStr = metaParts[1] || '0';
    const prixM2Str = metaParts[2] || '0';
    const distanceStr = metaParts[3] || '';
    const prixNum = prixStr.replace(/[^\d]/g, '') + (prixStr.includes('k') ? '000' : '');
    const sourceLabel = comp.source === 'dvf' ? 'DVF' : comp.source === 'ideeri' ? 'Ideeri vendu' : comp.source === 'encours' ? 'En cours' : 'Portail';
    const simVal = parseInt(comp.simScore) || 70;
    const donVal = parseInt(comp.donScore) || 50;
    // Adresse "humaine" : DVF live → adresse réelle ; sinon mock Lyon 3ème
    const liveAddr = comp._dvfRaw?.commune
      ? `${comp._dvfRaw.cp || ''} ${comp._dvfRaw.commune}`.trim()
      : null;
    // Champs structurés conservés pour le rapport CompteRendu (sinon le
    // /report affichait "—" partout : surface, pieces, type, date…).
    const f = comp.fields || {};
    const raw = comp._dvfRaw || {};
    const surfaceNum = Number(f.surface ?? raw.surface) || null;
    const piecesNum = Number(f.pieces ?? raw.pieces) || null;
    const typeStr = f.type || raw.type || null;
    const prixRawNum = Number(f.prix ?? raw.prix) || Number(parseInt(prixNum)) || 0;
    const prixM2RawNum = Number(f.prixM2 ?? raw.prixM2)
      || (surfaceNum && prixRawNum ? Math.round(prixRawNum / surfaceNum) : 0);
    const dateRaw = raw.date || raw.date_mutation || null;
    const dateLabel = dateRaw
      ? new Date(dateRaw).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      : null;
    // Build a full selected-format object
    const promoted = {
      id: comp.id,
      title: comp.title,
      addr: liveAddr || raw.adresse || 'Lyon 3\u00e8me',
      source: comp.source,
      sourceLabel,
      prix: parseInt(prixNum).toLocaleString('fr-FR').replace(/,/g, ' ').replace(/\./g, ' '),
      prixM2: prixM2Str.replace('/m\u00b2', '').replace('\u20ac', '').trim(),
      // Versions numériques pour CompteRendu (calculs + rendu propre)
      prixRaw: prixRawNum,
      prixM2Raw: prixM2RawNum,
      surface: surfaceNum,
      pieces: piecesNum,
      type: typeStr,
      dateLabel,
      distance: distanceStr,
      // Préserve les coords (DVF live a tx.lat/tx.lon ; mocks utilisent COMP_COORDS)
      coords: comp.coords || COMP_COORDS[comp.id],
      _dvfRaw: comp._dvfRaw,
      venteLabel: comp.source === 'encours' ? '\u2014 En cours de vente' : parseInt(prixNum).toLocaleString('fr-FR').replace(/,/g, ' ').replace(/\./g, ' ') + ' \u20ac',
      venteDetail: comp.source === 'dvf' ? 'Transaction r\u00e9elle DVF' : 'Prix affich\u00e9',
      venteNa: comp.source === 'encours',
      avisLabel: '\u2014',
      avisDetail: 'Non renseign\u00e9',
      avisNa: true,
      meta: comp.meta.split(' · ').slice(0, -1).join(' \u00b7 '),
      similarite: simVal,
      simClass: simVal >= 80 ? 'score-high' : simVal >= 60 ? 'score-mid' : 'score-low',
      donnees: donVal,
      donClass: donVal >= 80 ? 'score-high' : donVal >= 40 ? 'score-mid' : 'score-low',
      donCount: comp.donCount,
      reliability: comp.source === 'dvf' || comp.source === 'ideeri' ? 'real' : 'listed',
      reliabilityLabel: comp.source === 'dvf' || comp.source === 'ideeri' ? '\ud83d\udfe2 Transaction r\u00e9elle' : '\ud83d\udfe0 Prix affich\u00e9',
      adjTotal: '0%',
      adjTotalClass: 'pos',
      adjustments: [],
      description: '',
      noPhoto: comp.source === 'dvf' && !(Array.isArray(comp.photos) && comp.photos.length > 0),
      // Priorité : photo réelle saisie par l'agent (manual / portail) →
      // placeholder unsplash pour non-DVF → undefined pour DVF (transaction).
      photoUrl: (Array.isArray(comp.photos) && comp.photos[0])
        || (comp.source !== 'dvf' ? `https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=520&h=140&fit=crop&crop=center&seed=${comp.id}` : undefined),
      // On préserve aussi le tableau complet et l'URL de l'annonce source.
      photos: Array.isArray(comp.photos) ? comp.photos : [],
      urlAnnonce: comp.urlAnnonce || comp.urlSource || null,
      portalName: comp.portalName || (comp.source === 'portail' ? randomPortalName() : undefined),
    };
    setOthers(prev => prev.filter(c => c.id !== compId));
    setSelected(prev => [...prev, promoted]);
    // Poids par défaut du nouveau comparable = sa pertinence
    // (similarité × 0.6 + données × 0.4). L'utilisateur peut ensuite
    // ajuster manuellement via le slider sur la carte.
    setWeights(prev => ({
      ...prev,
      [promoted.id]: prev[promoted.id] !== undefined
        ? prev[promoted.id]
        : Math.round((promoted.similarite || 0) * 0.6 + (promoted.donnees || 0) * 0.4),
    }));
  };

  const removeFromSelected = (compId) => {
    const comp = selected.find(c => c.id === compId);
    if (!comp) return;
    // Convert back to compact format
    const sourcePrefix = comp.source === 'dvf' ? 'DVF' : comp.source === 'ideeri' ? 'Ideeri' : comp.source === 'encours' ? 'En cours' : 'Portail';
    const demoted = {
      id: comp.id,
      title: comp.title,
      source: comp.source,
      meta: `${sourcePrefix} \u00b7 ${comp.prix}\u20ac \u00b7 ${comp.prixM2}\u20ac/m\u00b2 \u00b7 ${comp.distance}`,
      simScore: `${comp.similarite}% sim.`,
      simClass: comp.similarite >= 80 ? 'high' : comp.similarite >= 60 ? 'mid' : 'low',
      donScore: `${comp.donnees}% donn\u00e9es`,
      donClass: comp.donnees >= 80 ? 'high' : comp.donnees >= 40 ? 'mid' : 'low',
      donCount: comp.donCount,
      portalName: comp.portalName,
      // Préserve coords + raw DVF lors du retour en "Autres"
      coords: comp.coords || COMP_COORDS[comp.id],
      _dvfRaw: comp._dvfRaw,
    };
    setSelected(prev => prev.filter(c => c.id !== compId));
    setOthers(prev => [...prev, demoted]);
    cleanupWeight(compId);
  };

  // Alias utilis\u00e9 par la card et le tableau r\u00e9cap pour la suppression
  const handleRemoveComparable = removeFromSelected;

  // Expose addToSelected for Leaflet popups
  addCompRef.current = addToSelected;
  useEffect(() => {
    window.__addComp = (id) => addCompRef.current?.(id);
    return () => { delete window.__addComp; };
  }, []);

  // Filter states — hydratation depuis reportStore pour persistance inter-pages
  const persistedFiltres = useMemo(
    () => getReportSection('comparablesConfig', {}).filtres || {},
    []
  );
  const [surfaceMin, setSurfaceMin] = useState(persistedFiltres.surfaceMin ?? 55);
  const [surfaceMax, setSurfaceMax] = useState(persistedFiltres.surfaceMax ?? 90);
  const [piecesMin, setPiecesMin] = useState(persistedFiltres.piecesMin ?? 2);
  const [piecesMax, setPiecesMax] = useState(persistedFiltres.piecesMax ?? 4);
  const [prixMin, setPrixMin] = useState(persistedFiltres.prixMin ?? 200000);
  const [prixMax, setPrixMax] = useState(persistedFiltres.prixMax ?? 400000);
  // Fourchette de prix (€) par source — filtre le prix total des comparables
  // de la source sur [min, max]. Échelle identique à la section "Fourchette
  // de prix" du dessous (100k–600k). Défaut : plage complète (= pas de coupe).
  const PRICE_FLOOR = 100000;
  const PRICE_MAX = 600000;
  const [priceMinDvf, setPriceMinDvf] = useState(persistedFiltres.priceMinDvf ?? PRICE_FLOOR);
  const [priceMaxDvf, setPriceMaxDvf] = useState(persistedFiltres.priceMaxDvf ?? PRICE_MAX);
  const [priceMinIdeeri, setPriceMinIdeeri] = useState(persistedFiltres.priceMinIdeeri ?? PRICE_FLOOR);
  const [priceMaxIdeeri, setPriceMaxIdeeri] = useState(persistedFiltres.priceMaxIdeeri ?? PRICE_MAX);
  const [priceMinEncours, setPriceMinEncours] = useState(persistedFiltres.priceMinEncours ?? PRICE_FLOOR);
  const [priceMaxEncours, setPriceMaxEncours] = useState(persistedFiltres.priceMaxEncours ?? PRICE_MAX);
  const [priceMinEstimation, setPriceMinEstimation] = useState(persistedFiltres.priceMinEstimation ?? PRICE_FLOOR);
  const [priceMaxEstimation, setPriceMaxEstimation] = useState(persistedFiltres.priceMaxEstimation ?? PRICE_MAX);
  const [priceMinMandatClos, setPriceMinMandatClos] = useState(persistedFiltres.priceMinMandatClos ?? PRICE_FLOOR);
  const [priceMaxMandatClos, setPriceMaxMandatClos] = useState(persistedFiltres.priceMaxMandatClos ?? PRICE_MAX);
  const [priceMinAutreAgence, setPriceMinAutreAgence] = useState(persistedFiltres.priceMinAutreAgence ?? PRICE_FLOOR);
  const [priceMaxAutreAgence, setPriceMaxAutreAgence] = useState(persistedFiltres.priceMaxAutreAgence ?? PRICE_MAX);
  const [priceMinPortail, setPriceMinPortail] = useState(persistedFiltres.priceMinPortail ?? PRICE_FLOOR);
  const [priceMaxPortail, setPriceMaxPortail] = useState(persistedFiltres.priceMaxPortail ?? PRICE_MAX);
  /* typeFilters : array de values TYPES_BIEN. Si [] ou contient tout → "Tous types".
   * Migration depuis l'ancien format string (typeFilter) pour les rapports
   * sauvegardés avant l'introduction du multiselect. */
  const [typeFilters, setTypeFilters] = useState(() => {
    if (Array.isArray(persistedFiltres.typeFilters)) return persistedFiltres.typeFilters;
    const legacy = persistedFiltres.typeFilter;
    if (legacy === 'tous' || legacy == null) return ['appartement'];
    return [legacy];
  });
  const [sourceDvf, setSourceDvf] = useState(persistedFiltres.sourceDvf ?? true);
  const [sourceIdeeri, setSourceIdeeri] = useState(persistedFiltres.sourceIdeeri ?? true);
  const [sourceEncours, setSourceEncours] = useState(persistedFiltres.sourceEncours ?? true);
  // Sources Papiris additionnelles : estimation (avis Ideeri non concrétisé),
  // mandat clos (mandat fini sans vente, info négative), vendu autre agence
  // (signal marché de la zone).
  const [sourceEstimation, setSourceEstimation] = useState(persistedFiltres.sourceEstimation ?? true);
  const [sourceMandatClos, setSourceMandatClos] = useState(persistedFiltres.sourceMandatClos ?? false);
  const [sourceAutreAgence, setSourceAutreAgence] = useState(persistedFiltres.sourceAutreAgence ?? true);
  // Drawer filtres : ouvert/fermé. Le bouton "Configurer les filtres" l'ouvre.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(460);
  const drawerResizeRef = useRef(null);
  const startDrawerResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = drawerWidth;
    const onMove = (ev) => {
      const next = Math.max(400, Math.min(window.innerWidth * 0.95, startW + (ev.clientX - startX)));
      setDrawerWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const [sourcePortail, setSourcePortail] = useState(persistedFiltres.sourcePortail ?? true);

  // Persiste les filtres dans le reportStore
  useEffect(() => {
    mergeReportSection('comparablesConfig', {
      filtres: {
        surfaceMin, surfaceMax,
        piecesMin, piecesMax,
        prixMin, prixMax,
        typeFilters,
        sourceDvf, sourceIdeeri, sourceEncours, sourcePortail,
        sourceEstimation, sourceMandatClos, sourceAutreAgence,
        radius, delayDvf, delayIdeeri, delayEncours, delayPortail,
        delayEstimation, delayMandatClos, delayAutreAgence,
        priceMinDvf, priceMaxDvf, priceMinIdeeri, priceMaxIdeeri,
        priceMinEncours, priceMaxEncours, priceMinPortail, priceMaxPortail,
        priceMinEstimation, priceMaxEstimation,
        priceMinMandatClos, priceMaxMandatClos,
        priceMinAutreAgence, priceMaxAutreAgence,
      },
    });
  }, [
    surfaceMin, surfaceMax, piecesMin, piecesMax,
    prixMin, prixMax, typeFilters,
    sourceDvf, sourceIdeeri, sourceEncours, sourcePortail,
    sourceEstimation, sourceMandatClos, sourceAutreAgence,
    radius, delayDvf, delayIdeeri, delayEncours, delayPortail,
    delayEstimation, delayMandatClos, delayAutreAgence,
    priceMinDvf, priceMaxDvf, priceMinIdeeri, priceMaxIdeeri,
    priceMinEncours, priceMaxEncours, priceMinPortail, priceMaxPortail,
    priceMinEstimation, priceMaxEstimation,
    priceMinMandatClos, priceMaxMandatClos,
    priceMinAutreAgence, priceMaxAutreAgence,
  ]);

  // Additional optional filters
  const [extraFilters, setExtraFilters] = useState([]);
  const allExtraFilters = [
    { key: 'dpe', label: 'DPE' },
    { key: 'etage', label: '\u00c9tage' },
    { key: 'parking', label: 'Parking' },
    { key: 'exterieur', label: 'Ext\u00e9rieur' },
    { key: 'annee', label: 'Ann\u00e9e construction' },
    { key: 'etat', label: '\u00c9tat g\u00e9n\u00e9ral' },
  ];
  const availableExtraFilters = allExtraFilters.filter(f => !extraFilters.includes(f.key));
  const addExtraFilter = (key) => setExtraFilters(prev => [...prev, key]);
  const removeExtraFilter = (key) => setExtraFilters(prev => prev.filter(k => k !== key));

  // Filtre live unifié : applique sources + type + surface + pièces + prix + rayon
  // Utilisé à la fois par le count (computeFilteredCount) et la liste visible
  // (visibleOthers), pour que les 2 affichages soient toujours alignés.
  const passesLiveFilters = (c) => {
    // Les comparables ajoutés manuellement par l'utilisateur ne sont JAMAIS
    // filtrés (sinon on lui cache son propre ajout si surface/pièces/prix sont
    // hors plage par défaut, ou si la source correspondante est décochée).
    if (c.manual) return true;
    // Filtre source (checkboxes)
    if (c.source === 'dvf' && !sourceDvf) return false;
    if (c.source === 'portail' && !sourcePortail) return false;
    if (c.source === 'ideeri' && !sourceIdeeri) return false;
    if (c.source === 'encours' && !sourceEncours) return false;
    if (c.source === 'estimation' && !sourceEstimation) return false;
    if (c.source === 'mandat_clos' && !sourceMandatClos) return false;
    if (c.source === 'autre_agence' && !sourceAutreAgence) return false;
    // Fourchette de prix [min, max] (€) par source (slider de chaque diffuseur)
    const srcRange = {
      dvf: [priceMinDvf, priceMaxDvf],
      portail: [priceMinPortail, priceMaxPortail],
      ideeri: [priceMinIdeeri, priceMaxIdeeri],
      encours: [priceMinEncours, priceMaxEncours],
      estimation: [priceMinEstimation, priceMaxEstimation],
      mandat_clos: [priceMinMandatClos, priceMaxMandatClos],
      autre_agence: [priceMinAutreAgence, priceMaxAutreAgence],
    }[c.source];
    if (srcRange) {
      const [lo, hi] = srcRange;
      if (lo > PRICE_FLOOR || hi < PRICE_MAX) {
        const p = c.fields?.prix ?? c._dvfRaw?.prix;
        if (typeof p === 'number' && (p < lo || p > hi)) return false;
      }
    }
    // Filtre type (multiselect)
    // - typeFilters vide ou contient tous les types → "Tous types" (pas de filtre)
    // - sinon : on garde si le type du comp matche l'une des values cochées
    if (typeFilters.length > 0 && typeFilters.length < TYPES_BIEN_VALUES.length) {
      const compType = c.fields?.type || c._dvfRaw?.type;
      if (compType) {
        const normalized = String(compType).toLowerCase().trim();
        if (!typeFilters.includes(normalized)) return false;
      }
    }
    // Filtre surface
    const compSurface = c.fields?.surface ?? c._dvfRaw?.surface;
    if (typeof compSurface === 'number' && (compSurface < surfaceMin || compSurface > surfaceMax)) return false;
    // Filtre pièces
    const compPieces = c.fields?.pieces ?? c._dvfRaw?.pieces;
    if (typeof compPieces === 'number' && (compPieces < piecesMin || compPieces > piecesMax)) return false;
    // Filtre prix
    const compPrix = c.fields?.prix ?? c._dvfRaw?.prix;
    if (typeof compPrix === 'number' && (compPrix < prixMin || compPrix > prixMax)) return false;
    // Filtre commune/quartier exclu (croix sur le tag de zone).
    // Ne s'applique qu'aux DVF : seules sources dont la commune est fiable
    // (cf. communesInRadius). Les mocks projetés gardent un libellé factice.
    if (excludedCommunes.length > 0 && c.source === 'dvf') {
      const compCommune = getCompCommune(c);
      if (compCommune && excludedCommunes.includes(compCommune)) return false;
    }
    // Filtre rayon (distance haversine depuis le target)
    if (c.coords && targetCoords) {
      const dist = haversineMeters(targetCoords, c.coords);
      if (dist != null && dist > radius) return false;
    }
    return true;
  };

  // Bien count : en mode live (DVF), on s'appuie sur le count réel de transactions.
  // En mode démo (pas de bien actif), on simule via les filtres pour garder l'UX initiale.
  const computeFilteredCount = () => {
    // Mode live : count réel des cards "others" filtré selon tous les filtres actifs.
    if (hasRealLocation && others.length > 0) {
      const filtered = others.filter(passesLiveFilters);
      return Math.max(filtered.length, 0);
    }
    let count = ALL_COMPS_COUNT;
    // Radius effect
    if (radius < 500) count = Math.round(count * 0.3);
    else if (radius < 1000) count = Math.round(count * 0.7);
    else if (radius > 2000) count = Math.min(count + 15, 80);
    // Surface effect
    const surfaceRange = surfaceMax - surfaceMin;
    if (surfaceRange < 20) count = Math.max(Math.round(count * 0.4), 2);
    else if (surfaceRange < 30) count = Math.round(count * 0.7);
    // Pieces effect
    const piecesRange = piecesMax - piecesMin;
    if (piecesRange === 0) count = Math.max(Math.round(count * 0.35), 1);
    else if (piecesRange === 1) count = Math.round(count * 0.6);
    // Prix effect
    const prixRange = prixMax - prixMin;
    if (prixRange < 100000) count = Math.max(Math.round(count * 0.5), 1);
    else if (prixRange < 150000) count = Math.round(count * 0.75);
    // Source effect
    const allSourceFlags = [
      sourceDvf, sourceIdeeri, sourceEncours, sourcePortail,
      sourceEstimation, sourceMandatClos, sourceAutreAgence,
    ];
    const sourcesOn = allSourceFlags.filter(Boolean).length;
    const sourcesTotal = allSourceFlags.length;
    if (sourcesOn < sourcesTotal) count = Math.max(Math.round(count * (sourcesOn / sourcesTotal)), 1);
    // Délai par source — chaque source contribue proportionnellement à son délai
    // DVF & Ideeri vendus : pleine contribution à 96 mois (8 ans)
    // En cours, Portail, Estimation, Mandat clos, Autre agence : 36 mois (3 ans)
    const sourceContribs = [];
    if (sourceDvf) sourceContribs.push(Math.min(delayDvf / 96, 1));
    if (sourceIdeeri) sourceContribs.push(Math.min(delayIdeeri / 96, 1));
    if (sourceEncours) sourceContribs.push(Math.min(delayEncours / 36, 1));
    if (sourcePortail) sourceContribs.push(Math.min(delayPortail / 36, 1));
    if (sourceEstimation) sourceContribs.push(Math.min(delayEstimation / 36, 1));
    if (sourceMandatClos) sourceContribs.push(Math.min(delayMandatClos / 36, 1));
    if (sourceAutreAgence) sourceContribs.push(Math.min(delayAutreAgence / 36, 1));
    const dateFactor = sourceContribs.length
      ? sourceContribs.reduce((a, b) => a + b, 0) / sourceContribs.length
      : 1;
    // Pondération non-linéaire : courbe douce pour que les petits délais réduisent fortement
    count = Math.max(Math.round(count * (0.15 + 0.85 * dateFactor)), 1);
    // Type (multiselect) : si "tous types" (vide ou tout coché) → bonus de biens
    // disponibles ; sinon, plus on a coché de types, plus on a de biens potentiels
    const allTypes = typeFilters.length === 0 || typeFilters.length === TYPES_BIEN_VALUES.length;
    if (allTypes) count = Math.min(count + 8, 90);
    else if (typeFilters.length >= 3) count = Math.min(count + 4, 90);
    return Math.max(count, 1);
  };
  const filteredCount = computeFilteredCount();

  /* Prix des biens disponibles regroupés par source (pour alimenter le
   * comptage de biens dans la fourchette de prix de chaque diffuseur). */
  const pricesBySource = useMemo(() => {
    const acc = {};
    for (const c of others) {
      const p = c.fields?.prix ?? c._dvfRaw?.prix;
      if (typeof p !== 'number') continue;
      (acc[c.source] = acc[c.source] || []).push(p);
    }
    return acc;
  }, [others]);

  /* Communes / quartiers réellement couverts par le rayon courant.
   * Dérivé des comparables `others` dont la distance au target <= radius,
   * sans appliquer les autres filtres (on veut voir toute la zone, même si
   * une source est décochée). Chaque entrée : { name, count }.
   * Trié par fréquence décroissante. */
  const communesInRadius = useMemo(() => {
    const counts = new Map();
    for (const c of others) {
      if (c.manual) continue; // les ajouts manuels ne définissent pas la zone
      // Seules les transactions DVF portent une commune fiable (champ DVF réel).
      // Les mocks de portails/mandats démo ont des coords projetées autour du
      // bien mais un libellé hardcodé "Lyon 3" → on les exclut des tags de zone
      // pour ne pas afficher une commune erronée (ex. bien à Condrieu).
      if (c.source !== 'dvf') continue;
      if (c.coords && targetCoords) {
        const dist = haversineMeters(targetCoords, c.coords);
        if (dist != null && dist > radius) continue;
      }
      const name = getCompCommune(c);
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  }, [others, radius, targetCoords]);

  /* Compte des filtres qui s'\u00e9cartent de la configuration par d\u00e9faut, pour
   * afficher un badge sur le bouton "Configurer les filtres". Une source est
   * "active" si elle est d\u00e9coch\u00e9e (toutes coch\u00e9es par d\u00e9faut sauf mandat_clos
   * d\u00e9coch\u00e9 par d\u00e9faut). */
  const activeFiltersCount = (() => {
    let n = 0;
    if (!sourceDvf) n += 1;
    if (!sourceIdeeri) n += 1;
    if (!sourceEncours) n += 1;
    if (!sourcePortail) n += 1;
    if (!sourceEstimation) n += 1;
    if (sourceMandatClos) n += 1; // décoché par défaut
    if (!sourceAutreAgence) n += 1;
    if (typeFilters.length > 0 && typeFilters.length < TYPES_BIEN_VALUES.length) n += 1;
    if (surfaceMin !== 55 || surfaceMax !== 90) n += 1;
    if (piecesMin !== 2 || piecesMax !== 4) n += 1;
    if (prixMin !== 200000 || prixMax !== 400000) n += 1;
    if (extraFilters && extraFilters.length > 0) n += extraFilters.length;
    return n;
  })();

  const formatRadius = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} km` : `${v}m`);
  const sliderPct = ((radius - 100) / (10000 - 100)) * 100;

  // Source → marker color mapping
  // vert = Ideeri vendu (mandat) · bleu = DVF officiel · orange = Ideeri en cours · rouge = Portails
  // violet = estimation · gris = mandat clos · teal = vendu autre agence
  const sourceMarkerColor = {
    dvf: '#4a6cf7',
    ideeri: '#46B962',
    encours: '#f5a623',
    portail: '#e74c3c',
    estimation: '#9b59b6',
    mandat_clos: '#7f8c8d',
    autre_agence: '#16a085',
  };

  // Initialize Leaflet map with markers and draw tool
  useEffect(() => {
    if (mapInstanceRef.current) return;
    if (!L || !mapRef.current) return;

    // dragging: false → la carte ne se déplace pas au glisser-déposer souris.
    // scrollWheelZoom: false → la molette ne zoome plus (le zoom molette ancre
    // sur le pointeur et déplace la vue). Navigation uniquement via les boutons
    // +/- de zoom (qui zooment toujours sur le centre).
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      keyboard: false,
    }).setView(targetCoords, 15);
    const tile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tile;
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Radius circle (will be hidden when user draws a custom zone)
    const radiusCircle = L.circle(targetCoords, { radius: 1000, color: '#46B962', weight: 2, opacity: 0.6, fillColor: '#46B962', fillOpacity: 0.06, dashArray: '8, 6' }).addTo(map);
    radiusCircleRef.current = radiusCircle;

    // Target marker — large, distinctive house icon with pulsing ring
    const targetIcon = L.divIcon({
      className: 'target-marker-icon',
      html: `<div style="width:40px;height:40px;position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:-8px;border:2.5px solid #46B962;border-radius:50%;opacity:0.4;animation:pulse 2s infinite"></div>
        <div style="position:absolute;inset:-4px;border:2px solid rgba(70,185,98,0.15);border-radius:50%;animation:pulse 2s infinite 0.5s"></div>
        <div style="width:40px;height:40px;background:#46B962;border:3px solid white;border-radius:50%;box-shadow:0 3px 12px rgba(70,185,98,0.45);display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    L.marker(targetCoords, { icon: targetIcon, zIndexOffset: 1000 }).addTo(map).bindPopup(
      `<div style="text-align:center;padding:4px 0">
        <div style="font-weight:700;font-size:14px;color:#333;margin-bottom:4px">${(targetLabel || '').replace(/</g, '&lt;')}</div>
        <div style="font-size:12px;color:#666;margin-bottom:6px">${(targetCityLine || '').replace(/</g, '&lt;')}</div>
        <div style="display:inline-block;background:#46B962;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Bien cible</div>
      </div>`
    );

    // Layer dédiée aux markers comparables — vide à l'init, peuplée par
    // un useEffect séparé qui réagit aux changements de selected/others
    // (inclut les transactions DVF live arrivant après l'init).
    const compMarkers = new L.FeatureGroup();
    map.addLayer(compMarkers);
    compMarkersLayerRef.current = compMarkers;

    // Drawing layer for user-drawn zones
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawLayerRef.current = drawnItems;

    // Freehand drawing via mouse events
    const onMouseDown = (e) => {
      if (!isDrawingRef.current) return;
      freehandPointsRef.current = [e.latlng];
      freehandLineRef.current = L.polyline([e.latlng], {
        color: '#4a6cf7', weight: 2.5, dashArray: '6,4', opacity: 0.8,
      }).addTo(map);
      map.dragging.disable();
    };
    const onMouseMove = (e) => {
      if (!isDrawingRef.current || !freehandLineRef.current) return;
      freehandPointsRef.current.push(e.latlng);
      freehandLineRef.current.addLatLng(e.latlng);
    };
    const onMouseUp = () => {
      if (!isDrawingRef.current || !freehandLineRef.current) return;
      // Note : le drag de la carte reste désactivé en permanence (navigation
      // uniquement via zoom). On ne réactive donc pas map.dragging ici.
      // Remove temp polyline, create filled polygon
      map.removeLayer(freehandLineRef.current);
      freehandLineRef.current = null;
      const pts = freehandPointsRef.current;
      if (pts.length > 4) {
        // Clear previous drawn zones (only keep the latest)
        drawnItems.clearLayers();
        const polygon = L.polygon(pts, {
          color: '#4a6cf7', weight: 2, fillColor: '#4a6cf7',
          fillOpacity: 0.12, dashArray: '6, 4',
        });
        drawnItems.addLayer(polygon);
        // Hide the green radius circle — the drawn zone replaces it
        if (radiusCircleRef.current) {
          map.removeLayer(radiusCircleRef.current);
        }
      }
      freehandPointsRef.current = [];
    };
    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch map tile layer when style changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const tile = tileLayerRef.current;
    if (!map || !tile) return;
    const urls = {
      plan: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    };
    tile.setUrl(urls[mapStyle] || urls.plan);
  }, [mapStyle]);

  /* Synchronise le cercle de rayon sur la carte avec le slider. Le cercle est
   * créé une fois (radius: 1000) ; ici on met à jour son rayon réel + on ajuste
   * la vue pour qu'il reste entièrement visible quand on élargit. */
  useEffect(() => {
    const map = mapInstanceRef.current;
    const circle = radiusCircleRef.current;
    if (!map || !circle) return;
    circle.setRadius(radius);
    // Ne recadre que si le cercle est affiché (pas de zone dessinée manuelle)
    if (map.hasLayer(circle)) {
      map.fitBounds(circle.getBounds(), { padding: [24, 24], animate: true });
    }
  }, [radius]);

  /* ─── Render markers comparables (selected + others) ──────────────────────
   * Effect dynamique — réagit aux changements de selected/others (par ex.
   * arrivée des transactions DVF live après fetch). Vide la layer puis
   * redessine tous les markers.
   *
   * Coordonnées : `comp.coords` en priorité (DVF live a lat/lon), sinon
   * fallback `COMP_COORDS[comp.id]` (mocks Lyon 3). */
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = compMarkersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    // Reset le mapping id → marker (sera rempli ci-dessous)
    markersByIdRef.current = {};

    // SELECTED — markers prominents (22px, ring autour)
    selected.forEach((rawComp) => {
      const comp = applySimOverride(rawComp, simOverrides);
      const coords = comp.coords || COMP_COORDS[comp.id];
      if (!coords) return;
      const color = sourceMarkerColor[comp.source] || '#999';
      const icon = L.divIcon({
        className: 'comp-marker-icon',
        html: `<div style="width:22px;height:22px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;position:relative">
          <div style="position:absolute;inset:-4px;border:2px solid ${color};border-radius:50%;opacity:0.25"></div>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const sim = comp.similarite || 0;
      const simColor = sim >= 80 ? '#46B962' : sim >= 60 ? '#d97706' : '#e74c3c';
      // Le bloc popup gère deux shapes (mock riche INITIAL_SELECTED + DVF live minimal)
      const titleSafe = (comp.title || '').replace(/</g, '&lt;');
      const addrSafe = (comp.addr || comp._dvfRaw?.adresse || '').replace(/</g, '&lt;');
      const distLabel = comp.distance || '';
      const prixLabel = comp.prix || (comp._dvfRaw?.prix ? `${comp._dvfRaw.prix.toLocaleString('fr-FR')}` : '—');
      const prixM2Label = comp.prixM2 || (comp._dvfRaw?.prixM2 ? `${comp._dvfRaw.prixM2.toLocaleString('fr-FR')}` : '—');
      const selMarker = L.marker(coords, { icon, zIndexOffset: 500 }).addTo(layer).bindPopup(
        `<div style="min-width:220px;padding:2px 0">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${titleSafe}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px">${addrSafe}${distLabel ? ' · ' + distLabel : ''}</div>
          <div style="display:flex;gap:12px;margin-bottom:6px">
            <div><div style="font-size:10px;color:#999">Prix</div><div style="font-weight:700;font-size:13px">${prixLabel} €</div></div>
            <div><div style="font-size:10px;color:#999">Prix/m²</div><div style="font-weight:600;font-size:13px">${prixM2Label} €</div></div>
          </div>
          ${sim ? `<div style="display:flex;gap:8px;margin-bottom:6px">
            <span style="background:${simColor}22;color:${simColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${sim}% sim.</span>
            ${comp.donnees ? `<span style="background:#4a6cf722;color:#4a6cf7;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.donnees}% données</span>` : ''}
          </div>` : ''}
          <div style="display:inline-block;background:#46B962;color:white;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600">✓ Sélectionné</div>
        </div>`
      );
      markersByIdRef.current[comp.id] = selMarker;
    });

    // OTHERS — markers medium (16px) avec popup + bouton "Ajouter"
    others.forEach((comp) => {
      const coords = comp.coords || COMP_COORDS[comp.id];
      if (!coords) return;
      const color = sourceMarkerColor[comp.source] || '#999';
      const icon = L.divIcon({
        className: 'comp-marker-icon',
        html: `<div style="width:16px;height:16px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.25);cursor:pointer;opacity:0.85"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const metaParts = (comp.meta || '').split(' · ');
      const simColor = comp.simClass === 'high' ? '#46B962' : comp.simClass === 'mid' ? '#d97706' : '#e74c3c';
      const titleSafe = (comp.title || '').replace(/</g, '&lt;');
      const othMarker = L.marker(coords, { icon }).addTo(layer).bindPopup(
        `<div style="min-width:220px;padding:2px 0">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${titleSafe}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px">${metaParts.join(' · ')}</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <span style="background:${simColor}22;color:${simColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.simScore || ''}</span>
            <span style="background:#88888822;color:#666;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.donScore || ''}</span>
          </div>
          <button onclick="window.__addComp&amp;&amp;window.__addComp('${comp.id}');this.textContent='✓ Ajouté';this.style.background='#46B962';this.style.color='white';this.style.borderColor='#46B962';this.disabled=true" style="width:100%;padding:6px 0;background:white;border:1.5px solid #46B962;color:#46B962;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Open Sans,sans-serif;transition:all 0.15s">+ Ajouter aux comparables</button>
        </div>`
      );
      markersByIdRef.current[comp.id] = othMarker;
    });
  }, [selected, others, simOverrides]);

  /* Zoom la carte sur les coordonnées d'un comparable + ouvre son popup.
   * Appelé au clic d'une PoolCompCard pour donner un feedback visuel
   * immédiat de la position du bien sur la carte. */
  const focusCompOnMap = (comp) => {
    // Met à jour le comp focusé pour les tags caractéristiques (barre haut)
    setFocusedComp(comp);
    const map = mapInstanceRef.current;
    if (!map) return;
    const coords = comp.coords || COMP_COORDS[comp.id];
    if (!coords) return;
    // flyTo avec animation fluide, zoom 17 (proche mais avec contexte alentour)
    map.flyTo(coords, 17, { duration: 0.6 });
    const marker = markersByIdRef.current[comp.id];
    if (marker) {
      // Léger délai pour laisser l'animation flyTo se positionner
      setTimeout(() => {
        try { marker.openPopup(); } catch { /* noop */ }
      }, 350);
    }
  };

  // Toggle freehand drawing mode
  const toggleDrawMode = () => {
    const next = !drawMode;
    isDrawingRef.current = next;
    setDrawMode(next);
    const map = mapInstanceRef.current;
    if (map) {
      if (next) {
        map.getContainer().style.cursor = 'crosshair';
      } else {
        map.getContainer().style.cursor = '';
        // drag carte volontairement laissé désactivé (navigation par zoom only)
      }
    }
  };

  // Clear all drawn zones and restore the radius circle
  const clearDrawnZones = () => {
    if (drawLayerRef.current) {
      drawLayerRef.current.clearLayers();
    }
    // Restore the green radius circle
    const map = mapInstanceRef.current;
    if (map && radiusCircleRef.current && !map.hasLayer(radiusCircleRef.current)) {
      map.addLayer(radiusCircleRef.current);
    }
    isDrawingRef.current = false;
    setDrawMode(false);
    if (map) {
      map.getContainer().style.cursor = '';
      // drag carte volontairement laissé désactivé (navigation par zoom only)
    }
  };

  return (
    <div className="step3-page">
      <style>{cssStyles}</style>

      <PropertyCard />
      <Stepper currentStep={3} />

      {/* ═══════════════════════════════════════════════════════════════
        * BANDEAU FILTRES COMPACT
        * H3 + compteur de résultats + bouton "Configurer les filtres" qui
        * ouvre le drawer latéral. Le rayon reste visible (contextuel carte).
        * La légende 7 sources est affichée sous la barre principale.
        * ═══════════════════════════════════════════════════════════════ */}
      <div className="filter-panel-compact">
        <div className="filter-bar">
          <h3>Filtres</h3>
          <span className="filter-bar-results">{filteredCount} résultats</span>
          <div className="filter-bar-spacer" />
          <button
            type="button"
            className="btn-open-filters"
            onClick={() => setFiltersOpen(true)}
            aria-label="Ouvrir le panneau des filtres"
          >
            ⚙ Configurer les filtres
            {activeFiltersCount > 0 && (
              <span className="filters-badge">{activeFiltersCount}</span>
            )}
          </button>
          <button type="button" className="btn-reset-compact">Réinitialiser</button>
        </div>

        {/* Le rayon a été déplacé en overlay sur la carte (cf. radius-overlay
         * dans la colonne carte du workspace). */}

        {/* Zones couvertes par le rayon — mini-tags communes/quartiers.
         * Dérivés des comparables réellement dans le rayon. Croix = exclure
         * la commune des résultats ; tag grisé + ↺ = réintégrer. */}
        {(communesInRadius.length > 0 || excludedCommunes.length > 0) && (
          <div className="zone-tags-row">
            <span className="zone-tags-label">Zones couvertes</span>
            <div className="zone-tags-list">
              {communesInRadius.map((z) => (
                <span key={z.name} className="zone-tag">
                  {z.name}
                  <span className="zone-tag-count">{z.count}</span>
                  <button
                    type="button"
                    className="zone-tag-remove"
                    onClick={() => setExcludedCommunes((prev) => prev.includes(z.name) ? prev : [...prev, z.name])}
                    title={`Exclure ${z.name} du périmètre`}
                    aria-label={`Exclure ${z.name} du périmètre`}
                  >
                    &times;
                  </button>
                </span>
              ))}
              {excludedCommunes.map((name) => (
                <span key={`x-${name}`} className="zone-tag is-excluded">
                  {name}
                  <button
                    type="button"
                    className="zone-tag-restore"
                    onClick={() => setExcludedCommunes((prev) => prev.filter((n) => n !== name))}
                    title={`Réintégrer ${name} au périmètre`}
                    aria-label={`Réintégrer ${name} au périmètre`}
                  >
                    &#8635;
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Légende des 7 sources colorées */}
        <div className="filter-bar-second">
          <div className="filter-legend-7">
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#4a6cf7' }} /> DVF</span>
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#46B962' }} /> Biens vendus</span>
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#f5a623' }} /> En cours</span>
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#9b59b6' }} /> Estimation</span>
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#7f8c8d' }} /> Mandat clos</span>
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#16a085' }} /> Autre agence</span>
            <span className="legend-item"><span className="legend-dot-sm" style={{ background: '#e74c3c' }} /> Portails</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
        * DRAWER LATÉRAL FILTRES — tous les filtres détaillés
        * Slide-in depuis la gauche, overlay sombre, fermable par × / Esc /
        * clic en dehors. Toutes les sections empilées verticalement.
        * ═══════════════════════════════════════════════════════════════ */}
      {filtersOpen && (
        <div
          className="filters-drawer-overlay"
          onClick={() => setFiltersOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFiltersOpen(false); }}
        >
          <aside
            className="filters-drawer-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ width: drawerWidth }}
          >
            <div
              className="filters-drawer-resize"
              onMouseDown={startDrawerResize}
              role="separator"
              aria-label="Redimensionner le panneau"
              title="Glisser pour agrandir"
            />
            <header className="filters-drawer-header">
              <h2>Filtres</h2>
              <span className="filters-drawer-results">{filteredCount} résultats</span>
              <button
                type="button"
                className="filters-drawer-close"
                onClick={() => setFiltersOpen(false)}
                aria-label="Fermer le panneau des filtres"
              >×</button>
            </header>

            <div className="filters-drawer-body">

              {/* SECTION 1 — Source & ancienneté max */}
              <section className="filters-drawer-section">
                <h3 className="filters-drawer-section-title">
                  Diffuseurs de biens
                  <span className="filters-drawer-section-hint">ancienneté + tranche de prix par diffuseur</span>
                </h3>
                <div className="filters-drawer-section-body">
                  <div className="source-checkboxes">
                    {/* CATÉGORIE PAPIRIS — estimation / mandats actifs / biens vendus */}
                    <div className={`source-cat${openSourceCats.papiris ? '' : ' is-collapsed'}`}>
                      <button type="button" className="source-cat-head" onClick={() => toggleSourceCat('papiris')} aria-expanded={openSourceCats.papiris}>
                        <span className={`source-cat-caret${openSourceCats.papiris ? ' is-open' : ''}`}>{'\u25b8'}</span>
                        <span className="source-cat-title">Papiris</span>
                      </button>
                      {openSourceCats.papiris && (
                        <>
                          <SourceRow dotClass="dot-estimation" label="Estimation"
                            checked={sourceEstimation} onToggle={() => setSourceEstimation(!sourceEstimation)}
                            delay={delayEstimation} setDelay={setDelayEstimation} maxMonths={36}
                            priceMin={priceMinEstimation} priceMax={priceMaxEstimation}
                            setPriceMin={setPriceMinEstimation} setPriceMax={setPriceMaxEstimation}
                            priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.estimation} />
                          <SourceRow dotClass="dot-encours" label="Mandats actifs"
                            checked={sourceEncours} onToggle={() => setSourceEncours(!sourceEncours)}
                            delay={delayEncours} setDelay={setDelayEncours} maxMonths={36}
                            priceMin={priceMinEncours} priceMax={priceMaxEncours}
                            setPriceMin={setPriceMinEncours} setPriceMax={setPriceMaxEncours}
                            priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.encours} />
                          <SourceRow dotClass="dot-ideeri" label="Biens vendus"
                            checked={sourceIdeeri} onToggle={() => setSourceIdeeri(!sourceIdeeri)}
                            delay={delayIdeeri} setDelay={setDelayIdeeri} maxMonths={96}
                            priceMin={priceMinIdeeri} priceMax={priceMaxIdeeri}
                            setPriceMin={setPriceMinIdeeri} setPriceMax={setPriceMaxIdeeri}
                            priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.ideeri} />
                        </>
                      )}
                    </div>

                    {/* CATÉGORIE IDEERI — mandats actifs / biens vendus */}
                    <div className={`source-cat${openSourceCats.ideeri ? '' : ' is-collapsed'}`}>
                      <button type="button" className="source-cat-head" onClick={() => toggleSourceCat('ideeri')} aria-expanded={openSourceCats.ideeri}>
                        <span className={`source-cat-caret${openSourceCats.ideeri ? ' is-open' : ''}`}>{'\u25b8'}</span>
                        <span className="source-cat-title">Ideeri</span>
                      </button>
                      {openSourceCats.ideeri && (
                        <>
                          <SourceRow dotClass="dot-mandat-clos" label="Mandats actifs"
                            checked={sourceMandatClos} onToggle={() => setSourceMandatClos(!sourceMandatClos)}
                            delay={delayMandatClos} setDelay={setDelayMandatClos} maxMonths={36}
                            priceMin={priceMinMandatClos} priceMax={priceMaxMandatClos}
                            setPriceMin={setPriceMinMandatClos} setPriceMax={setPriceMaxMandatClos}
                            priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.mandat_clos} />
                          <SourceRow dotClass="dot-autre-agence" label="Biens vendus"
                            checked={sourceAutreAgence} onToggle={() => setSourceAutreAgence(!sourceAutreAgence)}
                            delay={delayAutreAgence} setDelay={setDelayAutreAgence} maxMonths={36}
                            priceMin={priceMinAutreAgence} priceMax={priceMaxAutreAgence}
                            setPriceMin={setPriceMinAutreAgence} setPriceMax={setPriceMaxAutreAgence}
                            priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.autre_agence} />
                        </>
                      )}
                    </div>

                    {/* CATÉGORIE DVF */}
                    <div className={`source-cat${openSourceCats.dvf ? '' : ' is-collapsed'}`}>
                      <button type="button" className="source-cat-head" onClick={() => toggleSourceCat('dvf')} aria-expanded={openSourceCats.dvf}>
                        <span className={`source-cat-caret${openSourceCats.dvf ? ' is-open' : ''}`}>{'\u25b8'}</span>
                        <span className="source-cat-title">DVF</span>
                      </button>
                      {openSourceCats.dvf && (
                        <SourceRow dotClass="dot-dvf" label="Transactions DVF"
                          checked={sourceDvf} onToggle={() => setSourceDvf(!sourceDvf)}
                          delay={delayDvf} setDelay={setDelayDvf} maxMonths={96}
                          priceMin={priceMinDvf} priceMax={priceMaxDvf}
                          setPriceMin={setPriceMinDvf} setPriceMax={setPriceMaxDvf}
                          priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.dvf} />
                      )}
                    </div>

                    {/* CATÉGORIE PORTAILS */}
                    <div className={`source-cat${openSourceCats.portails ? '' : ' is-collapsed'}`}>
                      <button type="button" className="source-cat-head" onClick={() => toggleSourceCat('portails')} aria-expanded={openSourceCats.portails}>
                        <span className={`source-cat-caret${openSourceCats.portails ? ' is-open' : ''}`}>{'\u25b8'}</span>
                        <span className="source-cat-title">Portails</span>
                      </button>
                      {openSourceCats.portails && (
                        <SourceRow dotClass="dot-portail" label="Annonces portails"
                          checked={sourcePortail} onToggle={() => setSourcePortail(!sourcePortail)}
                          delay={delayPortail} setDelay={setDelayPortail} maxMonths={36}
                          priceMin={priceMinPortail} priceMax={priceMaxPortail}
                          setPriceMin={setPriceMinPortail} setPriceMax={setPriceMaxPortail}
                          priceFloor={PRICE_FLOOR} priceCeil={PRICE_MAX} prices={pricesBySource.portail} />
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2 — Type de bien */}
              <section className="filters-drawer-section">
                <h3 className="filters-drawer-section-title">Type de bien</h3>
                <div className="filters-drawer-section-body">
                  <TypeMultiSelect selected={typeFilters} onChange={setTypeFilters} />
                </div>
              </section>

              {/* SECTION 3 — Surface */}
              <section className="filters-drawer-section">
                <h3 className="filters-drawer-section-title">
                  Surface
                  <span className="filters-drawer-section-hint">Bien cible : 72.5 m²</span>
                </h3>
                <div className="filters-drawer-section-body">
                  <div className="filter-range">
                    <input type="number" value={surfaceMin} min="0" max="500" onChange={(e) => setSurfaceMin(Number(e.target.value))} />
                    <span className="sep">à</span>
                    <input type="number" value={surfaceMax} min="0" max="500" onChange={(e) => setSurfaceMax(Number(e.target.value))} />
                    <span className="unit">m²</span>
                  </div>
                </div>
              </section>

              {/* SECTION 4 — Nombre de pièces */}
              <section className="filters-drawer-section">
                <h3 className="filters-drawer-section-title">
                  Nombre de pièces
                  <span className="filters-drawer-section-hint">Bien cible : T3</span>
                </h3>
                <div className="filters-drawer-section-body">
                  <div className="filter-range">
                    <input type="number" value={piecesMin} min="1" max="10" onChange={(e) => setPiecesMin(Number(e.target.value))} />
                    <span className="sep">à</span>
                    <input type="number" value={piecesMax} min="1" max="10" onChange={(e) => setPiecesMax(Number(e.target.value))} />
                    <span className="unit">pièces</span>
                  </div>
                </div>
              </section>

              {/* SECTION 5 — Fourchette de prix */}
              <section className="filters-drawer-section">
                <h3 className="filters-drawer-section-title">Fourchette de prix</h3>
                <div className="filters-drawer-section-body">
                  {(() => {
                    const PRICE_MIN_SCALE = 100000;
                    const PRICE_MAX_SCALE = 600000;
                    // Prix de chaque bien réel disponible (mode live).
                    const allPrices = others
                      .map((c) => c.fields?.prix ?? c._dvfRaw?.prix)
                      .filter((p) => typeof p === 'number');
                    // Comptage MONOTONE : nb de biens dont le prix est <= borne.
                    // Plus la borne haute monte, plus le cumul augmente.
                    const biensUpTo = (p) => allPrices.filter((v) => v <= p).length;
                    // Nb de biens réellement DANS la fourchette [prixMin, prixMax].
                    const biensInRange = allPrices.filter((v) => v >= prixMin && v <= prixMax).length;
                    const leftPct = ((prixMin - PRICE_MIN_SCALE) / (PRICE_MAX_SCALE - PRICE_MIN_SCALE)) * 100;
                    const rightPct = ((prixMax - PRICE_MIN_SCALE) / (PRICE_MAX_SCALE - PRICE_MIN_SCALE)) * 100;
                    const nBelow = biensUpTo(prixMin);
                    const nUpToMax = biensUpTo(prixMax);
                    return (
                      <>
                        <div className="price-dual">
                          <div className="price-dual-track" />
                          <div
                            className="price-dual-selected"
                            style={{
                              left: `calc(12px + ${(Math.max(0, Math.min(100, leftPct)) / 100).toFixed(4)} * (100% - 24px))`,
                              width: `calc(${((Math.max(0, Math.min(100, rightPct)) - Math.max(0, Math.min(100, leftPct))) / 100).toFixed(4)} * (100% - 24px))`,
                            }}
                          />
                          <input type="range" min={PRICE_MIN_SCALE} max={PRICE_MAX_SCALE} step={5000} value={prixMin} onChange={(e) => { const v = Number(e.target.value); setPrixMin(Math.min(v, prixMax - 5000)); }} aria-label="Prix minimum" />
                          <input type="range" min={PRICE_MIN_SCALE} max={PRICE_MAX_SCALE} step={5000} value={prixMax} onChange={(e) => { const v = Number(e.target.value); setPrixMax(Math.max(v, prixMin + 5000)); }} aria-label="Prix maximum" />
                          <div className="price-dual-labels">
                            <span>
                              <strong>{(prixMin / 1000).toFixed(0)} k€</strong> · <span className="count">{nBelow} en dessous</span>
                            </span>
                            <span>
                              <strong>{(prixMax / 1000).toFixed(0)} k€</strong> · <span className="count">{nUpToMax} jusqu'ici</span>
                            </span>
                          </div>
                        </div>
                        <div className="filter-hint" style={{ marginTop: 14 }}>
                          Soit {Math.round(prixMin / 72.5).toLocaleString('fr-FR')} — {Math.round(prixMax / 72.5).toLocaleString('fr-FR')} €/m² —{' '}
                          <strong style={{ color: '#46B962' }}>{biensInRange} biens</strong> dans la fourchette
                        </div>
                      </>
                    );
                  })()}
                </div>
              </section>

              {/* SECTION 6 — Filtres avancés (conditionnels) */}
              <section className="filters-drawer-section">
                <h3 className="filters-drawer-section-title">
                  Filtres avancés
                  {extraFilters.length > 0 && <span className="filters-drawer-section-hint">{extraFilters.length} actif{extraFilters.length > 1 ? 's' : ''}</span>}
                </h3>
                <div className="filters-drawer-section-body">
                  {extraFilters.includes('dpe') && (
                    <div className="filter-item" style={{ marginBottom: 10 }}>
                      <div className="filter-item-label">DPE <span className="chip-close" onClick={() => removeExtraFilter('dpe')}>×</span></div>
                      <select className="filter-select" defaultValue="all">
                        <option value="all">Tous DPE</option>
                        <option value="AB">A – B</option>
                        <option value="CD">C – D</option>
                        <option value="EFG">E – F – G</option>
                      </select>
                    </div>
                  )}
                  {extraFilters.includes('etage') && (
                    <div className="filter-item" style={{ marginBottom: 10 }}>
                      <div className="filter-item-label">Étage <span className="chip-close" onClick={() => removeExtraFilter('etage')}>×</span></div>
                      <div className="filter-range">
                        <input type="number" defaultValue="0" min="0" max="30" />
                        <span className="sep">à</span>
                        <input type="number" defaultValue="10" min="0" max="30" />
                      </div>
                    </div>
                  )}
                  {extraFilters.includes('parking') && (
                    <div className="filter-item" style={{ marginBottom: 10 }}>
                      <div className="filter-item-label">Parking <span className="chip-close" onClick={() => removeExtraFilter('parking')}>×</span></div>
                      <select className="filter-select" defaultValue="all">
                        <option value="all">Indifférent</option>
                        <option value="oui">Avec parking</option>
                        <option value="non">Sans parking</option>
                      </select>
                    </div>
                  )}
                  {extraFilters.includes('exterieur') && (
                    <div className="filter-item" style={{ marginBottom: 10 }}>
                      <div className="filter-item-label">Extérieur <span className="chip-close" onClick={() => removeExtraFilter('exterieur')}>×</span></div>
                      <select className="filter-select" defaultValue="all">
                        <option value="all">Indifférent</option>
                        <option value="balcon">Balcon / Terrasse</option>
                        <option value="jardin">Jardin</option>
                        <option value="aucun">Aucun</option>
                      </select>
                    </div>
                  )}
                  {extraFilters.includes('annee') && (
                    <div className="filter-item" style={{ marginBottom: 10 }}>
                      <div className="filter-item-label">Année construction <span className="chip-close" onClick={() => removeExtraFilter('annee')}>×</span></div>
                      <div className="filter-range">
                        <input type="number" defaultValue="1950" min="1800" max="2026" />
                        <span className="sep">à</span>
                        <input type="number" defaultValue="2026" min="1800" max="2026" />
                      </div>
                    </div>
                  )}
                  {extraFilters.includes('etat') && (
                    <div className="filter-item" style={{ marginBottom: 10 }}>
                      <div className="filter-item-label">État général <span className="chip-close" onClick={() => removeExtraFilter('etat')}>×</span></div>
                      <select className="filter-select" defaultValue="all">
                        <option value="all">Tous états</option>
                        <option value="neuf">Neuf / Rénové</option>
                        <option value="bon">Bon état</option>
                        <option value="travaux">À rénover</option>
                      </select>
                    </div>
                  )}
                  {availableExtraFilters.length > 0 && (
                    <div className="filter-add-row" style={{ marginTop: extraFilters.length > 0 ? 12 : 0 }}>
                      <span style={{ fontSize: 11, color: '#949494', marginRight: 4 }}>Ajouter :</span>
                      {availableExtraFilters.map((f) => (
                        <button key={f.key} type="button" className="filter-chip-add" onClick={() => addExtraFilter(f.key)}>+ {f.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <footer className="filters-drawer-footer">
              <button type="button" className="btn-reset">Réinitialiser tout</button>
              <button type="button" className="btn-apply" onClick={() => setFiltersOpen(false)}>
                Voir les {filteredCount} résultats
              </button>
            </footer>
          </aside>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════════════
        * WORKSPACE 3 COLONNES — Carte + Pool disponibles + Panier sélection
        * Layout CSS Grid avec 2 poignées draggable entre colonnes.
        * Drag & drop natif HTML5 du pool vers le panier.
        * ═══════════════════════════════════════════════════════════════ */}
      {/* ─── Barre de tags : caractéristiques du bien cible
       * Au clic sur un comparable (pool ou panier), chaque tag se colore
       * selon le match avec ce comparable :
       *   vert  ✓ = match  (même valeur, ou tolérance respectée)
       *   rouge ✕ = no match (valeur différente)
       *   gris  = info absente sur le comparable
       *   neutre (aucun clic encore) = gris pâle uniforme
       * ─── */}
      {targetFeatures.length > 0 && (
        <div className="target-tags-bar">
          <span className="target-tags-label">Bien cible</span>
          <div className="target-tags-list">
            {targetFeatures.map((f) => {
              const state = tagState(f, focusedComp);
              return (
                <span key={f.key} className={`target-tag is-${state}`}>
                  {state === 'match' && <span className="tag-tick">✓</span>}
                  {state === 'nomatch' && <span className="tag-tick">✕</span>}
                  {f.label}
                </span>
              );
            })}
          </div>
          {focusedComp && (
            <>
              <span className="target-tags-focused-label">
                vs <strong>{focusedComp.title || focusedComp.id}</strong>
              </span>
              <button
                type="button"
                className="target-tags-clear"
                onClick={() => setFocusedComp(null)}
              >
                Réinitialiser
              </button>
            </>
          )}
        </div>
      )}

      {/* Toggle on/off de la comparaison V1.
       * Visible dès qu'une étude précédente existe pour le bien.
       * Contrôle l'affichage des badges V1 sur les cards + bandeau biens
       * disparus. Permet de revenir à une vue "neutre" sans superposition. */}
      {previousStudy && (
        <div className="v1-toggle-bar">
          <div className="v1-toggle-info">
            <span className="v1-toggle-icon">⏱</span>
            <span>
              <strong>Étude précédente</strong>
              {previousStudy.date && (
                <span className="v1-toggle-date"> · {previousStudy.date}</span>
              )}
              {Array.isArray(previousStudy.comparables) && (
                <span className="v1-toggle-count">
                  {' · '}
                  {previousStudy.comparables.length} bien
                  {previousStudy.comparables.length > 1 ? 's' : ''} en mémoire
                </span>
              )}
            </span>
          </div>
          <label
            className={`v1-switch${showV1 ? ' is-on' : ''}`}
            title={showV1 ? 'Masquer la comparaison V1' : 'Afficher la comparaison V1'}
          >
            <input
              type="checkbox"
              checked={showV1}
              onChange={(e) => setShowV1(e.target.checked)}
            />
            <span className="v1-switch-track">
              <span className="v1-switch-thumb" />
            </span>
          </label>
        </div>
      )}

      {/* Bandeau "biens disparus de l'offre" — biens présents dans l'étude
       * précédente qui n'apparaissent plus dans le pool actuel (vendus
       * silencieusement, retirés, etc.). Calque visuel intelligent.
       * Conditionné par le toggle showV1. */}
      {previousStudy && showV1 && (() => {
        const currentIds = new Set([
          ...selected.map((c) => c.id),
          ...others.map((c) => c.id),
        ]);
        const missing = (previousStudy.comparables || []).filter((p) => !currentIds.has(p.id));
        if (missing.length === 0) return null;
        return (
          <div className="previous-missing-bar">
            <div className="previous-missing-bar-text">
              ⏱ <strong>{missing.length} bien{missing.length > 1 ? 's' : ''}</strong> de votre étude
              précédente {previousStudy.date ? `du ${previousStudy.date}` : ''} n&rsquo;
              {missing.length > 1 ? 'apparaissent' : 'apparaît'} plus dans l&rsquo;offre actuelle.
            </div>
            <button
              type="button"
              className="previous-missing-bar-toggle"
              onClick={() => setPreviousMissingOpen((v) => !v)}
            >
              {previousMissingOpen ? '▴ Masquer' : '▾ Voir la liste'}
            </button>
            {previousMissingOpen && (
              <div className="previous-missing-list">
                {missing.map((p) => {
                  const sourceColor = p.source === 'dvf' ? '#4a6cf7'
                    : p.source === 'ideeri' ? '#46B962'
                    : p.source === 'encours' ? '#f5a623'
                    : p.source === 'portail' ? '#e74c3c'
                    : p.source === 'estimation' ? '#9b59b6'
                    : p.source === 'mandat_clos' ? '#7f8c8d'
                    : p.source === 'autre_agence' ? '#16a085' : '#999';
                  return (
                    <div key={p.id} className="previous-missing-item">
                      <span className="previous-missing-item-source" style={{ background: sourceColor }} />
                      <span className="previous-missing-item-title">{p.title || p.addr || p.id}</span>
                      {p.prix && <span className="previous-missing-item-price">{p.prix}</span>}
                      <span style={{ fontSize: 10, color: '#aaa', fontStyle: 'italic' }}>
                        retiré du marché
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {(() => {
        const visibleOthers = others
          .filter((c) => {
            if (c.manual) return true;
            if (hasRealLocation) return passesLiveFilters(c);
            if (c.source === 'dvf') return sourceDvf;
            if (c.source === 'portail') return sourcePortail;
            if (c.source === 'ideeri') return sourceIdeeri;
            if (c.source === 'encours') return sourceEncours;
            return true;
          })
          .map((c) => enrichWithCoverage(c, targetFields))
          .map((c) => applySimOverride(c, simOverrides));
        return (
          <div
            ref={workspaceRef}
            className={`workspace-2col${activeHandle !== null ? ' is-resizing' : ''}`}
            style={{
              '--col-map': `${colWidths.map}%`,
              '--col-pool': `${100 - colWidths.map}%`,
            }}
          >
            {/* COL 1 — CARTE */}
            <div className="map-card-comp workspace-col">
              {/* Rayon de recherche — overlay flottant en haut de la carte */}
              <div className="radius-overlay">
                <div className="radius-label">Rayon</div>
                <span className="commune-badge">{targetCityShort}</span>
                <div className="radius-slider-wrap">
                  <div className="cs-slider" style={{ '--cs-pct': sliderPct }}>
                    <div className="cs-track" />
                    <div className="cs-fill" />
                    <div className="cs-thumb" />
                    <input
                      type="range"
                      className="cs-input"
                      min="100"
                      max="10000"
                      step="100"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                      aria-label="Rayon de recherche"
                    />
                  </div>
                </div>
                <div className="radius-value">{formatRadius(radius)}</div>
              </div>
              <div ref={mapRef} className="map-container" />
              {/* Draw controls — top left, below zoom */}
              <div className="map-draw-controls" style={{ top: 80, left: 12 }}>
                <button className={`map-draw-btn ${drawMode ? 'active' : ''}`} onClick={toggleDrawMode}>
                  {drawMode ? '\u2715 Terminer le dessin' : '\u270f\ufe0f Dessiner une zone'}
                </button>
                {drawMode && (
                  <div style={{ background: 'rgba(74,108,247,0.9)', color: 'white', padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 500, maxWidth: 160, textAlign: 'center' }}>
                    Dessinez librement sur la carte, puis rel&acirc;chez
                  </div>
                )}
                {drawLayerRef.current && (
                  <button className="map-draw-btn danger" onClick={clearDrawnZones}>
                    {'\ud83d\uddd1'} Effacer les zones
                  </button>
                )}
              </div>
              <div className="map-style-toggle">
                <button className={`map-style-btn ${mapStyle === 'plan' ? 'active' : ''}`} onClick={() => setMapStyle('plan')}>Plan</button>
                <button className={`map-style-btn ${mapStyle === 'satellite' ? 'active' : ''}`} onClick={() => setMapStyle('satellite')}>Satellite</button>
              </div>
              <div className="map-info-bar">
                <div className="map-info-left">
                  <div className="map-info-stat">
                    <div className="map-info-stat-val">{filteredCount}</div>
                    <div className="map-info-stat-label">biens trouv&eacute;s</div>
                  </div>
                  <div className="map-info-divider" />
                  <div className="map-info-stat">
                    <div className="map-info-stat-val">{selected.length}</div>
                    <div className="map-info-stat-label">s&eacute;lectionn&eacute;s</div>
                  </div>
                </div>
                <div className="map-legend-inline" title="Cliquez sur une source pour l'activer/désactiver">
                  <span className="map-legend-label-hint">Filtrer</span>
                  <button
                    type="button"
                    className={`map-legend-item${sourceDvf ? '' : ' is-inactive'}`}
                    onClick={() => setSourceDvf(!sourceDvf)}
                    aria-pressed={sourceDvf}
                  >
                    <span className="legend-dot" style={{ background: '#4a6cf7' }} /> DVF
                  </button>
                  <button
                    type="button"
                    className={`map-legend-item${sourceIdeeri ? '' : ' is-inactive'}`}
                    onClick={() => setSourceIdeeri(!sourceIdeeri)}
                    aria-pressed={sourceIdeeri}
                  >
                    <span className="legend-dot" style={{ background: '#46B962' }} /> Biens vendus
                  </button>
                  <button
                    type="button"
                    className={`map-legend-item${sourceEncours ? '' : ' is-inactive'}`}
                    onClick={() => setSourceEncours(!sourceEncours)}
                    aria-pressed={sourceEncours}
                  >
                    <span className="legend-dot" style={{ background: '#f5a623' }} /> En cours
                  </button>
                  <button
                    type="button"
                    className={`map-legend-item${sourceEstimation ? '' : ' is-inactive'}`}
                    onClick={() => setSourceEstimation(!sourceEstimation)}
                    aria-pressed={sourceEstimation}
                  >
                    <span className="legend-dot" style={{ background: '#9b59b6' }} /> Estimation
                  </button>
                  <button
                    type="button"
                    className={`map-legend-item${sourceMandatClos ? '' : ' is-inactive'}`}
                    onClick={() => setSourceMandatClos(!sourceMandatClos)}
                    aria-pressed={sourceMandatClos}
                  >
                    <span className="legend-dot" style={{ background: '#7f8c8d' }} /> Mandat clos
                  </button>
                  <button
                    type="button"
                    className={`map-legend-item${sourceAutreAgence ? '' : ' is-inactive'}`}
                    onClick={() => setSourceAutreAgence(!sourceAutreAgence)}
                    aria-pressed={sourceAutreAgence}
                  >
                    <span className="legend-dot" style={{ background: '#16a085' }} /> Autre agence
                  </button>
                  <button
                    type="button"
                    className={`map-legend-item${sourcePortail ? '' : ' is-inactive'}`}
                    onClick={() => setSourcePortail(!sourcePortail)}
                    aria-pressed={sourcePortail}
                  >
                    <span className="legend-dot" style={{ background: '#e74c3c' }} /> Portails
                  </button>
                </div>
              </div>
            </div>

            {/* Poign\u00e9e 1 \u2014 entre Carte et Pool (double-clic = reset 30/40/30) */}
            <div
              className={`col-resize-handle${activeHandle === 1 ? ' is-dragging' : ''}`}
              onMouseDown={(e) => startResize(e, 1)}
              onDoubleClick={resetCols}
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionner Carte / Pool — double-clic pour réinitialiser"
              title="Glissez pour redimensionner · Double-clic pour reset"
            />

            {/* COL 2 — POOL (biens disponibles, draggable)
             * Layout en 2 sections empilées :
             *   • Marché théorique (haut) : prix affichés / estimations /
             *     mandats clos / portails — informations non concrétisées
             *   • Marché réel (bas) : DVF / Biens vendus / Vendu autre agence
             *     — transactions réellement effectuées
             * Chaque section a un header coloré + sous-sections par source. */}
            <div className="workspace-col pool-panel">
              {drawerComp ? (
                /* MODE DÉTAIL — remplace toute la liste des biens par le
                 * détail du comparable cliqué. Bouton « Retour » pour
                 * revenir à la liste complète. */
                <ComparableDrawer
                  comp={drawerComp}
                  inline
                  onClose={() => { setDrawerComp(null); setFocusedComp(null); }}
                  isSelected={selected.some((c) => c.id === drawerComp.id)}
                  weight={selected.some((c) => c.id === drawerComp.id) ? effectiveWeight(drawerComp) : undefined}
                  onWeightChange={selected.some((c) => c.id === drawerComp.id) ? handleWeightChange : undefined}
                  onAdd={(id) => addToSelected(id)}
                  onRemove={(id) => handleRemoveComparable(id)}
                />
              ) : (
              <>
              <div className="pool-header">
                <span className="pool-header-title">Disponibles</span>
                <span className="pool-header-count">{visibleOthers.length} bien{visibleOthers.length > 1 ? 's' : ''}</span>
              </div>

              {(() => {
                // Regroupement par sous-catégorie. "Invendu depuis 3 mois"
                // est un état DÉRIVÉ : il agrège les biens des sources
                // 'encours' (Papiris) et 'portail' dont la durée de mise en
                // vente dépasse 90 jours. Ces biens sont RETIRÉS de leur
                // source d'origine (pas d'affichage en double).
                const JOURS_INVENDU = 90;
                const isInvendu = (c) => {
                  if (c.source !== 'encours' && c.source !== 'portail') return false;
                  const jours = Number(c.joursEnCommercialisation) || 0;
                  return jours >= JOURS_INVENDU;
                };
                const groups = {
                  encours:      { label: 'En cours',                dotClass: 'dot-encours',      items: [] },
                  estimation:   { label: 'Estimations',             dotClass: 'dot-estimation',   items: [] },
                  portail:      { label: 'Portails',                dotClass: 'dot-portail',      items: [] },
                  mandat_clos:  { label: 'Mandats clos',            dotClass: 'dot-mandat-clos',  items: [] },
                  invendu_3m:   { label: 'Invendu depuis 3 mois',   dotClass: 'dot-invendu-3m',   items: [] },
                  dvf:          { label: 'DVF',                     dotClass: 'dot-dvf',          items: [] },
                  ideeri:       { label: 'Biens vendus (Papiris)',  dotClass: 'dot-ideeri',       items: [] },
                  autre_agence: { label: 'Vendu par autre agence',  dotClass: 'dot-autre-agence', items: [] },
                };
                visibleOthers.forEach((c) => {
                  if (isInvendu(c)) {
                    groups.invendu_3m.items.push(c);
                    return;
                  }
                  const key = String(c.source);
                  if (groups[key]) groups[key].items.push(c);
                });
                // 3 catégories principales (dropdowns repliables) :
                //   • Marché théorique : prix affichés / estimations / portails / mandats clos
                //   • Marché réel : DVF / biens vendus / vendu autre agence
                //   • Invendus : biens en commercialisation depuis ≥ 90 jours
                //     (signal négatif fort = prix demandé souvent trop haut).
                const theoriqueKeys = ['encours', 'estimation', 'portail', 'mandat_clos'];
                const reelKeys      = ['dvf', 'ideeri', 'autre_agence'];
                const invendusKeys  = ['invendu_3m'];
                const theoriqueTotal = theoriqueKeys.reduce((s, k) => s + groups[k].items.length, 0);
                const reelTotal      = reelKeys.reduce((s, k) => s + groups[k].items.length, 0);
                const invendusTotal  = invendusKeys.reduce((s, k) => s + groups[k].items.length, 0);

                const renderSubsection = (key) => {
                  const g = groups[key];
                  if (!g) return null;
                  const empty = g.items.length === 0;
                  return (
                    <div key={key} className={`pool-subsection${empty ? ' is-empty' : ''}`}>
                      <div className="pool-subsection-head">
                        <span className={`pool-subsection-dot ${g.dotClass}`} />
                        <span className="pool-subsection-label">{g.label}</span>
                        <span className="pool-subsection-count">{g.items.length}</span>
                      </div>
                      {empty ? (
                        <div className="pool-subsection-empty">Aucun bien</div>
                      ) : (
                        <div className="pool-subsection-cards">
                          {g.items.map((c) => {
                            const prev = showV1 ? previousById[c.id] : null;
                            const v1Status = prev ? getPreviousStatus(c, prev) : null;
                            return (
                              <PoolCompCard
                                key={c.id}
                                comp={c}
                                onOpenEdit={setDrawerComp}
                                onFocusOnMap={focusCompOnMap}
                                onSelect={addToSelected}
                                v1Status={v1Status}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                };

                // Rend une catégorie principale sous forme de dropdown repliable.
                const renderSectionBlock = (sectionKey, variant, title, total, subKeys) => {
                  const isOpen = openPoolSections[sectionKey];
                  return (
                    <div className={`pool-section-block ${variant}${isOpen ? '' : ' is-collapsed'}`}>
                      <button
                        type="button"
                        className="pool-section-header"
                        onClick={() => togglePoolSection(sectionKey)}
                        aria-expanded={isOpen}
                      >
                        <span className={`pool-section-caret${isOpen ? ' is-open' : ''}`}>{'\u25b8'}</span>
                        <div className="pool-section-title">{title}</div>
                        <span className="pool-section-count">{total}</span>
                      </button>
                      {isOpen && subKeys.map(renderSubsection)}
                    </div>
                  );
                };

                return (
                  <div className="pool-sections">
                    {renderSectionBlock('theorique', 'theorique', 'Marché théorique', theoriqueTotal, theoriqueKeys)}
                    {renderSectionBlock('reel', 'reel', 'Marché réel', reelTotal, reelKeys)}
                    {renderSectionBlock('invendus', 'invendus', 'Invendus', invendusTotal, invendusKeys)}

                    {visibleOthers.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#999', padding: '30px 14px', fontSize: 12, fontStyle: 'italic' }}>
                        Aucun bien ne correspond aux filtres actuels
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ─── PANIER DE SÉLECTION ─────────────────────────────────
               * Liste compacte des comparables retenus, en bas de la colonne
               * pool (dans la même zone de travail que les biens). Toujours
               * visible ; le détail du calcul reste dans le récap en dessous. */}
              <div className="pool-basket">
                <div className="pool-basket-head">
                  <span className="pool-basket-title">Panier de sélection</span>
                  <span className="pool-basket-count">
                    {selected.length} bien{selected.length > 1 ? 's' : ''}
                  </span>
                </div>
                {selected.length === 0 ? (
                  <div className="pool-basket-empty">
                    Cliquez sur un bien pour l'ajouter au panier
                  </div>
                ) : (
                  <div className="pool-basket-list">
                    {selected.map((c) => {
                      const dotCls = c.source === 'dvf' ? 'dot-dvf'
                        : c.source === 'ideeri' ? 'dot-ideeri'
                        : c.source === 'encours' ? 'dot-encours'
                        : c.source === 'estimation' ? 'dot-estimation'
                        : c.source === 'mandat_clos' ? 'dot-mandat-clos'
                        : c.source === 'autre_agence' ? 'dot-autre-agence'
                        : 'dot-portail';
                      const m2 = c.fields?.prixM2 ?? c._dvfRaw?.prixM2;
                      const m2Label = typeof m2 === 'number'
                        ? `${m2.toLocaleString('fr-FR')} €/m²`
                        : (typeof m2 === 'string' && m2 !== '—' ? `${m2} €/m²` : '—');
                      const photos = getCompPhotos(c);
                      const photo = photos && photos.length ? photos[0] : null;
                      const photoIcon = c.source === 'dvf' ? '\ud83d\udcca' : '\ud83c\udfe0';
                      return (
                        <div
                          key={c.id}
                          className="pool-basket-item"
                          onClick={() => setDrawerComp(c)}
                          role="button"
                          tabIndex={0}
                          title={c.title}
                        >
                          {photo ? (
                            <div
                              className="pool-basket-thumb"
                              style={{ backgroundImage: `url(${photo})` }}
                            >
                              <span className={`pool-basket-dot ${dotCls}`} />
                            </div>
                          ) : (
                            <div className={`pool-basket-thumb no-photo source-${c.source}`}>
                              {photoIcon}
                              <span className={`pool-basket-dot ${dotCls}`} />
                            </div>
                          )}
                          <button
                            type="button"
                            className="pool-basket-item-remove"
                            onClick={(e) => { e.stopPropagation(); handleRemoveComparable(c.id); }}
                            aria-label={`Retirer ${c.title} du panier`}
                            title="Retirer du panier"
                          >×</button>
                          <div className="pool-basket-item-body">
                            <span className="pool-basket-item-title">{c.title}</span>
                            <span className="pool-basket-item-m2">{m2Label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════
        * CARTE ESTIMATION FINALE — prix au m² uniquement
        * Affiche le prix au m² calculé (moyenne pondérée des comparables
        * ajustés) + un mini tableau du calcul détaillé (par bien : prix/m²
        * ajusté × poids). Aucun "total estimé" : seul le €/m² fait sens
        * comme résultat final de cette étape.
        * ═══════════════════════════════════════════════════════════════ */}
      {(() => {
        if (selected.length === 0) {
          return (
            <div className="estimation-final-card empty">
              <h3 className="estimation-final-title">Récapitulatif du calcul</h3>
              <div className="estimation-final-empty">
                Ajoutez au moins 1 comparable au panier pour voir le calcul
              </div>
            </div>
          );
        }
        // Pré-calcul par comparable + agrégat pondéré (util partagé avec Step5).
        // On applique d'abord l'override de similarité, puis on fige le poids
        // effectif dans une map pour que computeWeightedM2 l'utilise tel quel.
        const effComps = selected.map((rawC) => applySimOverride(rawC, simOverrides));
        const effWeights = {};
        effComps.forEach((c) => { effWeights[c.id] = effectiveWeight(c); });
        const { avgM2, sumW, rows } = computeWeightedM2(effComps, effWeights);
        return (
          <div className="estimation-final-card">
            <h3 className="estimation-final-title">
              Récapitulatif du calcul
              <span className="estimation-final-title-hint">
                {rows.length} comparable{rows.length > 1 ? 's' : ''} pondéré{rows.length > 1 ? 's' : ''}
              </span>
            </h3>
            {/* Tableau du calcul : prix/m² brut → correction → ajusté × poids
             *                    → moyenne pondérée en ligne de total */}
            <table className="estimation-recap-table">
              <thead>
                <tr>
                  <th className="t-left">Comparable</th>
                  <th>Prix/m²</th>
                  <th>Correction</th>
                  <th>Ajusté/m²</th>
                  <th>Poids</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const dotCls = r.source === 'dvf' ? 'dot-dvf'
                    : r.source === 'ideeri' ? 'dot-ideeri'
                    : r.source === 'encours' ? 'dot-encours'
                    : r.source === 'estimation' ? 'dot-estimation'
                    : r.source === 'mandat_clos' ? 'dot-mandat-clos'
                    : r.source === 'autre_agence' ? 'dot-autre-agence'
                    : 'dot-portail';
                  const adjLabel = r.adjPct === 0
                    ? '—'
                    : `${r.adjPct > 0 ? '+' : ''}${r.adjPct.toFixed(1)}%`;
                  const adjCls = r.adjPct > 0 ? 'pos' : r.adjPct < 0 ? 'neg' : '';
                  return (
                    <tr key={r.id}>
                      <td className="t-left">
                        <span className={`source-dot ${dotCls}`} style={{ display: 'inline-block', marginRight: 6 }} />
                        <span style={{ verticalAlign: 'middle' }}>{r.title}</span>
                      </td>
                      <td>{r.prixM2 ? `${r.prixM2.toLocaleString('fr-FR')} €` : '—'}</td>
                      <td className={`t-adj ${adjCls}`}>{adjLabel}</td>
                      <td>{r.adjustedM2 ? `${r.adjustedM2.toLocaleString('fr-FR')} €` : '—'}</td>
                      <td>{r.weight}%</td>
                    </tr>
                  );
                })}
                <tr className="t-row-total">
                  <td className="t-left" colSpan={3}>Moyenne pondérée</td>
                  <td>{avgM2 ? `${avgM2.toLocaleString('fr-FR')} €/m²` : '—'}</td>
                  <td>{sumW}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Footer */}
      <div className="footer-buttons">
        <button className="btn btn-ghost" onClick={() => navigate('/step/2')}>
          &larr; &Eacute;tape pr&eacute;c&eacute;dente : Contexte zone
        </button>
        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={() => navigate('/step/4')}>
            &Eacute;tape suivante : Tension march&eacute; &rarr;
          </button>
          <div className="min-note">&#10003; Minimum recommand&eacute; : 3 comparables s&eacute;lectionn&eacute;s</div>
        </div>
      </div>

      {/* Le drawer d\u00e9tail comparable est maintenant rendu inline dans la
          colonne 3 du workspace ci-dessus (\u00e0 la place du panier quand un
          comparable est s\u00e9lectionn\u00e9 via le state drawerComp). */}

      {/* Le drawer d'override manuel de la similarité a été retiré :
          le clic sur une carte ouvre désormais directement le drawer
          détail du comparable (ComparableDrawer ci-dessus). La similarité
          calculée reste consultable sur la carte (toggle "Pertinence"),
          et le poids dans l'estimation s'ajuste via le slider exposé
          dans le drawer détail (uniquement pour les biens sélectionnés). */}

    </div>
  );
}
