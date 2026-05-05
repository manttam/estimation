import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import ComparableDrawer from '../components/ComparableDrawer';
import { comparables } from '../data/propertyData';

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
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
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
    color: #949494;
    background: none;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: 'Open Sans', sans-serif;
  }
  .btn-reset-filters:hover {
    background: #fafafa;
  }

  /* RADIUS SLIDER ROW */
  .radius-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #eee;
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
  .radius-slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #bbb;
  }
  .radius-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #eee;
    outline: none;
    cursor: pointer;
  }
  .radius-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #46B962;
    border: 3px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    cursor: pointer;
  }
  .radius-value {
    font-size: 16px;
    font-weight: 700;
    color: #46B962;
    min-width: 60px;
    text-align: right;
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
    color: #e74c3c;
  }
  .source-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .source-cb-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
    padding: 3px 0;
  }
  .source-cb-label input[type="checkbox"] {
    accent-color: #46B962;
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  .source-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .source-row .source-cb-label {
    flex: 0 0 auto;
    padding: 0;
  }
  .source-row .source-mini-slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1 1 80px;
    min-width: 0;
    max-width: 90px;
    height: 3px;
    border-radius: 2px;
    background: #eee;
    outline: none;
    cursor: pointer;
    margin: 0;
  }
  .source-row .source-mini-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #46B962;
    border: 1.5px solid white;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    cursor: pointer;
  }
  .source-row .source-mini-slider::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #46B962;
    border: 1.5px solid white;
    cursor: pointer;
  }
  .source-row .source-delay-value {
    flex: 0 0 auto;
    margin-left: auto;
    font-size: 10px;
    font-weight: 600;
    color: #46B962;
    text-align: right;
    white-space: nowrap;
  }
  .source-row.disabled .source-mini-slider,
  .source-row.disabled .source-delay-value {
    opacity: 0.4;
  }
  .source-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }
  .dot-dvf { background: #4a6cf7; }
  .dot-ideeri { background: #46B962; }
  .dot-encours { background: #f5a623; }
  .dot-portail { background: #e74c3c; }
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
    border-color: #46B962;
    outline: none;
    box-shadow: 0 0 0 2px rgba(70,185,98,0.15);
  }
  .filter-range .sep {
    font-size: 11px;
    color: #bbb;
  }
  .filter-range .unit {
    font-size: 10px;
    color: #949494;
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
    border-color: #46B962;
    outline: none;
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
    background: #46B962;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    cursor: pointer;
  }

  /* ── Double-range slider (prix) ──────────────────────── */
  .price-dual {
    position: relative;
    height: 46px;
    padding: 0 4px;
    margin-top: 4px;
  }
  .price-dual-track {
    position: absolute;
    top: 18px;
    left: 4px;
    right: 4px;
    height: 10px;
    border-radius: 5px;
    /* dégradé = densité de biens par tranche de prix */
    background: linear-gradient(
      to right,
      #fdecec 0%,
      #fef5e6 10%,
      #e8f6ec 25%,
      #46B962 40%,
      #46B962 55%,
      #e8f6ec 70%,
      #fef5e6 85%,
      #fdecec 100%
    );
    border: 1px solid #e5e5e5;
    overflow: hidden;
  }
  .price-dual-selected {
    position: absolute;
    top: 18px;
    height: 10px;
    border-radius: 5px;
    border: 2px solid #46B962;
    background: transparent;
    pointer-events: none;
    box-sizing: border-box;
  }
  .price-dual input[type="range"] {
    position: absolute;
    top: 18px;
    left: 0;
    width: 100%;
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
    border: 2px solid #46B962;
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
    border: 2px solid #46B962;
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
    font-size: 10px;
    color: #666;
    padding: 0 4px;
  }
  .price-dual-labels strong {
    color: #393939;
    font-weight: 700;
  }
  .price-dual-labels .count {
    color: #46B962;
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
    color: #949494;
    transition: all 0.15s;
    font-family: 'Open Sans', sans-serif;
  }
  .filter-chip-add:hover {
    border-color: #4a6cf7;
    color: #4a6cf7;
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
    color: #949494;
  }

  /* ═══ RESULTS BANNER ═══ */
  .results-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    margin-bottom: 14px;
    background: linear-gradient(135deg, #f0f8f3 0%, #e8f5ee 100%);
    border: 1.5px solid #46B962;
    border-radius: 10px;
  }
  .results-banner-count {
    font-size: 28px;
    font-weight: 700;
    color: #46B962;
    line-height: 1;
  }
  .results-banner-text {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
  .results-banner-details {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .results-tag {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    background: #46B962;
    color: white;
  }
  .results-tag.outline {
    background: transparent;
    color: #46B962;
    border: 1.5px solid #46B962;
  }

  /* ═══ SPLIT VIEW ═══ */
  .split-view {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    height: 440px;
  }

  /* MAP CARD */
  .map-card-comp {
    flex: 1;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #eee;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .map-card-comp .map-container {
    flex: 1;
    z-index: 1;
  }

  /* MAP BOTTOM INFO BAR */
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
    padding: 10px 16px;
    border: 1px solid rgba(238,238,238,0.8);
  }
  .map-info-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .map-info-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .map-info-stat-val {
    font-size: 16px;
    font-weight: 700;
    color: #46B962;
  }
  .map-info-stat-label {
    font-size: 10px;
    color: #949494;
  }
  .map-info-divider {
    width: 1px;
    height: 28px;
    background: #e5e5e5;
  }
  .map-legend-inline {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .map-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #949494;
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .map-legend-item:hover {
    background: #f0f0f0;
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
    display: inline-block;
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
    border: 1px solid #e5e5e5;
    overflow: hidden;
  }
  .map-style-btn {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #949494;
    transition: all 0.15s;
    font-family: 'Open Sans', sans-serif;
  }
  .map-style-btn.active {
    background: #46B962;
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
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    color: #555;
    font-family: 'Open Sans', sans-serif;
    transition: all 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .map-draw-btn:hover {
    border-color: #4a6cf7;
    color: #4a6cf7;
    background: #f8f9ff;
  }
  .map-draw-btn.active {
    background: #4a6cf7;
    color: white;
    border-color: #4a6cf7;
  }
  .map-draw-btn.danger {
    color: #e74c3c;
    border-color: #fdd;
  }
  .map-draw-btn.danger:hover {
    background: #fef2f2;
    border-color: #e74c3c;
  }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.5); opacity: 0; }
    100% { transform: scale(1); opacity: 0; }
  }

  /* LIST PANEL */
  .list-panel {
    width: 520px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
  }
  .list-panel::-webkit-scrollbar {
    width: 5px;
  }
  .list-panel::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 3px;
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
    color: #949494;
  }

  /* COMP CARD */
  .comp-card {
    background: #fff;
    border-radius: 10px;
    padding: 14px;
    border: 1px solid #eee;
    position: relative;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .comp-card.selected {
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
    color: #949494;
  }
  .source-badge {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .source-badge.dvf { background: #f0f4ff; color: #666; }
  .source-badge.ideeri { background: #f0f8f5; color: #666; }
  .source-badge.encours { background: #fffbf0; color: #666; }
  .source-badge.portail { background: #fef6f0; color: #666; }
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
    font-family: 'Open Sans', sans-serif;
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
    color: #949494;
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
    border: 1.5px solid #46B962;
  }
  .score-mid {
    background: #fef9f0;
    border: 1.5px solid #d97706;
  }
  .score-low {
    background: #fef2f2;
    border: 1.5px solid #e74c3c;
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
  .score-high .score-badge-fill { background: #46B962; }
  .score-mid .score-badge-value { color: #b45309; }
  .score-mid .score-badge-fill { background: #d97706; }
  .score-low .score-badge-value { color: #c0392b; }
  .score-low .score-badge-fill { background: #e74c3c; }
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
  .pertinence-detail-fill.score-high { background: #46B962; }
  .pertinence-detail-fill.score-mid { background: #d97706; }
  .pertinence-detail-fill.score-low { background: #e74c3c; }
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
  .comp-card.selected.clickable {
    cursor: pointer;
    transition: border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  }
  .comp-card.selected.clickable:hover {
    border-color: #46B962;
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
    color: #46B962;
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
    background: #46B962;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }
  .weight-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #46B962;
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
    color: #949494;
  }
  .adj-val {
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
  }
  .adj-val.pos { background: rgba(70,185,98,0.1); color: #46B962; }
  .adj-val.neg { background: rgba(231,76,60,0.1); color: #e74c3c; }

  .comp-actions {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
    align-items: center;
  }
  .link-edit {
    color: #4a6cf7;
    font-size: 11px;
    text-decoration: none;
    cursor: pointer;
  }
  .btn-remove {
    background: none;
    border: none;
    color: #e74c3c;
    font-size: 11px;
    cursor: pointer;
    margin-left: auto;
    font-family: 'Open Sans', sans-serif;
  }

  /* SUMMARY TABLE */
  .summary-card {
    background: #fff;
    border-radius: 10px;
    padding: 16px;
    border: 1px solid #eee;
    margin-bottom: 14px;
    position: relative;
    overflow-x: auto;
  }
  .summary-title {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .summary-card table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    table-layout: fixed;
  }
  .summary-card th {
    background: #fafafa;
    padding: 9px 10px;
    text-align: left;
    font-weight: 600;
    color: #949494;
    border-bottom: 2px solid #f0f0f0;
    white-space: nowrap;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .summary-card td {
    padding: 10px 10px;
    border-bottom: 1px solid #f5f5f5;
    white-space: nowrap;
  }
  .summary-card tbody tr:hover {
    background: #fafafa;
  }
  .t-price {
    font-weight: 600;
    text-align: right;
  }
  .t-adj {
    text-align: center;
    font-weight: 600;
  }
  .t-adj.pos { color: #46B962; }
  .t-adj.neg { color: #e74c3c; }
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
    color: #46B962;
    font-weight: 600;
  }
  .t-weight-input:focus {
    border-color: #46B962;
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
    color: #e74c3c;
    background: #fef2f2;
  }

  /* FOOTER */
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
    text-decoration: none;
  }
  .btn-primary {
    background: #46B962;
    color: white;
  }
  .btn-primary:hover {
    background: #3da856;
  }
  .btn-ghost {
    background: transparent;
    color: #393939;
    border: 1px solid #eee;
  }
  .btn-ghost:hover {
    background: #fafafa;
  }
  .min-note {
    font-size: 11px;
    color: #46B962;
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
  .comp-card.compact {
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
    color: #949494;
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
    color: #46B962;
    font-size: 11px;
    cursor: pointer;
    font-weight: 600;
    margin-left: auto;
    font-family: 'Open Sans', sans-serif;
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
    color: #949494;
    margin-bottom: 3px;
  }
  .val-item-value {
    font-size: 14px;
    font-weight: 700;
    color: #393939;
  }
  .val-item-value.highlight { color: #46B962; }
  .val-item-value.na { font-size: 12px; color: #ccc; font-weight: 500; }
  .val-delta {
    font-size: 10px;
    font-weight: 600;
    margin-top: 2px;
  }
  .val-delta.pos { color: #46B962; }
  .val-delta.neg { color: #e74c3c; }
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

const INITIAL_OTHERS = [
  { id: 'duguesclin', title: 'T3 70m\u00b2 \u2014 5 rue Duguesclin, Lyon 3', source: 'dvf', meta: 'DVF \u00b7 295k\u20ac \u00b7 4 214\u20ac/m\u00b2 \u00b7 750m', simScore: '84% sim.', simClass: 'high', donScore: '62% donn\u00e9es', donClass: 'mid', donCount: '113/182' },
  { id: 'lafayette', title: 'T4 85m\u00b2 \u2014 18 cours Lafayette, Lyon 3', source: 'portail', portalName: 'SeLoger', meta: 'Portail \u00b7 340k\u20ac \u00b7 4 000\u20ac/m\u00b2 \u00b7 890m', simScore: '58% sim.', simClass: 'mid', donScore: '5% donn\u00e9es', donClass: 'low', donCount: '9/182' },
  { id: 'mazenod', title: 'T2 55m\u00b2 \u2014 33 rue Mazenod, Lyon 3', source: 'dvf', meta: 'DVF \u00b7 240k\u20ac \u00b7 4 363\u20ac/m\u00b2 \u00b7 420m', simScore: '71% sim.', simClass: 'mid', donScore: '68% donn\u00e9es', donClass: 'mid', donCount: '124/182' },
  { id: 'guichard', title: 'T3 71m\u00b2 \u2014 7 place Guichard, Lyon 3', source: 'ideeri', meta: 'Ideeri \u00b7 298k\u20ac \u00b7 4 197\u20ac/m\u00b2 \u00b7 310m', simScore: '89% sim.', simClass: 'high', donScore: '93% donn\u00e9es', donClass: 'high', donCount: '538/575' },
];

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

function CompactCompCard({ comp, onAdd }) {
  const dotClass = comp.source === 'dvf' ? 'dot-dvf' : comp.source === 'ideeri' ? 'dot-ideeri' : comp.source === 'encours' ? 'dot-encours' : 'dot-portail';
  return (
    <div className="comp-card compact">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {comp.portalName && <a className="btn-view-ad" href="#" onClick={(e) => e.preventDefault()}>&#8599; Annonce</a>}
          <button className="btn-add" onClick={() => onAdd && onAdd(comp.id)}>+ Ajouter</button>
        </div>
      </div>
    </div>
  );
}

// All 47 mock comparables for filtering simulation
const ALL_COMPS_COUNT = 47;

export default function Step3Comparables() {
  const navigate = useNavigate();
  const [radius, setRadius] = useState(1000);
  const [mapStyle, setMapStyle] = useState('plan');
  // Délai max par source (en mois) — 3 ans (36 mois) pour "En cours" et "Portail", 8 ans (96 mois) pour DVF et Ideeri/Bien vendus
  const [delayDvf, setDelayDvf] = useState(36);
  const [delayIdeeri, setDelayIdeeri] = useState(36);
  const [delayEncours, setDelayEncours] = useState(12);
  const [delayPortail, setDelayPortail] = useState(12);
  const [drawMode, setDrawMode] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const drawLayerRef = useRef(null);
  const radiusCircleRef = useRef(null);
  const freehandPointsRef = useRef([]);
  const freehandLineRef = useRef(null);
  const isDrawingRef = useRef(false);
  const addCompRef = useRef(null);

  // Selected / Others comparable lists (dynamic)
  const [selected, setSelected] = useState(INITIAL_SELECTED);
  const [others, setOthers] = useState(INITIAL_OTHERS);

  // Drawer pour afficher le d\u00e9tail d'un comparable
  const [drawerComp, setDrawerComp] = useState(null);

  // Pond\u00e9ration manuelle des comparables (somme = 100, normalis\u00e9e auto)
  const [weights, setWeights] = useState(() => {
    const eq = Math.round(100 / Math.max(INITIAL_SELECTED.length, 1));
    const obj = {};
    INITIAL_SELECTED.forEach((c, i) => {
      obj[c.id] = i === INITIAL_SELECTED.length - 1 ? 100 - eq * (INITIAL_SELECTED.length - 1) : eq;
    });
    return obj;
  });

  // Modifier le poids d'un comparable et re-normaliser les autres pour somme = 100
  const handleWeightChange = (id, newValue) => {
    setWeights((prev) => {
      const ids = Object.keys(prev);
      if (ids.length <= 1) return { ...prev, [id]: 100 };
      const clamped = Math.max(0, Math.min(100, newValue));
      const otherIds = ids.filter((k) => k !== id);
      const otherSumOld = otherIds.reduce((s, k) => s + (prev[k] || 0), 0);
      const remaining = 100 - clamped;
      const next = { [id]: clamped };
      if (otherSumOld <= 0) {
        // Tous les autres \u00e9taient \u00e0 0 \u2192 r\u00e9partition \u00e9gale
        const each = Math.floor(remaining / otherIds.length);
        otherIds.forEach((k, i) => {
          next[k] = i === otherIds.length - 1 ? remaining - each * (otherIds.length - 1) : each;
        });
      } else {
        // R\u00e9partition proportionnelle, derni\u00e8re cl\u00e9 absorbe l'arrondi
        let allocated = 0;
        otherIds.forEach((k, i) => {
          if (i === otherIds.length - 1) {
            next[k] = Math.max(0, remaining - allocated);
          } else {
            const v = Math.round((prev[k] / otherSumOld) * remaining);
            next[k] = v;
            allocated += v;
          }
        });
      }
      return next;
    });
  };

  // Nettoyage du poids associ\u00e9 \u00e0 un comparable supprim\u00e9 (re-normalisation \u00e0 100%)
  const cleanupWeight = (id) => {
    setWeights((prev) => {
      const { [id]: _removed, ...rest } = prev;
      const ids = Object.keys(rest);
      if (ids.length === 0) return {};
      const sum = ids.reduce((s, k) => s + (rest[k] || 0), 0);
      if (sum === 0) {
        const eq = Math.round(100 / ids.length);
        const next = {};
        ids.forEach((k, i) => { next[k] = i === ids.length - 1 ? 100 - eq * (ids.length - 1) : eq; });
        return next;
      }
      let allocated = 0;
      const next = {};
      ids.forEach((k, i) => {
        if (i === ids.length - 1) {
          next[k] = Math.max(0, 100 - allocated);
        } else {
          const v = Math.round((rest[k] / sum) * 100);
          next[k] = v;
          allocated += v;
        }
      });
      return next;
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
    // Build a full selected-format object
    const promoted = {
      id: comp.id,
      title: comp.title,
      addr: 'Lyon 3\u00e8me',
      source: comp.source,
      sourceLabel,
      prix: parseInt(prixNum).toLocaleString('fr-FR').replace(/,/g, ' ').replace(/\./g, ' '),
      prixM2: prixM2Str.replace('/m\u00b2', '').replace('\u20ac', '').trim(),
      distance: distanceStr,
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
      noPhoto: comp.source === 'dvf',
      photoUrl: comp.source !== 'dvf' ? `https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=520&h=140&fit=crop&crop=center&seed=${comp.id}` : undefined,
      portalName: comp.portalName || (comp.source === 'portail' ? randomPortalName() : undefined),
    };
    setOthers(prev => prev.filter(c => c.id !== compId));
    setSelected(prev => [...prev, promoted]);
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

  // Filter states
  const [surfaceMin, setSurfaceMin] = useState(55);
  const [surfaceMax, setSurfaceMax] = useState(90);
  const [piecesMin, setPiecesMin] = useState(2);
  const [piecesMax, setPiecesMax] = useState(4);
  const [prixMin, setPrixMin] = useState(200000);
  const [prixMax, setPrixMax] = useState(400000);
  const [typeFilter, setTypeFilter] = useState('appartement');
  const [sourceDvf, setSourceDvf] = useState(true);
  const [sourceIdeeri, setSourceIdeeri] = useState(true);
  const [sourceEncours, setSourceEncours] = useState(true);
  const [sourcePortail, setSourcePortail] = useState(true);

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

  // Simulated dynamic bien count based on filters
  const computeFilteredCount = () => {
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
    const sourcesOn = [sourceDvf, sourceIdeeri, sourceEncours, sourcePortail].filter(Boolean).length;
    if (sourcesOn < 4) count = Math.max(Math.round(count * (sourcesOn / 4)), 1);
    // Délai par source — chaque source contribue proportionnellement à son délai
    // DVF & Ideeri : pleine contribution à 96 mois (8 ans)
    // En cours & Portail : pleine contribution à 36 mois (3 ans)
    const sourceContribs = [];
    if (sourceDvf) sourceContribs.push(Math.min(delayDvf / 96, 1));
    if (sourceIdeeri) sourceContribs.push(Math.min(delayIdeeri / 96, 1));
    if (sourceEncours) sourceContribs.push(Math.min(delayEncours / 36, 1));
    if (sourcePortail) sourceContribs.push(Math.min(delayPortail / 36, 1));
    const dateFactor = sourceContribs.length
      ? sourceContribs.reduce((a, b) => a + b, 0) / sourceContribs.length
      : 1;
    // Pondération non-linéaire : courbe douce pour que les petits délais réduisent fortement
    count = Math.max(Math.round(count * (0.15 + 0.85 * dateFactor)), 1);
    // Type
    if (typeFilter === 'tous') count = Math.min(count + 8, 90);
    return Math.max(count, 1);
  };
  const filteredCount = computeFilteredCount();

  const formatRadius = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} km` : `${v}m`);
  const sliderPct = ((radius - 100) / (5000 - 100)) * 100;

  // Source → marker color mapping
  // vert = Ideeri vendu (mandat) · bleu = DVF officiel · orange = Ideeri en cours · rouge = Portails
  const sourceMarkerColor = {
    dvf: '#4a6cf7',
    ideeri: '#46B962',
    encours: '#f5a623',
    portail: '#e74c3c',
  };

  // Initialize Leaflet map with markers and draw tool
  useEffect(() => {
    if (mapInstanceRef.current) return;
    if (!L || !mapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(TARGET_COORDS, 15);
    const tile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tile;
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Radius circle (will be hidden when user draws a custom zone)
    const radiusCircle = L.circle(TARGET_COORDS, { radius: 1000, color: '#46B962', weight: 2, opacity: 0.6, fillColor: '#46B962', fillOpacity: 0.06, dashArray: '8, 6' }).addTo(map);
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
    L.marker(TARGET_COORDS, { icon: targetIcon, zIndexOffset: 1000 }).addTo(map).bindPopup(
      `<div style="text-align:center;padding:4px 0">
        <div style="font-weight:700;font-size:14px;color:#333;margin-bottom:4px">12 rue des Lilas</div>
        <div style="font-size:12px;color:#666;margin-bottom:6px">69003 Lyon 3ème</div>
        <div style="display:inline-block;background:#46B962;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Bien cible</div>
      </div>`
    );

    // Add comparable markers — SELECTED (large, prominent)
    INITIAL_SELECTED.forEach((comp) => {
      const coords = COMP_COORDS[comp.id];
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
      const simClass = comp.similarite >= 80 ? '#46B962' : comp.similarite >= 60 ? '#d97706' : '#e74c3c';
      L.marker(coords, { icon, zIndexOffset: 500 }).addTo(map).bindPopup(
        `<div style="min-width:220px;padding:2px 0">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${comp.title}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px">${comp.addr} · ${comp.distance}</div>
          <div style="display:flex;gap:12px;margin-bottom:6px">
            <div><div style="font-size:10px;color:#999">Prix</div><div style="font-weight:700;font-size:13px">${comp.prix} €</div></div>
            <div><div style="font-size:10px;color:#999">Prix/m²</div><div style="font-weight:600;font-size:13px">${comp.prixM2} €</div></div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:6px">
            <span style="background:${simClass}22;color:${simClass};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.similarite}% sim.</span>
            <span style="background:#4a6cf722;color:#4a6cf7;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.donnees}% données</span>
          </div>
          <div style="display:inline-block;background:#46B962;color:white;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600">✓ Sélectionné</div>
        </div>`
      );
    });

    // Add comparable markers — OTHERS (medium, with rich popup + Ajouter button)
    INITIAL_OTHERS.forEach((comp) => {
      const coords = COMP_COORDS[comp.id];
      if (!coords) return;
      const color = sourceMarkerColor[comp.source] || '#999';
      const icon = L.divIcon({
        className: 'comp-marker-icon',
        html: `<div style="width:16px;height:16px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.25);cursor:pointer;opacity:0.85"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      // Parse meta for popup details
      const metaParts = comp.meta.split(' · ');
      const simColor = comp.simClass === 'high' ? '#46B962' : comp.simClass === 'mid' ? '#d97706' : '#e74c3c';
      L.marker(coords, { icon }).addTo(map).bindPopup(
        `<div style="min-width:220px;padding:2px 0">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${comp.title}</div>
          <div style="font-size:11px;color:#666;margin-bottom:6px">${metaParts.join(' · ')}</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <span style="background:${simColor}22;color:${simColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.simScore}</span>
            <span style="background:#88888822;color:#666;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${comp.donScore}</span>
          </div>
          <button onclick="window.__addComp&amp;&amp;window.__addComp('${comp.id}');this.textContent='✓ Ajouté';this.style.background='#46B962';this.style.color='white';this.style.borderColor='#46B962';this.disabled=true" style="width:100%;padding:6px 0;background:white;border:1.5px solid #46B962;color:#46B962;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Open Sans,sans-serif;transition:all 0.15s">+ Ajouter aux comparables</button>
        </div>`
      );
    });

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
      map.dragging.enable();
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
        map.dragging.enable();
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
      map.dragging.enable();
    }
  };

  return (
    <div className="step3-page">
      <style>{cssStyles}</style>

      <PropertyCard />
      <Stepper currentStep={3} />

      {/* Filter Panel */}
      <div className="filter-panel">
        <div className="filter-top">
          <div className="filter-top-left">
            <h3>Filtres</h3>
            <span className="result-count">{filteredCount} r&eacute;sultats</span>
          </div>
          <button className="btn-reset-filters">R&eacute;initialiser les filtres</button>
        </div>

        {/* Radius Slider */}
        <div className="radius-row">
          <div className="radius-label">Rayon</div>
          <span className="commune-badge">Lyon 3&egrave;me</span>
          <div className="radius-slider-wrap">
            <input
              type="range"
              className="radius-slider"
              min="100"
              max="5000"
              value={radius}
              step="100"
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ background: `linear-gradient(to right, #46B962 0%, #46B962 ${sliderPct}%, #eee ${sliderPct}%, #eee 100%)` }}
            />
            <div className="radius-slider-labels">
              <span>100m</span>
              <span>1km</span>
              <span>2km</span>
              <span>3km</span>
              <span>5km</span>
            </div>
          </div>
          <div className="radius-value">{formatRadius(radius)}</div>
        </div>

        {/* Filter Grid */}
        <div className="filter-grid">
          <div className="filter-item">
            <div className="filter-item-label">Source &amp; anciennet&eacute; max <span className="chip-close">&times;</span></div>
            <div className="source-checkboxes">
              <div className={`source-row${sourceDvf ? '' : ' disabled'}`}>
                <label className="source-cb-label">
                  <input type="checkbox" checked={sourceDvf} onChange={() => setSourceDvf(!sourceDvf)} />
                  <span className="source-dot dot-dvf" /> DVF
                </label>
                <input
                  type="range"
                  className="source-mini-slider"
                  min="1"
                  max="96"
                  value={delayDvf}
                  disabled={!sourceDvf}
                  onChange={(e) => setDelayDvf(Number(e.target.value))}
                />
                <span className="source-delay-value">{delayDvf} mois</span>
              </div>
              <div className={`source-row${sourceIdeeri ? '' : ' disabled'}`}>
                <label className="source-cb-label">
                  <input type="checkbox" checked={sourceIdeeri} onChange={() => setSourceIdeeri(!sourceIdeeri)} />
                  <span className="source-dot dot-ideeri" /> Bien vendus
                </label>
                <input
                  type="range"
                  className="source-mini-slider"
                  min="1"
                  max="96"
                  value={delayIdeeri}
                  disabled={!sourceIdeeri}
                  onChange={(e) => setDelayIdeeri(Number(e.target.value))}
                />
                <span className="source-delay-value">{delayIdeeri} mois</span>
              </div>
              <div className={`source-row${sourceEncours ? '' : ' disabled'}`}>
                <label className="source-cb-label">
                  <input type="checkbox" checked={sourceEncours} onChange={() => setSourceEncours(!sourceEncours)} />
                  <span className="source-dot dot-encours" /> En cours
                </label>
                <input
                  type="range"
                  className="source-mini-slider"
                  min="1"
                  max="36"
                  value={delayEncours}
                  disabled={!sourceEncours}
                  onChange={(e) => setDelayEncours(Number(e.target.value))}
                />
                <span className="source-delay-value">{delayEncours} mois</span>
              </div>
              <div className={`source-row${sourcePortail ? '' : ' disabled'}`}>
                <label className="source-cb-label">
                  <input type="checkbox" checked={sourcePortail} onChange={() => setSourcePortail(!sourcePortail)} />
                  <span className="source-dot dot-portail" /> Portails
                </label>
                <input
                  type="range"
                  className="source-mini-slider"
                  min="1"
                  max="36"
                  value={delayPortail}
                  disabled={!sourcePortail}
                  onChange={(e) => setDelayPortail(Number(e.target.value))}
                />
                <span className="source-delay-value">{delayPortail} mois</span>
              </div>
            </div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Type de bien <span className="chip-close">&times;</span></div>
            <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="appartement">Appartement</option>
              <option value="maison">Maison</option>
              <option value="tous">Tous types</option>
            </select>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Surface <span className="chip-close">&times;</span></div>
            <div className="filter-range">
              <input type="number" value={surfaceMin} min="0" max="500" onChange={(e) => setSurfaceMin(Number(e.target.value))} />
              <span className="sep">&agrave;</span>
              <input type="number" value={surfaceMax} min="0" max="500" onChange={(e) => setSurfaceMax(Number(e.target.value))} />
              <span className="unit">m&sup2;</span>
            </div>
            <div className="filter-hint">Bien cible : 72.5 m&sup2; &mdash; <strong style={{ color: '#46B962' }}>{filteredCount} biens</strong></div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Nombre de pi&egrave;ces <span className="chip-close">&times;</span></div>
            <div className="filter-range">
              <input type="number" value={piecesMin} min="1" max="10" onChange={(e) => setPiecesMin(Number(e.target.value))} />
              <span className="sep">&agrave;</span>
              <input type="number" value={piecesMax} min="1" max="10" onChange={(e) => setPiecesMax(Number(e.target.value))} />
              <span className="unit">pi&egrave;ces</span>
            </div>
            <div className="filter-hint">Bien cible : T3 &mdash; <strong style={{ color: '#46B962' }}>{filteredCount} biens</strong></div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Fourchette de prix <span className="chip-close">&times;</span></div>
            {(() => {
              // Distribution des biens par tranche de 10k€ (gaussienne ~ centrée 300k)
              // Total ≈ ALL_COMPS_COUNT sur la zone. Sert uniquement à afficher
              // les compteurs aux extrémités du slider.
              const PRICE_MIN_SCALE = 100000;
              const PRICE_MAX_SCALE = 600000;
              const biensAtPrice = (p) => {
                // Cloche centrée 300k€, σ ≈ 70k. Max ≈ 43 biens, min 2.
                const center = 300000;
                const sigma = 70000;
                const peak = 43;
                const val = peak * Math.exp(-Math.pow(p - center, 2) / (2 * sigma * sigma));
                return Math.max(2, Math.round(val));
              };
              const leftPct  = ((prixMin - PRICE_MIN_SCALE) / (PRICE_MAX_SCALE - PRICE_MIN_SCALE)) * 100;
              const rightPct = ((prixMax - PRICE_MIN_SCALE) / (PRICE_MAX_SCALE - PRICE_MIN_SCALE)) * 100;
              const nMin = biensAtPrice(prixMin);
              const nMax = biensAtPrice(prixMax);
              return (
                <>
                  <div className="price-dual">
                    <div className="price-dual-track" />
                    <div
                      className="price-dual-selected"
                      style={{
                        left: `calc(${Math.max(0, Math.min(100, leftPct))}% + 4px)`,
                        width: `calc(${Math.max(0, rightPct - leftPct)}% - 0px)`,
                      }}
                    />
                    <input
                      type="range"
                      min={PRICE_MIN_SCALE}
                      max={PRICE_MAX_SCALE}
                      step={5000}
                      value={prixMin}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setPrixMin(Math.min(v, prixMax - 5000));
                      }}
                      aria-label="Prix minimum"
                    />
                    <input
                      type="range"
                      min={PRICE_MIN_SCALE}
                      max={PRICE_MAX_SCALE}
                      step={5000}
                      value={prixMax}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setPrixMax(Math.max(v, prixMin + 5000));
                      }}
                      aria-label="Prix maximum"
                    />
                    <div className="price-dual-labels">
                      <span>
                        <strong>{(prixMin / 1000).toFixed(0)} k&euro;</strong> &middot;{' '}
                        <span className="count">{nMin} biens</span>
                      </span>
                      <span>
                        <strong>{(prixMax / 1000).toFixed(0)} k&euro;</strong> &middot;{' '}
                        <span className="count">{nMax} biens</span>
                      </span>
                    </div>
                  </div>
                  <div className="filter-hint" style={{ marginTop: 14 }}>
                    Soit {Math.round(prixMin / 72.5).toLocaleString('fr-FR')} &mdash; {Math.round(prixMax / 72.5).toLocaleString('fr-FR')} &euro;/m&sup2; &mdash;{' '}
                    <strong style={{ color: '#46B962' }}>{filteredCount} biens</strong> dans la fourchette
                  </div>
                </>
              );
            })()}
          </div>
          {/* Extra filters added dynamically */}
          {extraFilters.includes('dpe') && (
            <div className="filter-item">
              <div className="filter-item-label">DPE <span className="chip-close" onClick={() => removeExtraFilter('dpe')}>&times;</span></div>
              <select className="filter-select" defaultValue="all">
                <option value="all">Tous DPE</option>
                <option value="AB">A &ndash; B</option>
                <option value="CD">C &ndash; D</option>
                <option value="EFG">E &ndash; F &ndash; G</option>
              </select>
            </div>
          )}
          {extraFilters.includes('etage') && (
            <div className="filter-item">
              <div className="filter-item-label">&Eacute;tage <span className="chip-close" onClick={() => removeExtraFilter('etage')}>&times;</span></div>
              <div className="filter-range">
                <input type="number" defaultValue="0" min="0" max="30" />
                <span className="sep">&agrave;</span>
                <input type="number" defaultValue="10" min="0" max="30" />
              </div>
            </div>
          )}
          {extraFilters.includes('parking') && (
            <div className="filter-item">
              <div className="filter-item-label">Parking <span className="chip-close" onClick={() => removeExtraFilter('parking')}>&times;</span></div>
              <select className="filter-select" defaultValue="all">
                <option value="all">Indiff&eacute;rent</option>
                <option value="oui">Avec parking</option>
                <option value="non">Sans parking</option>
              </select>
            </div>
          )}
          {extraFilters.includes('exterieur') && (
            <div className="filter-item">
              <div className="filter-item-label">Ext&eacute;rieur <span className="chip-close" onClick={() => removeExtraFilter('exterieur')}>&times;</span></div>
              <select className="filter-select" defaultValue="all">
                <option value="all">Indiff&eacute;rent</option>
                <option value="balcon">Balcon / Terrasse</option>
                <option value="jardin">Jardin</option>
                <option value="aucun">Aucun</option>
              </select>
            </div>
          )}
          {extraFilters.includes('annee') && (
            <div className="filter-item">
              <div className="filter-item-label">Ann&eacute;e construction <span className="chip-close" onClick={() => removeExtraFilter('annee')}>&times;</span></div>
              <div className="filter-range">
                <input type="number" defaultValue="1950" min="1800" max="2026" />
                <span className="sep">&agrave;</span>
                <input type="number" defaultValue="2026" min="1800" max="2026" />
              </div>
            </div>
          )}
          {extraFilters.includes('etat') && (
            <div className="filter-item">
              <div className="filter-item-label">&Eacute;tat g&eacute;n&eacute;ral <span className="chip-close" onClick={() => removeExtraFilter('etat')}>&times;</span></div>
              <select className="filter-select" defaultValue="all">
                <option value="all">Tous &eacute;tats</option>
                <option value="neuf">Neuf / R&eacute;nov&eacute;</option>
                <option value="bon">Bon &eacute;tat</option>
                <option value="travaux">&Agrave; r&eacute;nover</option>
              </select>
            </div>
          )}
        </div>

        {/* Add More Filters */}
        {availableExtraFilters.length > 0 && (
          <div className="filter-add-row">
            <span style={{ fontSize: 11, color: '#949494', marginRight: 4 }}>Ajouter :</span>
            {availableExtraFilters.map((f) => (
              <button key={f.key} className="filter-chip-add" onClick={() => addExtraFilter(f.key)}>+ {f.label}</button>
            ))}
          </div>
        )}

        {/* Source Legend */}
        <div className="source-legend">
          <div className="source-item"><span className="source-dot dot-dvf" /> DVF (transactions r&eacute;elles)</div>
          <div className="source-item"><span className="source-dot dot-ideeri" /> Ideeri vendus</div>
          <div className="source-item"><span className="source-dot dot-encours" /> Ideeri en cours</div>
          <div className="source-item"><span className="source-dot dot-portail" /> Portails immo</div>
        </div>
      </div>

      {/* Results Banner */}
      <div className="results-banner">
        <div className="results-banner-count">{filteredCount}</div>
        <div className="results-banner-text">biens comparables trouv&eacute;s</div>
        <div className="results-banner-details">
          <span className="results-tag">{selected.length} s&eacute;lectionn&eacute;s</span>
          <span className="results-tag outline">{filteredCount - selected.length} disponibles</span>
        </div>
      </div>

      {/* Split View: Map + List */}
      <div className="split-view">
        <div className="map-card-comp">
          <div ref={mapRef} className="map-container" />
          {/* Draw controls — top left, below zoom */}
          <div className="map-draw-controls" style={{ top: 80, left: 12 }}>
            <button className={`map-draw-btn ${drawMode ? 'active' : ''}`} onClick={toggleDrawMode}>
              {drawMode ? '✕ Terminer le dessin' : '✏️ Dessiner une zone'}
            </button>
            {drawMode && (
              <div style={{ background: 'rgba(74,108,247,0.9)', color: 'white', padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 500, maxWidth: 160, textAlign: 'center' }}>
                Dessinez librement sur la carte, puis relâchez
              </div>
            )}
            {drawLayerRef.current && (
              <button className="map-draw-btn danger" onClick={clearDrawnZones}>
                🗑 Effacer les zones
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
                <div className="map-info-stat-label">dans le rayon</div>
              </div>
              <div className="map-info-divider" />
              <div className="map-info-stat">
                <div className="map-info-stat-val">{selected.length}</div>
                <div className="map-info-stat-label">s&eacute;lectionn&eacute;s</div>
              </div>
              <div className="map-info-divider" />
              <div className="map-info-stat">
                <div className="map-info-stat-val">4 172 &euro;</div>
                <div className="map-info-stat-label">moy. /m&sup2;</div>
              </div>
            </div>
            <div className="map-legend-inline">
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#46B962' }} /> Ideeri vendu</div>
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#4a6cf7' }} /> DVF</div>
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#f5a623' }} /> Ideeri en cours</div>
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#e74c3c' }} /> Portails</div>
            </div>
          </div>
        </div>

        {/* List Panel */}
        <div className="list-panel">
          <div className="section-label">S&eacute;lectionn&eacute;s ({selected.length})</div>
          {selected.map((c) => (
            <SelectedCompCard
              key={c.id}
              comp={c}
              onRemove={handleRemoveComparable}
              onOpenDrawer={setDrawerComp}
              weight={weights[c.id] !== undefined ? weights[c.id] : 0}
              onWeightChange={handleWeightChange}
            />
          ))}
          {others.length > 0 && <div className="section-label others">Autres ({others.length})</div>}
          {others.map((c) => (
            <CompactCompCard key={c.id} comp={c} onAdd={addToSelected} />
          ))}
        </div>
      </div>

      {/* Summary Table */}
      <div className="summary-card">
        <div className="summary-title">R&eacute;capitulatif</div>
        <table>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Comparable</th>
              <th>Source</th>
              <th className="t-adj">Pert.</th>
              <th className="t-price">Prix</th>
              <th className="t-price">Prix/m&sup2;</th>
              <th className="t-adj">Corr.</th>
              <th className="t-price">Ajust&eacute;/m&sup2;</th>
              <th className="t-adj">Poids</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {selected.map((c) => {
              const pertinence = Math.round((c.similarite || 0) * 0.6 + (c.donnees || 0) * 0.4);
              const pertCls = pertinence >= 80 ? 'pos' : pertinence >= 60 ? '' : 'neg';
              const sourceShort = c.source === 'dvf' ? 'DVF' : c.source === 'ideeri' ? 'Ideeri' : c.source === 'encours' ? 'En cours' : 'Portail';
              const dotCls = c.source === 'dvf' ? 'dot-dvf' : c.source === 'ideeri' ? 'dot-ideeri' : c.source === 'encours' ? 'dot-encours' : 'dot-portail';
              // Tentative de calcul Ajust\u00e9/m\u00b2 \u00e0 partir de prix/m\u00b2 et adjTotal
              const m2Num = parseInt(String(c.prixM2).replace(/\D/g, ''), 10) || 0;
              const adjPctMatch = String(c.adjTotal || '0%').replace(',', '.').match(/-?\d+(\.\d+)?/);
              const adjPct = adjPctMatch ? parseFloat(adjPctMatch[0]) * (String(c.adjTotal).startsWith('\u2212') ? -1 : 1) : 0;
              const adjustedM2 = Math.round(m2Num * (1 + adjPct / 100));
              return (
                <tr key={c.id}>
                  <td><strong>{c.title}</strong></td>
                  <td><span className={`source-dot ${dotCls}`} style={{ display: 'inline-block', marginRight: 4 }} />{sourceShort}</td>
                  <td className={`t-adj ${pertCls}`} style={pertCls === '' ? { color: '#d97706' } : {}}>{pertinence}%</td>
                  <td className="t-price">{c.prix} &euro;</td>
                  <td className="t-price">{c.prixM2} &euro;</td>
                  <td className={`t-adj ${c.adjTotalClass || ''}`}>{c.adjTotal}</td>
                  <td className="t-price">{adjustedM2 ? `${adjustedM2.toLocaleString('fr-FR')} \u20ac` : '\u2014'}</td>
                  <td className="t-adj">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={weights[c.id] !== undefined ? weights[c.id] : 0}
                      onChange={(e) => handleWeightChange(c.id, Number(e.target.value))}
                      className="t-weight-input"
                    />
                    <span style={{ marginLeft: 2, color: '#888', fontSize: 11 }}>%</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-trash"
                      onClick={() => handleRemoveComparable(c.id)}
                      title="Retirer ce comparable"
                      aria-label="Retirer"
                    >
                      &#128465;
                    </button>
                  </td>
                </tr>
              );
            })}
            {selected.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#999', padding: '20px 0', fontStyle: 'italic' }}>
                  Aucun comparable s\u00e9lectionn\u00e9
                </td>
              </tr>
            )}
            {selected.length > 0 && (() => {
              // Moyenne pond\u00e9r\u00e9e des prix/m\u00b2 ajust\u00e9s
              let sumW = 0;
              let sumWP = 0;
              selected.forEach((c) => {
                const w = weights[c.id] || 0;
                const m2Num = parseInt(String(c.prixM2).replace(/\D/g, ''), 10) || 0;
                const adjPctMatch = String(c.adjTotal || '0%').replace(',', '.').match(/-?\d+(\.\d+)?/);
                const adjPct = adjPctMatch ? parseFloat(adjPctMatch[0]) * (String(c.adjTotal).startsWith('\u2212') ? -1 : 1) : 0;
                const adjustedM2 = Math.round(m2Num * (1 + adjPct / 100));
                sumW += w;
                sumWP += adjustedM2 * w;
              });
              const avgM2 = sumW > 0 ? Math.round(sumWP / sumW) : 0;
              return (
                <tr className="t-avg">
                  <td colSpan={6} style={{ textAlign: 'right', paddingRight: 12 }}><strong>Moyenne pondérée :</strong></td>
                  <td className="t-price"><strong>{avgM2 ? `${avgM2.toLocaleString('fr-FR')} €/m²` : '—'}</strong></td>
                  <td className="t-adj"><strong>{sumW}%</strong></td>
                  <td></td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

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

      {/* Drawer d\u00e9tail comparable */}
      {drawerComp && (
        <ComparableDrawer comp={drawerComp} onClose={() => setDrawerComp(null)} />
      )}
    </div>
  );
}
