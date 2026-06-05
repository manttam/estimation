import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import PhotoUploader from '../components/PhotoUploader';
import Step1EditDrawer from '../components/Step1EditDrawer';
import { avisValeur } from '../data/propertyData';
import { PROPERTY_PHOTOS } from '../data/propertyPhotos';
import { getActiveBien } from '../utils/activeBien';
import { getAllPhotos, deletePhoto, getPhotosByRoom } from '../utils/photosStore';
import CadastrePLUCards from '../components/CadastrePLUCards';
import {
  sectionsGenerales,
  roomFieldSchema,
  ROOM_TYPES,
  roomTypeLabel,
  roomPhotoType,
  buildRoomsFromActiveBien,
  createEmptyRoom,
  buildInitialBienDetails,
} from '../data/step1Schema';
import {
  mergeReportSection,
  getReportSection,
  getReportState,
  setReportState,
} from '../utils/reportStore';

// Fix default Leaflet marker icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const missingCriticalFields = [
  'Garage / Box ferm\u00e9',
  'Hauteur sous plafond',
  'Fissures structurelles',
  'Toiture \u00e9tat',
  'Type de vitrage',
];

// Photos custom du bien actif : Vite scanne le dossier au build et inclut
// chaque image dans le bundle (avec hash de cache busting). Pour ajouter des
// photos, il suffit de les deposer dans app/src/photos-bien-actif/ avec le
// nom <type>-<XX>-<label>.<ext>. Voir le README dans ce dossier.
const PHOTO_TYPE_VALUES = ['salon', 'cuisine', 'chambre', 'sdb', 'wc', 'bureau', 'exterieur', 'autre'];

// `eager: true` => les URLs sont resolues au build, pas de fetch runtime.
const customPhotoModules = import.meta.glob(
  '../photos-bien-actif/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, import: 'default' }
);

function parsePhotoFilename(filename) {
  // ex: "salon-01-vue-cheminee.jpg" -> type="salon", order=1, label="Vue Cheminee"
  const name = filename.replace(/\.[^.]+$/, '');
  const parts = name.split('-');
  let type = 'autre';
  let order = 999;
  let labelParts = parts;

  if (parts.length > 0 && PHOTO_TYPE_VALUES.includes(parts[0].toLowerCase())) {
    type = parts[0].toLowerCase();
    labelParts = parts.slice(1);
  }
  if (labelParts.length > 0 && /^\d+$/.test(labelParts[0])) {
    order = parseInt(labelParts[0], 10);
    labelParts = labelParts.slice(1);
  }

  let label;
  if (labelParts.length > 0) {
    label = labelParts.join(' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } else {
    label = `${type.charAt(0).toUpperCase() + type.slice(1)} ${String(order).padStart(2, '0')}`;
  }
  return { type, order, label };
}

const CUSTOM_PHOTOS = Object.entries(customPhotoModules)
  .map(([path, url]) => {
    const filename = path.split('/').pop();
    const parsed = parsePhotoFilename(filename);
    return { ...parsed, url, filename };
  })
  .sort((a, b) => {
    const ta = PHOTO_TYPE_VALUES.indexOf(a.type);
    const tb = PHOTO_TYPE_VALUES.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    return a.order - b.order;
  })
  .map((p, i) => ({
    id: `custom-${i + 1}`,
    type: p.type,
    label: p.label,
    url: p.url,
  }));

const PHOTO_TYPES = [
  { value: 'all',       label: 'Toutes',        icon: '\ud83d\udcf8' },
  { value: 'salon',     label: 'Salon/S\u00e9jour',  icon: '\ud83d\udecb\ufe0f' },
  { value: 'cuisine',   label: 'Cuisine',       icon: '\ud83c\udf73' },
  { value: 'chambre',   label: 'Chambre',       icon: '\ud83d\udecf\ufe0f' },
  { value: 'sdb',       label: 'Salle de bain', icon: '\ud83d\udec1' },
  { value: 'wc',        label: 'WC',            icon: '\ud83d\udebd' },
  { value: 'bureau',    label: 'Bureau',        icon: '\ud83d\udcbc' },
  { value: 'exterieur', label: 'Ext\u00e9rieur',     icon: '\ud83c\udf3f' },
  { value: 'autre',     label: 'Autre',         icon: '\ud83c\udfe0' },
];

const cssStyles = `
  .step1-page {
    background: #fafafa;
    min-height: 100vh;
    padding-bottom: 32px;
    font-family: var(--font);
  }

  /* Workspace 2 colonnes redimensionnables (pattern Step3) */
  .step1-content {
    display: grid;
    grid-template-columns: var(--s1-col-main, 1fr) 6px var(--s1-col-side, 340px);
    gap: 0;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 20px;
    align-items: start;
  }

  .step1-left {
    min-width: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-content: start;
    padding-right: 16px;
  }
  /* Les libellés de groupe occupent toute la largeur des 2 colonnes */
  .step1-left > .step1-section-label { grid-column: 1 / -1; }
  /* Le bouton "Ajouter une pièce" et la zone de boutons : pleine largeur */
  .step1-left > .step1-add-room,
  .step1-left > .buttons-area { grid-column: 1 / -1; }

  .step1-resizer {
    align-self: stretch;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    border: none;
    padding: 0;
    position: relative;
  }
  .step1-resizer::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 50%;
    transform: translateX(-50%);
    width: 2px;
    background: var(--border, #e6e6e6);
    border-radius: 2px;
    transition: background 0.15s;
  }
  .step1-resizer:hover::before,
  .step1-resizer.is-dragging::before {
    background: var(--green, #46B962);
    width: 3px;
  }

  .step1-right {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-left: 16px;
  }

  /* SECTION TITLE */
  .step1-section-label {
    font-size: var(--fs-sm, 12px);
    font-weight: 700;
    color: #9a9a9a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 12px 0 2px;
  }
  .step1-section-label:first-child { margin-top: 0; }

  /* READ-ONLY CARD (section générale ou pièce) */
  .info-card {
    background: white;
    border: 1px solid var(--border, #eee);
    border-radius: var(--radius-card, 10px);
    overflow: hidden;
  }
  .info-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid #f2f2f2;
  }
  .info-card-head-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }
  .info-card-btn.ghost-photos {
    padding: 3px 10px;
    font-size: var(--fs-xs, 11px);
    color: #4a6cf7;
    border-color: #dfe4fb;
    background: #f5f7ff;
  }
  .info-card-btn.ghost-photos:hover {
    color: #3a55d9;
    border-color: #4a6cf7;
    background: #eef1ff;
  }
  .info-card-title {
    font-size: var(--fs-md, 14px);
    font-weight: 700;
    color: var(--text, #222);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .info-card-sub {
    font-size: var(--fs-sm, 12px);
    color: #999;
    font-weight: 500;
    margin-left: 4px;
  }
  .info-card-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .info-card-btn {
    padding: 5px 12px;
    border-radius: 7px;
    font-size: var(--fs-sm, 12px);
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border, #e6e6e6);
    background: #fff;
    color: #444;
    font-family: inherit;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .info-card-btn:hover {
    border-color: var(--green, #46B962);
    color: var(--green-dark, #3da856);
    background: rgba(70, 185, 98, 0.05);
  }
  .info-card-btn.danger:hover {
    border-color: var(--red, #e74c3c);
    color: var(--red, #e74c3c);
    background: #fef2f2;
  }

  .info-card-body {
    padding: 14px 16px;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px 18px;
  }
  .info-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .info-row.full { grid-column: 1 / -1; }
  .info-row-label {
    font-size: var(--fs-xs, 11px);
    color: #999;
    font-weight: 500;
  }
  .info-row-value {
    font-size: var(--fs-base, 13px);
    color: var(--text, #333);
    font-weight: 500;
    word-break: break-word;
  }
  .info-row-value.empty {
    color: #c0c0c0;
    font-style: italic;
    font-weight: 400;
  }
  .info-card-empty {
    font-size: var(--fs-base, 13px);
    color: #bbb;
    font-style: italic;
    text-align: center;
    padding: 6px 0;
  }

  .step1-add-room {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: var(--radius-card, 10px);
    border: 1px dashed #d0d0d0;
    background: #fff;
    cursor: pointer;
    font-size: var(--fs-base, 13px);
    font-weight: 600;
    color: #666;
    font-family: inherit;
    transition: all 0.15s;
    width: 100%;
  }
  .step1-add-room:hover {
    border-color: var(--green, #46B962);
    color: var(--green-dark, #3da856);
    background: rgba(70, 185, 98, 0.04);
  }

  /* SIDEBAR SECTIONS */
  .photos-section {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 16px;
  }

  .photos-header {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .photos-count-inline {
    font-size: 11px;
    color: #555;
    background: #f0f0f0;
    padding: 2px 10px;
    border-radius: var(--radius-card);
    font-weight: 500;
  }

  /* Filtres par type de pi\u00e8ce */
  .photos-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 12px;
  }

  .photo-filter {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid #e5e5e5;
    background: white;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 500;
    color: #555;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .photo-filter:hover {
    border-color: #4a6cf7;
    color: #4a6cf7;
  }

  .photo-filter.active {
    background: #4a6cf7;
    color: white;
    border-color: #4a6cf7;
  }

  .photo-filter .filter-count {
    font-size: 10px;
    opacity: 0.75;
    background: rgba(0,0,0,0.05);
    padding: 1px 6px;
    border-radius: 8px;
    margin-left: 2px;
  }

  .photo-filter.active .filter-count {
    background: rgba(255,255,255,0.2);
  }

  /* Grille miniatures */
  .photos-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .photo-thumb-wrapper {
    position: relative;
    aspect-ratio: 1;
  }

  .photo-thumb {
    position: relative;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    background: #f0f0f0;
    border: none;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }

  .photo-thumb:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  }

  .photo-thumb-delete {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.7);
    color: white;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: inherit;
    transition: background 0.15s, transform 0.1s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .photo-thumb-delete:hover {
    background: #d33;
    transform: scale(1.1);
  }
  .photo-thumb-delete:focus-visible {
    outline: 2px solid #4a6cf7;
    outline-offset: 2px;
  }

  .photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .photo-thumb-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
    color: white;
    padding: 14px 8px 6px;
    font-size: 10px;
    font-weight: 500;
    text-align: left;
    opacity: 0;
    transition: opacity 0.18s;
    pointer-events: none;
  }

  .photo-thumb:hover .photo-thumb-label,
  .photo-thumb:focus-visible .photo-thumb-label {
    opacity: 1;
  }

  .photos-empty {
    padding: 20px 12px;
    text-align: center;
    color: #888;
    font-size: 12px;
    background: #f7f7f7;
    border-radius: 8px;
  }

  /* Lightbox */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: lb-fadein 0.15s ease-out;
  }

  @keyframes lb-fadein {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .lightbox-content {
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .lightbox-content img {
    max-width: 100%;
    max-height: 78vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.5);
  }

  .lightbox-caption {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    color: white;
    flex-wrap: wrap;
    justify-content: center;
  }

  .lightbox-type {
    background: rgba(255,255,255,0.15);
    padding: 6px 12px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 600;
  }

  .lightbox-label {
    font-size: 14px;
    color: rgba(255,255,255,0.85);
  }

  .lightbox-counter {
    font-size: 12px;
    color: rgba(255,255,255,0.55);
    font-variant-numeric: tabular-nums;
  }

  .lightbox-close,
  .lightbox-nav {
    position: absolute;
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, transform 0.15s;
    font-family: inherit;
    line-height: 1;
  }

  .lightbox-close:hover,
  .lightbox-nav:hover {
    background: rgba(255,255,255,0.25);
  }

  .lightbox-close {
    top: 24px;
    right: 24px;
    width: 44px;
    height: 44px;
    font-size: 28px;
    font-weight: 300;
  }

  .lightbox-nav {
    top: 50%;
    transform: translateY(-50%);
    width: 56px;
    height: 56px;
    font-size: 40px;
    font-weight: 300;
    padding-bottom: 4px;
  }

  .lightbox-nav:hover {
    transform: translateY(-50%) scale(1.05);
  }

  .lightbox-prev { left: 24px; }
  .lightbox-next { right: 24px; }

  /* MAP */
  .map-section {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 16px;
  }

  .map-section .leaflet-container {
    width: 100%;
    height: 220px;
    border-radius: 8px;
    margin-bottom: 12px;
    border: 1px solid #e0e0e0;
    z-index: 0;
  }

  .map-address {
    font-size: 12px;
    color: #888;
    margin-bottom: 8px;
  }

  /* MEDIA MODAL (agrandissement Cadastre / Plan de zone) */
  .media-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .media-modal-content {
    position: relative;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .media-modal-content img {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    border-radius: 8px;
    background: white;
  }

  .media-modal-caption {
    color: white;
    text-align: center;
    font-size: 13px;
    background: rgba(0,0,0,0.4);
    padding: 8px 16px;
    border-radius: 6px;
    max-width: 90vw;
  }

  .media-modal-caption .mm-title {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 2px;
  }

  .media-modal-close {
    position: absolute;
    top: -38px;
    right: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .media-modal-close:hover {
    background: rgba(255,255,255,0.25);
  }

  /* ROOM PHOTOS POPUP (lecture seule) */
  .room-photos-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    animation: fadeIn 0.15s ease-out;
  }
  .room-photos-content {
    position: relative;
    background: white;
    border-radius: var(--radius-card, 10px);
    width: min(880px, 92vw);
    max-height: 86vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,0.28);
  }
  .room-photos-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border, #eee);
  }
  .room-photos-head h3 {
    margin: 0;
    font-size: var(--fs-lg, 16px);
    font-weight: 700;
    color: var(--text, #222);
  }
  .room-photos-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--border, #eee);
    background: #f6f6f6;
    color: #555;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .room-photos-close:hover { background: #ececec; color: #222; }
  .room-photos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    padding: 18px;
    overflow-y: auto;
  }
  .room-photo-cell {
    border: 1px solid var(--border, #eee);
    border-radius: 8px;
    overflow: hidden;
    background: #fafafa;
  }
  .room-photo-cell img {
    display: block;
    width: 100%;
    height: 140px;
    object-fit: cover;
  }
  .room-photo-cell .rp-label {
    padding: 6px 8px;
    font-size: var(--fs-xs, 11px);
    color: #555;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .room-photos-empty {
    padding: 36px 18px;
    text-align: center;
    color: #888;
    font-size: var(--fs-sm, 12px);
  }

  /* CRITICAL FIELDS */
  .critical-section {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 16px;
  }

  .critical-header {
    font-size: 13px;
    font-weight: 700;
    color: #f5a623;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .critical-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .critical-item {
    font-size: 12px;
    color: var(--red);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
    padding: 6px 8px;
    border-radius: 6px;
  }

  .critical-item:hover {
    background: rgba(231, 76, 60, 0.1);
  }

  /* NOTES */
  .notes-section {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 16px;
  }

  .notes-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 12px;
  }

  .notes-textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    min-height: 100px;
    transition: all 0.2s;
    box-sizing: border-box;
    color: #333;
    outline: none;
  }

  .notes-textarea:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
  }

  .notes-textarea::placeholder {
    color: #bbb;
  }

  /* ---- Points forts / vigilance + avis vendeur (déplacés depuis Step5) ---- */
  .appraisal-card {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 16px;
  }
  .appraisal-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 12px;
  }
  .appraisal-hint {
    font-size: 10px;
    color: #bbb;
    font-weight: 400;
  }
  .appraisal-item {
    display: flex;
    gap: 8px;
    padding: 6px 0;
    font-size: 12px;
    color: var(--text);
    align-items: flex-start;
    position: relative;
  }
  .appraisal-icon {
    font-size: 14px;
    flex-shrink: 0;
    opacity: 0.85;
  }
  .appraisal-text {
    flex: 1;
    font-size: 12px;
    color: #333;
    outline: none;
  }
  .appraisal-text[contenteditable="true"]:focus {
    border-bottom: 1px dashed var(--green);
    padding-bottom: 1px;
  }
  .appraisal-del {
    display: none;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #eee;
    background: white;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #bbb;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .appraisal-item:hover .appraisal-del { display: flex; }
  .appraisal-del:hover {
    border-color: var(--red);
    color: var(--red);
    background: #fef2f2;
  }
  .appraisal-add {
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
    font-family: inherit;
  }
  .appraisal-add:hover {
    border-color: var(--green);
    color: var(--green);
    background: rgba(70, 185, 98, 0.04);
  }
  .seller-opinion-input {
    width: 100%;
    box-sizing: border-box;
    min-height: 90px;
    padding: 10px 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    background: #fafbfd;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .seller-opinion-input:focus {
    border-color: var(--green);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
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

  /* BUTTONS AREA */
  .buttons-area {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
  }

  .step1-page .btn {
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-size: var(--fs-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    font-family: inherit;
  }

  .step1-page .btn-primary {
    background: var(--green);
    color: white;
  }

  .step1-page .btn-primary:hover {
    background: var(--green-dark);
    box-shadow: 0 4px 12px rgba(70, 185, 98, 0.3);
  }

  .step1-page .btn-ghost {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .step1-page .btn-ghost:hover {
    background: #f9f9f9;
    border-color: var(--text);
  }

  @media (max-width: 1100px) {
    .step1-content {
      display: flex;
      flex-direction: column;
    }
    .step1-left { padding-right: 0; grid-template-columns: 1fr; }
    .step1-right { padding-left: 0; width: 100%; }
    .step1-resizer { display: none; }
    .info-grid { grid-template-columns: 1fr; }
    .photos-grid { grid-template-columns: repeat(4, 1fr); }
  }
`;

// Bornes de redimensionnement de la colonne principale (ratio 0..1).
const MIN_MAIN_RATIO = 0.45;
const MAX_MAIN_RATIO = 0.78;
const DEFAULT_MAIN_RATIO = 0.66;

// Construit le sous-titre d'une carte pièce : "X m²".
function roomSubtitle(room) {
  const s = room.surface;
  if (s !== undefined && s !== null && String(s).trim() !== '') {
    return `${s} m\u00b2`;
  }
  return '';
}

// Formate une valeur de champ pour l'affichage lecture seule.
function displayValue(field, value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  if (field.type === 'toggle') return value ? 'Oui' : 'Non';
  const unit = field.unit ? ` ${field.unit}` : '';
  return `${value}${unit}`;
}

export default function Step1BienCible() {
  // Bien actif (saisi via /nouveau-bien). Si null, on retombe sur les valeurs
  // demo (12 rue des Lilas, Lyon 3eme).
  const [activeBien] = useState(() => getActiveBien());

  // ---- Photos uploadées via PhotoUploader (IndexedDB) -------------------
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const uploadedUrlsRef = useRef(new Map());

  const buildUploadedFromRaw = (raw) => {
    const next = (raw || []).map((p) => {
      let url = uploadedUrlsRef.current.get(p.id);
      if (!url) {
        url = URL.createObjectURL(p.blob);
        uploadedUrlsRef.current.set(p.id, url);
      }
      return {
        id: `up-${p.id}`,
        rawId: p.id,
        type: p.type,
        label: p.label,
        order: p.order || 0,
        url,
      };
    });
    const liveIds = new Set((raw || []).map((p) => p.id));
    for (const [id, url] of uploadedUrlsRef.current.entries()) {
      if (!liveIds.has(id)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        uploadedUrlsRef.current.delete(id);
      }
    }
    next.sort((a, b) => {
      const ta = PHOTO_TYPE_VALUES.indexOf(a.type);
      const tb = PHOTO_TYPE_VALUES.indexOf(b.type);
      if (ta !== tb) return ta - tb;
      return a.order - b.order;
    });
    return next;
  };

  useEffect(() => {
    let alive = true;
    getAllPhotos()
      .then((raw) => { if (alive) setUploadedPhotos(buildUploadedFromRaw(raw)); })
      .catch((err) => console.error('[Step1] getAllPhotos', err));
    const urlsCache = uploadedUrlsRef.current;
    return () => {
      alive = false;
      for (const url of urlsCache.values()) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      urlsCache.clear();
    };
  }, []);

  // Cle forcant le remount du PhotoUploader quand une photo est supprimée
  // depuis le carrousel principal (sinon son state interne reste obsolète).
  const [uploaderKey, setUploaderKey] = useState(0);

  // Resync photos après modification d'une galerie pièce (dans le drawer).
  const refreshUploadedPhotos = async () => {
    try {
      const fresh = await getAllPhotos();
      setUploadedPhotos(buildUploadedFromRaw(fresh));
      setUploaderKey((k) => k + 1);
    } catch (err) {
      console.error('[Step1] refreshUploadedPhotos', err);
    }
  };

  const handleDeleteUploaded = async (rawId) => {
    if (!rawId) return;
    try {
      await deletePhoto(rawId);
      const fresh = await getAllPhotos();
      setUploadedPhotos(buildUploadedFromRaw(fresh));
      setUploaderKey((k) => k + 1);
      if (lightboxIndex !== null) setLightboxIndex(null);
    } catch (err) {
      console.error('[Step1] handleDeleteUploaded', err);
    }
  };

  // Catalogue photo effectif :
  // - mode live (bien actif) : uniquement les photos uploadées (zéro fake).
  // - mode démo : CUSTOM_PHOTOS > PROPERTY_PHOTOS.
  let photoCatalog;
  if (activeBien) {
    photoCatalog = uploadedPhotos;
  } else if (CUSTOM_PHOTOS.length > 0) {
    photoCatalog = CUSTOM_PHOTOS;
  } else {
    photoCatalog = PROPERTY_PHOTOS;
  }

  // ---- bienDetails (sections générales) persisté dans reportStore -------
  // Clé d'un champ section : `${section.key}__${field.key}`.
  // On hydrate depuis reportStore (saisies précédentes) en complétant avec
  // le pré-remplissage dérivé du bien actif (priorité aux saisies stockées).
  const [bienDetails, setBienDetails] = useState(() => {
    const stored = getReportSection('bienDetails', {});
    const prefill = buildInitialBienDetails(activeBien);
    return { ...prefill, ...stored };
  });

  useEffect(() => {
    mergeReportSection('bienDetails', bienDetails);
  }, [bienDetails]);

  const sectionFieldKey = (sectionKey, fieldKey) => `${sectionKey}__${fieldKey}`;

  const setSectionField = (sectionKey, fieldKey, value) => {
    setBienDetails((prev) => ({ ...prev, [sectionFieldKey(sectionKey, fieldKey)]: value }));
  };

  // ---- Pièces (state local persisté sous reportStore.rooms) --------------
  const [rooms, setRooms] = useState(() => {
    const stored = getReportSection('rooms', null);
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return buildRoomsFromActiveBien(activeBien);
  });

  useEffect(() => {
    mergeReportSection('rooms', rooms);
  }, [rooms]);

  const setRoomField = (roomId, fieldKey, value) => {
    setRooms((prev) => prev.map((r) => (
      r.id === roomId ? { ...r, fields: { ...r.fields, [fieldKey]: value } } : r
    )));
  };
  const setRoomName = (roomId, name) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, name } : r)));
  };
  const setRoomType = (roomId, type) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, type } : r)));
  };
  const addRoom = () => {
    const room = createEmptyRoom('autre');
    setRooms((prev) => [...prev, room]);
    setDrawer({ kind: 'room', roomId: room.id });
  };
  const removeRoom = (roomId) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  // ---- Drawer d'édition (section générale OU pièce) ----------------------
  // drawer = null | { kind: 'section', sectionKey } | { kind: 'room', roomId }
  const [drawer, setDrawer] = useState(null);
  const closeDrawer = () => setDrawer(null);

  const openSection = sectionsGenerales.find(
    (s) => drawer?.kind === 'section' && s.key === drawer.sectionKey
  );
  const openRoom = rooms.find((r) => drawer?.kind === 'room' && r.id === drawer.roomId);

  // ---- Pop-up galerie photos d'une pièce (lecture seule) -----------------
  // photoModal = null | { roomName, photos: [{ id, src, label }] }
  const [photoModal, setPhotoModal] = useState(null);
  const openRoomPhotos = async (room) => {
    try {
      const raw = await getPhotosByRoom(room.id);
      const photos = raw.map((p) => ({
        id: p.id,
        src: URL.createObjectURL(p.blob),
        label: p.label || '',
      }));
      setPhotoModal({ roomName: room.name || roomTypeLabel(room.type), photos });
    } catch (err) {
      console.error('[Step1] openRoomPhotos', err);
      setPhotoModal({ roomName: room.name || roomTypeLabel(room.type), photos: [] });
    }
  };
  const closeRoomPhotos = () => {
    setPhotoModal((cur) => {
      if (cur) cur.photos.forEach((p) => { try { URL.revokeObjectURL(p.src); } catch { /* ignore */ } });
      return null;
    });
  };
  // ESC ferme la pop-up galerie
  useEffect(() => {
    if (!photoModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeRoomPhotos(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoModal]);

  // ---- Colonnes redimensionnables ----------------------------------------
  const [mainRatio, setMainRatio] = useState(DEFAULT_MAIN_RATIO);
  const [dragging, setDragging] = useState(false);
  const contentRef = useRef(null);

  const startResize = (e) => {
    e.preventDefault();
    setDragging(true);
    const container = contentRef.current;
    if (!container) return;
    const onMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      let ratio = x / rect.width;
      if (ratio < MIN_MAIN_RATIO) ratio = MIN_MAIN_RATIO;
      if (ratio > MAX_MAIN_RATIO) ratio = MAX_MAIN_RATIO;
      setMainRatio(ratio);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };
  const resetResize = () => setMainRatio(DEFAULT_MAIN_RATIO);

  // ---- Mini-carte + adresse + Cadastre/PLU -------------------------------
  const DEMO_COORDS = [45.758, 4.859];
  const DEMO_ADDRESS_LINE1 = '12 rue des Lilas';
  const DEMO_ADDRESS_LINE2 = '69003 Lyon';

  const mapCenter = activeBien?.adresse?.coords || DEMO_COORDS;
  const cadastreLat = mapCenter[0];
  const cadastreLon = mapCenter[1];

  let addressLine1 = DEMO_ADDRESS_LINE1;
  let addressLine2 = DEMO_ADDRESS_LINE2;
  let cadastreAddress = `${DEMO_ADDRESS_LINE1}, ${DEMO_ADDRESS_LINE2}`;
  if (activeBien?.adresse?.label) {
    const label = activeBien.adresse.label;
    const postcode = activeBien.adresse.postcode || '';
    const city = activeBien.adresse.city || '';
    const tail = `${postcode} ${city}`.trim();
    if (tail && label.endsWith(tail)) {
      addressLine1 = label.slice(0, label.length - tail.length).trim();
    } else {
      addressLine1 = label;
    }
    addressLine2 = tail || addressLine2;
    cadastreAddress = label;
  }

  // ---- Points forts / vigilance + avis du vendeur ------------------------
  const hasRealLocation = !!(activeBien && activeBien.adresse && activeBien.adresse.label);

  const buildAutoPoints = () => {
    if (!hasRealLocation) {
      return { forts: avisValeur.pointsForts, vigilance: avisValeur.pointsVigilance };
    }
    if (!activeBien?.bien) return { forts: [], vigilance: [] };
    const bien = activeBien.bien;
    const forts = [];
    const vigilance = [];

    const dpe = bien.dpe ? String(bien.dpe).toUpperCase() : null;
    if (dpe && ['A', 'B', 'C'].includes(dpe)) forts.push(`DPE ${dpe} — bien performant énergétiquement`);
    else if (dpe && ['F', 'G'].includes(dpe)) vigilance.push(`DPE ${dpe} — passoire thermique (interdiction de location 2025/2028)`);
    else if (dpe === 'E') vigilance.push('DPE E — interdiction de location prévue en 2034');

    if (bien.type === 'appartement' && bien.etage != null && bien.etage !== '') {
      const e = Number(bien.etage);
      if (e === 0) vigilance.push('Rez-de-chaussée — vis-à-vis et sécurité à anticiper');
      else if (e >= 6 && !bien.ascenseur) vigilance.push(`${e}e étage sans ascenseur — frein commercial fort`);
      else if (e >= 3 && bien.ascenseur) forts.push(`${e}e étage avec ascenseur — vue dégagée et confort`);
    }

    if (bien.exposition && /sud/i.test(bien.exposition)) forts.push(`Exposition ${bien.exposition.replace('_', '-')} — luminosité optimale`);
    else if (bien.exposition === 'nord') vigilance.push('Exposition nord — luminosité réduite');

    if (bien.exterieur === 'jardin') forts.push('Jardin — atout différenciant rare en zone urbaine');
    else if (bien.exterieur === 'terrasse') forts.push('Terrasse — extérieur très recherché');
    else if (bien.exterieur === 'balcon') forts.push('Balcon — extérieur appréciable');
    else if (bien.exterieur === 'aucun' && bien.type === 'appartement') vigilance.push('Absence d\u2019extérieur — frein post-Covid');

    if (bien.parking === 'box') forts.push('Box / garage fermé — valorise le bien (+5%)');
    else if (bien.parking === 'place') forts.push('Place de parking — confort apprécié en centre-ville');
    else if (bien.parking === 'aucun') vigilance.push('Pas de stationnement — frein dans certains quartiers');

    if (bien.etat === 'neuf') forts.push('État neuf — aucun travaux à prévoir');
    else if (bien.etat === 'refait') forts.push('Récemment rénové — prêt à emménager');
    else if (bien.etat === 'a_renover') vigilance.push('À rénover — anticiper budget travaux');
    else if (bien.etat === 'a_reconstruire') vigilance.push('À reconstruire — projet lourd, public restreint');

    if (bien.annee) {
      const a = Number(bien.annee);
      if (a >= 2010) forts.push(`Construction ${a} — récent, normes thermiques actuelles`);
      else if (a < 1948) vigilance.push(`Construction ${a} — ancien, vigilance sur structure et isolation`);
    }
    return { forts, vigilance };
  };

  const [pointsForts, setPointsForts] = useState(() => {
    const st = getReportState();
    if (Array.isArray(st.pointsForts)) return st.pointsForts;
    return buildAutoPoints().forts;
  });
  const [pointsVigilance, setPointsVigilance] = useState(() => {
    const st = getReportState();
    if (Array.isArray(st.pointsVigilance)) return st.pointsVigilance;
    return buildAutoPoints().vigilance;
  });
  const [avisVendeur, setAvisVendeur] = useState(() => {
    const st = getReportState();
    return typeof st.avisVendeur === 'string' ? st.avisVendeur : '';
  });

  useEffect(() => { setReportState({ pointsForts }); }, [pointsForts]);
  useEffect(() => { setReportState({ pointsVigilance }); }, [pointsVigilance]);
  useEffect(() => { setReportState({ avisVendeur }); }, [avisVendeur]);

  const addPointFort = () => setPointsForts((prev) => [...prev, 'Nouveau point\u2026']);
  const addPointVigilance = () => setPointsVigilance((prev) => [...prev, 'Nouveau point\u2026']);
  const removePointFort = (idx) => setPointsForts((prev) => prev.filter((_, i) => i !== idx));
  const removePointVigilance = (idx) => setPointsVigilance((prev) => prev.filter((_, i) => i !== idx));

  // ---- Photos : filtre par type + lightbox -------------------------------
  const [photoFilter, setPhotoFilter] = useState('salon');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const filteredPhotos = photoFilter === 'all'
    ? photoCatalog
    : photoCatalog.filter((p) => p.type === photoFilter);

  const photoCountsByType = photoCatalog.reduce(
    (acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; },
    { all: photoCatalog.length }
  );

  const openLightbox = (idx) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i - 1 + filteredPhotos.length) % filteredPhotos.length);
  const nextPhoto = () => setLightboxIndex((i) => (i + 1) % filteredPhotos.length);

  const handleFilterChange = (value) => {
    setPhotoFilter(value);
    setLightboxIndex(null);
  };

  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const total = filteredPhotos.length;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i - 1 + total) % total);
      else if (e.key === 'ArrowRight') setLightboxIndex((i) => (i + 1) % total);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, filteredPhotos.length]);

  // ---- Modale média générique (Cadastre / Plan de zone) ------------------
  const [mediaModal, setMediaModal] = useState(null);
  const closeMediaModal = () => setMediaModal(null);

  useEffect(() => {
    if (!mediaModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMediaModal(null); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mediaModal]);

  // Grille de styles inline pour les colonnes redimensionnables.
  const contentStyle = {
    '--s1-col-main': `${(mainRatio * 100).toFixed(2)}%`,
    '--s1-col-side': `${((1 - mainRatio) * 100).toFixed(2)}%`,
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="step1-page">
        <PropertyCard />
        <Stepper currentStep={1} />

        <div className="step1-content" ref={contentRef} style={contentStyle}>
          {/* LEFT COLUMN : cartes lecture seule */}
          <div className="step1-left">
            <div className="step1-section-label">Informations générales</div>

            {sectionsGenerales.map((section) => {
              const filled = section.fields
                .map((f) => ({ field: f, value: displayValue(f, bienDetails[sectionFieldKey(section.key, f.key)]) }))
                .filter((x) => x.value !== null);
              return (
                <div key={section.key} className="info-card">
                  <div className="info-card-head">
                    <div className="info-card-head-left">
                      <h3 className="info-card-title">{section.title}</h3>
                    </div>
                    <div className="info-card-actions">
                      <button
                        type="button"
                        className="info-card-btn"
                        onClick={() => setDrawer({ kind: 'section', sectionKey: section.key })}
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                  <div className="info-card-body">
                    {filled.length > 0 ? (
                      <div className="info-grid">
                        {filled.map(({ field, value }) => (
                          <div
                            key={field.key}
                            className={`info-row${field.type === 'textarea' ? ' full' : ''}`}
                          >
                            <span className="info-row-label">{field.label}</span>
                            <span className="info-row-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="info-card-empty">Aucune valeur renseignée</div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="step1-section-label">Pièces du bien</div>

            {rooms.map((room) => {
              const filled = roomFieldSchema
                .map((f) => ({ field: f, value: displayValue(f, room.fields?.[f.key]) }))
                .filter((x) => x.value !== null);
              const sub = roomSubtitle(room);
              return (
                <div key={room.id} className="info-card">
                  <div className="info-card-head">
                    <div className="info-card-head-left">
                      <h3 className="info-card-title">{room.name || roomTypeLabel(room.type)}</h3>
                      {sub && <span className="info-card-sub">({sub})</span>}
                      <button
                        type="button"
                        className="info-card-btn ghost-photos"
                        onClick={() => openRoomPhotos(room)}
                      >
                        Photos
                      </button>
                    </div>
                    <div className="info-card-actions">
                      <button
                        type="button"
                        className="info-card-btn"
                        onClick={() => setDrawer({ kind: 'room', roomId: room.id })}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="info-card-btn danger"
                        onClick={() => removeRoom(room.id)}
                        aria-label={`Supprimer ${room.name || roomTypeLabel(room.type)}`}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <div className="info-card-body">
                    {filled.length > 0 ? (
                      <div className="info-grid">
                        {filled.map(({ field, value }) => (
                          <div
                            key={field.key}
                            className={`info-row${field.type === 'textarea' ? ' full' : ''}`}
                          >
                            <span className="info-row-label">{field.label}</span>
                            <span className="info-row-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="info-card-empty">Aucune valeur renseignée</div>
                    )}
                  </div>
                </div>
              );
            })}

            <button type="button" className="step1-add-room" onClick={addRoom}>
              + Ajouter une pièce
            </button>

            {/* BUTTONS */}
            <div className="buttons-area">
              <span className="btn btn-ghost">&larr; Retour</span>
              <Link to="/step/2" className="btn btn-primary">
                &Eacute;tape suivante : Contexte Zone &rarr;
              </Link>
            </div>
          </div>

          {/* RESIZER */}
          <button
            type="button"
            className={`step1-resizer${dragging ? ' is-dragging' : ''}`}
            onMouseDown={startResize}
            onTouchStart={startResize}
            onDoubleClick={resetResize}
            aria-label="Redimensionner les colonnes"
            title="Glisser pour redimensionner — double-clic pour réinitialiser"
          />

          {/* RIGHT SIDEBAR */}
          <div className="step1-right">
            {/* Panneau d'édition inline (section générale OU pièce) — en tête de colonne */}
            {openSection && (
              <Step1EditDrawer
                inline
                open
                title={openSection.title}
                subtitle="Informations générales"
                schema={openSection.fields}
                values={Object.fromEntries(
                  openSection.fields.map((f) => [f.key, bienDetails[sectionFieldKey(openSection.key, f.key)]])
                )}
                onField={(key, value) => setSectionField(openSection.key, key, value)}
                onClose={closeDrawer}
              />
            )}

            {openRoom && (
              <Step1EditDrawer
                key={openRoom.id}
                inline
                open
                title={openRoom.name || roomTypeLabel(openRoom.type)}
                subtitle="Détails de la pièce"
                schema={roomFieldSchema}
                values={openRoom.fields || {}}
                onField={(key, value) => setRoomField(openRoom.id, key, value)}
                onClose={closeDrawer}
                roomNameValue={openRoom.name}
                onRoomName={(v) => setRoomName(openRoom.id, v)}
                roomTypeValue={openRoom.type}
                onRoomType={(v) => setRoomType(openRoom.id, v)}
                roomTypeOptions={ROOM_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                photoRoomId={openRoom.id}
                photoRoomType={roomPhotoType(openRoom.type)}
                onPhotosChange={refreshUploadedPhotos}
              />
            )}

            {/* Photos */}
            <div className="photos-section">
              <div className="photos-header">
                <span>Photos du bien</span>
                <span className="photos-count-inline">{photoCatalog.length}</span>
              </div>

              <div className="photos-filters" role="tablist" aria-label="Filtrer les photos par pi\u00e8ce">
                {PHOTO_TYPES.filter((t) => t.value === 'all' || photoCountsByType[t.value]).map((t) => (
                  <button
                    key={t.value}
                    role="tab"
                    aria-selected={photoFilter === t.value}
                    className={`photo-filter ${photoFilter === t.value ? 'active' : ''}`}
                    onClick={() => handleFilterChange(t.value)}
                  >
                    <span className="filter-label">{t.label}</span>
                    <span className="filter-count">{photoCountsByType[t.value] || 0}</span>
                  </button>
                ))}
              </div>

              {filteredPhotos.length > 0 ? (
                <div className="photos-grid">
                  {filteredPhotos.map((p, idx) => (
                    <div key={p.id} className="photo-thumb-wrapper">
                      <button
                        type="button"
                        className="photo-thumb"
                        onClick={() => openLightbox(idx)}
                        aria-label={`Ouvrir ${p.label} en grand`}
                      >
                        <img src={p.url} alt={p.label} loading="lazy" />
                        <span className="photo-thumb-label">{p.label}</span>
                      </button>
                      {p.rawId && (
                        <button
                          type="button"
                          className="photo-thumb-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUploaded(p.rawId);
                          }}
                          aria-label={`Supprimer ${p.label}`}
                          title="Supprimer cette photo"
                        >&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="photos-empty">Aucune photo dans cette cat\u00e9gorie</div>
              )}

              {/* Uploader global : disponible des qu'il y a un bien actif. */}
              {activeBien && (
                <PhotoUploader
                  key={uploaderKey}
                  onChange={(raw) => setUploadedPhotos(buildUploadedFromRaw(raw))}
                />
              )}
            </div>

            {/* Lightbox plein \u00e9cran */}
            {lightboxIndex !== null && filteredPhotos[lightboxIndex] && (() => {
              const current = filteredPhotos[lightboxIndex];
              const typeMeta = PHOTO_TYPES.find((t) => t.value === current.type);
              return (
                <div
                  className="lightbox-overlay"
                  onClick={closeLightbox}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Visionneuse photos"
                >
                  <button
                    className="lightbox-close"
                    onClick={closeLightbox}
                    aria-label="Fermer la visionneuse"
                  >&times;</button>
                  {filteredPhotos.length > 1 && (
                    <button
                      className="lightbox-nav lightbox-prev"
                      onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                      aria-label="Photo pr\u00e9c\u00e9dente"
                    >&#8249;</button>
                  )}
                  <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                    <img src={current.url} alt={current.label} />
                    <div className="lightbox-caption">
                      <span className="lightbox-type">
                        {typeMeta?.label}
                      </span>
                      <span className="lightbox-label">{current.label}</span>
                      <span className="lightbox-counter">
                        {lightboxIndex + 1} / {filteredPhotos.length}
                      </span>
                    </div>
                  </div>
                  {filteredPhotos.length > 1 && (
                    <button
                      className="lightbox-nav lightbox-next"
                      onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                      aria-label="Photo suivante"
                    >&#8250;</button>
                  )}
                </div>
              );
            })()}

            {/* Modale m\u00e9dia g\u00e9n\u00e9rique (Cadastre / Plan de zone) */}
            {mediaModal && (
              <div
                className="media-modal-overlay"
                onClick={closeMediaModal}
                role="dialog"
                aria-modal="true"
                aria-label={mediaModal.title}
              >
                <div className="media-modal-content" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="media-modal-close"
                    onClick={closeMediaModal}
                    aria-label="Fermer"
                  >&times;</button>
                  <img src={mediaModal.url} alt={mediaModal.title} />
                  <div className="media-modal-caption">
                    <div className="mm-title">{mediaModal.title}</div>
                    {mediaModal.caption && <div>{mediaModal.caption}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Pop-up photos de la pi\u00e8ce (lecture seule) */}
            {photoModal && (
              <div
                className="room-photos-overlay"
                onClick={closeRoomPhotos}
                role="dialog"
                aria-modal="true"
                aria-label={`Photos ${photoModal.roomName}`}
              >
                <div className="room-photos-content" onClick={(e) => e.stopPropagation()}>
                  <div className="room-photos-head">
                    <h3>Photos &mdash; {photoModal.roomName}</h3>
                    <button
                      type="button"
                      className="room-photos-close"
                      onClick={closeRoomPhotos}
                      aria-label="Fermer"
                    >&times;</button>
                  </div>
                  {photoModal.photos.length === 0 ? (
                    <div className="room-photos-empty">Aucune photo associée à cette pièce.</div>
                  ) : (
                    <div className="room-photos-grid">
                      {photoModal.photos.map((p) => (
                        <div className="room-photo-cell" key={p.id}>
                          <img src={p.src} alt={p.label || photoModal.roomName} />
                          {p.label && <div className="rp-label">{p.label}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Map */}
            <div className="map-section">
              <MapContainer
                key={`${mapCenter[0]}-${mapCenter[1]}`}
                center={mapCenter}
                zoom={16}
                zoomControl={false}
                scrollWheelZoom={false}
                style={{ width: '100%', height: 220, borderRadius: 8, marginBottom: 12, border: '1px solid #e0e0e0', zIndex: 0 }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={mapCenter}>
                  <Popup>
                    <strong>{addressLine1}</strong><br />{addressLine2}
                  </Popup>
                </Marker>
              </MapContainer>
              <div className="map-address">
                <strong>{addressLine1}</strong><br />{addressLine2}
              </div>
            </div>

            {/* Cadastre + Plan de zone (data.gouv / IGN) */}
            <CadastrePLUCards lat={cadastreLat} lon={cadastreLon} address={cadastreAddress} />

            {/* Critical Fields */}
            <div className="critical-section">
              <div className="critical-header">
                Champs critiques manquants
              </div>
              <div className="critical-list">
                {missingCriticalFields.map((f, i) => (
                  <div key={i} className="critical-item">
                    &#x274C; {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="notes-section">
              <div className="notes-label">&#x1F4DD; Notes terrain</div>
              <textarea
                className="notes-textarea"
                placeholder="Observations de visite..."
              />
            </div>

            {/* Points forts */}
            <div className="appraisal-card strengths">
              <div className="appraisal-title">Points forts <span className="appraisal-hint">(cliquer pour modifier)</span></div>
              <div>
                {pointsForts.map((p, i) => (
                  <div key={i} className="appraisal-item">
                    <span className="appraisal-icon">&#10004;</span>
                    <span
                      className="appraisal-text"
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
                    <button className="appraisal-del" onClick={() => removePointFort(i)} title="Supprimer">&times;</button>
                  </div>
                ))}
              </div>
              <button className="appraisal-add" onClick={addPointFort}>+ Ajouter un point fort</button>
            </div>

            {/* Points de vigilance */}
            <div className="appraisal-card weaknesses">
              <div className="appraisal-title">Points de vigilance <span className="appraisal-hint">(cliquer pour modifier)</span></div>
              <div>
                {pointsVigilance.map((p, i) => (
                  <div key={i} className="appraisal-item">
                    <span className="appraisal-icon">&#9888;</span>
                    <span
                      className="appraisal-text"
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
                    <button className="appraisal-del" onClick={() => removePointVigilance(i)} title="Supprimer">&times;</button>
                  </div>
                ))}
              </div>
              <button className="appraisal-add" onClick={addPointVigilance}>+ Ajouter un point de vigilance</button>
            </div>

            {/* Avis du vendeur */}
            <div className="appraisal-card">
              <div className="appraisal-title">Avis du vendeur <span className="appraisal-hint">(perception du propri&eacute;taire)</span></div>
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
        </div>
      </div>
    </>
  );
}
