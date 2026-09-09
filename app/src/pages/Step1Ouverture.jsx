import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { agence, agent, avisValeur } from '../data/propertyData';
import { getActiveBien } from '../utils/activeBien';
import { reverseGeocode } from '../utils/banClient';
import { getCompPhotos } from '../utils/compPhotos';
import { getReportState, setReportState } from '../utils/reportStore';
import {
  buildMarcheLocal,
  enrichirAdresses,
  adresseLisible,
  STATUTS,
  STATUT_ORDER,
} from '../data/marcheLocalIdeeri';

// Bien de démonstration (aucun bien actif saisi) : 12 rue des Lilas, Lyon 3.
const DEMO = {
  coords: [45.758, 4.859],
  ligne1: '12 rue des Lilas',
  ligne2: '69003 Lyon',
  ville: 'Lyon 3e',
};

const RAYONS = [2, 5, 10];
const PERIODES = [
  { mois: 12, label: '12 mois' },
  { mois: 24, label: '24 mois' },
  { mois: 36, label: '36 mois' },
];

const euros = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;

const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dateDuJour() {
  const d = new Date();
  return `${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}

// --- Icônes Leaflet -------------------------------------------------------
const iconBienCible = L.divIcon({
  className: 'ml-pin-wrapper',
  html: '<span class="ml-pin ml-pin-cible" aria-hidden="true"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const iconAgence = L.divIcon({
  className: 'ml-pin-wrapper',
  html: '<span class="ml-pin ml-pin-agence" aria-hidden="true">A</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/**
 * Recadre la carte sur la zone de recherche quand le rayon change.
 * L'agence n'est incluse dans le cadrage que si elle est proche du rayon
 * demandé : sinon un petit rayon serait dézoomé juste pour la faire tenir.
 */
function RecadrageCarte({ centre, rayonKm, agence }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(centre).toBounds(rayonKm * 2000);
    if (agence && agence.distance <= rayonKm * 1.6) bounds.extend(agence.coords);
    map.fitBounds(bounds, { padding: [24, 24], animate: true });
  }, [map, centre, rayonKm, agence]);
  return null;
}

/**
 * Amène le bien sélectionné dans le champ de vision — mais seulement s'il en
 * est sorti. Recentrer à chaque clic ferait perdre le repère du bien estimé.
 */
function PanVersSelection({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (!coords) return;
    if (!map.getBounds().pad(-0.15).contains(coords)) {
      map.panTo(coords, { animate: true });
    }
  }, [map, coords]);
  return null;
}

const cssStyles = `
  .s1-page { background: #fafafa; min-height: 100vh; padding-bottom: 40px; font-family: var(--font); }
  .s1-wrap { max-width: 1280px; margin: 0 auto; padding: 0 20px; }

  /* ---------- Bandeau d'ouverture ---------- */
  .s1-hero {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: center;
    background: linear-gradient(135deg, #ffffff 0%, #f4fbf6 100%);
    border: 1px solid var(--border);
    border-left: 4px solid var(--green);
    border-radius: var(--radius-card);
    padding: 22px 24px;
    margin-bottom: 20px;
  }
  .s1-hero-kicker {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--green);
    margin-bottom: 6px;
  }
  .s1-hero-title { font-size: 22px; font-weight: 700; color: var(--text); line-height: 1.25; }
  .s1-hero-address { font-size: var(--fs-md); color: var(--text-light); margin-top: 4px; }
  .s1-agent {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    min-width: 260px;
  }
  .s1-agent img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .s1-agent-nom { font-size: var(--fs-md); font-weight: 700; color: var(--text); }
  .s1-agent-role { font-size: var(--fs-sm); color: var(--muted); }
  .s1-agent-agence { font-size: var(--fs-sm); color: var(--text-light); margin-top: 4px; font-weight: 600; }
  .s1-agent-carte { font-size: var(--fs-2xs); color: var(--muted); margin-top: 2px; }

  /* ---------- Bloc marché local ---------- */
  .s1-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    margin-bottom: 20px;
    overflow: hidden;
  }
  .s1-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #f2f2f2;
    flex-wrap: wrap;
  }
  .s1-card-title { font-size: var(--fs-xl); font-weight: 700; color: var(--text); }
  .s1-card-sub { font-size: var(--fs-base); color: var(--muted); margin-top: 3px; }

  /* Bascule réseau / mon agence */
  .s1-toggle { display: inline-flex; background: #f2f2f2; border-radius: 999px; padding: 3px; }
  .s1-toggle button {
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-light);
    padding: 7px 16px;
    border-radius: 999px;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .s1-toggle button.active { background: #fff; color: var(--text); box-shadow: var(--shadow-sm); }

  .s1-filters {
    display: flex;
    align-items: center;
    gap: 22px;
    flex-wrap: wrap;
    padding: 12px 20px;
    background: #fbfbfb;
    border-bottom: 1px solid #f2f2f2;
  }
  .s1-filter-group { display: flex; align-items: center; gap: 8px; }
  .s1-filter-label {
    font-size: var(--fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
  }
  .s1-chip {
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text-light);
    font-family: var(--font);
    font-size: var(--fs-sm);
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .s1-chip:hover { border-color: #cfcfcf; }
  .s1-chip.active { border-color: currentColor; }
  .s1-chip .s1-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .s1-chip.off { opacity: 0.45; }
  .s1-chip-count { font-size: var(--fs-2xs); color: var(--muted); font-weight: 700; }
  .s1-chip.active .s1-chip-count { color: inherit; }

  /* ---------- Chiffres clés ---------- */
  .s1-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-bottom: 1px solid #f2f2f2;
  }
  .s1-stat { padding: 16px 20px; border-right: 1px solid #f2f2f2; }
  .s1-stat:last-child { border-right: none; }
  .s1-stat-value { font-size: 26px; font-weight: 700; color: var(--text); line-height: 1.1; }
  .s1-stat-value .s1-unit { font-size: var(--fs-md); font-weight: 600; color: var(--text-light); margin-left: 3px; }
  .s1-stat-label { font-size: var(--fs-sm); color: var(--text-light); margin-top: 5px; }
  .s1-stat-hint { font-size: var(--fs-xs); color: var(--muted); margin-top: 3px; }
  .s1-stat.empty .s1-stat-value { color: var(--muted); font-size: 20px; }

  .s1-narrative {
    padding: 14px 20px;
    font-size: var(--fs-md);
    line-height: 1.6;
    color: var(--text);
    background: var(--green-light);
    border-bottom: 1px solid #f2f2f2;
  }
  .s1-narrative strong { font-weight: 700; }

  /* ---------- Carte + liste ---------- */
  .s1-market-body { display: grid; grid-template-columns: 1fr 340px; grid-template-rows: 540px; }
  .s1-map { position: relative; border-right: 1px solid #f2f2f2; }
  .s1-map .leaflet-container { height: 540px; width: 100%; z-index: 0; }
  .s1-legend {
    position: absolute;
    left: 12px;
    bottom: 12px;
    z-index: 500;
    background: rgba(255,255,255,0.95);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 9px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    box-shadow: var(--shadow-sm);
  }
  .s1-legend-row { display: flex; align-items: center; gap: 7px; font-size: var(--fs-xs); color: var(--text-light); }
  .s1-legend-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.12); }

  .s1-list { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .s1-list-head {
    flex-shrink: 0;
    padding: 12px 16px;
    border-bottom: 1px solid #f2f2f2;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .s1-list-head span:last-child { color: var(--muted); font-weight: 600; }
  .s1-list-scroll { overflow-y: auto; flex: 1; min-height: 0; }
  .s1-item {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid #f5f5f5;
    border-left: 3px solid transparent;
    padding: 10px 14px;
    cursor: pointer;
    font-family: var(--font);
    display: flex;
    gap: 10px;
    align-items: flex-start;
    transition: background 0.12s, border-color 0.12s;
  }
  .s1-item:hover { background: #fafafa; border-left-color: var(--green); }
  .s1-item-photo {
    width: 62px;
    height: 62px;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: var(--radius-md);
    background: #f0f0f0;
  }
  .s1-item-corps { display: block; min-width: 0; flex: 1; }
  .s1-item-top { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; flex-wrap: wrap; }
  .s1-badge {
    font-size: var(--fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 2px 7px;
    border-radius: 3px;
    color: #fff;
    white-space: nowrap;
  }
  .s1-item-type { display: block; font-size: var(--fs-base); font-weight: 700; color: var(--text); }
  .s1-item-addr {
    display: block;
    font-size: var(--fs-sm);
    color: var(--text-light);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .s1-item-meta {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    align-items: baseline;
    font-size: var(--fs-xs);
    color: var(--muted);
    margin-top: 3px;
  }
  .s1-item-prix { font-size: var(--fs-base); font-weight: 700; color: var(--text); }
  .s1-item-mine {
    font-size: var(--fs-2xs);
    font-weight: 700;
    color: var(--green);
    background: var(--green-light);
    border-radius: 3px;
    padding: 1px 6px;
    white-space: nowrap;
  }

  /* ---------- Fiche d'un bien ---------- */
  .s1-fiche-retour {
    border: none;
    background: none;
    font-family: var(--font);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--green);
    cursor: pointer;
    padding: 0;
  }
  .s1-fiche-retour:hover { text-decoration: underline; }
  .s1-fiche { overflow-y: auto; flex: 1; min-height: 0; }
  .s1-fiche-photo { position: relative; aspect-ratio: 16 / 10; background: #f0f0f0; }
  .s1-fiche-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .s1-fiche-badge { position: absolute; top: 10px; left: 10px; box-shadow: var(--shadow-sm); }
  .s1-fiche-miniatures { display: flex; gap: 5px; padding: 6px 14px 0; }
  .s1-miniature {
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    padding: 0;
    background: none;
    cursor: pointer;
    overflow: hidden;
    line-height: 0;
    flex: 1;
    min-width: 0;
  }
  .s1-miniature img { width: 100%; height: 36px; object-fit: cover; }
  .s1-miniature.active { border-color: var(--green); }
  .s1-fiche-corps { padding: 10px 14px 14px; }
  .s1-fiche-titre { font-size: var(--fs-lg); font-weight: 700; color: var(--text); line-height: 1.3; }
  .s1-fiche-adresse { font-size: var(--fs-base); color: var(--text-light); margin-top: 2px; }
  .s1-fiche-prix {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 8px 0 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f2f2f2;
  }
  .s1-fiche-prix-val { font-size: 22px; font-weight: 700; color: var(--text); }
  .s1-fiche-prix-m2 { font-size: var(--fs-base); color: var(--muted); font-weight: 600; }
  .s1-fiche-lignes { display: flex; flex-direction: column; gap: 7px; }
  .s1-fiche-lignes > div { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .s1-fiche-lignes dt { font-size: var(--fs-sm); color: var(--muted); flex-shrink: 0; }
  .s1-fiche-lignes dd {
    font-size: var(--fs-base);
    color: var(--text);
    font-weight: 600;
    text-align: right;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .s1-list-empty { padding: 30px 16px; text-align: center; color: var(--muted); font-size: var(--fs-base); }

  /* Pins Leaflet personnalisés */
  .ml-pin-wrapper { background: none; border: none; }
  .ml-pin {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px; height: 26px;
    border-radius: 50%;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: #fff;
    border: 3px solid #fff;
    box-shadow: 0 1px 5px rgba(0,0,0,0.35);
  }
  .ml-pin-cible { background: var(--green); animation: ml-pulse 2.2s ease-out infinite; }
  .ml-pin-agence { background: var(--dark); }
  @keyframes ml-pulse {
    0%   { box-shadow: 0 1px 5px rgba(0,0,0,0.35), 0 0 0 0 rgba(70,185,98,0.5); }
    70%  { box-shadow: 0 1px 5px rgba(0,0,0,0.35), 0 0 0 14px rgba(70,185,98,0); }
    100% { box-shadow: 0 1px 5px rgba(0,0,0,0.35), 0 0 0 0 rgba(70,185,98,0); }
  }
  .ml-popup h4 { font-size: var(--fs-base); margin-bottom: 3px; color: var(--text); }
  .ml-popup .ml-popup-line { font-size: var(--fs-sm); color: var(--text-light); }
  .ml-popup .ml-popup-prix { font-size: var(--fs-md); font-weight: 700; color: var(--text); margin-top: 4px; }

  /* ---------- Points forts / vigilance ---------- */
  .s1-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .s1-note-card {
    background: #fff;
    border: 1px solid var(--border);
    border-top: 3px solid var(--green);
    border-radius: var(--radius-card);
    padding: 16px 18px;
  }
  .s1-note-card.vigilance { border-top-color: var(--orange); }
  .s1-note-title { font-size: var(--fs-md); font-weight: 700; color: var(--text); }
  .s1-note-hint { font-size: var(--fs-sm); color: var(--muted); margin: 3px 0 12px; }
  .s1-note-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .s1-note-icon { font-size: var(--fs-md); flex-shrink: 0; width: 16px; text-align: center; }
  .s1-note-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font);
    font-size: var(--fs-base);
    color: var(--text);
    border: 1px solid transparent;
    border-bottom-color: #efefef;
    background: none;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    transition: border-color 0.15s, background 0.15s;
  }
  .s1-note-input:hover { background: #fafafa; }
  .s1-note-input:focus { outline: none; border-color: var(--green); background: #fff; }
  .s1-note-del {
    border: none; background: none; cursor: pointer;
    color: #c9c9c9; font-size: var(--fs-lg); line-height: 1;
    padding: 2px 6px; border-radius: var(--radius-sm); flex-shrink: 0;
  }
  .s1-note-del:hover { color: var(--red); background: var(--red-light); }
  .s1-note-add {
    border: 1px dashed var(--border);
    background: none;
    color: var(--text-light);
    font-family: var(--font);
    font-size: var(--fs-sm);
    font-weight: 600;
    padding: 7px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    width: 100%;
    margin-top: 4px;
  }
  .s1-note-add:hover { border-color: var(--green); color: var(--green); }
  .s1-note-empty { font-size: var(--fs-sm); color: var(--muted); padding: 6px 0 12px; font-style: italic; }

  /* ---------- Navigation ---------- */
  .s1-nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .s1-nav .btn {
    font-family: var(--font);
    font-size: var(--fs-base);
    font-weight: 600;
    padding: 10px 20px;
    border-radius: var(--radius-md);
    text-decoration: none;
    cursor: pointer;
    border: 1px solid var(--border);
  }
  .s1-nav .btn-ghost { background: #fff; color: var(--text-light); }
  .s1-nav .btn-primary { background: var(--green); border-color: var(--green); color: #fff; }
  .s1-nav .btn-primary:hover { background: var(--green-dark); }

  @media (max-width: 1100px) {
    .s1-market-body { grid-template-columns: 1fr; grid-template-rows: auto auto; }
    .s1-map { border-right: none; border-bottom: 1px solid #f2f2f2; }
    .s1-list { height: 420px; }
    .s1-stats { grid-template-columns: repeat(2, 1fr); }
    .s1-stat:nth-child(2n) { border-right: none; }
    .s1-hero { grid-template-columns: 1fr; }
    .s1-notes { grid-template-columns: 1fr; }
  }
`;

export default function Step1Ouverture() {
  const activeBien = useMemo(() => getActiveBien(), []);

  // ---- Bien estimé : coordonnées + libellés d'adresse ----------------------
  // On garde lat/lon en primitives : `centre` doit avoir une identité stable,
  // sinon le marché local serait régénéré à chaque rendu.
  const lat = activeBien?.adresse?.coords?.[0] ?? DEMO.coords[0];
  const lon = activeBien?.adresse?.coords?.[1] ?? DEMO.coords[1];
  const centre = useMemo(() => [lat, lon], [lat, lon]);
  const ville = activeBien?.adresse?.city || DEMO.ville;
  const prixM2Ref = activeBien?.result?.prixM2 || activeBien?.dvfStats?.median || 2600;

  let ligne1 = DEMO.ligne1;
  let ligne2 = DEMO.ligne2;
  if (activeBien?.adresse?.label) {
    const label = activeBien.adresse.label;
    const tail = `${activeBien.adresse.postcode || ''} ${activeBien.adresse.city || ''}`.trim();
    ligne1 = tail && label.endsWith(tail) ? label.slice(0, -tail.length).trim() : label;
    ligne2 = tail || '';
  }

  // ---- Marché local (fictif, déterministe) --------------------------------
  const marcheInitial = useMemo(
    () => buildMarcheLocal({ lat, lon, ville, prixM2Ref }),
    [lat, lon, ville, prixM2Ref]
  );
  const [biens, setBiens] = useState(marcheInitial.biens);
  const [infosAgence, setInfosAgence] = useState(marcheInitial.agence);

  // Géocodage inverse en tâche de fond : remplace les voies fictives par les
  // voies réelles du secteur. Échec silencieux (hors ligne) = libellés fictifs.
  useEffect(() => {
    let annule = false;

    enrichirAdresses(marcheInitial.biens, reverseGeocode, {
      onBatch: (partiel) => { if (!annule) setBiens(partiel); },
    });

    reverseGeocode(marcheInitial.agence.coords[0], marcheInitial.agence.coords[1])
      .then((res) => {
        if (annule || !res?.city) return;
        setInfosAgence((prev) => ({ ...prev, commune: res.city }));
      });

    return () => { annule = true; };
  }, [marcheInitial]);

  // ---- Filtres ------------------------------------------------------------
  const [perimetre, setPerimetre] = useState('reseau'); // 'reseau' | 'agence'
  const [rayon, setRayon] = useState(5);
  const [periode, setPeriode] = useState(24);
  const [statutsActifs, setStatutsActifs] = useState(() => new Set(STATUT_ORDER));
  const [selection, setSelection] = useState(null);

  const [photoIndex, setPhotoIndex] = useState(0);

  const ouvrirFiche = (id) => { setSelection(id); setPhotoIndex(0); };
  const fermerFiche = () => setSelection(null);

  const toggleStatut = (key) => {
    setStatutsActifs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      // On ne laisse jamais la carte totalement vide.
      return next.size === 0 ? new Set([key]) : next;
    });
  };

  // Périmètre + rayon + période : la base sur laquelle on compte.
  // Les filtres de statut ne s'appliquent qu'à l'affichage, pas aux compteurs
  // des puces (sinon un compteur passerait à 0 en se désactivant lui-même).
  const dansPerimetre = useMemo(() => biens.filter((b) => {
    if (perimetre === 'agence' && !b.mine) return false;
    if (b.distance > rayon) return false;
    if (b.statut !== 'en_vente' && b.moisEcoules > periode) return false;
    return true;
  }), [biens, perimetre, rayon, periode]);

  const affiches = useMemo(
    () => dansPerimetre
      .filter((b) => statutsActifs.has(b.statut))
      .sort((a, b) => a.distance - b.distance),
    [dansPerimetre, statutsActifs]
  );

  // Le bien de la fiche est cherché dans la liste AFFICHÉE : si un filtre
  // l'exclut, la fiche se referme d'elle-même sur la liste.
  const bienFiche = useMemo(
    () => affiches.find((b) => b.id === selection) || null,
    [affiches, selection]
  );
  const coordsSelection = bienFiche ? bienFiche.coords : null;
  const photosFiche = useMemo(
    () => (bienFiche ? getCompPhotos({ id: bienFiche.id }) : []),
    [bienFiche]
  );

  const comptesParStatut = useMemo(() => {
    const acc = { vendu: 0, compromis: 0, en_vente: 0 };
    dansPerimetre.forEach((b) => { acc[b.statut] += 1; });
    return acc;
  }, [dansPerimetre]);

  const stats = useMemo(() => {
    const vendus = dansPerimetre.filter((b) => b.statut === 'vendu');
    const delaiMoyen = vendus.length
      ? Math.round(vendus.reduce((s, b) => s + b.delaiJours, 0) / vendus.length)
      : null;
    return {
      vendus: vendus.length,
      vendusAgence: vendus.filter((b) => b.mine).length,
      delaiMoyen,
      enVente: comptesParStatut.en_vente,
      compromis: comptesParStatut.compromis,
    };
  }, [dansPerimetre, comptesParStatut]);

  const libellePerimetre = perimetre === 'agence' ? 'notre agence' : 'le réseau Ideeri';

  // ---- Points forts / points de vigilance (saisie manuelle de l'agent) ----
  const aBienReel = !!activeBien?.adresse?.label;
  const [pointsForts, setPointsForts] = useState(() => {
    const st = getReportState();
    if (Array.isArray(st.pointsForts)) return st.pointsForts;
    return aBienReel ? [] : avisValeur.pointsForts;
  });
  const [pointsVigilance, setPointsVigilance] = useState(() => {
    const st = getReportState();
    if (Array.isArray(st.pointsVigilance)) return st.pointsVigilance;
    return aBienReel ? [] : avisValeur.pointsVigilance;
  });

  useEffect(() => { setReportState({ pointsForts }); }, [pointsForts]);
  useEffect(() => { setReportState({ pointsVigilance }); }, [pointsVigilance]);

  const majPoint = (setter) => (idx, valeur) =>
    setter((prev) => prev.map((p, i) => (i === idx ? valeur : p)));
  const supprPoint = (setter) => (idx) =>
    setter((prev) => prev.filter((_, i) => i !== idx));

  const renderNotes = (titre, hint, items, setter, icone, classe, placeholder, ajout) => (
    <div className={`s1-note-card ${classe}`}>
      <div className="s1-note-title">{titre}</div>
      <div className="s1-note-hint">{hint}</div>
      {items.length === 0 && (
        <div className="s1-note-empty">Rien de noté pour l’instant.</div>
      )}
      {items.map((p, i) => (
        <div className="s1-note-row" key={i}>
          <span className="s1-note-icon" aria-hidden="true">{icone}</span>
          <input
            className="s1-note-input"
            value={p}
            placeholder={placeholder}
            onChange={(e) => majPoint(setter)(i, e.target.value)}
          />
          <button
            type="button"
            className="s1-note-del"
            onClick={() => supprPoint(setter)(i)}
            aria-label={`Supprimer « ${p} »`}
            title="Supprimer"
          >&times;</button>
        </div>
      ))}
      <button type="button" className="s1-note-add" onClick={() => setter((prev) => [...prev, ''])}>
        + {ajout}
      </button>
    </div>
  );

  return (
    <>
      <style>{cssStyles}</style>
      <div className="s1-page">
        <div className="s1-wrap">
          <PropertyCard />
          <Stepper currentStep={1} />

          {/* ---------- Ouverture du rendez-vous ---------- */}
          <section className="s1-hero">
            <div>
              <div className="s1-hero-kicker">Rendez-vous d’estimation · {dateDuJour()}</div>
              <h1 className="s1-hero-title">{agence.nom}, sur votre secteur</h1>
              <div className="s1-hero-address">
                {ligne1}{ligne2 ? `, ${ligne2}` : ''}
              </div>
            </div>
            <div className="s1-agent">
              <img src={agent.photo} alt="" />
              <div>
                <div className="s1-agent-nom">{agent.nom}</div>
                <div className="s1-agent-role">{agent.fonction}</div>
                <div className="s1-agent-agence">{agence.nom}</div>
                <div className="s1-agent-carte">Carte pro. {agence.carteT}</div>
              </div>
            </div>
          </section>

          {/* ---------- Marché local ---------- */}
          <section className="s1-card">
            <div className="s1-card-head">
              <div>
                <div className="s1-card-title">Notre implantation autour de votre bien</div>
                <div className="s1-card-sub">
                  {infosAgence.commune
                    ? `Agence de ${infosAgence.commune}, à ${infosAgence.distance} km de votre bien`
                    : `Agence à ${infosAgence.distance} km de votre bien`}
                </div>
              </div>
              <div className="s1-toggle" role="group" aria-label="Périmètre affiché">
                <button
                  type="button"
                  className={perimetre === 'reseau' ? 'active' : ''}
                  onClick={() => setPerimetre('reseau')}
                >
                  Réseau Ideeri
                </button>
                <button
                  type="button"
                  className={perimetre === 'agence' ? 'active' : ''}
                  onClick={() => setPerimetre('agence')}
                >
                  Notre agence
                </button>
              </div>
            </div>

            <div className="s1-filters">
              <div className="s1-filter-group">
                <span className="s1-filter-label">Rayon</span>
                {RAYONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`s1-chip${rayon === r ? ' active' : ''}`}
                    style={rayon === r ? { color: 'var(--green)', background: 'var(--green-light)' } : undefined}
                    onClick={() => setRayon(r)}
                  >
                    {r} km
                  </button>
                ))}
              </div>
              <div className="s1-filter-group">
                <span className="s1-filter-label">Période</span>
                {PERIODES.map((p) => (
                  <button
                    key={p.mois}
                    type="button"
                    className={`s1-chip${periode === p.mois ? ' active' : ''}`}
                    style={periode === p.mois ? { color: 'var(--green)', background: 'var(--green-light)' } : undefined}
                    onClick={() => setPeriode(p.mois)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="s1-filter-group">
                <span className="s1-filter-label">Afficher</span>
                {STATUT_ORDER.map((key) => {
                  const s = STATUTS[key];
                  const actif = statutsActifs.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`s1-chip${actif ? ' active' : ' off'}`}
                      style={actif ? { color: s.color, background: '#fff' } : undefined}
                      onClick={() => toggleStatut(key)}
                      aria-pressed={actif}
                    >
                      <span className="s1-dot" style={{ background: s.color }} />
                      {s.pluriel}
                      <span className="s1-chip-count">{comptesParStatut[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chiffres clés — recalculés à chaque changement de filtre */}
            <div className="s1-stats">
              <div className={`s1-stat${stats.vendus === 0 ? ' empty' : ''}`}>
                <div className="s1-stat-value">{stats.vendus || '—'}</div>
                <div className="s1-stat-label">
                  {stats.vendus > 1 ? 'biens vendus' : 'bien vendu'} sur {periode} mois
                </div>
                <div className="s1-stat-hint">
                  {perimetre === 'reseau'
                    ? `dont ${stats.vendusAgence} par notre agence`
                    : `dans un rayon de ${rayon} km`}
                </div>
              </div>
              <div className={`s1-stat${stats.delaiMoyen === null ? ' empty' : ''}`}>
                <div className="s1-stat-value">
                  {stats.delaiMoyen !== null ? <>{stats.delaiMoyen}<span className="s1-unit">jours</span></> : '—'}
                </div>
                <div className="s1-stat-label">délai de vente moyen</div>
                <div className="s1-stat-hint">du mandat au compromis</div>
              </div>
              <div className={`s1-stat${stats.enVente === 0 ? ' empty' : ''}`}>
                <div className="s1-stat-value">{stats.enVente || '—'}</div>
                <div className="s1-stat-label">biens en vente aujourd’hui</div>
                <div className="s1-stat-hint">portefeuille actif sur la zone</div>
              </div>
              <div className={`s1-stat${stats.compromis === 0 ? ' empty' : ''}`}>
                <div className="s1-stat-value">{stats.compromis || '—'}</div>
                <div className="s1-stat-label">sous compromis</div>
                <div className="s1-stat-hint">ventes en cours de signature</div>
              </div>
            </div>

            {stats.vendus > 0 && (
              <p className="s1-narrative">
                Sur les <strong>{periode} derniers mois</strong>, dans un rayon de{' '}
                <strong>{rayon} km</strong> autour de votre bien, {libellePerimetre} a vendu{' '}
                <strong>{stats.vendus} bien{stats.vendus > 1 ? 's' : ''}</strong>
                {stats.delaiMoyen !== null && <> en <strong>{stats.delaiMoyen} jours</strong> en moyenne</>}
                {stats.enVente > 0 && <>, et suit actuellement <strong>{stats.enVente} bien{stats.enVente > 1 ? 's' : ''}</strong> en vente sur le même secteur</>}.
              </p>
            )}

            <div className="s1-market-body">
              <div className="s1-map">
                <MapContainer
                  center={centre}
                  zoom={12}
                  scrollWheelZoom={false}
                  zoomControl
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <RecadrageCarte centre={centre} rayonKm={rayon} agence={infosAgence} />
                  <PanVersSelection coords={coordsSelection} />

                  {/* Zone de recherche */}
                  <Circle
                    center={centre}
                    radius={rayon * 1000}
                    pathOptions={{ color: '#46B962', weight: 1.5, fillColor: '#46B962', fillOpacity: 0.06, dashArray: '6 5' }}
                  />

                  {/* Biens du marché local — le clic ouvre la fiche à droite */}
                  {affiches.map((b) => {
                    const s = STATUTS[b.statut];
                    const actif = selection === b.id;
                    return (
                      <CircleMarker
                        key={b.id}
                        center={b.coords}
                        radius={actif ? 10 : 6}
                        pathOptions={{
                          color: actif ? STATUTS[b.statut].color : '#fff',
                          weight: actif ? 3 : 2,
                          fillColor: s.color,
                          fillOpacity: b.mine ? 0.95 : 0.65,
                        }}
                        eventHandlers={{ click: () => ouvrirFiche(b.id) }}
                      >
                        <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                          {b.type} {b.surface} m² · {euros(b.prix)}
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}

                  {/* Agence */}
                  <Marker position={infosAgence.coords} icon={iconAgence}>
                    <Popup>
                      <div className="ml-popup">
                        <h4>{agence.nom}</h4>
                        <div className="ml-popup-line">
                          {infosAgence.commune || agence.adresse}
                        </div>
                        <div className="ml-popup-line">
                          à {infosAgence.distance} km du bien estimé
                        </div>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Bien estimé */}
                  <Marker position={centre} icon={iconBienCible}>
                    <Popup>
                      <div className="ml-popup">
                        <h4>Votre bien</h4>
                        <div className="ml-popup-line">{ligne1}</div>
                        <div className="ml-popup-line">{ligne2}</div>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>

                <div className="s1-legend">
                  {STATUT_ORDER.map((key) => (
                    <div className="s1-legend-row" key={key}>
                      <span className="s1-legend-dot" style={{ background: STATUTS[key].color }} />
                      {STATUTS[key].pluriel}
                    </div>
                  ))}
                  <div className="s1-legend-row">
                    <span className="s1-legend-dot" style={{ background: 'var(--dark)' }} />
                    Notre agence
                  </div>
                </div>
              </div>

              <aside className="s1-list">
                {bienFiche ? (
                  /* -------- Fiche du bien sélectionné -------- */
                  <>
                    <div className="s1-list-head">
                      <button type="button" className="s1-fiche-retour" onClick={fermerFiche}>
                        &larr; Tous les biens
                      </button>
                      <span>{affiches.length}</span>
                    </div>

                    <div className="s1-fiche">
                      <div className="s1-fiche-photo">
                        <img
                          src={photosFiche[photoIndex]}
                          alt={`${bienFiche.type} ${bienFiche.surface} m² — ${adresseLisible(bienFiche)}`}
                          loading="lazy"
                        />
                        <span
                          className="s1-badge s1-fiche-badge"
                          style={{ background: STATUTS[bienFiche.statut].color }}
                        >
                          {STATUTS[bienFiche.statut].label}
                        </span>
                      </div>

                      {photosFiche.length > 1 && (
                        <div className="s1-fiche-miniatures">
                          {photosFiche.map((url, i) => (
                            <button
                              key={url}
                              type="button"
                              className={`s1-miniature${i === photoIndex ? ' active' : ''}`}
                              onClick={() => setPhotoIndex(i)}
                              aria-label={`Photo ${i + 1}`}
                            >
                              <img src={url} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="s1-fiche-corps">
                        <div className="s1-fiche-titre">
                          {bienFiche.type} {bienFiche.pieces} pièces · {bienFiche.surface} m²
                        </div>
                        <div className="s1-fiche-adresse">{adresseLisible(bienFiche)}</div>

                        <div className="s1-fiche-prix">
                          <span className="s1-fiche-prix-val">{euros(bienFiche.prix)}</span>
                          <span className="s1-fiche-prix-m2">{bienFiche.prixM2} €/m²</span>
                        </div>

                        <dl className="s1-fiche-lignes">
                          <div>
                            <dt>Distance</dt>
                            <dd>à {bienFiche.distance} km de votre bien</dd>
                          </div>
                          {bienFiche.statut === 'en_vente' ? (
                            <div>
                              <dt>En vente</dt>
                              <dd>depuis {bienFiche.enLigneDepuisJours} jours ({bienFiche.dateLabel})</dd>
                            </div>
                          ) : (
                            <>
                              <div>
                                <dt>{bienFiche.statut === 'vendu' ? 'Vendu' : 'Compromis signé'}</dt>
                                <dd>{bienFiche.dateLabel}</dd>
                              </div>
                              <div>
                                <dt>Délai de vente</dt>
                                <dd>{bienFiche.delaiJours} jours</dd>
                              </div>
                            </>
                          )}
                          <div>
                            <dt>Commercialisé par</dt>
                            <dd>
                              {bienFiche.agenceNom}
                              {bienFiche.mine && <span className="s1-item-mine">Notre agence</span>}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </>
                ) : (
                  /* -------- Liste -------- */
                  <>
                    <div className="s1-list-head">
                      <span>Biens sur le secteur</span>
                      <span>{affiches.length}</span>
                    </div>
                    <div className="s1-list-scroll">
                      {affiches.length === 0 && (
                        <div className="s1-list-empty">
                          Aucun bien avec ces filtres.<br />Élargissez le rayon ou la période.
                        </div>
                      )}
                      {affiches.map((b) => {
                        const s = STATUTS[b.statut];
                        const photo = getCompPhotos({ id: b.id })[0];
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className="s1-item"
                            onClick={() => ouvrirFiche(b.id)}
                          >
                            <img className="s1-item-photo" src={photo} alt="" loading="lazy" />
                            <span className="s1-item-corps">
                              <span className="s1-item-top">
                                <span className="s1-badge" style={{ background: s.color }}>{s.label}</span>
                                {b.mine && <span className="s1-item-mine">Notre agence</span>}
                              </span>
                              <span className="s1-item-type">
                                {b.type} {b.pieces}P · {b.surface} m²
                              </span>
                              <span className="s1-item-addr">{adresseLisible(b)}</span>
                              <span className="s1-item-meta">
                                <span className="s1-item-prix">{euros(b.prix)}</span>
                                <span>à {b.distance} km</span>
                                {b.statut === 'en_vente'
                                  ? <span>en ligne {b.enLigneDepuisJours} j</span>
                                  : <span>vendu en {b.delaiJours} j</span>}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </aside>
            </div>
          </section>

          {/* ---------- Points forts / vigilance ---------- */}
          <section className="s1-notes">
            {renderNotes(
              'Points forts',
              'Ce que vous relevez avec le mandant pendant la visite.',
              pointsForts, setPointsForts, '✓', 'forts',
              'Ex. Exposition sud, extérieur rare sur le secteur…',
              'Ajouter un point fort'
            )}
            {renderNotes(
              'Points de vigilance',
              'Ce qui pèsera sur le prix ou le délai — à dire dès maintenant.',
              pointsVigilance, setPointsVigilance, '⚠', 'vigilance',
              'Ex. Travaux de toiture à prévoir, pas de stationnement…',
              'Ajouter un point de vigilance'
            )}
          </section>

          {/* ---------- Navigation ---------- */}
          <div className="s1-nav">
            <Link to="/" className="btn btn-ghost">&larr; Tableau de bord</Link>
            <Link to="/step/2" className="btn btn-primary">
              Étape suivante : Relevé du bien &rarr;
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
