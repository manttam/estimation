import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import FreeDraw, { ALL, NONE } from 'leaflet-freedraw';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
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
    gap: 4px;
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
  .dot-portail { background: #e87722; }
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

  /* ═══ SPLIT VIEW ═══ */
  .split-view {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    height: 560px;
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
    width: 420px;
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
    font-size: 11px;
  }
  .summary-card th {
    background: #fafafa;
    padding: 8px 6px;
    text-align: left;
    font-weight: 500;
    color: #999;
    border-bottom: 1px solid #eee;
    white-space: nowrap;
    font-size: 11px;
  }
  .summary-card td {
    padding: 8px 6px;
    border-bottom: 1px solid #f5f5f5;
  }
  .t-price {
    font-weight: 600;
    text-align: right;
  }
  .t-adj {
    text-align: center;
    font-weight: 500;
  }
  .t-adj.pos { color: #46B962; }
  .t-adj.neg { color: #e74c3c; }
  .t-avg {
    background: #fafafa;
    font-weight: 600;
  }
  .t-avg td {
    color: #333;
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

// Selected comparable data matching the wireframe
const selectedComps = [
  {
    id: 'villeroy',
    title: 'T3 68m\u00b2 \u2014 8 rue Villeroy',
    addr: 'Lyon 3\u00e8me',
    source: 'dvf',
    sourceLabel: 'DVF',
    prix: '285 000',
    prixM2: '4 191',
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
    description: 'Bel appartement T3 traversant de 68m² au 3ème étage avec ascenseur. Séjour lumineux donnant sur cour arborée, cuisine équipée récente, deux chambres avec rangements. Parquet ancien, moulures. Cave et local vélo.',
    noPhoto: true,
  },
  {
    id: 'lacassagne',
    title: 'T3 75m\u00b2 \u2014 22 av. Lacassagne',
    addr: 'Lyon 3\u00e8me',
    source: 'ideeri',
    sourceLabel: 'Ideeri vendu',
    prix: '310 000',
    prixM2: '4 133',
    distance: '520m',
    venteLabel: '310 000 \u20ac',
    venteDetail: '4 133 \u20ac/m\u00b2 net vendeur',
    avisLabel: '305 000 \u20ac',
    avisDetail: '\u25b2 \u22121.6% vs vente \u2014 Estimation pr\u00e9cise',
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
  },
  {
    id: 'paulbert',
    title: 'T2 62m\u00b2 \u2014 15 rue Paul Bert',
    addr: 'Lyon 3\u00e8me',
    source: 'encours',
    sourceLabel: 'En cours',
    prix: '265 000',
    prixM2: '4 274',
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
  },
];

const otherComps = [
  { id: 'duguesclin', title: 'T3 70m\u00b2 \u2014 5 rue Duguesclin, Lyon 3', source: 'dvf', meta: 'DVF \u00b7 295k\u20ac \u00b7 4 214\u20ac/m\u00b2 \u00b7 750m', simScore: '84% sim.', simClass: 'high', donScore: '62% donn\u00e9es', donClass: 'mid', donCount: '113/182' },
  { id: 'lafayette', title: 'T4 85m\u00b2 \u2014 18 cours Lafayette, Lyon 3', source: 'portail', meta: 'Portail \u00b7 340k\u20ac \u00b7 4 000\u20ac/m\u00b2 \u00b7 890m', simScore: '58% sim.', simClass: 'mid', donScore: '5% donn\u00e9es', donClass: 'low', donCount: '9/182' },
  { id: 'mazenod', title: 'T2 55m\u00b2 \u2014 33 rue Mazenod, Lyon 3', source: 'dvf', meta: 'DVF \u00b7 240k\u20ac \u00b7 4 363\u20ac/m\u00b2 \u00b7 420m', simScore: '71% sim.', simClass: 'mid', donScore: '68% donn\u00e9es', donClass: 'mid', donCount: '124/182' },
  { id: 'guichard', title: 'T3 71m\u00b2 \u2014 7 place Guichard, Lyon 3', source: 'ideeri', meta: 'Ideeri \u00b7 298k\u20ac \u00b7 4 197\u20ac/m\u00b2 \u00b7 310m', simScore: '89% sim.', simClass: 'high', donScore: '93% donn\u00e9es', donClass: 'high', donCount: '538/575' },
  { id: 'felixfaure', title: 'T3 69m\u00b2 \u2014 42 av. F\u00e9lix Faure, Lyon 3', source: 'portail', meta: 'Portail \u00b7 289k\u20ac \u00b7 4 188\u20ac/m\u00b2 \u00b7 1.1km', simScore: '76% sim.', simClass: 'mid', donScore: '7% donn\u00e9es', donClass: 'low', donCount: '13/182' },
];

function SelectedCompCard({ comp }) {
  return (
    <div className="comp-card selected">
      {comp.noPhoto ? (
        <div className="comp-card-photo no-photo">
          <span>Pas de photo &mdash; source {comp.sourceLabel}</span>
        </div>
      ) : (
        <div className="comp-card-photo" style={{ background: 'linear-gradient(135deg, #e8f5ee 0%, #d1ecdb 50%, #b8e0c8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: '#999' }}>Photo placeholder</span>
        </div>
      )}
      <div className="comp-card-header">
        <div>
          <div className="comp-card-title">{comp.title}</div>
          <div className="comp-card-addr">{comp.addr}</div>
        </div>
        <span className={`source-badge ${comp.source}`}>{comp.sourceLabel}</span>
      </div>
      <div className="comp-prices">
        <div className="p-item"><div className="p-label">Prix</div><div className="p-val">{comp.prix} &euro;</div></div>
        <div className="p-item"><div className="p-label">Prix/m&sup2;</div><div className="p-val">{comp.prixM2} &euro;</div></div>
        <div className="p-item"><div className="p-label">Distance</div><div className="p-val" style={{ color: '#4a6cf7' }}>{comp.distance}</div></div>
      </div>
      {comp.description && (
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
      <div className="scoring-row">
        <div className={`score-badge ${comp.simClass}`}>
          <span className="score-badge-label">Similarit&eacute;</span>
          <span className="score-badge-value">{comp.similarite}%</span>
          <span className="score-badge-bar"><span className="score-badge-fill" style={{ width: `${comp.similarite}%` }} /></span>
        </div>
        <div className={`score-badge ${comp.donClass}`}>
          <span className="score-badge-label">Donn&eacute;es</span>
          <span className="score-badge-value">{comp.donnees}%</span>
          <span className="score-badge-bar"><span className="score-badge-fill" style={{ width: `${comp.donnees}%` }} /></span>
          <span className="data-count">{comp.donCount}</span>
        </div>
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
      <div className="comp-actions">
        <a className="link-edit">&#9998; Modifier ajustement</a>
        <button className="btn-remove">&times; Retirer</button>
      </div>
    </div>
  );
}

function CompactCompCard({ comp }) {
  const dotClass = comp.source === 'dvf' ? 'dot-dvf' : comp.source === 'ideeri' ? 'dot-ideeri' : comp.source === 'encours' ? 'dot-encours' : 'dot-portail';
  return (
    <div className="comp-card compact">
      <div className="compact-row">
        <div className="compact-left">
          <div className="compact-title">{comp.title}</div>
          <div className="compact-meta"><span className={`source-dot ${dotClass}`} /> {comp.meta}</div>
          <div className="compact-scores">
            <span className={`compact-score ${comp.simClass}`}>{comp.simScore}</span>
            <span className={`compact-score ${comp.donClass}`}>{comp.donScore}</span>
            <span className="data-count">{comp.donCount}</span>
          </div>
        </div>
        <button className="btn-add">+ Ajouter</button>
      </div>
    </div>
  );
}

export default function Step3Comparables() {
  const navigate = useNavigate();
  const [radius, setRadius] = useState(1000);
  const [mapStyle, setMapStyle] = useState('plan');
  const [dateSlider, setDateSlider] = useState(12);
  const [drawMode, setDrawMode] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawLayerRef = useRef(null);
  const drawHandlerRef = useRef(null);
  const freeDrawRef = useRef(null);

  const formatRadius = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} km` : `${v}m`);
  const sliderPct = ((radius - 100) / (5000 - 100)) * 100;

  // Source → marker color mapping
  const sourceMarkerColor = {
    dvf: '#4a6cf7',
    ideeri: '#46B962',
    encours: '#f5a623',
    portail: '#e87722',
  };

  // Initialize Leaflet map with markers and draw tool
  useEffect(() => {
    if (mapInstanceRef.current) return;
    if (!L || !mapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(TARGET_COORDS, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Radius circle
    L.circle(TARGET_COORDS, { radius: 1000, color: '#46B962', weight: 2, opacity: 0.6, fillColor: '#46B962', fillOpacity: 0.06, dashArray: '8, 6' }).addTo(map);

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
    selectedComps.forEach((comp) => {
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
    otherComps.forEach((comp) => {
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
          <button onclick="this.textContent='✓ Ajouté';this.style.background='#46B962';this.style.color='white';this.style.borderColor='#46B962'" style="width:100%;padding:6px 0;background:white;border:1.5px solid #46B962;color:#46B962;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Open Sans,sans-serif;transition:all 0.15s">+ Ajouter aux comparables</button>
        </div>`
      );
    });

    // Drawing layer for user-drawn zones
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawLayerRef.current = drawnItems;

    // FreeDraw for freehand polygon drawing
    const freeDraw = new FreeDraw({
      mode: NONE,
      strokeWidth: 2,
      leaveModeAfterCreate: true,
      maximumPolygons: 10,
    });
    map.addLayer(freeDraw);
    freeDrawRef.current = freeDraw;

    // Style freedraw polygons after creation
    freeDraw.on('markers', (event) => {
      freeDraw.all().forEach((polygon) => {
        polygon.setStyle({
          color: '#4a6cf7',
          weight: 2,
          fillColor: '#4a6cf7',
          fillOpacity: 0.12,
          dashArray: '6, 4',
        });
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Toggle freehand drawing mode (FreeDraw)
  const toggleDrawMode = () => {
    if (!freeDrawRef.current) return;

    if (drawMode) {
      // Exit draw mode
      freeDrawRef.current.mode(NONE);
      setDrawMode(false);
    } else {
      // Enter freehand draw mode
      freeDrawRef.current.mode(ALL);
      setDrawMode(true);
    }
  };

  // Clear all drawn zones
  const clearDrawnZones = () => {
    if (freeDrawRef.current) {
      freeDrawRef.current.clear();
      freeDrawRef.current.mode(NONE);
    }
    if (drawLayerRef.current) {
      drawLayerRef.current.clearLayers();
    }
    setDrawMode(false);
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
            <span className="result-count">47 r&eacute;sultats</span>
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
            <div className="filter-item-label">Source <span className="chip-close">&times;</span></div>
            <div className="source-checkboxes">
              <label className="source-cb-label"><input type="checkbox" defaultChecked /> <span className="source-dot dot-dvf" /> DVF</label>
              <label className="source-cb-label"><input type="checkbox" defaultChecked /> <span className="source-dot dot-ideeri" /> Ideeri vendus</label>
              <label className="source-cb-label"><input type="checkbox" defaultChecked /> <span className="source-dot dot-encours" /> En cours</label>
              <label className="source-cb-label"><input type="checkbox" defaultChecked /> <span className="source-dot dot-portail" /> Portails</label>
            </div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Type de bien <span className="chip-close">&times;</span></div>
            <select className="filter-select">
              <option value="appartement">Appartement</option>
              <option value="maison">Maison</option>
              <option value="tous">Tous types</option>
            </select>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Surface <span className="chip-close">&times;</span></div>
            <div className="filter-range">
              <input type="number" defaultValue="55" min="0" max="500" />
              <span className="sep">&agrave;</span>
              <input type="number" defaultValue="90" min="0" max="500" />
              <span className="unit">m&sup2;</span>
            </div>
            <div className="filter-hint">Bien cible : 72.5 m&sup2; &mdash; <strong style={{ color: '#46B962' }}>8 biens</strong></div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Nombre de pi&egrave;ces <span className="chip-close">&times;</span></div>
            <div className="filter-range">
              <input type="number" defaultValue="2" min="1" max="10" />
              <span className="sep">&agrave;</span>
              <input type="number" defaultValue="4" min="1" max="10" />
              <span className="unit">pi&egrave;ces</span>
            </div>
            <div className="filter-hint">Bien cible : T3 &mdash; <strong style={{ color: '#46B962' }}>8 biens</strong></div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Fourchette de prix <span className="chip-close">&times;</span></div>
            <div className="filter-range">
              <input type="number" defaultValue="200000" min="0" max="2000000" step="5000" />
              <span className="sep">&agrave;</span>
              <input type="number" defaultValue="400000" min="0" max="2000000" step="5000" />
              <span className="unit">&euro;</span>
            </div>
            <div className="filter-hint">Soit 2 759 &mdash; 5 517 &euro;/m&sup2; &mdash; <strong style={{ color: '#46B962' }}>8 biens</strong></div>
          </div>
          <div className="filter-item">
            <div className="filter-item-label">Anciennet&eacute; max <span className="chip-close">&times;</span></div>
            <div className="filter-range">
              <input
                type="range"
                className="filter-slider"
                min="1"
                max="36"
                value={dateSlider}
                onChange={(e) => setDateSlider(Number(e.target.value))}
              />
              <span className="unit" style={{ minWidth: 55, textAlign: 'right', fontWeight: 600, color: '#46B962' }}>{dateSlider} mois</span>
            </div>
            <div className="filter-hint">Transactions ou mises en vente depuis &mdash; <strong style={{ color: '#46B962' }}>8 biens</strong></div>
          </div>
        </div>

        {/* Add More Filters */}
        <div className="filter-add-row">
          <span style={{ fontSize: 11, color: '#949494', marginRight: 4 }}>Ajouter :</span>
          {['DPE', '\u00c9tage', 'Parking', 'Ext\u00e9rieur', 'Ann\u00e9e construction', '\u00c9tat g\u00e9n\u00e9ral'].map((f) => (
            <button key={f} className="filter-chip-add">+ {f}</button>
          ))}
        </div>

        {/* Source Legend */}
        <div className="source-legend">
          <div className="source-item"><span className="source-dot dot-dvf" /> DVF (transactions r&eacute;elles)</div>
          <div className="source-item"><span className="source-dot dot-ideeri" /> Ideeri vendus</div>
          <div className="source-item"><span className="source-dot dot-encours" /> Ideeri en cours</div>
          <div className="source-item"><span className="source-dot dot-portail" /> Portails immo</div>
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
                <div className="map-info-stat-val">47</div>
                <div className="map-info-stat-label">dans le rayon</div>
              </div>
              <div className="map-info-divider" />
              <div className="map-info-stat">
                <div className="map-info-stat-val">3</div>
                <div className="map-info-stat-label">s&eacute;lectionn&eacute;s</div>
              </div>
              <div className="map-info-divider" />
              <div className="map-info-stat">
                <div className="map-info-stat-val">4 172 &euro;</div>
                <div className="map-info-stat-label">moy. /m&sup2;</div>
              </div>
            </div>
            <div className="map-legend-inline">
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#4a6cf7' }} /> DVF</div>
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#46B962' }} /> Ideeri</div>
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#f5a623' }} /> En cours</div>
              <div className="map-legend-item"><span className="legend-dot" style={{ background: '#e87722' }} /> Portail</div>
            </div>
          </div>
        </div>

        {/* List Panel */}
        <div className="list-panel">
          <div className="section-label">S&eacute;lectionn&eacute;s (3)</div>
          {selectedComps.map((c) => (
            <SelectedCompCard key={c.id} comp={c} />
          ))}
          <div className="section-label others">Autres (5)</div>
          {otherComps.map((c) => (
            <CompactCompCard key={c.id} comp={c} />
          ))}
        </div>
      </div>

      {/* Summary Table */}
      <div className="summary-card">
        <div className="summary-title">R&eacute;capitulatif</div>
        <table>
          <thead>
            <tr>
              <th>Comparable</th>
              <th>Source</th>
              <th className="t-adj">Sim.</th>
              <th className="t-adj">Donn&eacute;es</th>
              <th className="t-price">Prix</th>
              <th className="t-price">Prix/m&sup2;</th>
              <th className="t-adj">Total adj.</th>
              <th className="t-price">Ajust&eacute;/m&sup2;</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>T3 68m&sup2; &mdash; Villeroy</strong></td>
              <td><span className="source-dot dot-dvf" style={{ display: 'inline-block', marginRight: 4 }} />DVF</td>
              <td className="t-adj pos">87%</td>
              <td className="t-adj" style={{ color: '#d97706' }}>68%</td>
              <td className="t-price">285 000 &euro;</td>
              <td className="t-price">4 191 &euro;</td>
              <td className="t-adj neg">&minus;2.1%</td>
              <td className="t-price">4 103 &euro;</td>
            </tr>
            <tr>
              <td><strong>T3 75m&sup2; &mdash; Lacassagne</strong></td>
              <td><span className="source-dot dot-ideeri" style={{ display: 'inline-block', marginRight: 4 }} />Ideeri</td>
              <td className="t-adj pos">92%</td>
              <td className="t-adj pos">95%</td>
              <td className="t-price">310 000 &euro;</td>
              <td className="t-price">4 133 &euro;</td>
              <td className="t-adj pos">+1.5%</td>
              <td className="t-price">4 195 &euro;</td>
            </tr>
            <tr>
              <td><strong>T2 62m&sup2; &mdash; Paul Bert</strong></td>
              <td><span className="source-dot dot-encours" style={{ display: 'inline-block', marginRight: 4 }} />En cours</td>
              <td className="t-adj" style={{ color: '#d97706' }}>61%</td>
              <td className="t-adj neg">7%</td>
              <td className="t-price">265 000 &euro;</td>
              <td className="t-price">4 274 &euro;</td>
              <td className="t-adj neg">&minus;3.8%</td>
              <td className="t-price">4 113 &euro;</td>
            </tr>
            <tr className="t-avg">
              <td colSpan={7} style={{ textAlign: 'right', paddingRight: 12 }}><strong>Moyenne pond&eacute;r&eacute;e :</strong></td>
              <td className="t-price"><strong>4 172 &euro;/m&sup2;</strong></td>
            </tr>
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
    </div>
  );
}
