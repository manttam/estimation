import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  property,
  contexteZone,
  comparables,
  avisValeur,
  agence,
  agent,
  mandant,
  personasAcquereurs,
} from '../data/propertyData';
import ReliabilityBadge from '../components/ReliabilityBadge';
import { getActiveBien } from '../utils/activeBien';
import { getAcquereurs } from '../utils/acquereursStore';
import { getPhotosForCarousel, revokePhotoUrls } from '../utils/photosStore';
import { getReportState, setReportState } from '../utils/reportStore';

/* Charge les comparables manuels saisis dans Step3 (clé `ideeri_manual_comps`). */
function loadManualComparables() {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem('ideeri_manual_comps');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Acquéreurs fictifs de démonstration (RGPD : données entièrement inventées,
 * aucune personne réelle). Utilisés en mode live lorsqu'aucun acquéreur n'a
 * été saisi, pour que la section « Profils d'acquéreurs » ne soit pas vide
 * lors d'une démonstration. Même forme que getAcquereurs() :
 * { id, prenom, nom, budgetMax (k€), surfaceMin, type, dpeMin }.
 */
const DEMO_ACQUEREURS = [
  { id: 'demo-1', prenom: 'Claire', nom: 'Martin', budgetMax: 320, surfaceMin: 60, type: 'appartement', dpeMin: 'D' },
  { id: 'demo-2', prenom: 'Thomas', nom: 'Bernard', budgetMax: 295, surfaceMin: 55, type: 'appartement', dpeMin: 'E' },
  { id: 'demo-3', prenom: 'Sophie', nom: 'Petit', budgetMax: 350, surfaceMin: 70, type: 'appartement', dpeMin: 'C' },
  { id: 'demo-4', prenom: 'Julien', nom: 'Durand', budgetMax: 270, surfaceMin: 50, type: 'indifferent', dpeMin: 'F' },
  { id: 'demo-5', prenom: 'Camille', nom: 'Leroy', budgetMax: 310, surfaceMin: 65, type: 'appartement', dpeMin: 'D' },
];

/**
 * Icônes Lucide inlinées (ISC license).
 * Utilisées par la section Méthodologie via `iconeLucide` du mock.
 */
const LUCIDE_ICONS = {
  SearchCheck: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 11 2 2 4-4" />
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  TrendingUp: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Building2: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  ),
};

/**
 * Collapsible — accordéon générique « 3 lignes visibles + Voir plus ».
 *
 * `items` : tableau de noeuds React (lignes prêtes à rendre).
 * Tant que la liste dépasse `visibleCount` (3 par défaut), on n'affiche
 * que les premières puis un bouton « Voir plus / Voir moins ».
 * En mode impression (?print=1), tout est déplié et le bouton masqué.
 */
function Collapsible({ items, visibleCount = 3, printMode = false }) {
  const [open, setOpen] = useState(false);
  const list = Array.isArray(items) ? items : [];
  const hasMore = list.length > visibleCount;
  const showAll = printMode || open || !hasMore;
  const shown = showAll ? list : list.slice(0, visibleCount);
  return (
    <>
      {shown}
      {hasMore && !printMode && (
        <button
          type="button"
          className="cr-voirplus"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Voir moins' : `Voir plus (${list.length - visibleCount})`}
        </button>
      )}
    </>
  );
}

/**
 * MarketMiniMap — carte Leaflet statique (POI) pour le compte rendu.
 *
 * Réplique l'init Step2 (Leaflet, tuiles CARTO Positron) en lecture seule :
 * marqueur du bien, cercle de rayon, pastilles POI.
 * `coords` : [lat, lon] du bien. `poi` : objet { categorie: [{name, coords}] }.
 * Ne rend rien si coords manquantes.
 */
function MarketMiniMap({ coords, poi, rayon = 1000 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ref.current || !Array.isArray(coords) || coords.length !== 2) return;
    if (mapRef.current) return; // déjà initialisée

    const POI_STYLES = {
      transports: { emoji: '🚇', color: '#2563EB' },
      commerces: { emoji: '🛒', color: '#D97706' },
      education: { emoji: '🎓', color: '#7C3AED' },
      sante: { emoji: '🏥', color: '#DC2626' },
      environnement: { emoji: '🌳', color: '#46B962' },
    };

    const map = L.map(ref.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      attributionControl: true,
    }).setView(coords, 15);
    mapRef.current = map;

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' }
    ).addTo(map);

    // Marqueur du bien (pastille verte « maison »)
    const houseIcon = L.divIcon({
      className: 'cr-map-target',
      html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#46B962;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
    L.marker(coords, { icon: houseIcon }).addTo(map);

    // Cercle de rayon
    L.circle(coords, {
      radius: rayon,
      color: '#46B962',
      weight: 1,
      fillColor: '#46B962',
      fillOpacity: 0.06,
    }).addTo(map);

    // POI
    if (poi && typeof poi === 'object') {
      Object.entries(poi).forEach(([cat, arr]) => {
        if (!Array.isArray(arr)) return;
        const style = POI_STYLES[cat] || { emoji: '📍', color: '#666' };
        arr.slice(0, 12).forEach((p) => {
          const c = p.coords;
          if (!Array.isArray(c) || c.length !== 2) return;
          const icon = L.divIcon({
            className: 'cr-map-poi',
            html: `<div style="width:18px;height:18px;border-radius:50%;background:${style.color};display:flex;align-items:center;justify-content:center;font-size:10px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">${style.emoji}</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          L.marker(c, { icon }).addTo(map).bindPopup(p.name || '');
        });
      });
    }

    // Recalage taille (le conteneur peut être monté caché)
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coords, poi, rayon]);

  return <div ref={ref} className="cr-market-map" />;
}

/**
 * CompteRendu — V2
 *
 * Document commercial d'avis de valeur remis au mandant.
 * 12 sections, personnalisation agence via variables CSS --primary / --secondary,
 * comparables enrichis avec indice de fiabilité, cascade V2 (sans ajustement zone).
 *
 * Mode ?print=1 → masque les boutons d'action pour rendu PDF serverless (Puppeteer).
 */
export default function CompteRendu() {
  const navigate = useNavigate();

  /* ───── Mode live : bien actif + acquéreurs réels ─────
   * En mode live (un bien a été saisi via /nouveau-bien), on dérive toutes
   * les sections depuis activeBien / getAcquereurs / IndexedDB photos.
   * En mode démo (aucun bien actif), on garde les mocks 12 rue des Lilas.
   */
  const activeBien = useMemo(() => getActiveBien(), []);
  const isLive = !!(activeBien?.adresse?.label);
  const realAcquereurs = useMemo(() => (isLive ? getAcquereurs() : []), [isLive]);

  // État persisté par Step3/Step5 (points forts/vigilance édités, prix retenu,
  // stratégie sélectionnée, comparables sélectionnés en Top 3).
  const reportState = useMemo(() => (isLive ? getReportState() : {}), [isLive]);
  // Comparables ajoutés à la main par l'agent dans Step3.
  const manualComps = useMemo(() => (isLive ? loadManualComparables() : []), [isLive]);

  // Photos IndexedDB (mode live uniquement) : chargement async + revoke au démontage
  const [livePhotos, setLivePhotos] = useState([]);
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const photos = await getPhotosForCarousel();
        if (!cancelled) setLivePhotos(photos || []);
      } catch (err) {
        console.warn('[CompteRendu] photos load error', err);
      }
    })();
    return () => {
      cancelled = true;
      revokePhotoUrls(livePhotos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // Lookup tolérant : trouve une valeur dans bienDetails par fin de clé
  // (les clés sont slugifiées "${catSlug}__${fieldSlug}" mais on cherche
  // souvent par fieldSlug seul).
  const findDetail = (bd, ...fieldSlugs) => {
    if (!bd) return undefined;
    const keys = Object.keys(bd);
    for (const slug of fieldSlugs) {
      const hit = keys.find((k) => k.endsWith(`__${slug}`) || k === slug);
      if (hit && bd[hit] !== undefined && bd[hit] !== '' && bd[hit] !== null) return bd[hit];
    }
    return undefined;
  };

  // effProperty : forme identique à property{} mais dérivée d'activeBien
  // + enrichie par les saisies détaillées de Step1 (reportState.bienDetails).
  const effProperty = useMemo(() => {
    if (!isLive) return property;
    const b = activeBien.bien || {};
    const adr = activeBien.adresse || {};
    const bd = reportState.bienDetails || {};
    return {
      ...property,
      adresse: adr.label || '',
      surface: b.surface ?? findDetail(bd, 'surface_carrez_m', 'surface_totale_m', 'surface') ?? '—',
      pieces: b.pieces ?? findDetail(bd, 'nombre_de_pieces') ?? '—',
      chambres: b.chambres ?? findDetail(bd, 'nombre_de_chambres') ?? '—',
      etage: b.etage != null ? b.etage : (findDetail(bd, 'etage_du_bien') ?? '—'),
      annee: b.annee ?? findDetail(bd, 'annee_de_construction') ?? '—',
      // Les slugs sont dérivés du label exact des champs Step1 par slugifyKey.
      // Pour DPE/GES, le label réel est "DPE — Étiquette énergie" / "...GES",
      // d'où les slugs 'dpe_etiquette_energie' et 'dpe_etiquette_ges'. On
      // garde les anciens slugs en fallback pour la rétrocompatibilité.
      dpe: b.dpe
        || findDetail(bd, 'dpe_etiquette_energie', 'classe_dpe', 'dpe')
        || '—',
      ges: findDetail(bd, 'dpe_etiquette_ges', 'classe_ges', 'ges') || '',
      chauffage: findDetail(bd, 'type_de_chauffage') || '',
      // État saisi en Step0 (CreationBien) → activeBien.bien.etat ;
      // fallback sur "État général" de Step1 si présent.
      etat: b.etat || findDetail(bd, 'etat_general') || '',
      // Référence stable : dérivée de createdAt (sinon elle changeait à chaque
      // rafraîchissement de la page à cause de Math.random).
      reference: (() => {
        const dt = new Date(activeBien.createdAt || Date.now());
        const y = dt.getFullYear();
        const seed = Math.abs(dt.getTime()) % 90000 + 10000;
        return `IDR-${y}-${seed}`;
      })(),
    };
  }, [isLive, activeBien, reportState]);

  // effContexteZone : marché local depuis reportState.contexteMarche (Step2)
  // si dispo, sinon depuis dvfStats du bien actif, sinon fallback contexteZone.
  const effContexteZone = useMemo(() => {
    if (!isLive) return contexteZone;
    const ctx = reportState.contexteMarche || {};
    const dvfLive = ctx.dvfLive || {};
    const dvf = (activeBien.dvfStats && activeBien.dvfStats.median) ? activeBien.dvfStats : dvfLive;
    const city = activeBien.adresse?.city || '';

    // Format helpers
    const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') : (n || '—'));
    const fourchetteFromDvf = (d) => (d.p25 && d.p75 ? `${fmt(d.p25)} – ${fmt(d.p75)}` : (d.fourchette || ctx.fourchette || '—'));

    return {
      ...contexteZone,
      zoneLabel: ctx.zoneLabel || (city ? `${city} (secteur du bien)` : 'Secteur du bien'),
      rayonMetres: ctx.rayon || contexteZone.rayonMetres,
      market: {
        ...contexteZone.market,
        prixM2: ctx.prixM2Median || (dvf.median ? Math.round(dvf.median).toLocaleString('fr-FR') : '—'),
        evolution: ctx.evolution || dvf.evolution || '—',
        transactions: ctx.transactions ?? dvf.count ?? '—',
        delai: ctx.delaiMoyen || dvf.delaiMoyen || '—',
        fourchette: ctx.fourchette || fourchetteFromDvf(dvf),
      },
      tensionLabel: dvf.tensionLabel || ctx.tensionLabel || '—',
      tensionScore: dvf.tensionScore ?? ctx.tensionScore ?? '—',
      commodites: [], // POI rendus dans une section dédiée plus bas
      poi: ctx.poi || null,
      risques: ctx.risques || null,
    };
  }, [isLive, activeBien, reportState]);

  // effComparables : priorité à ce que l'agent a sélectionné en Step3
  // (reportState.comparablesSelectionnes) + comparables saisis à la main
  // (manualComps) ; sinon fallback sur dvfTopComparables.
  //
  // Les comparables Step3 ont des formes hétérogènes (DVF promu, manual,
  // legacy avant patch d'enrichissement). On extrait donc agressivement
  // depuis tous les containers possibles : champs racine, c.fields,
  // c._dvfRaw, c.meta string, c.title string.
  const effComparables = useMemo(() => {
    if (!isLive) return comparables;
    const sel = Array.isArray(reportState.comparablesSelectionnes)
      ? reportState.comparablesSelectionnes
      : [];
    const dvfTop = Array.isArray(activeBien.dvfTopComparables) ? activeBien.dvfTopComparables : [];

    // ─── Helpers d'extraction tolérants ─────────────────────────────────
    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const s = String(v);
      // Gère "295k€" → 295000
      const kMatch = s.match(/(\d+(?:[.,]\d+)?)\s*k/i);
      if (kMatch) return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
      const cleaned = s.replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };
    // Extrait surface / pieces / type d'un titre type "T3 65m² — adresse".
    const parseTitle = (title) => {
      if (!title || typeof title !== 'string') return {};
      const out = {};
      const surfMatch = title.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
      if (surfMatch) out.surface = toNum(surfMatch[1]);
      const piecesMatch = title.match(/T\s*(\d+)/i);
      if (piecesMatch) out.pieces = Number(piecesMatch[1]);
      if (/maison/i.test(title)) out.type = 'maison';
      else if (/appartement|^T\s*\d/i.test(title)) out.type = 'appartement';
      return out;
    };
    // Extrait prix, prixM2, distance, date depuis la string meta type
    // "DVF · 295k€ · 4 214€/m² · 750m · Mar. 2025".
    const parseMeta = (meta) => {
      if (!meta || typeof meta !== 'string') return {};
      const parts = meta.split(/\s+·\s+/);
      const out = {};
      parts.forEach((p) => {
        const s = p.trim();
        // prix/m²
        if (/€\/m²|€ ?\/m²/i.test(s)) {
          out.prixM2 = toNum(s);
        } else if (/€/.test(s)) {
          out.prix = toNum(s);
        } else if (/^\d+(?:[.,]\d+)?\s*(?:km|m)$/i.test(s)) {
          // distance "750m" ou "1.2km"
          const km = /km/i.test(s);
          const n = parseFloat(s.replace(',', '.').replace(/[^\d.]/g, ''));
          out.distance = km ? Math.round(n * 1000) : Math.round(n);
        } else if (/^(Janv|Févr|Mars|Avr|Mai|Juin|Juil|Août|Sept|Oct|Nov|Déc)/i.test(s)) {
          out.dateLabel = s;
        }
      });
      return out;
    };
    const formatDate = (d) => {
      if (!d) return '';
      if (typeof d === 'string' && d.includes('-')) {
        try {
          return new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        } catch {
          return d;
        }
      }
      return String(d);
    };
    const formatDistance = (raw) => {
      if (raw === null || raw === undefined || raw === '') return '';
      if (typeof raw === 'number') return raw >= 1000 ? `${(raw / 1000).toFixed(1)} km` : `${raw} m`;
      const s = String(raw);
      // Si déjà formatée ("750m" / "1.2km" / "1,2 km")
      if (/m|km/i.test(s)) return s.replace(/(\d)(km|m)/i, '$1 $2');
      const n = parseFloat(s.replace(',', '.'));
      return Number.isFinite(n) ? (n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.round(n)} m`) : '';
    };

    // ─── Normalisation d'un comparable hétérogène ────────────────────────
    const normalize = (c, idx, fallbackSource = 'dvf') => {
      const src = c.source || fallbackSource;
      const raw = c._dvfRaw || {};
      const f = c.fields || {};
      const parsedT = parseTitle(c.title);
      const parsedM = parseMeta(c.meta);

      const surfaceN = toNum(c.surface ?? f.surface ?? raw.surface ?? parsedT.surface);
      const piecesN = toNum(c.pieces ?? f.pieces ?? raw.pieces ?? parsedT.pieces);
      const typeStr = c.type || f.type || raw.type || parsedT.type || 'appartement';
      const prixN = toNum(c.prixRaw ?? f.prix ?? raw.prix ?? c.prix ?? parsedM.prix);
      const prixM2N = toNum(c.prixM2Raw ?? f.prixM2 ?? raw.prixM2 ?? c.prixM2 ?? parsedM.prixM2)
        || (surfaceN && prixN ? Math.round(prixN / surfaceN) : 0);
      const adresseStr = c.addr || c.adresse || raw.adresse
        || (raw.commune ? `${raw.cp || ''} ${raw.commune}`.trim() : '')
        || '';
      const dateStr = c.dateLabel || parsedM.dateLabel || formatDate(c.date || raw.date || raw.date_mutation);
      const distanceN = c.distance ?? parsedM.distance ?? raw.distance;
      const distanceLabel = formatDistance(distanceN);

      const typeLabel = typeStr === 'maison' ? 'Maison'
        : typeStr === 'appartement' ? 'Appartement'
        : typeStr.charAt(0).toUpperCase() + typeStr.slice(1);

      const etageVal = c.etage ?? f.etage ?? raw.etage;
      const etageMaxVal = c.etagesTotal ?? c.etageMax ?? f.etageMax ?? raw.etagesTotal;
      const dpeVal = c.dpe || f.dpe || raw.dpe || '';
      const etatVal = c.etat || c.infosGenerales?.etatGeneral || f.etat || '';
      const expoVal = c.exposition || c.orientation || f.exposition || f.orientation || '';
      const anneeVal = c.anneeConstruction || c.annee || f.anneeConstruction
        || f.annee || raw.anneeConstruction || raw.annee || '';

      return {
        id: c.id || `${src}-${idx}`,
        source: src,
        sourceLabel: c.sourceLabel || (src === 'dvf' ? 'DVF' : src === 'ideeri' ? 'Ideeri' : src === 'encours' ? 'En cours' : 'Portail'),
        type: typeLabel,
        typeRaw: typeStr,
        surface: surfaceN || 0,
        pieces: piecesN || 0,
        adresse: adresseStr || '—',
        prix: prixN || 0,
        prixM2: prixM2N || 0,
        prixM2Raw: prixM2N || 0,
        date: dateStr || '',
        distance: distanceLabel || '—',
        etage: (etageVal === 0 || etageVal) ? etageVal : '—',
        etageMax: (etageMaxVal === 0 || etageMaxVal) ? etageMaxVal : '—',
        selected: true,
        dpe: dpeVal || '—',
        etat: etatVal || '—',
        atouts: c.atoutsQualitatifs || c.atouts || [],
        exposition: expoVal || '—',
        anneeConstruction: anneeVal || '—',
        // Photo : priorité au tableau saisi par l'agent, puis photoUrl
        // unique, sinon null (la card affiche un placeholder texte).
        photoUrl: (Array.isArray(c.photos) && c.photos[0])
          || c.photoUrl
          || null,
        photos: Array.isArray(c.photos) ? c.photos : (c.photoUrl ? [c.photoUrl] : []),
        urlAnnonce: c.urlAnnonce || c.urlSource || null,
        commentairePertinence: c.commentairePertinence || (c.manual
          ? 'Comparable saisi manuellement par l\'agent.'
          : src === 'dvf'
            ? 'Comparable issu de la base DVF (transaction confirmée).'
            : 'Comparable de référence.'),
        raisonEcart: c.raisonEcart || '',
        donneesCroisees: c.donneesCroisees || { fiabilite: src === 'dvf' || src === 'ideeri' ? 'haute' : 'moyenne' },
      };
    };

    // Agrège tous les comparables disponibles, dédupliqués par id.
    const dedupe = (arr) => {
      const seen = new Set();
      const out = [];
      for (const c of arr) {
        const id = c?.id;
        if (!id || !seen.has(id)) {
          if (id) seen.add(id);
          out.push(c);
        }
      }
      return out;
    };

    // Source primaire : les sélectionnés (Top retenu par l'agent).
    if (sel.length > 0) {
      // On ajoute aussi les manuels qui n'auraient pas été sélectionnés,
      // pour qu'ils restent visibles dans la section "Autres biens analysés".
      const selNorm = sel.map((c, idx) => normalize(c, idx, c.source || 'portail'));
      const selIds = new Set(selNorm.map((c) => c.id));
      const extraManual = manualComps
        .filter((c) => !selIds.has(c.id))
        .map((c, idx) => ({ ...normalize(c, idx + sel.length, c.source || 'portail'), selected: false }));
      return dedupe([...selNorm, ...extraManual]);
    }
    // Sinon : manuels + DVF top (tous "sélectionnés" par défaut pour qu'ils
    // s'affichent dans la grille principale).
    const manualNormalized = manualComps.map((c, idx) => normalize(c, idx, c.source || 'portail'));
    const dvfNormalized = dvfTop.map((c, idx) => normalize(c, idx + manualNormalized.length, 'dvf'));
    return dedupe([...manualNormalized, ...dvfNormalized]);
  }, [isLive, activeBien, reportState, manualComps]);

  // effAvisValeur : prix depuis activeBien.result + génération auto des
  // points forts / vigilance depuis les caractéristiques du bien
  // (mêmes règles qu'en Step5AvisValeur — DPE, étage, exposition, exterieur,
  // parking, état, année).
  const effAvisValeur = useMemo(() => {
    if (!isLive) return avisValeur;
    const r = activeBien.result || {};
    const prixBas = r.prixBas || 0;
    const prixHaut = r.prixHaut || 0;
    const prixMedian = r.prix || Math.round((prixBas + prixHaut) / 2);
    const surface = activeBien.bien?.surface || 1;
    const prixM2 = r.prixM2 || Math.round(prixMedian / surface);

    // Step0 saisit type/surface/pieces/.../etat/exposition mais PAS le DPE
    // (qui est saisi en Step1 dans la catégorie « Isolation Thermique »).
    // On enrichit donc 'bien' depuis reportState.bienDetails pour que les
    // règles auto (points forts / vigilance) voient bien le DPE saisi.
    const bd = reportState.bienDetails || {};
    const bienRaw = activeBien.bien || {};
    const bien = {
      ...bienRaw,
      dpe: bienRaw.dpe
        || findDetail(bd, 'dpe_etiquette_energie', 'classe_dpe', 'dpe')
        || null,
      ges: bienRaw.ges
        || findDetail(bd, 'dpe_etiquette_ges', 'classe_ges', 'ges')
        || null,
    };
    const forts = [];
    const vigilance = [];

    const dpe = bien.dpe ? String(bien.dpe).toUpperCase() : null;
    if (dpe && ['A', 'B', 'C'].includes(dpe)) {
      forts.push(`DPE ${dpe} — bien performant énergétiquement`);
    } else if (dpe && ['F', 'G'].includes(dpe)) {
      vigilance.push(`DPE ${dpe} — passoire thermique (interdiction de location 2025/2028)`);
    } else if (dpe === 'E') {
      vigilance.push(`DPE E — interdiction de location prévue en 2034`);
    }

    if (bien.type === 'appartement' && bien.etage != null && bien.etage !== '') {
      const e = Number(bien.etage);
      if (e === 0) vigilance.push('Rez-de-chaussée — vis-à-vis et sécurité à anticiper');
      else if (e >= 6 && !bien.ascenseur) vigilance.push(`${e}e étage sans ascenseur — frein commercial fort`);
      else if (e >= 3 && bien.ascenseur) forts.push(`${e}e étage avec ascenseur — vue dégagée et confort`);
    }

    if (bien.exposition && /sud/i.test(bien.exposition)) {
      forts.push(`Exposition ${bien.exposition.replace('_', '-')} — luminosité optimale`);
    } else if (bien.exposition === 'nord') {
      vigilance.push('Exposition nord — luminosité réduite');
    }

    if (bien.exterieur === 'jardin') forts.push('Jardin — atout différenciant rare en zone urbaine');
    else if (bien.exterieur === 'terrasse') forts.push('Terrasse — extérieur très recherché');
    else if (bien.exterieur === 'balcon') forts.push('Balcon — extérieur appréciable');
    else if (bien.exterieur === 'aucun' && bien.type === 'appartement') {
      vigilance.push('Absence d’extérieur — frein post-Covid');
    }

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

    // Si l'agent a édité les points dans Step5, on prend SES saisies ;
    // sinon on retombe sur les règles auto calculées ci-dessus.
    const fortsEdites = Array.isArray(reportState.pointsForts) && reportState.pointsForts.length > 0
      ? reportState.pointsForts
      : forts;
    const vigilanceEdites = Array.isArray(reportState.pointsVigilance) && reportState.pointsVigilance.length > 0
      ? reportState.pointsVigilance
      : vigilance;

    // Stratégies : le customPrice retenu en Step5 prime sur le prix médian.
    const customPrice = typeof reportState.customPrice === 'number' && reportState.customPrice > 0
      ? reportState.customPrice
      : prixMedian;
    const customPrixM2 = surface > 0 ? Math.round(customPrice / surface) : prixM2;
    const selectedIdx = typeof reportState.selectedStrategy === 'number'
      ? reportState.selectedStrategy
      : 1; // par défaut "Recommandé"

    const strategies = [
      { label: 'Prudent', prix: prixBas, prixM2: Math.round(prixBas / surface), delai: '—', profilCible: '—', risque: '—', argumentaireDetaille: 'Borne basse de la fourchette d\'estimation.', recommended: selectedIdx === 0 },
      { label: 'Recommandé', prix: customPrice, prixM2: customPrixM2, delai: '—', profilCible: '—', risque: '—', argumentaireDetaille: 'Prix retenu par l\'agent à partir de l\'analyse cascade.', recommended: selectedIdx === 1 },
      { label: 'Ambitieux', prix: prixHaut, prixM2: Math.round(prixHaut / surface), delai: '—', profilCible: '—', risque: '—', argumentaireDetaille: 'Borne haute de la fourchette d\'estimation.', recommended: selectedIdx === 2 },
    ];

    return {
      ...avisValeur,
      prixBas,
      prixHaut,
      prixM2: customPrixM2,
      strategies,
      decomposition: Array.isArray(r.breakdown) && r.breakdown.length > 0 ? r.breakdown : avisValeur.decomposition,
      pointsForts: fortsEdites,
      pointsVigilance: vigilanceEdites,
      acquereurs: realAcquereurs.map((a) => ({ budget: (a.budgetMax || 0) * 1000 })),
      afficherCommodites: false,
      // Avis du vendeur saisi en Step5 (ressenti du propriétaire au RDV).
      avisVendeur: typeof reportState.avisVendeur === 'string' ? reportState.avisVendeur : '',
    };
  }, [isLive, activeBien, realAcquereurs, reportState]);

  // Identités effectives — on prend en priorité les saisies persistées
  // (reportState.agence/agent/mandant), et on retombe sur les mocks
  // propertyData pour tout champ vide. Cela permet à l'agent de
  // surcharger n'importe quel champ depuis une fiche de réglages sans
  // perdre les valeurs par défaut de démo.
  const effAgence = useMemo(() => {
    const persisted = (reportState.agence && typeof reportState.agence === 'object')
      ? reportState.agence : {};
    const merged = { ...agence };
    Object.keys(persisted).forEach((k) => {
      const v = persisted[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
    return merged;
  }, [reportState]);

  const effAgent = useMemo(() => {
    const persisted = (reportState.agent && typeof reportState.agent === 'object')
      ? reportState.agent : {};
    const merged = { ...agent };
    Object.keys(persisted).forEach((k) => {
      const v = persisted[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
    return merged;
  }, [reportState]);

  const effMandant = useMemo(() => {
    const persisted = (reportState.mandant && typeof reportState.mandant === 'object')
      ? reportState.mandant : {};
    const merged = { ...mandant };
    Object.keys(persisted).forEach((k) => {
      const v = persisted[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
    return merged;
  }, [reportState]);

  // effLettre : textes de la lettre page 2 saisis dans Réglages, avec
  // fallback sur les phrases par défaut (propertyData.avisValeur.lettre +
  // fallbacks hard-codés pour l'objet / la formule d'appel / la formule
  // de politesse qui n'existaient pas en mock).
  const effLettre = useMemo(() => {
    const persisted = (reportState.lettre && typeof reportState.lettre === 'object')
      ? reportState.lettre : {};
    const pick = (key, fallback) => {
      const v = persisted[key];
      return (typeof v === 'string' && v.trim() !== '') ? v : fallback;
    };
    return {
      objet: pick('objet', null),                             // null → format auto avec adresse
      formuleAppel: pick('formuleAppel', null),               // null → format auto avec civilité + nom
      introParagraphe: pick('introParagraphe', avisValeur?.lettre?.introParagraphe || ''),
      paragrapheMethodologie: pick(
        'paragrapheMethodologie',
        "Notre méthodologie s'appuie sur l'analyse de biens comparables, la mesure de la tension de marché dans votre secteur et les caractéristiques propres de votre bien. Vous retrouverez le détail dans les pages suivantes.",
      ),
      cloture: pick('cloture', avisValeur?.lettre?.cloture || ''),
      formulePolitesse: pick('formulePolitesse', 'Je reste à votre disposition,'),
    };
  }, [reportState]);

  const themeStyle = {
    '--primary': effAgence.couleurPrimaire,
    '--secondary': effAgence.couleurSecondaire,
  };

  const recommendedStrategy = effAvisValeur.strategies.find((s) => s.recommended) || effAvisValeur.strategies[0];

  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isPrintMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('print') === '1';

  // Mode partage : le rapport est ouvert via un lien sécurisé (?t=JWT).
  // On masque les actions agent (bouton Retour, Partager) pour le mandant.
  const shareToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('t')
      : null;
  const isSharedView = Boolean(shareToken);

  const [shareStatus, setShareStatus] = useState('idle'); // idle|loading|copied|error

  // Avis de l'agent sur l'état du marché local (ex. « point positif :
  // beaucoup de commerces à proximité »). Éditable dans le rapport, persisté
  // dans le reportStore. Masqué en lecture seule (impression / vue partagée).
  const [avisMarche, setAvisMarche] = useState(() => {
    const v = reportState.avisMarche;
    return typeof v === 'string' ? v : '';
  });
  const persistAvisMarche = () => setReportState({ avisMarche });

  const selectedComps = effComparables.filter((c) => c.selected);

  // Personas d'acquéreurs : en web on sélectionne, en PDF tout est déplié.
  // En mode live, on ne dispose pas de personas regroupés → on affichera
  // une liste plate des acquéreurs réels dans la section 6.
  const personasList = Object.values(personasAcquereurs);
  const [activePersonaKey, setActivePersonaKey] = useState(personasList[0].key);

  // Prix de référence pour le filtre acquéreur : on prend le prix retenu
  // par l'agent (customPrice → médiane) ; on ne considère un acquéreur
  // comme "compatible budget" que si son plafond couvre ce prix.
  const prixReference = isLive
    ? (typeof reportState.customPrice === 'number' && reportState.customPrice > 0
        ? reportState.customPrice
        : (activeBien.result?.prix || 0))
    : 0;

  // En mode live, si aucun acquéreur réel n'a été saisi, on simule un fichier
  // d'acquéreurs fictifs (DEMO_ACQUEREURS) pour que la section ne soit pas vide.
  const usingDemoAcquereurs = isLive && realAcquereurs.length === 0;
  const effAcquereurs = isLive
    ? (usingDemoAcquereurs ? DEMO_ACQUEREURS : realAcquereurs)
    : [];

  // Partitionnement : compatibles (budgetMax * 1000 >= prixReference) vs
  // hors budget. Si l'acquéreur n'a pas de budgetMax → considéré inconnu
  // donc on l'affiche (pas d'exclusion arbitraire).
  const acquereursCompatibles = isLive
    ? effAcquereurs.filter((a) => {
        const bm = Number(a.budgetMax);
        if (!Number.isFinite(bm) || bm <= 0) return true;
        if (!prixReference) return true;
        return bm * 1000 >= prixReference;
      })
    : [];
  const acquereursHorsBudget = isLive
    ? effAcquereurs.filter((a) => {
        const bm = Number(a.budgetMax);
        if (!Number.isFinite(bm) || bm <= 0) return false;
        if (!prixReference) return false;
        return bm * 1000 < prixReference;
      })
    : [];
  const totalProjets = isLive
    ? acquereursCompatibles.length
    : personasList.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="report-root" style={themeStyle}>
      <style>{reportCss}</style>

      {/* =============================================================
          SECTION 1 — Couverture
          ============================================================= */}
      <section className="cover">
        <img src={effAgence.logo} alt={effAgence.nom} className="cover-logo" />
        <div className="cover-bar" />
        <h1 className="cover-title">ÉTUDE DE MARCHÉ</h1>
        <p className="cover-address">{effProperty.adresse || '—'}</p>
        <div className="cover-hero" aria-hidden="true">
          {isLive && livePhotos[0]?.src ? (
            <img src={livePhotos[0].src} alt="Photo principale" className="cover-hero-img" />
          ) : (
            <div className="cover-hero-placeholder">
              <span>{effProperty.surface} m² · T{effProperty.pieces} · Étage {effProperty.etage}</span>
            </div>
          )}
        </div>
        <div className="cover-meta">
          <div>Référence : <strong>{effProperty.reference}</strong></div>
          <div>Établi le {dateEdition}</div>
          <div>Par {effAgent.nom}, {effAgent.fonction}</div>
        </div>
        <div className="cover-footer">
          Document confidentiel · Établi par {effAgence.nom} · {dateEdition}
        </div>
      </section>

      {/* =============================================================
          SECTION 2 — Lettre d'accompagnement
          ============================================================= */}
      <section className="letter page-break">
        <div className="letter-header">
          <div className="letter-from">
            <strong>{effAgence.nom}</strong>
            <div>{effAgence.adresse}</div>
            <div>{effAgence.tel}</div>
            <div>{effAgence.email}</div>
          </div>
          <div className="letter-to">
            <strong>{effMandant.civilite} {effMandant.prenom} {effMandant.nom}</strong>
            <div>{effMandant.adresseCorrespondance}</div>
          </div>
        </div>

        <p className="letter-date">{(effAgence.adresse || '').split(',').slice(-1)[0].trim().split(' ').slice(-1)[0] /* ville */ ? `Lyon, le ${dateEdition}` : `Le ${dateEdition}`}</p>

        <p className="letter-object">
          <strong>Objet :</strong> {effLettre.objet || `Étude de marché — ${effProperty.adresse || '—'}`}
        </p>

        <div className="letter-body">
          <p>{effLettre.formuleAppel || `${effMandant.civilite || ''} ${effMandant.nom || ''}`.trim() + ','}</p>
          <p>{effLettre.introParagraphe || effAvisValeur.lettre.introParagraphe}</p>
          <p>
            Au terme de notre analyse, nous évaluons la valeur vénale de votre bien
            à <strong>{(effAvisValeur.prixBas || 0).toLocaleString('fr-FR')} € — {(effAvisValeur.prixHaut || 0).toLocaleString('fr-FR')} €</strong>,
            avec une recommandation de prix de présentation à <strong>{(recommendedStrategy?.prix || 0).toLocaleString('fr-FR')} €</strong>.
          </p>
          <p>{effLettre.paragrapheMethodologie}</p>
          <p>{effLettre.cloture || effAvisValeur.lettre.cloture}</p>
          <p>{effLettre.formulePolitesse}</p>
        </div>

        <div className="letter-signature">
          {effAgent.signature && (
            <img src={effAgent.signature} alt="Signature" className="signature-img" />
          )}
          <div><strong>{effAgent.nom}</strong></div>
          <div>{effAgent.fonction}</div>
          <div>{effAgent.telDirect || effAgent.telephone} · {effAgent.email}</div>
        </div>
      </section>

      {/* Section Synthèse supprimée à la demande — le prix/fourchette est
          présenté directement en section Proposition commerciale. */}

      {/* =============================================================
          SECTION 4 — Votre bien
          ============================================================= */}
      <section className="property page-break">
        <h2 className="section-title">Votre bien</h2>

        <div className="property-gallery">
          {isLive ? (
            livePhotos.length > 0 ? (
              <>
                <div className="photo-main" style={{ backgroundImage: `url(${livePhotos[0].src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div className="photo-grid">
                  {livePhotos.slice(1, 4).map((p, i) => (
                    <div
                      key={p.id || i}
                      className="photo-thumb"
                      style={{ backgroundImage: `url(${p.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="photo-main" style={{ color: '#999' }}>Aucune photo ajoutée</div>
            )
          ) : (
            <>
              <div className="photo-main">Photo principale</div>
              <div className="photo-grid">
                <div className="photo-thumb">Séjour</div>
                <div className="photo-thumb">Cuisine</div>
                <div className="photo-thumb">Chambre</div>
              </div>
            </>
          )}
        </div>

        <div className="property-specs">
          <div className="spec-col">
            <div className="spec-row"><span>Type</span><strong>{isLive ? (activeBien?.bien?.type === 'maison' ? 'Maison' : 'Appartement') : 'Appartement'} T{effProperty.pieces}</strong></div>
            <div className="spec-row"><span>Surface</span><strong>{effProperty.surface} m²</strong></div>
            <div className="spec-row"><span>Pièces</span><strong>{effProperty.pieces}</strong></div>
            <div className="spec-row"><span>Chambres</span><strong>{effProperty.chambres}</strong></div>
            <div className="spec-row"><span>Étage</span><strong>{effProperty.etage}{isLive ? '' : ' / 6'}</strong></div>
            <div className="spec-row"><span>Année</span><strong>{effProperty.annee}</strong></div>
          </div>
          <div className="spec-col">
            <div className="spec-row">
              <span>DPE</span>
              <strong className={`dpe-badge dpe-${effProperty.dpe}`}>{effProperty.dpe}</strong>
            </div>
            <div className="spec-row">
              <span>GES</span>
              <strong className={`dpe-badge dpe-${isLive ? (effProperty.ges || 'D') : 'D'}`}>{isLive ? (effProperty.ges || '—') : 'D'}</strong>
            </div>
            <div className="spec-row"><span>Exposition</span><strong>{isLive ? (activeBien?.bien?.exposition || '—') : 'Sud-Est'}</strong></div>
            <div className="spec-row"><span>Chauffage</span><strong>{isLive ? (effProperty.chauffage || '—') : 'Individuel gaz'}</strong></div>
            <div className="spec-row"><span>État</span><strong>{isLive ? (effProperty.etat || '—') : 'Bon état'}</strong></div>
            <div className="spec-row"><span>Ascenseur</span><strong>{isLive ? (activeBien?.bien?.ascenseur ? 'Oui' : 'Non') : 'Oui'}</strong></div>
          </div>
        </div>

        {!isLive && (
          <p className="property-desc">
            Bel appartement T{effProperty.pieces} de {effProperty.surface} m² traversant, situé au {effProperty.etage}ᵉ
            étage avec ascenseur d'un immeuble des années 1970 en bon état d'entretien.
            Il dispose d'un balcon de 5,2 m² exposé Sud-Est, d'une cave et d'un parking
            extérieur. La cuisine ouverte sur le séjour lumineux offre un espace de vie
            agréable. Les menuiseries double vitrage performant et la chaudière gaz à
            condensation de 2018 permettent une consommation maîtrisée.
          </p>
        )}

        {!isLive && (
          <div className="property-tags">
            <span className="pill">Balcon</span>
            <span className="pill">Ascenseur</span>
            <span className="pill">Cave</span>
            <span className="pill">Parking</span>
            <span className="pill">DPE D</span>
            <span className="pill">Métro 350m</span>
          </div>
        )}
        {isLive && (
          <div className="property-tags">
            {activeBien?.bien?.exterieur && activeBien.bien.exterieur !== 'aucun' && (
              <span className="pill">{activeBien.bien.exterieur.charAt(0).toUpperCase() + activeBien.bien.exterieur.slice(1)}</span>
            )}
            {activeBien?.bien?.ascenseur && <span className="pill">Ascenseur</span>}
            {activeBien?.bien?.parking && activeBien.bien.parking !== 'aucun' && (
              <span className="pill">Parking {activeBien.bien.parking}</span>
            )}
            {effProperty.dpe && effProperty.dpe !== '—' && <span className="pill">DPE {effProperty.dpe}</span>}
          </div>
        )}
      </section>

      {/* =============================================================
          SECTION 4 bis — Fiche technique détaillée (mode live)
          Affiche toutes les saisies des accordéons Step1 (bienDetails),
          regroupées par catégorie. Seuls les champs non vides sont rendus.
          ============================================================= */}
      {isLive && reportState.bienDetails && Object.keys(reportState.bienDetails).length > 0 && (
        <section className="fiche-technique page-break">
          <h2 className="section-title">Fiche technique du bien</h2>
          <p className="section-intro" style={{ marginBottom: 24, color: '#666' }}>
            Ensemble des caractéristiques relevées lors de la visite et de la saisie
            du dossier. Ces informations alimentent la valorisation et permettent
            de qualifier précisément l'état du bien.
          </p>

          {(() => {
            // Groupe les clés par préfixe catégorie (`${catSlug}__${fieldSlug}`)
            const bd = reportState.bienDetails || {};
            const groups = {};
            Object.entries(bd).forEach(([key, value]) => {
              // Filtre : on ignore les valeurs vides / nulles / false (pour les toggles non cochés)
              if (value === '' || value === null || value === undefined) return;
              if (value === false) return;
              const idx = key.indexOf('__');
              const catSlug = idx > 0 ? key.slice(0, idx) : '_autres';
              const fieldSlug = idx > 0 ? key.slice(idx + 2) : key;
              if (!groups[catSlug]) groups[catSlug] = [];
              groups[catSlug].push({ fieldSlug, value });
            });

            // Helpers d'affichage : slug -> libellé humain
            const humanize = (slug) => {
              if (!slug) return '';
              return slug
                .split('_')
                .filter(Boolean)
                .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
                .join(' ');
            };
            const formatValue = (v) => {
              if (v === true) return 'Oui';
              if (v === false) return 'Non';
              if (typeof v === 'number') return v.toLocaleString('fr-FR');
              return String(v);
            };

            // Ordre privilégié des catégories
            const CAT_ORDER = [
              'identification_juridique',
              'caracteristiques_generales',
              'structure',
              'revetements_muraux',
              'revetements_de_sol',
              'menuiseries',
              'portes',
              'electrique',
              'plomberie',
              'chauffage',
            ];
            const catKeys = Object.keys(groups).sort((a, b) => {
              const ia = CAT_ORDER.indexOf(a);
              const ib = CAT_ORDER.indexOf(b);
              if (ia === -1 && ib === -1) return a.localeCompare(b);
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            });

            return catKeys.map((catKey) => {
              // Chaque ligne « libellé · valeur » est préparée puis passée au
              // Collapsible : 3 visibles + « Voir plus » pour gagner de la place.
              const rows = groups[catKey].map(({ fieldSlug, value }) => (
                <div key={fieldSlug} className="fiche-row">
                  <span className="fiche-row-label">{humanize(fieldSlug)}</span>
                  <strong className="fiche-row-value">{formatValue(value)}</strong>
                </div>
              ));
              return (
                <div key={catKey} className="fiche-cat cr-collapse-cat">
                  <h3 className="cr-collapse-title">{humanize(catKey)}</h3>
                  <div className="fiche-list">
                    <Collapsible items={rows} visibleCount={3} printMode={isPrintMode} />
                  </div>
                </div>
              );
            });
          })()}
        </section>
      )}

      {/* =============================================================
          SECTION 5 — Votre marché local (V2, factuel uniquement)
          ============================================================= */}
      <section className="market page-break">
        <h2 className="section-title">Le marché local de votre bien</h2>
        <p className="market-zone">
          {effContexteZone.zoneLabel} · rayon {effContexteZone.rayonMetres} m autour du bien
        </p>

        {isLive && Array.isArray(activeBien?.adresse?.coords) && activeBien.adresse.coords.length === 2 && (
          <MarketMiniMap
            coords={activeBien.adresse.coords}
            poi={effContexteZone.poi}
            rayon={Number(effContexteZone.rayonMetres) || 1000}
          />
        )}

        <div className="market-kpis">
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.prixM2} €/m²</div>
            <div className="kpi-label">Médiane secteur</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.evolution}</div>
            <div className="kpi-label">Évolution 12 mois</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.delai}</div>
            <div className="kpi-label">Délai moyen de vente</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.transactions}</div>
            <div className="kpi-label">Transactions 12 mois</div>
          </div>
        </div>

        <div className="market-tension">
          <strong>Tension du marché : </strong>
          <span className="tension-badge">{effContexteZone.tensionLabel}</span>
          <span className="tension-score">{effContexteZone.tensionScore}/10</span>
        </div>

        <p className="market-caption">
          Fourchette de prix observée sur la typologie T{effProperty.pieces} dans votre secteur :
          <strong> {effContexteZone.market.fourchette} €/m²</strong>.
        </p>

        {/* Avis de l'agent sur l'état du marché : éditable (sauf impression /
            vue partagée) puis affiché tel quel dans le rapport remis. */}
        {(!isPrintMode && !isSharedView) ? (
          <div className="market-avis-edit">
            <label htmlFor="cr-avis-marche">Votre avis sur l'état du marché</label>
            <textarea
              id="cr-avis-marche"
              className="market-avis-input"
              rows={2}
              placeholder="Ex. : point positif — beaucoup de commerces à proximité, marché dynamique sur la typologie."
              value={avisMarche}
              onChange={(e) => setAvisMarche(e.target.value)}
              onBlur={persistAvisMarche}
            />
          </div>
        ) : (
          avisMarche.trim().length > 0 && (
            <div className="market-avis-view">
              <h3>Notre regard sur le marché local</h3>
              <p>{avisMarche}</p>
            </div>
          )
        )}
      </section>

      {/* =============================================================
          SECTION 5 bis — Commodités à proximité (POI Overpass / Step2)
          Source : reportState.contexteMarche.poi (persisté par Step2).
          ============================================================= */}
      {isLive && effContexteZone.poi && Object.keys(effContexteZone.poi).some((k) => Array.isArray(effContexteZone.poi[k]) && effContexteZone.poi[k].length > 0) && (
        <section className="commodites page-break">
          <h2 className="section-title">Commodités à proximité</h2>
          <p className="section-intro" style={{ marginBottom: 24, color: '#666' }}>
            Points d'intérêt relevés dans un rayon de {effContexteZone.rayonMetres || 1000} m
            autour du bien (source OpenStreetMap).
          </p>

          {(() => {
            const POI_LABELS = {
              transports: 'Transports & accessibilité',
              commerces: 'Commerces & services',
              education: 'Éducation',
              sante: 'Santé',
              environnement: 'Environnement & cadre de vie',
            };
            const POI_ORDER = ['transports', 'commerces', 'education', 'sante', 'environnement'];
            const fmtDist = (d) => {
              if (d == null) return '—';
              return d < 1000 ? `${d} m` : `${(d / 1000).toFixed(1)} km`;
            };

            return POI_ORDER
              .filter((cat) => Array.isArray(effContexteZone.poi[cat]) && effContexteZone.poi[cat].length > 0)
              .map((cat) => {
                // 3 POI visibles + « Voir plus » pour gagner de la place.
                const rows = effContexteZone.poi[cat].map((p, i) => (
                  <li key={i} className="poi-row">
                    <span className="poi-row-name">{p.name}</span>
                    <strong className="poi-row-dist">{fmtDist(p.distance)}</strong>
                  </li>
                ));
                return (
                  <div key={cat} className="poi-cat cr-collapse-cat">
                    <h3 className="cr-collapse-title">{POI_LABELS[cat]}</h3>
                    <ul className="poi-list">
                      <Collapsible items={rows} visibleCount={3} printMode={isPrintMode} />
                    </ul>
                  </div>
                );
              });
          })()}
        </section>
      )}

      {/* =============================================================
          SECTION 5 ter — Risques & Aléas (Géorisques / Step2)
          Source : reportState.contexteMarche.risques.
          ============================================================= */}
      {isLive && effContexteZone.risques && (() => {
        const r = effContexteZone.risques;
        // Au moins une donnée présente
        return !!(r.inondation || r.argile || r.sismique || r.radon || r.mouvement || r.basias);
      })() && (
        <section className="risques page-break">
          <h2 className="section-title">Risques & Aléas</h2>
          <p className="section-intro" style={{ marginBottom: 24, color: '#666' }}>
            Synthèse des risques naturels et technologiques répertoriés sur la commune
            (source : Géorisques — data.gouv.fr).
          </p>

          {(() => {
            const r = effContexteZone.risques;
            const items = [];
            if (r.inondation) {
              items.push({
                label: 'Inondation (PPRI)',
                value: r.inondation.present ? (r.inondation.niveau || 'Présent') : 'Aucun',
                level: r.inondation.present ? 'warn' : 'ok',
              });
            }
            if (r.argile && r.argile.niveau) {
              const niv = String(r.argile.niveau).toLowerCase();
              const isBad = /fort|élev/.test(niv);
              const isWarn = /moy/.test(niv);
              items.push({
                label: 'Retrait-gonflement argiles',
                value: r.argile.niveau,
                level: isBad ? 'bad' : isWarn ? 'warn' : 'ok',
              });
            }
            if (r.sismique && r.sismique.niveau) {
              const z = parseInt(r.sismique.zone, 10);
              const lvl = z >= 4 ? 'bad' : z === 3 ? 'warn' : 'ok';
              items.push({
                label: `Sismicité (zone ${r.sismique.zone || '?'})`,
                value: r.sismique.niveau,
                level: lvl,
              });
            }
            if (r.radon && r.radon.potentiel) {
              const lvl = r.radon.potentiel === 'Élevé' ? 'bad' : r.radon.potentiel === 'Moyen' ? 'warn' : 'ok';
              items.push({
                label: 'Potentiel radon',
                value: r.radon.potentiel,
                level: lvl,
              });
            }
            if (r.mouvement) {
              items.push({
                label: 'Mouvements de terrain (500 m)',
                value: r.mouvement.present ? `${r.mouvement.count} signalé(s)` : 'Aucun',
                level: r.mouvement.present ? 'warn' : 'ok',
              });
            }
            if (r.basias) {
              items.push({
                label: 'Sites BASIAS (500 m)',
                value: r.basias.present ? `${r.basias.count} signalé(s)` : 'Aucun',
                level: r.basias.present ? 'warn' : 'ok',
              });
            }

            const COLORS = { ok: '#46B962', warn: '#f5a623', bad: '#e74c3c' };

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}>
                {items.map((it, i) => (
                  <div key={i} style={{
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${COLORS[it.level]}`,
                    borderRadius: 6,
                    padding: '10px 14px',
                    background: '#fff',
                  }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>{it.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS[it.level] }}>
                      {it.value}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* =============================================================
          SECTION 6 — Profils d'acquéreurs en recherche
          (5 personas, reprend Acte 2 de Step4 — interactif en web, déplié en PDF)
          ============================================================= */}
      <section className="personas page-break">
        <h2 className="section-title">Profils d'acquéreurs en recherche</h2>
        <p className="section-intro">
          {isLive ? (
            totalProjets > 0 ? (
              <>
                <strong>{totalProjets} projet{totalProjets > 1 ? 's' : ''} d'achat actif{totalProjets > 1 ? 's' : ''}</strong> dans votre fichier acquéreurs
                {prixReference > 0 ? (
                  <> dont le budget max couvre le prix de {prixReference.toLocaleString('fr-FR')} €</>
                ) : null}
                .
                {acquereursHorsBudget.length > 0 && (
                  <> {acquereursHorsBudget.length} autre{acquereursHorsBudget.length > 1 ? 's' : ''} acquéreur{acquereursHorsBudget.length > 1 ? 's' : ''} hors budget (voir ci-dessous).</>
                )}
              </>
            ) : (
              <>
                Aucun acquéreur de votre fichier ne couvre le prix de {prixReference.toLocaleString('fr-FR')} €.
                {acquereursHorsBudget.length > 0 && (
                  <> {acquereursHorsBudget.length} acquéreur{acquereursHorsBudget.length > 1 ? 's sont' : ' est'} hors budget — voir ci-dessous.</>
                )}
              </>
            )
          ) : (
            <><strong>{totalProjets} projets d'achat actifs</strong> dans votre périmètre matchent les critères de votre bien. Ils se répartissent en 5 profils-types.</>
          )}
        </p>

        {usingDemoAcquereurs && (
          <p className="acquereurs-demo-note">
            Données d'acquéreurs simulées (aucun acquéreur réel saisi pour ce bien) —
            ajoutez votre fichier réel depuis l'étape 4 pour remplacer ces exemples.
          </p>
        )}

        {isLive && acquereursCompatibles.length > 0 && (
          <div className="live-acquereurs-list">
            <h4 className="live-acquereurs-title">Acquéreurs compatibles ({acquereursCompatibles.length})</h4>
            <ul>
              {acquereursCompatibles.map((a, i) => (
                <li key={a.id || i} style={{ marginBottom: '8px' }}>
                  <strong>{a.prenom || ''} {a.nom || `Acquéreur ${i + 1}`}</strong>
                  {a.budgetMax && <> · Budget max <strong>{(Number(a.budgetMax) * 1000).toLocaleString('fr-FR')} €</strong></>}
                  {a.surfaceMin && <> · Surface min <strong>{a.surfaceMin} m²</strong></>}
                  {a.type && a.type !== 'indifferent' && <> · Type {a.type}</>}
                  {a.dpeMin && <> · DPE min {a.dpeMin}</>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLive && acquereursHorsBudget.length > 0 && (
          <div className="live-acquereurs-list live-acquereurs-out">
            <h4 className="live-acquereurs-title">Acquéreurs hors budget ({acquereursHorsBudget.length})</h4>
            <p className="live-acquereurs-note">
              Ces acquéreurs ont un budget max inférieur au prix retenu
              ({prixReference.toLocaleString('fr-FR')} €) — ils ne sont
              comptés ni dans les projets actifs ni dans le score de tension.
            </p>
            <ul>
              {acquereursHorsBudget.map((a, i) => (
                <li key={a.id || i} style={{ marginBottom: '6px', opacity: 0.65 }}>
                  <strong>{a.prenom || ''} {a.nom || `Acquéreur ${i + 1}`}</strong>
                  {a.budgetMax && <> · Budget max <strong>{(Number(a.budgetMax) * 1000).toLocaleString('fr-FR')} €</strong> (manque {((prixReference - Number(a.budgetMax) * 1000)).toLocaleString('fr-FR')} €)</>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isLive && !reportState.displayConfig?.hideDemo && (
        <>
        <div className="personas-row">
          {personasList.map((p) => {
            const isActive = activePersonaKey === p.key;
            return (
              <div
                key={p.key}
                className={`persona-card ${isActive ? 'active' : ''}`}
                onClick={() => !isPrintMode && setActivePersonaKey(p.key)}
                role={isPrintMode ? undefined : 'button'}
                tabIndex={isPrintMode ? undefined : 0}
              >
                <div className="persona-count">{p.count}</div>
                <div className="persona-name">{p.name}</div>
                <div className="persona-sub">{p.sub}</div>
              </div>
            );
          })}
        </div>

        {/* En PDF → tous les personas dépliés ; en web → seul l'actif */}
        {(isPrintMode ? personasList : personasList.filter((p) => p.key === activePersonaKey))
          .map((p) => (
            <div className="persona-focus" key={`focus-${p.key}`}>
              <div className="persona-focus-header">
                <div className="persona-focus-title">
                  <span className="dot" />
                  <span>{p.name}</span>
                  <span className="count-pill">{p.count} projets</span>
                </div>
                <div className="persona-focus-meta">
                  <span>Budget moyen <strong>{p.budget}</strong></span>
                  <span>Délai cible <strong>{p.delai}</strong></span>
                  <span>Compatibilité <strong className="compat">{p.compat}</strong></span>
                </div>
              </div>

              <div className="persona-focus-body">
                <div className="persona-needs">
                  <h4>Besoins principaux identifiés</h4>
                  <ul>
                    {p.needs.map((n, i) => (
                      <li key={i} className="need-item">
                        <span
                          className="need-bullet"
                          style={{ color: n.match ? 'var(--primary)' : '#e05252' }}
                        >
                          {n.match ? '✓' : '✗'}
                        </span>
                        <span className="need-text">
                          {n.txt}
                          <span className={`need-tag ${n.match ? '' : 'miss'}`}>
                            {n.tag}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="persona-buyers">
                  <h4>Top projets de ce profil</h4>
                  <div className="buyer-list">
                    {p.buyers.map((b) => (
                      <div key={b.rank} className="buyer-row">
                        <span className="buyer-rank">#{b.rank}</span>
                        <span className="buyer-name">{b.name}</span>
                        <span className="buyer-budget">{b.budget}</span>
                        <span className="buyer-score">{b.score}</span>
                      </div>
                    ))}
                    {p.count > p.buyers.length && (
                      <div className="buyer-more">
                        + {p.count - p.buyers.length} autre{p.count - p.buyers.length > 1 ? 's' : ''} projet{p.count - p.buyers.length > 1 ? 's' : ''} dans ce profil
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
        )}
      </section>

      {/* =============================================================
          SECTION 7 — Notre méthodologie
          ============================================================= */}
      {!reportState.displayConfig?.hideConfiance && (
      <section className="methodology">
        <h2 className="section-title">Comment nous avons estimé votre bien</h2>

        <div className="pillars">
          {effAvisValeur.methodologie.piliers.map((p, i) => (
            <div className="pillar" key={i}>
              <div className="pillar-visual">
                {LUCIDE_ICONS[p.iconeLucide] || null}
              </div>
              <div className="pillar-title">{p.titre}</div>
              <div className="pillar-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* =============================================================
          SECTION 7 — Comparables retenus (enrichis, avec badge fiabilité)
          ============================================================= */}
      <section className="comparables page-break">
        <h2 className="section-title">Comparables retenus</h2>
        <p className="comp-intro">
          Nous avons analysé <strong>{effComparables.length} biens comparables</strong>,
          dont <strong>{selectedComps.length} retenus</strong> pour le calcul
          de la moyenne pondérée.
        </p>

        {selectedComps.length === 0 ? (
          <div className="comp-empty">
            Aucun comparable n'a été retenu en étape 3. L'analyse comparative
            pourra être complétée ultérieurement.
          </div>
        ) : (
          <div className="comparables-grid">
            {selectedComps.map((c) => {
              const surfaceTxt = Number(c.surface) > 0 ? `${c.surface} m²` : null;
              const piecesTxt = Number(c.pieces) > 0
                ? `${c.pieces} pièce${Number(c.pieces) > 1 ? 's' : ''}`
                : null;
              const titleParts = [c.type, surfaceTxt, piecesTxt].filter(Boolean);
              const titleLine = titleParts.length > 1
                ? `${titleParts[0]} — ${titleParts.slice(1).join(', ')}`
                : titleParts[0] || '—';
              const distTxt = c.distance && c.distance !== '—' ? c.distance : null;
              const addressLine = [c.adresse !== '—' ? c.adresse : null, distTxt]
                .filter(Boolean)
                .join(' · ');
              const etageDisplay = (c.etage === '—' && c.etageMax === '—')
                ? '—'
                : `${c.etage}${c.etageMax !== '—' ? '/' + c.etageMax : ''}`;
              const prixNum = Number(c.prix) || 0;
              const prixM2Num = Number(c.prixM2) || 0;
              return (
                <div className="comp-card" key={c.id}>
                  {c.photoUrl && (
                    <div className="comp-photo">
                      <img
                        src={c.photoUrl}
                        alt={titleLine}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  <div className="comp-header">
                    <span className={`comp-source comp-source-${c.source}`}>
                      {c.sourceLabel}
                    </span>
                    {c.date && <span className="comp-date">{c.date}</span>}
                  </div>

                  <div className="comp-title">{titleLine}</div>
                  {addressLine && <div className="comp-address">{addressLine}</div>}

                  <div className="comp-grid">
                    <div><span>Étage</span><strong>{etageDisplay}</strong></div>
                    <div>
                      <span>DPE</span>
                      <strong className={`dpe-badge dpe-${c.dpe}`}>{c.dpe}</strong>
                    </div>
                    <div><span>État</span><strong>{c.etat}</strong></div>
                    <div><span>Atouts</span><strong>{(c.atouts || []).join(', ') || '—'}</strong></div>
                    <div><span>Exposition</span><strong>{c.exposition}</strong></div>
                    <div><span>Année</span><strong>{c.anneeConstruction}</strong></div>
                  </div>

                  <div className="comp-price">
                    <div>
                      <strong>
                        {prixNum > 0 ? `${prixNum.toLocaleString('fr-FR')} €` : '—'}
                      </strong>
                      {prixM2Num > 0 && (
                        <span className="comp-m2"> · {prixM2Num.toLocaleString('fr-FR')} €/m²</span>
                      )}
                    </div>
                  </div>

                  <div className="comp-reliability">
                    <ReliabilityBadge comparable={c} size="sm" />
                  </div>

                  {c.commentairePertinence && (
                    <p className="comp-comment">{c.commentairePertinence}</p>
                  )}

                  {c.urlAnnonce && (
                    <a
                      className="comp-link"
                      href={c.urlAnnonce}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Voir l'annonce d'origine ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {effComparables.some((c) => !c.selected) && (
          <div className="comp-others">
            <h3>Autres biens analysés (non retenus)</h3>
            <div className="comp-others-list">
              {effComparables
                .filter((c) => !c.selected)
                .map((c) => {
                  const surfaceTxt = Number(c.surface) > 0 ? `${c.surface} m²` : null;
                  const typoParts = [c.type, surfaceTxt].filter(Boolean).join(' · ');
                  const prixM2Num = Number(c.prixM2) || 0;
                  return (
                    <div className="comp-other-row" key={c.id}>
                      <div className="cor-main">
                        <strong className="cor-address">{c.adresse}</strong>
                        {typoParts && <span className="cor-typo">{typoParts}</span>}
                      </div>
                      <div className="cor-side">
                        <span className="cor-price">
                          {prixM2Num > 0 ? `${prixM2Num.toLocaleString('fr-FR')} €/m²` : '—'}
                        </span>
                        {c.raisonEcart && <span className="cor-reason">{c.raisonEcart}</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="comp-average">
          Moyenne pondérée retenue : <strong>{(effAvisValeur.prixM2 || 0).toLocaleString('fr-FR')} €/m²</strong>
          {isLive && reportState.comparablesConfig?.weights && (() => {
            const w = reportState.comparablesConfig.weights;
            const sel = Array.isArray(reportState.comparablesSelectionnes)
              ? reportState.comparablesSelectionnes
              : [];
            if (sel.length === 0) return null;
            let sumW = 0;
            let sumPxW = 0;
            sel.forEach((c) => {
              const id = c.id;
              const px = Number(c.prixM2Raw ?? c.prixM2) || 0;
              const wt = Number(w[id]) || 0;
              if (px > 0 && wt > 0) {
                sumW += wt;
                sumPxW += px * wt;
              }
            });
            if (sumW <= 0) return null;
            const pondereCalc = Math.round(sumPxW / sumW);
            return (
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                Calcul direct depuis les pondérations agent ({sel.length} comparables) :
                {' '}<strong>{pondereCalc.toLocaleString('fr-FR')} €/m²</strong>
              </div>
            );
          })()}
        </div>
      </section>

      {/* =============================================================
          SECTION 8 — Argumentaire de valorisation
          ============================================================= */}
      <section className="arguments">
        <h2 className="section-title">Argumentaire de valorisation</h2>

        <div className="arg-cols">
          <div className="arg-col arg-strong">
            <h3>Points forts</h3>
            <ul>
              {(effAvisValeur.pointsForts || []).length > 0 ? (
                effAvisValeur.pointsForts.map((p, i) => <li key={i}>{p}</li>)
              ) : (
                <li style={{ color: '#999' }}>Non renseigné</li>
              )}
            </ul>
          </div>
          <div className="arg-col arg-vigilance">
            <h3>Points de vigilance</h3>
            <ul>
              {(effAvisValeur.pointsVigilance || []).length > 0 ? (
                effAvisValeur.pointsVigilance.map((p, i) => <li key={i}>{p}</li>)
              ) : (
                <li style={{ color: '#999' }}>Non renseigné</li>
              )}
            </ul>
          </div>
        </div>

        {effAvisValeur.avisVendeur && effAvisValeur.avisVendeur.trim().length > 0 && (
          <div className="arg-seller">
            <h3>L'avis du vendeur</h3>
            <p>{effAvisValeur.avisVendeur}</p>
          </div>
        )}
      </section>

      {/* =============================================================
          SECTION 9 — Décomposition du prix (V2, sans ajustement zone)
          ============================================================= */}
      <section className="decomposition page-break">
        <h2 className="section-title">Décomposition du prix</h2>

        <div className="cascade">
          {(effAvisValeur.decomposition || []).map((d, i) => (
            <React.Fragment key={i}>
              <div className={`cascade-step ${d.final ? 'final' : ''}`}>
                <div className="step-label">{d.step}</div>
                <div className="step-value">{d.value}</div>
                {d.delta && <div className="step-delta">{d.delta}</div>}
                <div className="step-detail">{d.detail}</div>
              </div>
              {i < (effAvisValeur.decomposition || []).length - 1 && (
                <span className="cascade-arrow">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* =============================================================
          SECTION 10 — Proposition commerciale (3 stratégies)
          ============================================================= */}
      {!reportState.displayConfig?.hideStrategie && (
      <section className="strategies page-break">
        <h2 className="section-title">Notre proposition</h2>

        <div className="strat-cols">
          {effAvisValeur.strategies.map((s, i) => (
            <div
              key={i}
              className={`strat-col ${s.recommended ? 'recommended' : ''}`}
            >
              {s.recommended && (
                <span className="strat-badge">Notre recommandation</span>
              )}
              <div className="strat-label">{s.label}</div>
              <div className="strat-price">{(s.prix || 0).toLocaleString('fr-FR')} €</div>
              <div className="strat-m2">{(s.prixM2 || 0).toLocaleString('fr-FR')} €/m²</div>
              <div className="strat-row">
                <span>Projets d'achat compatibles</span>
                <strong>
                  {(effAvisValeur.acquereurs || []).filter((a) => a.budget >= s.prix).length}
                </strong>
              </div>
              <div className="strat-row"><span>Délai</span><strong>{s.delai}</strong></div>
              <div className="strat-row"><span>Profil</span><strong>{s.profilCible}</strong></div>
              <div className="strat-row"><span>Risque</span><strong>{s.risque}</strong></div>
            </div>
          ))}
        </div>

        {recommendedStrategy && (
          <div className="strat-reco">
            <strong>Pourquoi la stratégie {recommendedStrategy.label} ?</strong>
            <p>{recommendedStrategy.argumentaireDetaille}</p>
          </div>
        )}
      </section>
      )}

      {/* =============================================================
          SECTION 11 — Votre interlocuteur
          ============================================================= */}
      <section className="contact">
        <h2 className="section-title">Votre interlocuteur</h2>

        <div className="contact-card">
          {effAgent.photo && (
            <img src={effAgent.photo} alt={effAgent.nom} className="agent-photo" />
          )}
          <div className="contact-identity">
            <div className="agent-name">{effAgent.nom}</div>
            <div className="agent-role">{effAgent.fonction}</div>
            <div>{effAgent.telDirect || effAgent.telephone}</div>
            <div>{effAgent.email}</div>
          </div>
          <div className="contact-agence">
            <img src={effAgence.logo} alt={effAgence.nom} className="agence-logo" />
            <div><strong>{effAgence.nom}</strong></div>
            <div>{effAgence.adresse}</div>
            <div>{effAgence.tel} · {effAgence.email}</div>
            <div>{effAgence.siteWeb}</div>
          </div>
        </div>
      </section>

      {/* =============================================================
          SECTION 12 — Mentions légales
          ============================================================= */}
      <footer className="legal page-break">
        <h3>Mentions légales</h3>
        <ul>
          {(effAvisValeur.mentionsLegales || []).map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <div className="legal-agence">
          {effAgence.carteT} · {effAgence.rcs}
          {effAgence.mentionsComplementaires && (
            <div>{effAgence.mentionsComplementaires}</div>
          )}
        </div>
      </footer>

      {/* Actions (non imprimées) */}
      {!isPrintMode && (
        <div className="actions no-print">
          <button className="btn primary" onClick={() => downloadPdf()}>
            Télécharger en PDF
          </button>

          {/* Bouton de partage — visible uniquement côté agent (pas dans la vue partagée) */}
          {!isSharedView && (
            <button
              className="btn share"
              onClick={() => handleShare(setShareStatus)}
              disabled={shareStatus === 'loading'}
            >
              {shareStatus === 'loading' && 'Génération du lien...'}
              {shareStatus === 'copied' && '✓ Lien copié (valide 7 jours)'}
              {shareStatus === 'error' && '⚠ Erreur, réessayer'}
              {shareStatus === 'idle' && 'Copier le lien de partage'}
            </button>
          )}

          {/* Retour à l'app — caché en vue partagée (le mandant n'a pas accès à l'app) */}
          {!isSharedView && (
            <button className="btn secondary" onClick={() => navigate('/step/5')}>
              Retour
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Génère un lien de partage côté client (pas d'API à appeler).
 *
 * Le token est une chaîne base64url encodant { exp: timestampMs + 7j }.
 * Pas de signature cryptographique (MVP avec données fictives).
 * Pour de vraies données sensibles, repasser par /api/share-token (JWT signé).
 */
async function handleShare(setShareStatus) {
  setShareStatus('loading');
  try {
    const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = btoa(JSON.stringify({ exp: expMs, v: 1 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = `${window.location.origin}/#/report?t=${token}`;

    // Copie dans le presse-papier avec fallback si l'API Clipboard est indispo
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch (_) {
      // ignore, on tente le fallback
    }
    if (!copied) {
      // Fallback : textarea temporaire + execCommand('copy')
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch (_) {
        /* noop */
      }
      ta.remove();
    }

    if (!copied) {
      // Dernier recours : afficher le lien dans un prompt pour copie manuelle
      window.prompt('Copiez ce lien de partage (valide 7 jours) :', url);
    }

    setShareStatus('copied');
    setTimeout(() => setShareStatus('idle'), 4000);
  } catch (e) {
    console.error('Partage impossible', e);
    setShareStatus('error');
    setTimeout(() => setShareStatus('idle'), 4000);
  }
}

/**
 * Déclenche l'impression PDF via le navigateur.
 *
 * Utilise window.print() (natif, fonctionne partout). L'utilisateur choisit
 * ensuite "Enregistrer au format PDF" dans la boîte de dialogue d'impression.
 *
 * L'endpoint serverless /api/report-pdf (Puppeteer) reste en place pour une
 * future évolution où on voudrait un PDF généré côté serveur sans prompt.
 */
function downloadPdf() {
  window.print();
}

// ===========================================================================
// Styles (embarqués) — utilise les variables CSS --primary / --secondary
// alimentées par l'objet agence.
// ===========================================================================
const reportCss = `
  .report-root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--secondary);
    background: #f5f5f5;
    max-width: 900px;
    margin: 0 auto;
    padding: 0;
    line-height: 1.55;
  }
  .report-root section,
  .report-root footer {
    background: #fff;
    padding: 40px 48px;
    margin: 0;
  }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--primary);
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
    margin: 0 0 24px;
  }

  /* ====== Composants transverses (collapsible, carte, avis) ====== */
  .cr-voirplus {
    margin-top: 8px;
    background: none;
    border: none;
    padding: 2px 0;
    color: var(--primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .cr-voirplus:hover { opacity: .75; }
  .cr-collapse-cat { margin-bottom: 24px; }
  .cr-collapse-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--primary, #1a3a52);
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e5e7eb;
  }
  .fiche-list, .poi-list { list-style: none; padding: 0; margin: 0; }
  .fiche-row, .poi-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px dotted #eee;
    font-size: 13px;
  }
  .fiche-row-label, .poi-row-name { color: #555; }
  .fiche-row-value { color: #111; margin-left: 16px; text-align: right; }
  .poi-row-dist { color: #46B962; margin-left: 12px; }

  .cr-market-map {
    width: 100%;
    height: 320px;
    border-radius: 8px;
    overflow: hidden;
    margin: 0 0 24px;
    border: 1px solid var(--border);
    z-index: 0;
  }

  .market-avis-edit { margin-top: 20px; }
  .market-avis-edit label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--primary);
    margin-bottom: 6px;
  }
  .market-avis-input {
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: var(--secondary);
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    resize: vertical;
  }
  .market-avis-input:focus { outline: none; border-color: var(--primary); }
  .market-avis-view {
    margin-top: 20px;
    padding: 14px 16px;
    background: #f0f7f2;
    border-left: 3px solid #46B962;
    border-radius: 4px;
  }
  .market-avis-view h3 {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    margin: 0 0 6px;
  }
  .market-avis-view p { margin: 0; font-size: 14px; color: var(--secondary); }

  .arg-seller {
    margin-top: 24px;
    padding: 14px 16px;
    background: #f7f7f9;
    border-left: 3px solid var(--primary);
    border-radius: 4px;
  }
  .arg-seller h3 {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .arg-seller p { margin: 0; font-size: 14px; color: var(--secondary); }

  .acquereurs-demo-note {
    font-size: 12px;
    color: #8a6d3b;
    background: #fcf8e3;
    border: 1px solid #faebcc;
    border-radius: 4px;
    padding: 8px 12px;
    margin: 0 0 16px;
  }

  /* ====== 1. Cover ====== */
  .cover {
    min-height: 900px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 60px 48px !important;
  }
  .cover-logo { max-width: 180px; max-height: 80px; margin-bottom: 20px; align-self: flex-start; }
  .cover-bar { width: 100%; height: 4px; background: var(--primary); margin-bottom: 60px; }
  .cover-title { font-size: 42px; font-weight: 700; letter-spacing: 4px; margin: 40px 0 16px; color: var(--secondary); }
  .cover-address { font-size: 20px; font-weight: 600; margin: 0 0 40px; color: var(--secondary); }
  .cover-hero { width: 100%; margin: 20px 0 40px; }
  .cover-hero-placeholder {
    width: 100%; aspect-ratio: 16 / 9; background: linear-gradient(135deg, var(--primary)22, #f0f0f0);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 14px; font-weight: 600;
  }
  .cover-meta { margin: 40px 0; font-size: 14px; color: var(--secondary); line-height: 1.8; }
  .cover-meta strong { color: var(--primary); }
  .cover-footer { margin-top: auto; padding-top: 40px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); width: 100%; }

  /* ====== 2. Letter ====== */
  .letter-header { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 13px; line-height: 1.6; }
  .letter-from, .letter-to { max-width: 45%; }
  .letter-from strong, .letter-to strong { color: var(--secondary); display: block; margin-bottom: 4px; }
  .letter-date { text-align: right; font-size: 13px; color: var(--secondary); margin: 0 0 24px; }
  .letter-object { font-size: 14px; margin: 0 0 24px; padding-bottom: 8px; border-bottom: 2px solid var(--primary); }
  .letter-body { font-size: 14px; line-height: 1.7; }
  .letter-body p { margin: 0 0 14px; }
  .letter-signature { margin-top: 40px; font-size: 13px; line-height: 1.6; }
  .letter-signature strong { color: var(--primary); }
  .signature-img { max-height: 60px; display: block; margin-bottom: 8px; }

  /* ====== 3. Summary ====== */
  .summary-hero { text-align: center; padding: 32px 0; border: 2px solid var(--primary); border-radius: 12px; background: linear-gradient(180deg, #fff 0%, var(--primary)0a 100%); margin-bottom: 24px; }
  .summary-label { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .summary-price { font-size: 54px; font-weight: 700; color: var(--primary); margin: 8px 0; letter-spacing: -1px; }
  .summary-range { font-size: 15px; color: var(--secondary); }
  .summary-kpis { display: flex; justify-content: space-around; gap: 16px; margin: 24px 0; }
  .kpi { text-align: center; flex: 1; }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--secondary); }
  .kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .kpi.kpi-highlight .kpi-value { color: var(--primary); }
  .summary-reco { padding: 16px 20px; background: #f7f7f7; border-left: 4px solid var(--primary); border-radius: 4px; font-size: 14px; }

  /* ====== 4. Property ====== */
  .property-gallery { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 24px; height: 280px; }
  .photo-main { background: linear-gradient(135deg, var(--border), #c5c5c5); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: 600; font-size: 13px; }
  .photo-grid { display: grid; grid-template-rows: repeat(3, 1fr); gap: 12px; }
  .photo-thumb { background: linear-gradient(135deg, var(--border), #d0d0d0); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: 500; font-size: 12px; }
  .property-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 20px; }
  .spec-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .spec-row span { color: var(--muted); }
  .spec-row strong { color: var(--secondary); }
  .property-desc { font-size: 14px; line-height: 1.7; color: var(--secondary); margin: 16px 0; }
  .property-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-block; background: var(--primary)15; color: var(--primary); border: 1px solid var(--primary)40; border-radius: 14px; padding: 3px 12px; font-size: 12px; font-weight: 600; }

  /* DPE badge */
  .dpe-badge { display: inline-block; min-width: 20px; padding: 2px 6px; border-radius: 4px; color: #fff; font-weight: 700; text-align: center; }
  .dpe-A { background: #319c3a; }
  .dpe-B { background: #67b045; }
  .dpe-C { background: #cadb2c; color: var(--text); }
  .dpe-D { background: #f5e638; color: var(--text); }
  .dpe-E { background: #f1a025; }
  .dpe-F { background: #e86a2e; }
  .dpe-G { background: #d63024; }

  /* ====== 5. Market ====== */
  .market-zone { margin: -16px 0 18px; font-size: 13px; color: var(--muted); font-style: italic; }
  .market-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .market-tension { margin: 16px 0; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .tension-badge { display: inline-block; background: var(--primary)15; color: var(--primary); border: 1px solid var(--primary)40; border-radius: 6px; padding: 4px 12px; font-weight: 600; font-size: 13px; }
  .tension-score { font-size: 13px; color: var(--muted); font-weight: 600; }
  .market-caption { font-size: 13px; color: var(--secondary); }
  .market-commodites { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border); }
  .market-commodites > h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--secondary); margin: 0 0 14px; }
  .commod-cat { margin-bottom: 12px; }
  .commod-cat h4 { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px; }
  .commod-cat ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .commod-cat li { font-size: 13px; color: var(--secondary); line-height: 1.5; padding-left: 14px; position: relative; }
  .commod-cat li::before { content: '•'; position: absolute; left: 0; color: var(--primary); }
  .commod-cat li strong { font-weight: 600; color: var(--secondary); }
  .commod-cat li span { color: var(--muted); }

  /* ====== 6. Personas acquéreurs ====== */
  .section-intro { font-size: 14px; color: var(--secondary); margin: 0 0 20px; line-height: 1.6; }
  .personas-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
  .persona-card { border: 1px solid var(--border); border-radius: 10px; padding: 18px 10px; background: #fff; text-align: center; cursor: pointer; transition: all 0.18s; position: relative; }
  .persona-card:hover { border-color: var(--primary)60; background: var(--primary)05; }
  .persona-card.active { border: 1px solid var(--primary); background: var(--primary)15; }
  .persona-card.active::after { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid var(--primary); }
  .persona-count { font-size: 28px; font-weight: 700; color: var(--secondary); line-height: 1; }
  .persona-card.active .persona-count { color: var(--primary); }
  .persona-name { font-size: 12px; font-weight: 700; color: var(--secondary); margin-top: 8px; }
  .persona-sub { font-size: 10px; color: var(--muted); margin-top: 2px; line-height: 1.3; }

  .persona-focus { border: 1px solid var(--primary)40; border-radius: 10px; background: linear-gradient(180deg, var(--primary)0a 0%, #fff 60%); padding: 20px 22px; margin-bottom: 16px; }
  .persona-focus-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--primary)25; margin-bottom: 14px; flex-wrap: wrap; gap: 12px; }
  .persona-focus-title { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: var(--secondary); }
  .persona-focus-title .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
  .count-pill { background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
  .persona-focus-meta { display: flex; gap: 16px; font-size: 11px; color: var(--muted); flex-wrap: wrap; }
  .persona-focus-meta strong { color: var(--secondary); }
  .persona-focus-meta .compat { color: var(--primary); }

  .persona-focus-body { display: grid; grid-template-columns: 1.3fr 1fr; gap: 22px; }
  .persona-needs h4, .persona-buyers h4 { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; }
  .persona-needs ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .need-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--secondary); line-height: 1.5; }
  .need-bullet { font-weight: 700; margin-top: 2px; flex-shrink: 0; }
  .need-text { display: inline; }
  .need-tag { display: inline-block; font-size: 10px; background: var(--primary)15; color: var(--primary); padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-weight: 600; vertical-align: middle; }
  .need-tag.miss { background: #fdecec; color: #e05252; }

  .buyer-list { display: flex; flex-direction: column; gap: 5px; }
  .buyer-row { display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; padding: 7px 10px; background: #fff; border: 1px solid var(--border); border-radius: 6px; font-size: 11px; }
  .buyer-rank { font-weight: 700; color: var(--muted); font-size: 10px; min-width: 16px; }
  .buyer-name { color: var(--secondary); font-weight: 600; }
  .buyer-budget { color: var(--muted); font-size: 10px; }
  .buyer-score { font-weight: 700; color: var(--primary); font-size: 12px; }
  .buyer-more { font-size: 11px; color: var(--muted); padding: 6px 10px; font-style: italic; }

  /* ====== 7. Methodology ====== */
  .pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
  .pillar { text-align: center; padding: 20px 14px; border: 1px solid var(--border); border-radius: 8px; background: #fafafa; }
  .pillar-visual { width: 56px; height: 56px; border-radius: 50%; border: 1px solid var(--primary); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; background: #fff; }
  .pillar-title { font-weight: 700; color: var(--primary); font-size: 14px; margin-bottom: 6px; }
  .pillar-desc { font-size: 12px; color: var(--secondary); line-height: 1.5; }

  /* ====== 7. Comparables ====== */
  .comp-intro { font-size: 14px; color: var(--secondary); line-height: 1.6; margin: 0 0 18px; }
  .comp-intro strong { color: var(--primary); }
  .comparables-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .comp-empty { padding: 18px 20px; border: 1px dashed #d4d4d4; border-radius: 10px; background: #fafafa; color: #6b6b6b; font-size: 13px; line-height: 1.6; }
  .comp-card { border: 1px solid var(--border); border-radius: 10px; padding: 20px; background: #fff; }
  .comp-photo { margin: -20px -20px 14px; overflow: hidden; border-radius: 10px 10px 0 0; background: #f4f4f4; max-height: 200px; }
  .comp-photo img { display: block; width: 100%; height: 180px; object-fit: cover; }
  .comp-link { display: inline-block; margin-top: 10px; font-size: 12px; color: var(--primary); text-decoration: none; font-weight: 600; }
  .comp-link:hover { text-decoration: underline; }
  .comp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .comp-source { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .comp-source-DVF { background: #e8f4fd; color: #1976d2; }
  .comp-source-IDEERI { background: var(--primary)15; color: var(--primary); }
  .comp-source-EN_COURS { background: #fff3e0; color: #e8a838; }
  .comp-date { font-size: 12px; color: var(--muted); }
  .comp-title { font-size: 15px; font-weight: 700; color: var(--secondary); margin-bottom: 4px; }
  .comp-address { font-size: 13px; color: var(--muted); margin-bottom: 12px; }
  .comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; margin-bottom: 12px; font-size: 12px; }
  .comp-grid > div { display: flex; flex-direction: column; }
  .comp-grid span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .comp-grid strong { color: var(--secondary); font-size: 13px; }
  .comp-price { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-top: 1px solid #f0f0f0; font-size: 14px; }
  .comp-price strong { color: var(--secondary); }
  .comp-m2 { color: var(--muted); font-size: 13px; }
  .comp-adjust { font-size: 12px; color: var(--muted); }
  .comp-adjust strong { color: var(--secondary); }
  .comp-reliability { margin: 8px 0; }
  .comp-comment { font-size: 12px; color: var(--secondary); font-style: italic; margin: 8px 0 0; padding: 8px 12px; background: #fafafa; border-radius: 4px; }
  .comp-average { margin-top: 20px; padding: 12px 20px; background: var(--primary)15; border-radius: 8px; text-align: right; font-size: 14px; color: var(--secondary); }
  .comp-average strong { color: var(--primary); font-size: 16px; }
  .comp-others { margin: 24px 0 12px; padding: 18px 20px; background: #fafafa; border-radius: 8px; border: 1px solid #ebebeb; }
  .comp-others h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b6b6b; margin: 0 0 12px; }
  .comp-others-list { display: flex; flex-direction: column; gap: 8px; }
  .comp-other-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; background: #fff; border: 1px solid #ebebeb; border-radius: 6px; flex-wrap: wrap; }
  .cor-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .cor-address { font-size: 13px; color: var(--secondary); }
  .cor-typo { font-size: 11px; color: var(--muted); }
  .cor-side { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cor-price { font-size: 13px; color: var(--secondary); font-weight: 600; }
  .cor-reason { display: inline-block; background: #fdecec; color: #c83a3a; border: 1px solid #f5c6c6; border-radius: 12px; padding: 2px 10px; font-size: 11px; font-weight: 600; }

  /* ====== 8. Arguments ====== */
  .arg-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .arg-col { padding: 20px; border-radius: 8px; background: #fafafa; }
  .arg-col h3 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .arg-strong h3 { color: var(--primary); }
  .arg-vigilance h3 { color: #e8a838; }
  .arg-col ul { list-style: none; padding: 0; margin: 0; }
  .arg-col li { padding: 8px 0 8px 16px; border-bottom: 1px solid #ebebeb; font-size: 13px; position: relative; }
  .arg-col li:last-child { border-bottom: none; }
  .arg-col li::before { content: ''; position: absolute; left: 0; top: 14px; width: 6px; height: 6px; border-radius: 50%; }
  .arg-strong li::before { background: var(--primary); }
  .arg-vigilance li::before { background: #e8a838; }

  /* ====== 9. Decomposition (V2 : 4 étapes) ====== */
  .cascade { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
  .cascade-step { flex: 1 1 0; min-width: 140px; background: #fafafa; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; text-align: center; }
  .cascade-step.final { background: var(--primary)15; border-color: var(--primary); font-weight: 600; }
  .cascade-step.final .step-value { color: var(--primary); font-size: 20px; }
  .step-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .step-value { font-size: 16px; font-weight: 700; color: var(--secondary); margin: 4px 0; }
  .step-delta { font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 4px; }
  .step-detail { font-size: 11px; color: var(--muted); line-height: 1.4; }
  .cascade-arrow { font-size: 20px; color: #c0c0c0; display: flex; align-items: center; }

  /* ====== 10. Strategies ====== */
  .strat-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
  .strat-col { border: 1px solid var(--border); border-radius: 10px; padding: 20px 16px; text-align: center; background: #fff; position: relative; }
  .strat-col.recommended { border: 2px solid var(--primary); background: var(--primary)0a; transform: translateY(-8px); box-shadow: 0 8px 24px var(--primary)30; }
  .strat-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 12px; white-space: nowrap; }
  .strat-label { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .strat-price { font-size: 26px; font-weight: 700; color: var(--secondary); margin: 4px 0; }
  .strat-col.recommended .strat-price { color: var(--primary); }
  .strat-m2 { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
  .strat-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-top: 1px solid #f0f0f0; font-size: 12px; text-align: left; }
  .strat-row span { color: var(--muted); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
  .strat-row strong { color: var(--secondary); font-size: 12px; font-weight: 600; line-height: 1.4; }
  .strat-reco { padding: 20px 24px; background: var(--primary)0a; border-left: 4px solid var(--primary); border-radius: 6px; }
  .strat-reco strong { color: var(--primary); font-size: 14px; }
  .strat-reco p { margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: var(--secondary); }

  /* ====== 11. Contact ====== */
  .contact-card { display: grid; grid-template-columns: auto 1fr 1fr; gap: 24px; align-items: start; padding: 20px; border: 1px solid var(--border); border-radius: 10px; }
  .agent-photo { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; }
  .contact-identity { font-size: 14px; line-height: 1.7; }
  .agent-name { font-size: 17px; font-weight: 700; color: var(--primary); }
  .agent-role { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
  .contact-agence { font-size: 13px; line-height: 1.7; color: var(--secondary); }
  .contact-agence strong { color: var(--primary); }
  .agence-logo { max-width: 120px; max-height: 50px; margin-bottom: 8px; }

  /* ====== 12. Legal ====== */
  .legal { font-size: 11px; color: #6b6b6b; }
  .legal h3 { color: var(--secondary); text-transform: uppercase; letter-spacing: 1px; font-size: 12px; margin: 0 0 12px; }
  .legal ul { padding-left: 18px; margin: 0 0 16px; }
  .legal li { margin-bottom: 6px; line-height: 1.6; }
  .legal-agence { padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); line-height: 1.6; }

  /* ====== Actions (UI-only) ====== */
  .actions { text-align: center; padding: 32px; background: #fff; border-top: 1px solid var(--border); }
  .btn { display: inline-block; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; margin: 0 6px; }
  .btn.primary { background: var(--primary); color: #fff; }
  .btn.secondary { background: #fff; color: var(--primary); border: 2px solid var(--primary); }
  .btn.share { background: #fff; color: var(--secondary); border: 2px solid var(--border); }
  .btn.share:disabled { opacity: 0.6; cursor: wait; }

  /* ====== Print media ====== */
  @media print {
    body { margin: 0; padding: 0; background: #fff !important; }
    .report-root { max-width: none; background: #fff; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    .report-root section, .report-root footer { padding: 24px 32px; }
    .strat-col.recommended { transform: none; box-shadow: none; }
  }
`;
