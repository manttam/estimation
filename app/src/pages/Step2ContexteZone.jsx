import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { contexteZone } from '../data/propertyData';
import { getActiveBien } from '../utils/activeBien';
import { getRisquesSynthese } from '../utils/georisquesClient';
import { mergeReportSection, getReportSection } from '../utils/reportStore';

const COLOR_MAP = {
  green: 'var(--green)',
  orange: 'var(--orange)',
  red: 'var(--red)',
  blue: 'var(--blue)',
};

const TYPE_COLOR = {
  dist: 'var(--blue)',
  'risk-ok': 'var(--green)',
  'risk-warn': 'var(--orange)',
  'risk-bad': 'var(--red)',
  green: 'var(--green)',
};

const cssStyles = `
  .step2-page {
    font-family: var(--font);
  }

  /* ═══ INFO BANNER ═══ */
  .info-banner {
    background: #f7f7f8;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    margin-bottom: 14px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  .info-banner .info-icon {
    font-size: 14px;
  }

  /* ═══ SCORE CARDS ═══ */
  .scores-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .score-card {
    background: #fff;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    border: 1px solid var(--border);
    border-top: 3px solid var(--border);
    position: relative;
  }
  .score-card.green { border-top-color: var(--green); }
  .score-card.orange { border-top-color: var(--orange); }
  .score-card.red { border-top-color: var(--red); }
  .score-label {
    font-size: 10px;
    color: #666;
    font-weight: 500;
    margin-bottom: 2px;
  }
  .score-num {
    font-size: 18px;
    font-weight: 700;
  }
  .score-num.green { color: var(--green); }
  .score-num.orange { color: var(--orange); }
  .score-num.red { color: var(--red); }

  /* ═══ MARCHÉ LOCAL — bandeau horizontal ═══ */
  .step2-page .market-bar {
    display: flex;
    align-items: center;
    gap: 18px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 16px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .step2-page .market-bar-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .step2-page .market-bar-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
  }
  .step2-page .market-bar-price {
    flex-shrink: 0;
    padding-right: 18px;
    border-right: 1px solid #f0f0f0;
  }
  .step2-page .market-bar-price .big {
    font-size: 22px;
    font-weight: 700;
    color: var(--green);
  }
  .step2-page .market-bar-price .unit {
    font-size: 12px;
    color: var(--muted);
  }
  .step2-page .market-bar-stats {
    display: flex;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .step2-page .market-bar-stats .market-stat {
    flex: 1;
    background: #f7f7f8;
    border-radius: 6px;
    padding: 6px 10px;
    text-align: center;
  }
  .step2-page .market-bar-stats .val {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
  .step2-page .market-bar-stats .val.up { color: var(--green); }
  .step2-page .market-bar-stats .lbl {
    font-size: 9px;
    color: #666;
    margin-top: 1px;
  }

  /* ═══ MAP ROW ═══ */
  /* ═══ WORKSPACE 2 COLONNES (Carte / Commodités) ═══
   * Grid avec une poignée centrale draggable. Largeurs pilotées par les
   * variables --col-map / --col-poi modifiées au drag (cf. startResize). */
  .step2-page .workspace-2col {
    display: grid;
    grid-template-columns:
      minmax(0, var(--col-map, 62%))
      10px
      minmax(0, var(--col-poi, 38%));
    gap: 0;
    margin-bottom: 14px;
    height: 460px;
    min-height: 360px;
  }
  .step2-page .workspace-2col.is-resizing {
    cursor: col-resize;
    user-select: none;
  }
  .step2-page .workspace-2col.is-resizing .map-container,
  .step2-page .workspace-2col.is-resizing .poi-panel-body {
    pointer-events: none;
  }
  .step2-page .ws-col {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .step2-page .ws-col-map { position: relative; }
  .step2-page .map-stage-inner {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .map-container {
    height: 100%;
    width: 100%;
    z-index: 0;
  }

  /* Poignée de redimensionnement (style Step3) */
  .step2-page .col-resize-handle {
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
  .step2-page .col-resize-handle::before {
    content: '';
    width: 2px;
    height: 36px;
    background: #d8d8d8;
    border-radius: 2px;
    transition: background 0.15s, height 0.15s;
  }
  .step2-page .col-resize-handle:hover { background: rgba(70, 185, 98, 0.06); }
  .step2-page .col-resize-handle:hover::before {
    background: var(--green);
    height: 64px;
  }
  .step2-page .col-resize-handle.is-dragging { background: rgba(70, 185, 98, 0.12); }
  .step2-page .col-resize-handle.is-dragging::before {
    background: var(--green);
    height: 96px;
  }

  /* ═══ COLONNE COMMODITÉS — liste complète des POI ═══ */
  .step2-page .ws-col-poi { overflow-y: auto; }
  .step2-page .poi-panel-header {
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 5;
    padding: 16px 18px 12px;
    border-bottom: 1px solid #eee;
  }
  .step2-page .poi-panel-header-text { min-width: 0; }
  .step2-page .poi-panel-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--text);
  }
  .step2-page .poi-panel-subtitle {
    font-size: 12px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .step2-page .poi-panel-body { padding: 12px 16px 24px; }

  /* Séparateur de section dans la colonne commodités */
  .step2-page .poi-sections-sep {
    margin: 18px 0 10px;
    padding-top: 14px;
    border-top: 1px solid #eee;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--muted);
  }

  .step2-page .poi-cat { margin-bottom: 14px; }
  .step2-page .poi-cat-head {
    display: grid;
    grid-template-columns: 20px 12px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    background: #fff;
    border: 1.5px solid #ececec;
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .step2-page .poi-cat-head:hover {
    border-color: var(--green);
    background: #effaf2;
  }
  .step2-page .poi-cat-head.active {
    border-color: #d4ead8;
    background: #f7fbf8;
  }
  .step2-page .poi-cat-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .step2-page .poi-cat-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
  .step2-page .poi-cat-count {
    font-size: 11px;
    font-weight: 700;
    color: #666;
    background: #f5f5f5;
    padding: 2px 9px;
    border-radius: 10px;
    min-width: 24px;
    text-align: center;
  }
  .step2-page .poi-cat-head.active .poi-cat-count {
    color: var(--green);
    background: #e8f6ec;
  }
  .step2-page .poi-list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0 0 0 6px;
  }
  .step2-page .poi-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid #f4f4f4;
  }
  .step2-page .poi-item:last-child { border-bottom: none; }
  .step2-page .poi-item-bullet {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transform: translateY(-1px);
  }
  .step2-page .poi-item-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    flex-shrink: 0;
  }
  .step2-page .poi-item-detail {
    font-size: 11px;
    color: var(--muted);
    margin-left: auto;
    text-align: right;
  }
  .step2-page .poi-list-empty {
    font-size: 12px;
    color: var(--muted);
    font-style: italic;
    margin: 6px 0 0 6px;
  }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.15); opacity: 0.15; }
    100% { transform: scale(1); opacity: 0.4; }
  }
  /* ─── Contrôles carte refondus (langage visuel Step3) ─── */
  .step2-page .map-controls {
    border-top: 1px solid var(--border);
    background: #fff;
    flex-shrink: 0;
  }
  .step2-page .mc-section {
    padding: 12px 14px;
  }
  .step2-page .mc-section + .mc-section {
    border-top: 1px solid #f0f0f0;
  }
  .step2-page .mc-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .step2-page .mc-section-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .step2-page .mc-count-pill {
    font-size: 11px;
    color: #666;
    background: #f5f5f5;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 600;
  }

  /* Rangées-cards commodités */
  .step2-page .mc-poi-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .step2-page .mc-poi-row {
    display: grid;
    grid-template-columns: 20px 12px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #fff;
    border: 1.5px solid #ececec;
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .step2-page .mc-poi-row:hover {
    border-color: var(--green);
    background: #effaf2;
  }
  .step2-page .mc-poi-row.active {
    border-color: #d4ead8;
    background: #f7fbf8;
  }
  .step2-page .mc-poi-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .step2-page .mc-poi-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }
  .step2-page .mc-poi-count {
    font-size: 11px;
    font-weight: 700;
    color: #666;
    background: #f5f5f5;
    padding: 2px 9px;
    border-radius: 10px;
    min-width: 24px;
    text-align: center;
  }
  .step2-page .mc-poi-row.active .mc-poi-count {
    color: var(--green);
    background: #e8f6ec;
  }

  /* Checkbox custom carrée arrondie animée */
  .step2-page .mc-check {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid #d0d6dd;
    background: #fff;
    position: relative;
    flex-shrink: 0;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .step2-page .mc-check.checked {
    background: var(--green);
    border-color: var(--green);
    box-shadow: 0 2px 6px rgba(70, 185, 98, 0.35);
  }
  .step2-page .mc-check.checked::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    animation: mc-check-pop 0.18s ease;
  }
  @keyframes mc-check-pop {
    0% { transform: rotate(45deg) scale(0.4); opacity: 0; }
    100% { transform: rotate(45deg) scale(1); opacity: 1; }
  }

  /* Rayon — ligne compacte : label + curseur + valeur */
  .step2-page .mc-radius-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .step2-page .mc-radius-row .mc-section-title {
    flex-shrink: 0;
  }
  .step2-page .mc-radius-value {
    flex-shrink: 0;
    min-width: 52px;
    text-align: right;
    font-size: 13px;
    font-weight: 700;
    color: var(--green);
  }
  /* Curseur natif stylé : piste avec remplissage vert + thumb vert */
  .step2-page .mc-range {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(
      to right,
      var(--green) 0%,
      var(--green) calc(var(--rad-pct, 0) * 1%),
      #ececec calc(var(--rad-pct, 0) * 1%),
      #ececec 100%
    );
    cursor: pointer;
    margin: 0;
  }
  .step2-page .mc-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25), inset 0 0 0 3px var(--green);
    cursor: pointer;
  }
  .step2-page .mc-range::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25), inset 0 0 0 3px var(--green);
    cursor: pointer;
  }

  /* Toolbar couches & sources */
  .step2-page .mc-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .step2-page .mc-toggle {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    padding: 5px 10px;
    border: 1.5px solid #ececec;
    border-radius: 8px;
    background: #fff;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .step2-page .mc-toggle:hover {
    border-color: var(--green);
  }
  .step2-page .mc-toggle.active {
    color: var(--text);
    border-color: #d4ead8;
    background: #f7fbf8;
  }
  .step2-page .mc-toggle .mc-check {
    width: 16px;
    height: 16px;
    border-radius: 5px;
  }
  .step2-page .mc-toggle .mc-check.checked::after {
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
  }
  .step2-page .mc-plu-chip {
    font-size: 12px;
    font-weight: 600;
    color: var(--blue);
    text-decoration: none;
    padding: 5px 10px;
    border: 1.5px solid #dfe5f5;
    border-radius: 8px;
    background: #f5f7ff;
    transition: background 0.15s;
  }
  .step2-page .mc-plu-chip:hover {
    background: #eef1ff;
  }
  .step2-page .mc-status {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    margin-left: auto;
  }
  .step2-page .mc-reload {
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
    color: var(--muted);
    cursor: pointer;
    font-family: var(--font);
    transition: border-color 0.15s, color 0.15s;
  }
  .step2-page .mc-reload:hover:not(:disabled) {
    border-color: var(--green);
    color: var(--green);
  }
  .step2-page .mc-reload:disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* Badge source du marché (réutilisé par le bandeau) */
  .market-source {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 2px 5px;
    border-radius: 3px;
  }
  .market-source.DVF {
    background: #e8f5ec;
    color: #2d7a44;
  }
  .market-source.demo {
    background: #fff5e6;
    color: #b07a1e;
  }
  .market-source.indispo {
    background: #f0f0f0;
    color: var(--muted);
  }

  /* ═══ COLLAPSIBLE SECTIONS ═══ */
  .section-group {
    margin-bottom: 14px;
  }
  /* Dans la colonne commodités étroite : autoriser le retour à la ligne */
  .step2-page .ws-col-poi .section-group { margin-bottom: 0; }
  .step2-page .ws-col-poi .collapse-header-left {
    flex-wrap: wrap;
    min-width: 0;
    row-gap: 2px;
  }
  .collapse-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 6px;
    overflow: hidden;
  }
  .collapse-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }
  .collapse-header:hover {
    background: #f8f8f8;
  }
  .collapse-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .collapse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted);
    flex-shrink: 0;
  }
  .collapse-dot.green { background: var(--green); }
  .collapse-dot.orange { background: var(--orange); }
  .collapse-dot.red { background: var(--red); }
  .collapse-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
  }
  .collapse-summary {
    font-size: 11px;
    color: #666;
  }
  .collapse-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .collapse-score {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
  }
  .collapse-score.green { color: var(--green); }
  .collapse-score.orange { color: var(--orange); }
  .collapse-score.red { color: var(--red); }
  .collapse-arrow {
    font-size: 10px;
    color: #bbb;
    transition: transform 0.2s;
  }
  .collapse-arrow.open {
    transform: rotate(180deg);
  }
  .collapse-body {
    padding: 0 14px 10px;
    border-top: 1px solid #f0f0f0;
    padding-top: 8px;
  }
  .d-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid #f5f5f5;
    font-size: 12px;
  }
  .d-row:last-child {
    border-bottom: none;
  }
  .d-row .lbl {
    color: #666;
    flex: 1;
  }
  .d-row .val {
    font-weight: 500;
    color: var(--text);
    text-align: right;
  }
  .d-row .val.dist { color: var(--blue); font-weight: 600; }
  .d-row .val.risk-ok { color: var(--green); }
  .d-row .val.risk-warn { color: var(--orange); font-weight: 600; }
  .d-row .val.risk-bad { color: var(--red); font-weight: 600; }
  .d-row.risk-impact {
    background: #fff5f5;
    border-radius: 6px;
    padding: 6px 8px;
    margin-top: 4px;
  }
  .d-row.risk-impact .lbl {
    color: var(--red);
    font-weight: 600;
  }

  /* OVERRIDE NOTE */
  .override-note {
    font-size: 10px;
    color: var(--muted);
    text-align: center;
    padding: 6px;
    background: #f7f7f8;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  /* FOOTER */
  .footer-buttons {
    display: flex;
    justify-content: space-between;
    padding: 14px 0;
    margin-top: 8px;
  }
  .btn {
    padding: 9px 18px;
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
  .btn-primary {
    background: var(--green);
    color: white;
  }
  .btn-primary:hover {
    background: var(--green-dark);
  }
  .btn-ghost {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
`;

/* ─── Coordonnées de fallback (mode démo / pas d'activeBien) ─── */
const DEMO_TARGET_COORDS = [45.7580, 4.8590];
const DEMO_TARGET_LABEL = '12 rue des Lilas';
const DEMO_TARGET_CITY_LINE = '69003 Lyon';

/* ─── Cadastre IGN — Géoplateforme (WMTS public) ─── */
const CADASTRE_TILE_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=CADASTRALPARCELS.PARCELS&TILEMATRIX={z}&TILEMATRIXSET=PM' +
  '&TILECOL={x}&TILEROW={y}&FORMAT=image/png&STYLE=normal';

/* ─── Overpass API — POI réels OSM (avec mirrors de secours) ─── */
/* Ordre = ordre d'essai. kumi.systems en 1er car overpass-api.de
   refuse régulièrement les connexions (ERR_CONNECTION_REFUSED). */
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const OVERPASS_TIMEOUT = 25;          // secondes côté serveur Overpass
const OVERPASS_QUERIES = {
  transports: (lat, lon, r) => `(
    node["railway"="station"](around:${r},${lat},${lon});
    node["public_transport"="station"](around:${r},${lat},${lon});
    node["highway"="bus_stop"](around:${r},${lat},${lon});
    node["amenity"="bicycle_rental"](around:${r},${lat},${lon});
  );out body 12;`,
  commerces: (lat, lon, r) => `(
    node["shop"~"supermarket|convenience|bakery|butcher|greengrocer"](around:${r},${lat},${lon});
    node["amenity"~"pharmacy|post_office|bank|cafe|restaurant"](around:${r},${lat},${lon});
  );out body 12;`,
  education: (lat, lon, r) => `(
    node["amenity"~"kindergarten|school|college|university"](around:${r},${lat},${lon});
    way["amenity"~"kindergarten|school|college|university"](around:${r},${lat},${lon});
  );out center 10;`,
  sante: (lat, lon, r) => `(
    node["amenity"~"hospital|clinic|doctors|dentist"](around:${r},${lat},${lon});
    way["amenity"~"hospital|clinic"](around:${r},${lat},${lon});
  );out center 10;`,
  environnement: (lat, lon, r) => `(
    way["leisure"~"park|garden|nature_reserve"](around:${r},${lat},${lon});
    node["leisure"~"park|garden|playground"](around:${r},${lat},${lon});
  );out center 10;`,
};

/* Distance approx (m) entre deux paires lat/lon - haversine */
function distMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* Détail formaté pour la popup OSM ("Métro — 350 m") */
function buildPoiDetail(tags, distance) {
  const parts = [];
  if (tags.railway === 'station') parts.push('Gare');
  else if (tags.public_transport === 'station') parts.push('Station');
  else if (tags.highway === 'bus_stop') parts.push('Arrêt bus');
  else if (tags.amenity === 'bicycle_rental') parts.push('Vélos');
  else if (tags.shop) parts.push(tags.shop.replace(/_/g, ' '));
  else if (tags.amenity) parts.push(tags.amenity.replace(/_/g, ' '));
  parts.push(distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`);
  return parts.join(' — ');
}

/* Fetch Overpass pour une catégorie — essaie les mirrors en cascade */
async function fetchOverpassCategory(cat, coords, radius, signal) {
  const [lat, lon] = coords;
  const body = `[out:json][timeout:${OVERPASS_TIMEOUT}];${OVERPASS_QUERIES[cat](lat, lon, radius)}`;
  let lastErr = null;
  let json = null;
  let usedEndpoint = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(body)}`,
        signal,
      });
      if (!res.ok) {
        lastErr = new Error(`${endpoint} ${res.status}`);
        // log discret en console.warn (pas d'erreur rouge si mirror suivant OK)
        console.warn('[Overpass]', cat, endpoint, '→ HTTP', res.status, '· essai mirror suivant');
        continue;
      }
      json = await res.json();
      usedEndpoint = endpoint;
      break;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastErr = err;
      console.warn('[Overpass]', cat, endpoint, '→', err.message, '· essai mirror suivant');
      continue;
    }
  }
  if (!json) throw lastErr || new Error('Overpass : tous les mirrors KO');
  const rawCount = Array.isArray(json.elements) ? json.elements.length : 0;
  console.log('[Overpass]', cat, '→ OK via', usedEndpoint, '·', rawCount, 'éléments bruts');
  if (!Array.isArray(json.elements)) return [];
  const filtered = json.elements
    .map((el) => {
      const c = el.type === 'node'
        ? [el.lat, el.lon]
        : el.center ? [el.center.lat, el.center.lon] : null;
      if (!c) return null;
      const tags = el.tags || {};
      const name = tags.name || tags['name:fr'] || tags.brand;
      if (!name) return null;
      const d = distMeters(coords, c);
      return { name, coords: c, detail: buildPoiDetail(tags, d), distance: d };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  console.log('[Overpass]', cat, '→', filtered.length, 'POI retenus (avec nom)');
  return filtered;
}

/* ─── Helpers : construction des sections déroulables dynamiques ─────── */

/* Format distance lisible : "350m" ou "1.2km" */
function fmtDist(d) {
  if (d == null || Number.isNaN(d)) return '—';
  return d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`;
}

/* Couleur du dot d'en-tête selon la distance moyenne POI */
function dotFromAvgDist(avgDist) {
  if (avgDist == null) return '';
  if (avgDist < 500) return 'green';
  if (avgDist < 1000) return 'orange';
  return 'red';
}

/* Titres EXACTS utilisés dans contexteZone.sections (matching fallback) */
const POI_SECTION_TITLES = {
  transports:    'Transports & Accessibilité',
  commerces:     'Commerces & Services',
  education:     'Éducation',
  sante:         'Santé',
  environnement: 'Environnement & Cadre de vie',
};
const RISQUES_TITLE = 'Risques & Aléas';

/* Construit une section "POI" pour une catégorie donnée */
function buildPoiSection(cat, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const top = items.slice(0, 5);
  const summary = top.slice(0, 2)
    .map((p) => `${p.name} ${fmtDist(p.distance)}`)
    .join(' · ');
  const avg = top.reduce((s, p) => s + (p.distance || 0), 0) / top.length;
  return {
    title:   POI_SECTION_TITLES[cat] || cat,
    summary,
    rows: top.map((p) => ({
      lbl:  p.name,
      val:  fmtDist(p.distance),
      type: 'dist',
    })),
    dotColor: dotFromAvgDist(avg),
  };
}

/* Construit la section "Risques & Aléas" depuis la synthèse Géorisques */
function buildRisquesSection(risques) {
  if (!risques) return null;
  const rows = [];
  let warnCount = 0;
  let badCount = 0;

  /* Inondation (PPRI) */
  if (risques.inondation) {
    if (risques.inondation.present) {
      rows.push({
        lbl: 'Inondation (PPRI)',
        val: risques.inondation.niveau || 'Présent',
        type: 'risk-warn',
      });
      warnCount++;
    } else {
      rows.push({ lbl: 'Inondation (PPRI)', val: 'Aucun', type: 'risk-ok' });
    }
  }

  /* Retrait-gonflement argiles */
  if (risques.argile && risques.argile.niveau) {
    const niv = String(risques.argile.niveau).toLowerCase();
    const isBad  = /fort|élev/.test(niv);
    const isWarn = /moy/.test(niv);
    rows.push({
      lbl:  'Retrait-gonflement argiles',
      val:  risques.argile.niveau,
      type: isBad ? 'risk-bad' : isWarn ? 'risk-warn' : 'risk-ok',
      isImpact: isBad,
    });
    if (isBad) badCount++;
    else if (isWarn) warnCount++;
  }

  /* Sismicité */
  if (risques.sismique && risques.sismique.niveau) {
    const z = parseInt(risques.sismique.zone, 10);
    const isBad  = z >= 4;
    const isWarn = z === 3;
    rows.push({
      lbl:  `Sismicité (zone ${risques.sismique.zone})`,
      val:  risques.sismique.niveau,
      type: isBad ? 'risk-bad' : isWarn ? 'risk-warn' : 'risk-ok',
    });
    if (isBad) badCount++;
    else if (isWarn) warnCount++;
  }

  /* Potentiel radon */
  if (risques.radon && risques.radon.potentiel) {
    const niv = risques.radon.potentiel;
    const isBad  = niv === 'Élevé';
    const isWarn = niv === 'Moyen';
    rows.push({
      lbl:  'Potentiel radon',
      val:  niv,
      type: isBad ? 'risk-bad' : isWarn ? 'risk-warn' : 'risk-ok',
    });
    if (isBad) badCount++;
    else if (isWarn) warnCount++;
  }

  /* Mouvements de terrain (rayon 500m) */
  if (risques.mouvement) {
    rows.push({
      lbl:  'Mouvements de terrain (500m)',
      val:  risques.mouvement.present ? `${risques.mouvement.count} signalé(s)` : 'Aucun',
      type: risques.mouvement.present ? 'risk-warn' : 'risk-ok',
    });
    if (risques.mouvement.present) warnCount++;
  }

  /* BASIAS / installations classées (rayon 500m) */
  if (risques.basias) {
    rows.push({
      lbl:  'Sites BASIAS (500m)',
      val:  risques.basias.present ? `${risques.basias.count} signalé(s)` : 'Aucun',
      type: risques.basias.present ? 'risk-warn' : 'risk-ok',
    });
    if (risques.basias.present) warnCount++;
  }

  if (rows.length === 0) return null;

  let summary;
  if (badCount > 0)       summary = `${badCount} alerte(s) majeure(s)`;
  else if (warnCount > 0) summary = `${warnCount} point(s) de vigilance`;
  else                    summary = 'Aucun risque majeur signalé';

  return {
    title: 'Risques & Aléas',
    summary,
    rows,
    dotColor: badCount > 0 ? 'red' : warnCount > 0 ? 'orange' : 'green',
  };
}

/* Section "live indisponible" pour une catégorie POI : signale clairement
   à l'utilisateur que les données ne sont pas dispos plutôt que d'afficher
   des POI démo qui ne correspondraient pas à sa localité. */
function buildEmptyPoiSection(cat) {
  return {
    title: POI_SECTION_TITLES[cat] || cat,
    summary: 'Données live indisponibles pour cette zone',
    rows: [
      { lbl: 'Source', val: 'OpenStreetMap / Overpass' },
      { lbl: 'Statut', val: 'Indisponible — réessayer plus tard' },
    ],
    dotColor: '',
  };
}

function buildEmptyRisquesSection() {
  return {
    title: RISQUES_TITLE,
    summary: 'Données live indisponibles pour cette zone',
    rows: [
      { lbl: 'Source', val: 'Géorisques (data.gouv.fr)' },
      { lbl: 'Statut', val: 'Indisponible — réessayer plus tard' },
    ],
    dotColor: '',
  };
}

/* Compose le tableau final de sections (POI + Risques) à passer au rendu.
   - Si le bien a une vraie localité (citycode) : pas de fallback démo Lyon 3
     trompeur. À la place on affiche une section "live indispo" explicite.
   - Sinon (mode démo / pas d'activeBien) : retombe sur contexteZone.sections. */
function buildDynamicSections({ realPoi, risques, hasRealLocation }, fallback) {
  const out = [];
  const order = ['transports', 'commerces', 'education', 'sante', 'environnement'];
  const fb = Array.isArray(fallback) ? fallback : [];
  const findFb = (title) => fb.find((s) => s.title === title);

  /* 1. Sections POI : live > (démo si pas de vraie loc) > placeholder */
  order.forEach((cat) => {
    const live = realPoi ? buildPoiSection(cat, realPoi[cat]) : null;
    if (live) {
      out.push(live);
    } else if (hasRealLocation) {
      out.push(buildEmptyPoiSection(cat));
    } else {
      const demo = findFb(POI_SECTION_TITLES[cat]);
      if (demo) out.push(demo);
    }
  });

  /* 2. Section Risques : live > (démo si pas de vraie loc) > placeholder */
  const risk = buildRisquesSection(risques);
  if (risk) {
    out.push(risk);
  } else if (hasRealLocation) {
    out.push(buildEmptyRisquesSection());
  } else {
    const demo = findFb(RISQUES_TITLE);
    if (demo) out.push(demo);
  }

  /* 3. Sections additionnelles du fallback (INSEE, etc.) :
        on les garde uniquement en mode démo sans vraie localité,
        sinon elles seraient trompeuses (chiffres Lyon 3). */
  if (!hasRealLocation) {
    const knownTitles = new Set([...Object.values(POI_SECTION_TITLES), RISQUES_TITLE]);
    fb.forEach((s) => {
      if (!knownTitles.has(s.title)) out.push(s);
    });
  }

  if (out.length === 0) return fallback;
  return out;
}

/* ─── POI simulés autour du bien cible ─── */
const POI_DATA = {
  transports: [
    { name: 'Métro Saxe-Gambetta', coords: [45.7565, 4.8545], detail: 'Ligne B/D — 350 m' },
    { name: 'Tram T1 — Guillotière', coords: [45.7558, 4.8570], detail: '500 m' },
    { name: 'Bus C3 — Dauphiné', coords: [45.7595, 4.8615], detail: '180 m' },
    { name: 'Vélo\'v — Place Guichard', coords: [45.7575, 4.8560], detail: '15 places — 200 m' },
    { name: 'Bus C9 — Villette', coords: [45.7605, 4.8575], detail: '280 m' },
  ],
  commerces: [
    { name: 'Carrefour City', coords: [45.7573, 4.8610], detail: 'Alimentation — 150 m' },
    { name: 'Boulangerie Paul', coords: [45.7585, 4.8565], detail: '120 m' },
    { name: 'Pharmacie des Lilas', coords: [45.7590, 4.8600], detail: '80 m' },
    { name: 'Marché couvert Part-Dieu', coords: [45.7608, 4.8570], detail: '650 m' },
    { name: 'Tabac Presse Liberté', coords: [45.7568, 4.8598], detail: '200 m' },
    { name: 'La Poste Lyon 3', coords: [45.7555, 4.8585], detail: '400 m' },
    { name: 'Banque LCL', coords: [45.7582, 4.8550], detail: '350 m' },
  ],
  education: [
    { name: 'École maternelle Montbrillant', coords: [45.7600, 4.8555], detail: 'Maternelle — 500 m' },
    { name: 'Collège Raoul Dufy', coords: [45.7545, 4.8610], detail: 'Collège — 800 m' },
    { name: 'Lycée Lacassagne', coords: [45.7530, 4.8570], detail: 'Lycée — 950 m' },
    { name: 'Crèche Les P\'tits Loups', coords: [45.7592, 4.8625], detail: '300 m' },
  ],
  sante: [
    { name: 'Cabinet Dr. Martin', coords: [45.7572, 4.8605], detail: 'Médecin généraliste — 100 m' },
    { name: 'Hôpital Édouard Herriot', coords: [45.7540, 4.8630], detail: 'Hôpital — 1.1 km' },
    { name: 'Dentiste Dr. Roux', coords: [45.7588, 4.8555], detail: '250 m' },
    { name: 'Laboratoire Biogroup', coords: [45.7578, 4.8620], detail: '200 m' },
  ],
};

const POI_STYLES = {
  transports: { color: '#2563EB', icon: '🚇', label: 'Transports' },
  commerces:  { color: '#D97706', icon: '🛒', label: 'Commerces' },
  education:  { color: '#7C3AED', icon: '🎓', label: 'Éducation' },
  sante:      { color: '#DC2626', icon: '🏥', label: 'Santé' },
};

export default function Step2ContexteZone() {
  const navigate = useNavigate();
  // Hydratation depuis reportStore (persistance inter-pages)
  const persistedContexte = useMemo(() => getReportSection('contexteMarche', {}), []);
  const [openSections, setOpenSections] = useState({});
  const [radiusMeters, setRadiusMeters] = useState(
    typeof persistedContexte.rayon === 'number' ? persistedContexte.rayon : 1000
  );
  const [activeLayers, setActiveLayers] = useState({ transports: true, commerces: true, education: false, sante: false });
  const [cadastreOn, setCadastreOn] = useState(false);
  const [realPoi, setRealPoi] = useState(persistedContexte.poi || null);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiError, setPoiError] = useState(null);
  const [risques, setRisques] = useState(persistedContexte.risques || null);
  const [risquesLoading, setRisquesLoading] = useState(false);
  const [dvfStatsLive, setDvfStatsLive] = useState(persistedContexte.dvfLive || null);
  const [dvfLoading, setDvfLoading] = useState(false);
  const [refetchTick, setRefetchTick] = useState(0);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const poiLayersRef = useRef({});                   // catégorie -> L.layerGroup
  const cadastreLayerRef = useRef(null);             // L.tileLayer cadastre
  const targetMarkerRef = useRef(null);              // marker bien-cible

  const toggleSection = (idx) => {
    setOpenSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  /* ═══ WORKSPACE 2 COLONNES (Carte / Commodités) ═══
   * Largeurs en % de la rect du workspace, modifiées au drag de la poignée
   * centrale. Même logique que la Step3 mais avec une seule poignée :
   * quand on agrandit la carte, la colonne commodités rétrécit, et inversement. */
  const [colWidths, setColWidths] = useState({ map: 62, poi: 38 });
  const [isResizing, setIsResizing] = useState(false);
  const workspaceRef = useRef(null);

  const startResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Throttle invalidateSize via rAF pour éviter la zone grise des tuiles
    let rafId = null;
    const requestMapInvalidate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const m = mapInstanceRef.current;
        if (m) { try { m.invalidateSize({ animate: false, pan: false }); } catch { /* noop */ } }
      });
    };

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const handleMove = (mv) => {
      if (!rect.width) return;
      const ratio = ((mv.clientX - rect.left) / rect.width) * 100;
      const newMap = clamp(ratio, 35, 75);
      setColWidths({ map: newMap, poi: 100 - newMap });
      requestMapInvalidate();
    };
    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
      const m = mapInstanceRef.current;
      if (m) { try { m.invalidateSize({ animate: false }); } catch { /* noop */ } }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  /* ─── Bien actif : coords / adresse / dvfStats ─────────────────────── */
  const activeBien = useMemo(() => getActiveBien(), []);
  const targetCoords = useMemo(() => {
    if (activeBien?.adresse?.coords && Array.isArray(activeBien.adresse.coords)) {
      return activeBien.adresse.coords;
    }
    return DEMO_TARGET_COORDS;
  }, [activeBien]);
  const targetLabel = activeBien?.adresse?.label || DEMO_TARGET_LABEL;
  const targetCityLine = activeBien?.adresse
    ? `${activeBien.adresse.postcode || ''} ${activeBien.adresse.city || ''}`.trim()
    : DEMO_TARGET_CITY_LINE;
  const dvfStats = activeBien?.dvfStats || null;
  const hasRealLocationGlobal = !!activeBien?.adresse?.citycode;

  /* Market Card : DVF réel (Step1 OU live Step2) si dispo, sinon
     - si vraie localité : placeholder "indispo" (ne jamais afficher Lyon 3 démo)
     - sinon : fallback contexteZone.market (mode démo) */
  const marketDisplay = useMemo(() => {
    const dvf = (dvfStats && dvfStats.median) ? dvfStats
              : (dvfStatsLive && dvfStatsLive.median) ? dvfStatsLive
              : null;
    if (dvf) {
      const fmt = (n) => Number(n).toLocaleString('fr-FR');
      return {
        prixM2: fmt(dvf.median),
        evolution: contexteZone.market.evolution,         // pas dans DVF actuel
        transactions: dvf.count || '—',
        delai: contexteZone.market.delai,                  // idem
        fourchette: dvf.p25 && dvf.p75
          ? `${fmt(dvf.p25)} – ${fmt(dvf.p75)}`
          : contexteZone.market.fourchette,
        source: 'DVF',
      };
    }
    if (hasRealLocationGlobal) {
      return {
        prixM2: '—',
        evolution: '—',
        transactions: '—',
        delai: '—',
        fourchette: '—',
        source: 'indispo',
      };
    }
    return { ...contexteZone.market, source: 'demo' };
  }, [dvfStats, dvfStatsLive, hasRealLocationGlobal]);

  const marketTitle = activeBien?.adresse?.city
    ? `Marché Local — ${activeBien.adresse.city}${activeBien.adresse.postcode ? ' (' + activeBien.adresse.postcode + ')' : ''}`
    : 'Marché Local — IRIS 693830107';

  /* Lien GPU (Géoportail Urbanisme) : pré-rempli sur la commune (citycode INSEE) */
  const pluUrl = activeBien?.adresse?.citycode
    ? `https://www.geoportail-urbanisme.gouv.fr/map/#tile=1&lon=${targetCoords[1]}&lat=${targetCoords[0]}&zoom=17`
    : 'https://www.geoportail-urbanisme.gouv.fr/';

  /* ─── Construction des sections déroulables ─────────────────────────── */
  /* Mode démo (pas de bien actif) → contexteZone.sections inchangé.       */
  /* Mode réel (citycode présent) → on construit dynamiquement, sans       */
  /* retomber sur les données démo Lyon 3 qui seraient trompeuses.          */
  const sections = useMemo(() => {
    const hasRealLocation = !!activeBien?.adresse?.citycode;
    if (!hasRealLocation && !realPoi && !risques) {
      return contexteZone.sections;
    }
    return buildDynamicSections(
      { realPoi, risques, hasRealLocation },
      contexteZone.sections
    );
  }, [realPoi, risques, activeBien]);

  const setRadius = (meters) => {
    setRadiusMeters(meters);
    if (circleRef.current) {
      circleRef.current.setRadius(meters);
    }
    const map = mapInstanceRef.current;
    if (map) {
      const zoom = meters <= 500 ? 16 : meters <= 1500 ? 15 : 14;
      // Pas d'animation : le slider est continu, on évite les à-coups au drag
      if (map.getZoom() !== zoom) map.setZoom(zoom, { animate: false });
    }
  };

  // Toggle POI category
  const toggleCategory = (cat) => {
    setActiveLayers(prev => {
      const next = { ...prev, [cat]: !prev[cat] };
      const map = mapInstanceRef.current;
      if (map && poiLayersRef.current[cat]) {
        if (next[cat]) {
          poiLayersRef.current[cat].addTo(map);
        } else {
          map.removeLayer(poiLayersRef.current[cat]);
        }
      }
      return next;
    });
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const L = window.L;
    if (!L || !mapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView(targetCoords, 15);
    // Fond CARTO Positron : gris pâle épuré, sans POI parasites → contraste max
    // pour les marqueurs de commodités. Gratuit, sans clé API.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    /* Cadastre IGN : layer gardé en ref, ajouté/retiré via toggle */
    cadastreLayerRef.current = L.tileLayer(CADASTRE_TILE_URL, {
      attribution: '&copy; IGN — Géoplateforme',
      opacity: 0.7,
      maxZoom: 20,
    });

    // Target marker
    const targetIcon = L.divIcon({
      className: 'target-marker-icon',
      html: `<div style="width:36px;height:36px;position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:-6px;border:2px solid var(--green);border-radius:50%;opacity:0.4;animation:pulse 2s infinite"></div>
        <div style="width:36px;height:36px;background:var(--green);border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(70,185,98,0.45);display:flex;align-items:center;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const popupHtml = `<strong>${escapeHtml(targetLabel)}</strong>${
      targetCityLine ? '<br>' + escapeHtml(targetCityLine) : ''
    }`;
    targetMarkerRef.current = L.marker(targetCoords, { icon: targetIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(popupHtml);

    // Radius circle
    const circle = L.circle(targetCoords, {
      radius: 1000,
      color: 'var(--green)',
      fillColor: 'var(--green)',
      fillOpacity: 0.06,
      weight: 2,
      dashArray: '8, 6',
      opacity: 0.6,
    }).addTo(map);
    circleRef.current = circle;

    // POI : on initialise les layerGroups vides (remplis ensuite par useEffect Overpass)
    Object.keys(POI_STYLES).forEach((cat) => {
      poiLayersRef.current[cat] = L.layerGroup();
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      cadastreLayerRef.current = null;
      targetMarkerRef.current = null;
      poiLayersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Recalcul des tuiles quand la largeur de la colonne carte change ─── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 60);
    return () => clearTimeout(t);
  }, [colWidths.map]);

  /* ─── Toggle cadastre IGN ───────────────────────────────────────────── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = cadastreLayerRef.current;
    if (!map || !layer) return;
    if (cadastreOn && !map.hasLayer(layer)) layer.addTo(map);
    else if (!cadastreOn && map.hasLayer(layer)) map.removeLayer(layer);
  }, [cadastreOn]);

  /* ─── Fetch DVF live si manquant ─────────────────────────────────────
     Step1 essaie de pré-remplir activeBien.dvfStats. Si l'utilisateur a
     court-circuité Step1 ou si DVF a échoué (petite commune, timeout…),
     on retente ici en Step2 pour ne pas afficher des chiffres démo Lyon 3
     trompeurs. */
  useEffect(() => {
    const citycode = activeBien?.adresse?.citycode;
    if (!citycode || (dvfStats && dvfStats.median)) {
      setDvfStatsLive(null);
      return undefined;
    }
    let cancelled = false;
    setDvfLoading(true);
    console.log('[DVF Step2] start fetch citycode=', citycode, 'type=', activeBien?.type);

    (async () => {
      try {
        // Proxy serverless Vercel : /api/dvf?citycode=XXXXX[&type=...]
        // Source côté serveur : Etalab geo-dvf statique. Bypass CORS,
        // cache CDN 24h, stats déjà calculées.
        const type = activeBien?.type || '';
        const url = `/api/dvf?citycode=${encodeURIComponent(citycode)}${type ? `&type=${encodeURIComponent(type)}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log('[DVF Step2] /api/dvf →', data);
        if (cancelled) return;
        if (data && data.ok && data.median) {
          // Format compatible avec dvfStats (Step1) : { median, moyenne, min, max, p25, p75, count }
          setDvfStatsLive({
            median: data.median,
            moyenne: data.moyenne,
            min: data.min,
            max: data.max,
            p25: data.p25,
            p75: data.p75,
            count: data.countByType ?? data.count,
          });
        } else {
          console.warn('[DVF Step2] api/dvf sans résultat exploitable', data);
          setDvfStatsLive(null);
        }
      } catch (err) {
        if (!cancelled) console.warn('[DVF Step2] fetch error', err);
      } finally {
        if (!cancelled) setDvfLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeBien, dvfStats, refetchTick]);

  /* ─── Fetch POI réels via Overpass quand coords / rayon changent ────── */
  useEffect(() => {
    if (!targetCoords) return;
    const ctrl = new AbortController();
    const debounce = setTimeout(async () => {
      setPoiLoading(true);
      setPoiError(null);
      try {
        const cats = Object.keys(OVERPASS_QUERIES);
        const results = await Promise.all(
          cats.map((cat) => fetchOverpassCategory(cat, targetCoords, radiusMeters, ctrl.signal)
            .catch((err) => {
              if (err.name === 'AbortError') throw err;
              console.warn('[Overpass]', cat, err.message);
              return null;
            }))
        );
        if (ctrl.signal.aborted) return;
        const next = {};
        cats.forEach((cat, i) => {
          if (Array.isArray(results[i]) && results[i].length > 0) next[cat] = results[i];
        });
        console.log('[Overpass] récap final →',
          Object.entries(next).map(([k, v]) => `${k}:${v.length}`).join(', ') || 'AUCUN POI',
          '· radius=', radiusMeters, 'm');
        setRealPoi(Object.keys(next).length > 0 ? next : null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[Overpass] global error', err);
          setPoiError('POI réels indisponibles — affichage des données démo.');
        }
      } finally {
        setPoiLoading(false);
      }
    }, 600);
    return () => {
      ctrl.abort();
      clearTimeout(debounce);
    };
  }, [targetCoords, radiusMeters, refetchTick]);

  /* ─── Fetch synthèse risques Géorisques ─────────────────────────────── */
  useEffect(() => {
    const citycode = activeBien?.adresse?.citycode;
    if (!citycode || !targetCoords) {
      setRisques(null);
      return undefined;
    }
    const ctrl = new AbortController();
    setRisquesLoading(true);
    getRisquesSynthese(citycode, targetCoords, ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setRisques(data);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.warn('[Géorisques]', err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setRisquesLoading(false);
      });
    return () => ctrl.abort();
  }, [activeBien, targetCoords]);

  /* ─── Repeupler les layerGroups POI quand realPoi change ────────────── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const L = window.L;
    if (!L) return;

    /* Si on a une vraie localité mais pas de POI live → on n'affiche RIEN
       sur la map (les markers démo Lyon 3 seraient trompeurs). */
    const hasRealLocation = !!activeBien?.adresse?.citycode;
    const sourceData = realPoi || (hasRealLocation ? {} : POI_DATA);

    Object.entries(POI_STYLES).forEach(([cat, style]) => {
      const group = poiLayersRef.current[cat];
      if (!group) return;
      group.clearLayers();

      const items = sourceData[cat] || [];
      items.forEach((poi) => {
        const icon = L.divIcon({
          className: 'poi-icon',
          html: `<div style="width:26px;height:26px;background:${style.color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1">${style.icon}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker(poi.coords, { icon }).addTo(group)
          .bindPopup(`<div style="font-family:'Open Sans',sans-serif;font-size:12px"><strong style="color:${style.color}">${poi.name}</strong><br><span style="color:#666">${poi.detail}</span></div>`);
      });

      // (Re)attache le groupe à la carte si la catégorie est active
      if (activeLayers[cat] && !map.hasLayer(group)) group.addTo(map);
    });
  }, [realPoi, activeLayers, activeBien]);

  /* ─── Persistance reportStore : rayon, POI, risques, DVF live, marché ── */
  useEffect(() => {
    mergeReportSection('contexteMarche', { rayon: radiusMeters });
  }, [radiusMeters]);

  useEffect(() => {
    if (realPoi) mergeReportSection('contexteMarche', { poi: realPoi });
  }, [realPoi]);

  useEffect(() => {
    if (risques) mergeReportSection('contexteMarche', { risques });
  }, [risques]);

  useEffect(() => {
    if (dvfStatsLive) mergeReportSection('contexteMarche', { dvfLive: dvfStatsLive });
  }, [dvfStatsLive]);

  /* Persiste la synthèse marché affichée (prixM2 médian, évolution,
     transactions, délai, fourchette) — utilisée par CompteRendu. */
  useEffect(() => {
    if (!marketDisplay) return;
    const isLiveSrc = marketDisplay.source === 'DVF';
    mergeReportSection('contexteMarche', {
      prixM2Median: isLiveSrc ? marketDisplay.prixM2 : undefined,
      evolution: marketDisplay.evolution,
      delaiMoyen: marketDisplay.delai,
      fourchette: marketDisplay.fourchette,
      transactions: marketDisplay.transactions,
      source: marketDisplay.source,
      zoneLabel: activeBien?.adresse?.city
        ? `${activeBien.adresse.city}${activeBien.adresse.postcode ? ' (' + activeBien.adresse.postcode + ')' : ''}`
        : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketDisplay]);

  return (
    <div className="step2-page">
      <style>{cssStyles}</style>

      <PropertyCard />
      <Stepper currentStep={2} />

      {/* Info Banner */}
      <div className="info-banner">
        <span className="info-icon">&#8505;</span>
        <span>Donn&eacute;es enrichies automatiquement &middot; 33 sources data.gouv / INSEE &middot; MAJ : 25 mars 2026</span>
      </div>

      {/* Marché local — bandeau horizontal pleine largeur */}
      <div className="market-bar">
        <div className="market-bar-head">
          <span className="market-bar-title">{marketTitle}</span>
          <span className={`market-source ${marketDisplay.source}`}>
            {marketDisplay.source === 'DVF'
              ? (dvfLoading ? 'DVF…' : 'DVF')
              : marketDisplay.source === 'indispo'
              ? (dvfLoading ? 'chargement…' : 'indispo')
              : 'démo'}
          </span>
        </div>
        <div className="market-bar-price">
          <span className="big">{marketDisplay.prixM2} &euro;</span>
          <span className="unit">/m&sup2;</span>
        </div>
        <div className="market-bar-stats">
          <div className="market-stat">
            <div className="val up">{marketDisplay.evolution}</div>
            <div className="lbl">&Eacute;volution 12 mois</div>
          </div>
          <div className="market-stat">
            <div className="val">{marketDisplay.transactions}</div>
            <div className="lbl">Transactions{marketDisplay.source === 'DVF' ? ' (24 mois)' : '/an'}</div>
          </div>
          <div className="market-stat">
            <div className="val">{marketDisplay.delai}</div>
            <div className="lbl">D&eacute;lai moyen vente</div>
          </div>
          <div className="market-stat">
            <div className="val">{marketDisplay.fourchette} &euro;</div>
            <div className="lbl">Fourchette P25&ndash;P75/m&sup2;</div>
          </div>
        </div>
      </div>

      {/* Carte + contrôles */}
      <div
        className={`workspace-2col ${isResizing ? 'is-resizing' : ''}`}
        ref={workspaceRef}
        style={{ '--col-map': `${colWidths.map}%`, '--col-poi': `${colWidths.poi}%` }}
      >
        {/* ─── Colonne 1 : carte + contrôles ─────────────────────────── */}
        <div className="ws-col ws-col-map">
          <div className="map-stage-inner">
            <div ref={mapRef} className="map-container" id="leaflet-map-zone" />
          </div>
          <div className="map-controls">
            {/* Rayon — curseur compact en ligne */}
            <div className="mc-section mc-radius-row">
              <span className="mc-section-title">Rayon</span>
              <input
                type="range"
                className="mc-range"
                min={100}
                max={3000}
                step={50}
                value={radiusMeters}
                onChange={(e) => setRadius(parseInt(e.target.value, 10))}
                style={{ '--rad-pct': Math.round(((radiusMeters - 100) / (3000 - 100)) * 100) }}
                aria-label="Rayon d'analyse en mètres"
              />
              <span className="mc-radius-value">
                {radiusMeters >= 1000
                  ? `${(radiusMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
                  : `${radiusMeters} m`}
              </span>
            </div>

            {/* Couches & sources — cadastre, PLU, statut */}
            <div className="mc-section">
              <div className="mc-toolbar">
                <div
                  className={`mc-toggle ${cadastreOn ? 'active' : ''}`}
                  onClick={() => setCadastreOn((v) => !v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCadastreOn((v) => !v); } }}
                >
                  <span className={`mc-check ${cadastreOn ? 'checked' : ''}`} />
                  <span>Cadastre IGN</span>
                </div>
                <a
                  href={pluUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mc-plu-chip"
                  title="Ouvrir le PLU de la commune sur le Géoportail Urbanisme"
                >
                  PLU / GPU ↗
                </a>
                <span className="mc-status">
                  {poiLoading
                    ? 'POI : chargement…'
                    : poiError
                    ? poiError
                    : realPoi
                    ? 'POI : OSM'
                    : 'POI : démo'}
                  {!risquesLoading && risques && ' · Risques : Géorisques'}
                </span>
                <button
                  type="button"
                  className="mc-reload"
                  onClick={() => setRefetchTick((t) => t + 1)}
                  disabled={poiLoading}
                  title="Forcer un nouveau fetch Overpass"
                >
                  {poiLoading ? '↻…' : '↻ Recharger'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Poignée de redimensionnement ───────────────────────────── */}
        <button
          type="button"
          className={`col-resize-handle ${isResizing ? 'is-dragging' : ''}`}
          onMouseDown={startResize}
          onDoubleClick={() => setColWidths({ map: 62, poi: 38 })}
          title="Glisser pour redimensionner · double-clic pour réinitialiser"
          aria-label="Redimensionner carte / commodités"
        />

        {/* ─── Colonne 2 : commodités (liste complète des POI) ────────── */}
        <div className="ws-col ws-col-poi">
          <div className="poi-panel-header">
            <div className="poi-panel-header-text">
              <h3 className="poi-panel-title">Commodités à proximité</h3>
              <div className="poi-panel-subtitle">
                <span>
                  {realPoi
                    ? `${Object.values(realPoi).reduce((s, a) => s + a.length, 0)} points trouvés`
                    : poiLoading
                    ? 'Chargement…'
                    : 'Données de démonstration'}
                </span>
                <span>· Rayon {radiusMeters >= 1000 ? `${(radiusMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `${radiusMeters} m`}</span>
              </div>
            </div>
          </div>
          <div className="poi-panel-body">
              {Object.entries(POI_STYLES).map(([cat, style]) => {
                const list = realPoi && Array.isArray(realPoi[cat]) ? realPoi[cat] : [];
                const on = activeLayers[cat];
                return (
                  <div key={cat} className="poi-cat">
                    <div
                      className={`poi-cat-head ${on ? 'active' : ''}`}
                      onClick={() => toggleCategory(cat)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(cat); } }}
                    >
                      <span className={`mc-check ${on ? 'checked' : ''}`} />
                      <span className="poi-cat-dot" style={{ background: style.color }} />
                      <span className="poi-cat-label">{style.label}</span>
                      <span className="poi-cat-count">{list.length}</span>
                    </div>
                    {on && (
                      list.length > 0 ? (
                        <ul className="poi-list">
                          {list.map((p, i) => (
                            <li key={i} className="poi-item">
                              <span
                                className="poi-item-bullet"
                                style={{ background: style.color }}
                              />
                              <span className="poi-item-name">{p.name}</span>
                              <span className="poi-item-detail">{p.detail}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="poi-list-empty">
                          {poiLoading ? 'Chargement…' : 'Aucun point trouvé dans ce rayon.'}
                        </p>
                      )
                    )}
                  </div>
                );
              })}

              {/* ─── Sections dépliables (caractéristiques de zone / risques) ─── */}
              <div className="poi-sections-sep">Caractéristiques de la zone</div>
              <div className="section-group">
                {sections.map((section, idx) => {
                  const isOpen = !!openSections[idx];
                  return (
                    <div key={idx} className="collapse-card">
                      <div className="collapse-header" onClick={() => toggleSection(idx)}>
                        <div className="collapse-header-left">
                          {section.dotColor && (
                            <span className={`collapse-dot ${section.dotColor}`} />
                          )}
                          <span className="collapse-title">{section.title}</span>
                          <span className="collapse-summary">{section.summary}</span>
                        </div>
                        <div className="collapse-header-right">
                          <span className={`collapse-arrow ${isOpen ? 'open' : ''}`}>&#9662;</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="collapse-body">
                          {section.rows.map((row, rIdx) => (
                            <div
                              key={rIdx}
                              className={`d-row ${row.isImpact ? 'risk-impact' : ''}`}
                            >
                              <span className="lbl">{row.lbl}</span>
                              <span className={`val ${row.type || ''}`}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          </div>
        </div>
      </div>

      {/* Override Note */}
      <div className="override-note">
        Donn&eacute;es enrichies automatiquement. Cliquez sur une valeur pour la corriger &mdash; les surcharges sont trac&eacute;es.
      </div>

      {/* Footer */}
      <div className="footer-buttons">
        <button className="btn btn-ghost" onClick={() => navigate('/step/1')}>
          &larr; Relev&eacute; d&rsquo;informations
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/step/3')}>
          Comparables &rarr;
        </button>
      </div>
    </div>
  );
}
