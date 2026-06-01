import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import PhotoUploader from '../components/PhotoUploader';
import { bienCibleCategories as bienCibleCategoriesBase } from '../data/propertyData';
import { PROPERTY_PHOTOS } from '../data/propertyPhotos';
import { getActiveBien, buildBienCibleCategories } from '../utils/activeBien';
import { getAllPhotos, deletePhoto } from '../utils/photosStore';
import CadastrePLUCards from '../components/CadastrePLUCards';
import { mergeReportSection, getReportSection, slugifyKey } from '../utils/reportStore';

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

  .step1-content {
    display: flex;
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .step1-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step1-right {
    width: 320px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ACCORDION */
  .accordion-item {
    background: white;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    overflow: hidden;
  }

  .accordion-header {
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: white;
    transition: all 0.2s;
    user-select: none;
  }

  .accordion-header:hover {
    background: #f9f9f9;
  }

  .accordion-header.open {
    border-bottom: 1px solid #eee;
  }

  .accordion-title-section {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .accordion-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .accordion-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .accordion-progress-bar {
    width: 40px;
    height: 4px;
    background: #f0f0f0;
    border-radius: 2px;
    overflow: hidden;
  }

  .accordion-progress-fill {
    height: 100%;
    background: var(--green);
    border-radius: 2px;
  }

  .accordion-progress-text {
    font-size: 12px;
    color: #888;
    font-weight: 500;
    min-width: 30px;
    text-align: right;
  }

  .accordion-progress.low .accordion-progress-bar {
    background: #ffe0e0;
  }

  .accordion-progress.low .accordion-progress-fill {
    background: var(--red);
  }

  .accordion-arrow {
    font-size: 18px;
    color: #999;
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .accordion-arrow.open {
    transform: rotate(180deg);
  }

  .accordion-body {
    padding: 16px;
  }

  /* FORM GRID */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 500;
    color: #444;
  }

  .form-input,
  .form-select {
    padding: 8px 10px;
    border: 1px solid #eee;
    border-radius: 8px;
    font-size: 13px;
    color: #333;
    outline: none;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-select:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
  }

  .form-input.error,
  .form-select.error {
    border-color: var(--red);
    background: #fff5f5;
  }

  .form-input.error:focus,
  .form-select.error:focus {
    box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
  }

  .form-select {
    appearance: auto;
  }

  /* TOGGLE SWITCH */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toggle-switch {
    width: 44px;
    height: 24px;
    background: #ccc;
    border-radius: var(--radius-card);
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    border: none;
    padding: 0;
    flex-shrink: 0;
  }

  .toggle-switch.on {
    background: var(--green);
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: left 0.2s;
  }

  .toggle-switch.on::after {
    left: 22px;
  }

  .toggle-label {
    font-size: 14px;
    color: var(--text);
    font-weight: 500;
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

  /* DOCS LOCALITY (Cadastre / Plan de zone) */
  .docs-locality {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
    margin-bottom: 4px;
  }

  .doc-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    display: flex;
    flex-direction: column;
  }

  .doc-card:hover {
    border-color: var(--green);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .doc-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #f5f5f5;
  }

  .doc-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.2s;
  }

  .doc-card:hover .doc-thumb img {
    transform: scale(1.03);
  }

  .doc-zoom {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
  }

  .doc-meta {
    padding: 8px 10px 10px;
  }

  .doc-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
  }

  .doc-sub {
    font-size: 11px;
    color: #949494;
    margin-top: 2px;
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

  /* CRITICAL FIELDS */
  .critical-section {
    background: white;
    border: 1px solid #eee;
    border-left: 3px solid #f5a623;
    border-radius: 0;
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

  @media (max-width: 1200px) {
    .step1-content {
      flex-direction: column;
    }
    .step1-right {
      width: 100%;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
    .photos-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
`;

function parseProgress(progress) {
  if (!progress) return 0;
  const parts = progress.split('/');
  if (parts.length !== 2) return 0;
  const num = parseInt(parts[0], 10);
  const den = parseInt(parts[1], 10);
  return den > 0 ? (num / den) * 100 : 0;
}

export default function Step1BienCible() {
  // Bien actif (saisi via /nouveau-bien). Si null, on retombe sur les valeurs
  // demo (12 rue des Lilas, Lyon 3eme).
  const [activeBien] = useState(() => getActiveBien());

  // Photos uploadees via PhotoUploader (IndexedDB). Recuperees au mount + apres
  // chaque ajout/suppression via le callback onChange du composant.
  // Forme : [{ id, src (objectURL), type, label, order, filename }]
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  // Pour eviter les fuites memoire, on cree les objectURLs ici (un par photo)
  // et on les revoke quand la liste est remplacee ou au demontage.
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
    // revoke les URLs orphelines
    const liveIds = new Set((raw || []).map((p) => p.id));
    for (const [id, url] of uploadedUrlsRef.current.entries()) {
      if (!liveIds.has(id)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        uploadedUrlsRef.current.delete(id);
      }
    }
    // tri par type (selon PHOTO_TYPE_VALUES) puis order
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
    // Capture la ref dans une variable locale pour le cleanup (evite warning
    // react-hooks/exhaustive-deps sur un ref.current "stale").
    const urlsCache = uploadedUrlsRef.current;
    return () => {
      alive = false;
      for (const url of urlsCache.values()) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      urlsCache.clear();
    };
  }, []);

  // Cle forcant le remount du PhotoUploader quand une photo est supprimee
  // depuis le carrousel principal (sinon son state interne reste obsolete).
  const [uploaderKey, setUploaderKey] = useState(0);

  // Suppression d'une photo uploadee depuis le carrousel principal.
  const handleDeleteUploaded = async (rawId) => {
    if (!rawId) return;
    try {
      await deletePhoto(rawId);
      const fresh = await getAllPhotos();
      setUploadedPhotos(buildUploadedFromRaw(fresh));
      setUploaderKey((k) => k + 1); // resync l'uploader
      // Si l'index lightbox courant n'existe plus, on ferme.
      if (lightboxIndex !== null) setLightboxIndex(null);
    } catch (err) {
      console.error('[Step1] handleDeleteUploaded', err);
    }
  };

  // Catalogue effectif :
  // - En mode live (activeBien) : UNIQUEMENT les photos uploadees par
  //   l'utilisateur via le PhotoUploader (zero donnee fake). Si elle n'a
  //   rien uploade, le carrousel est vide et seul le PhotoUploader est
  //   propose. Les CUSTOM_PHOTOS bundlees etaient utilisees comme
  //   "fallback live" mais ne sont jamais supprimables (pas en IDB) -
  //   donc inadaptees au mode live.
  // - En mode demo (pas de bien actif) : CUSTOM_PHOTOS > PROPERTY_PHOTOS.
  let photoCatalog;
  if (activeBien) {
    photoCatalog = uploadedPhotos;
  } else if (CUSTOM_PHOTOS.length > 0) {
    photoCatalog = CUSTOM_PHOTOS;
  } else {
    photoCatalog = PROPERTY_PHOTOS;
  }

  // Categories pre-remplies dynamiquement a partir du bien actif. Si aucun
  // bien actif, retombe sur le bien demo statique.
  const [bienCibleCategories] = useState(() => {
    return buildBienCibleCategories(bienCibleCategoriesBase, activeBien);
  });

  // Mini-carte + adresse + CadastrePLU : derivees du bien actif (ou demo).
  const DEMO_COORDS = [45.758, 4.859];
  const DEMO_ADDRESS_LINE1 = '12 rue des Lilas';
  const DEMO_ADDRESS_LINE2 = '69003 Lyon';

  const mapCenter = activeBien?.adresse?.coords || DEMO_COORDS;
  const cadastreLat = mapCenter[0];
  const cadastreLon = mapCenter[1];

  // Adresse en deux lignes : "{numero rue}" / "{cp ville}". On essaie d'extraire
  // a partir du label BAN ; sinon on retombe sur postcode + city ou demo.
  let addressLine1 = DEMO_ADDRESS_LINE1;
  let addressLine2 = DEMO_ADDRESS_LINE2;
  let cadastreAddress = `${DEMO_ADDRESS_LINE1}, ${DEMO_ADDRESS_LINE2}`;
  if (activeBien?.adresse?.label) {
    const label = activeBien.adresse.label;
    const postcode = activeBien.adresse.postcode || '';
    const city = activeBien.adresse.city || '';
    const tail = `${postcode} ${city}`.trim();
    // Le label BAN est souvent du type "12 rue des Lilas 69003 Lyon".
    // On retire la fin (cp + ville) pour garder la rue seule.
    if (tail && label.endsWith(tail)) {
      addressLine1 = label.slice(0, label.length - tail.length).trim();
    } else {
      addressLine1 = label;
    }
    addressLine2 = tail || addressLine2;
    cadastreAddress = label;
  }

  // Find the index with defaultOpen, fallback to index 1
  const defaultOpenIdx = bienCibleCategories.findIndex((c) => c.defaultOpen);
  const initialOpen = defaultOpenIdx >= 0 ? defaultOpenIdx : 1;
  const [openSection, setOpenSection] = useState(initialOpen);

  // Construit la clé stable d'un champ pour reportStore : "${catSlug}__${fieldSlug}".
  const fieldKey = (cat, field) => `${slugifyKey(cat.title)}__${slugifyKey(field.label)}`;

  // bienDetails persisté : on hydrate l'état local à partir de reportStore
  // (saisies précédentes), sinon avec les valeurs/toggles par défaut du
  // schéma propertyData/buildBienCibleCategories.
  const [bienDetails, setBienDetails] = useState(() => {
    const stored = getReportSection('bienDetails', {});
    const init = { ...stored };
    bienCibleCategories.forEach((cat) => {
      (cat.fields || []).forEach((field) => {
        const key = fieldKey(cat, field);
        if (init[key] === undefined) {
          if (field.type === 'toggle') init[key] = !!field.on;
          else if (field.value !== undefined && field.value !== '') init[key] = field.value;
        }
      });
    });
    return init;
  });

  // Snapshot dérivé : toggleStates pour conserver la signature de
  // getToggleState (catIdx-fieldIdx) sans toucher au rendu.
  const [toggleStates, setToggleStates] = useState(() => {
    const out = {};
    bienCibleCategories.forEach((cat, catIdx) => {
      (cat.fields || []).forEach((field, fIdx) => {
        if (field.type !== 'toggle') return;
        const key = fieldKey(cat, field);
        const stored = bienDetails[key];
        out[`${catIdx}-${fIdx}`] = stored !== undefined ? !!stored : !!field.on;
      });
    });
    return out;
  });

  // Persiste toutes les saisies à chaque modification (rapport y lit).
  useEffect(() => {
    mergeReportSection('bienDetails', bienDetails);
  }, [bienDetails]);

  // Setter générique appelé par les inputs/selects/toggles.
  const setFieldValue = (cat, field, value) => {
    const key = fieldKey(cat, field);
    setBienDetails((prev) => ({ ...prev, [key]: value }));
  };

  // Photos : filtre par type + index lightbox -----------------------------
  // Par defaut on verrouille sur Salon/Sejour pour n'afficher qu'une seule
  // photo a l'ouverture de l'etape (catalogue demo : 1 seul item de type salon).
  const [photoFilter, setPhotoFilter] = useState('salon');
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = ferm\u00e9

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

  // Changement de filtre : ferme aussi le lightbox (les indices ne correspondent plus)
  const handleFilterChange = (value) => {
    setPhotoFilter(value);
    setLightboxIndex(null);
  };

  // Clavier : ESC ferme, fl\u00e8ches naviguent ; bloque le scroll de fond
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

  // Modale m\u00e9dia g\u00e9n\u00e9rique (Cadastre / Plan de zone) ----------------------
  const [mediaModal, setMediaModal] = useState(null); // { title, url, caption } ou null
  const openMediaModal = (data) => setMediaModal(data);
  const closeMediaModal = () => setMediaModal(null);

  useEffect(() => {
    if (!mediaModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMediaModal(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mediaModal]);

  const toggleSection = (idx) => {
    setOpenSection((prev) => (prev === idx ? null : idx));
  };

  const handleToggle = (catIdx, fieldIdx, currentOn) => {
    const key = `${catIdx}-${fieldIdx}`;
    setToggleStates((prev) => {
      const newVal = prev[key] !== undefined ? !prev[key] : !currentOn;
      // Persiste aussi dans bienDetails (clé sémantique)
      const cat = bienCibleCategories[catIdx];
      const field = cat?.fields?.[fieldIdx];
      if (cat && field) setFieldValue(cat, field, newVal);
      return { ...prev, [key]: newVal };
    });
  };

  const getToggleState = (catIdx, fieldIdx, defaultOn) => {
    const key = `${catIdx}-${fieldIdx}`;
    return toggleStates[key] !== undefined ? toggleStates[key] : !!defaultOn;
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="step1-page">
        <PropertyCard />
        <Stepper currentStep={1} />

        <div className="step1-content">
          {/* LEFT COLUMN */}
          <div className="step1-left">
            {bienCibleCategories.map((cat, idx) => {
              const isOpen = openSection === idx;
              const pct = parseProgress(cat.progress);

              return (
                <div key={idx} className="accordion-item">
                  <div
                    className={`accordion-header${isOpen ? ' open' : ''}`}
                    onClick={() => toggleSection(idx)}
                  >
                    <div className="accordion-title-section">
                      <span className="accordion-title">{cat.title}</span>
                      <div className={`accordion-progress${cat.low ? ' low' : ''}`}>
                        <div className="accordion-progress-bar">
                          <div
                            className="accordion-progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="accordion-progress-text">{cat.progress}</span>
                      </div>
                    </div>
                    <span className={`accordion-arrow${isOpen ? ' open' : ''}`}>
                      &#9660;
                    </span>
                  </div>

                  {isOpen && (
                    <div className="accordion-body">
                      <div className="form-grid">
                        {cat.fields.map((field, fIdx) => (
                          <div key={fIdx} className="form-group">
                            <label className="form-label">{field.label}</label>
                            {field.type === 'toggle' ? (
                              <div className="toggle-row">
                                <button
                                  type="button"
                                  className={`toggle-switch${getToggleState(idx, fIdx, field.on) ? ' on' : ''}`}
                                  onClick={() => handleToggle(idx, fIdx, field.on)}
                                />
                                <span className="toggle-label">
                                  {getToggleState(idx, fIdx, field.on) ? 'Oui' : 'Non'}
                                </span>
                              </div>
                            ) : field.type === 'select' ? (
                              <select
                                className={`form-select${field.error ? ' error' : ''}`}
                                value={bienDetails[fieldKey(cat, field)] ?? field.value ?? ''}
                                onChange={(e) => setFieldValue(cat, field, e.target.value)}
                              >
                                <option value="">
                                  {field.placeholder || '-- Choisir --'}
                                </option>
                                {field.options && field.options.map((o, oi) => (
                                  <option key={oi} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className={`form-input${field.error ? ' error' : ''}`}
                                type={field.type || 'text'}
                                value={bienDetails[fieldKey(cat, field)] ?? field.value ?? ''}
                                placeholder={field.placeholder || ''}
                                onChange={(e) => setFieldValue(cat, field, e.target.value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* BUTTONS */}
            <div className="buttons-area">
              <span className="btn btn-ghost">&larr; Retour</span>
              <Link to="/step/2" className="btn btn-primary">
                &Eacute;tape suivante : Contexte Zone &rarr;
              </Link>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="step1-right">
            {/* Photos */}
            <div className="photos-section">
              <div className="photos-header">
                <span>Photos du bien</span>
                <span className="photos-count-inline">{photoCatalog.length}</span>
              </div>

              {/* Filtres par type de pi\u00e8ce */}
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

              {/* Grille de miniatures cliquables */}
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

              {/* Uploader : disponible des qu'il y a un bien actif. */}
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
          </div>
        </div>
      </div>
    </>
  );
}
