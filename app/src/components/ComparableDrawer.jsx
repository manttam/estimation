import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

const drawerCss = `
  .comp-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
    animation: drawer-fade-in 0.18s ease;
  }
  @keyframes drawer-fade-in {
    from { background: rgba(0, 0, 0, 0); }
    to { background: rgba(0, 0, 0, 0.42); }
  }
  .comp-drawer-panel {
    width: 560px;
    max-width: 95vw;
    height: 100vh;
    background: #fff;
    overflow-y: auto;
    animation: drawer-slide-in 0.25s ease;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  @keyframes drawer-slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .drawer-header {
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 5;
    padding: 18px 22px 14px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .drawer-header-text { flex: 1; min-width: 0; }
  .drawer-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px;
    color: #1a1a1a;
  }
  .drawer-subtitle {
    font-size: 12px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .drawer-close {
    background: #f5f5f5;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    color: #666;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .drawer-close:hover { background: #ececec; color: #1a1a1a; }
  .drawer-body { padding: 18px 22px 32px; }
  .drawer-section { margin-bottom: 22px; }
  .drawer-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin: 0 0 10px;
  }
  /* Carousel */
  .photo-carousel {
    position: relative;
    width: 100%;
    height: 280px;
    border-radius: 10px;
    overflow: hidden;
    background: #f0f0f0;
    margin-bottom: 8px;
  }
  .photo-carousel img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.92);
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: background 0.15s;
  }
  .carousel-arrow:hover { background: #fff; }
  .carousel-arrow.left { left: 10px; }
  .carousel-arrow.right { right: 10px; }
  .carousel-dots {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
  }
  .carousel-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: background 0.15s;
  }
  .carousel-dot.active { background: #fff; }
  .carousel-counter {
    position: absolute;
    top: 10px;
    right: 12px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 10px;
  }
  .no-photo-block {
    height: 140px;
    background: #fafafa;
    border: 1px dashed #ddd;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #aaa;
    font-size: 12px;
    text-align: center;
    padding: 0 20px;
  }
  /* Key facts grid */
  .key-facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    background: #fafafa;
    border-radius: 10px;
    padding: 14px;
  }
  .key-fact-item { text-align: center; }
  .key-fact-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 3px;
  }
  .key-fact-value {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .key-fact-value.muted {
    color: #999;
    font-weight: 500;
    font-size: 12px;
  }
  /* Pros/Cons */
  .pros-cons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .pros-cons-col {
    border-radius: 8px;
    padding: 12px;
  }
  .pros-cons-col.pros {
    background: #f0f8f5;
    border: 1px solid #d4ead8;
  }
  .pros-cons-col.cons {
    background: #fef6f6;
    border: 1px solid #f3d4d4;
  }
  .pros-cons-title {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .pros-cons-col.pros .pros-cons-title { color: #2d8856; }
  .pros-cons-col.cons .pros-cons-title { color: #c0392b; }
  .pros-cons ul { list-style: none; margin: 0; padding: 0; }
  .pros-cons li {
    font-size: 12px;
    color: #333;
    padding: 3px 0;
    padding-left: 14px;
    position: relative;
    line-height: 1.4;
  }
  .pros-cons-col.pros li::before {
    content: "+";
    position: absolute;
    left: 0;
    font-weight: 700;
    color: #46B962;
  }
  .pros-cons-col.cons li::before {
    content: "−";
    position: absolute;
    left: 0;
    font-weight: 700;
    color: #e74c3c;
  }
  /* Highlights (portails) */
  .highlights-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .highlight-tag {
    background: #fff5ee;
    color: #c25e1c;
    border: 1px solid #fdd8b8;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 500;
  }
  /* Rooms table */
  .rooms-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .rooms-table thead th {
    text-align: left;
    font-weight: 600;
    color: #666;
    padding: 8px 10px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .rooms-table tbody td {
    padding: 8px 10px;
    border-bottom: 1px solid #f5f5f5;
    color: #333;
  }
  .rooms-table tbody tr:last-child td { border-bottom: none; }
  .rooms-total {
    font-weight: 600;
    background: #f0f8f5;
  }
  /* General info grid */
  .general-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 18px;
  }
  .general-info-row {
    border-bottom: 1px solid #f5f5f5;
    padding: 6px 0;
  }
  .general-info-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .general-info-value {
    font-size: 12px;
    color: #1a1a1a;
    font-weight: 500;
    line-height: 1.4;
  }
  .dpe-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 11px;
    color: #fff;
  }
  .dpe-A { background: #008b3a; }
  .dpe-B { background: #4cb050; }
  .dpe-C { background: #c8d72e; color: #333; }
  .dpe-D { background: #f7e51d; color: #333; }
  .dpe-E { background: #f0b332; }
  .dpe-F { background: #e8743b; }
  .dpe-G { background: #d72027; }
  /* Ad description */
  .ad-description {
    background: #fafafa;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.55;
    color: #333;
    border: 1px solid #eee;
    white-space: pre-wrap;
  }
  /* Agency */
  .agency-card {
    background: #fff5ee;
    border: 1px solid #fdd8b8;
    border-radius: 10px;
    padding: 14px;
  }
  .agency-name {
    font-size: 14px;
    font-weight: 700;
    color: #c25e1c;
    margin-bottom: 4px;
  }
  .agency-agent {
    font-size: 12px;
    color: #666;
    margin-bottom: 2px;
  }
  .agency-phone {
    font-size: 12px;
    color: #c25e1c;
    font-weight: 600;
  }
  .agency-link {
    display: inline-block;
    margin-top: 10px;
    background: #fff;
    color: #c25e1c;
    border: 1px solid #c25e1c;
    border-radius: 6px;
    padding: 5px 12px;
    text-decoration: none;
    font-size: 11px;
    font-weight: 600;
  }
  /* Price evolution */
  .price-evo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
  }
  .days-badge {
    background: #f0f8f5;
    color: #2d8856;
    border: 1px solid #d4ead8;
    padding: 5px 12px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 600;
  }
  .days-badge.long {
    background: #fef6f6;
    color: #c0392b;
    border-color: #f3d4d4;
  }
  .price-curve-wrap {
    background: #fafafa;
    border-radius: 10px;
    padding: 12px 12px 16px;
    border: 1px solid #eee;
    margin-bottom: 12px;
    position: relative;
    /* Espace en haut pour le tooltip flottant */
    padding-top: 56px;
  }
  .price-curve-svg { width: 100%; display: block; }
  .price-curve-svg circle.dot {
    cursor: pointer;
    transition: r 0.12s;
  }
  .price-curve-svg circle.dot:hover { r: 6; }
  /* Tooltip "rail" affich\u00e9 en haut du wrap, pos\u00e9 dans le padding-top */
  .curve-tooltip {
    position: absolute;
    top: 8px;
    background: #1a1a1a;
    color: #fff;
    padding: 7px 11px;
    border-radius: 6px;
    font-size: 11px;
    line-height: 1.35;
    pointer-events: none;
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
    transform: translateX(-50%);
    transition: left 0.08s linear;
  }
  .curve-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1a1a1a;
  }
  .curve-tooltip-date {
    color: #aaa;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .curve-tooltip-event {
    font-weight: 600;
    margin-bottom: 2px;
  }
  .curve-tooltip-price {
    color: #46B962;
    font-weight: 700;
    font-size: 13px;
  }
  .price-timeline {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .price-timeline li {
    position: relative;
    padding: 8px 0 8px 22px;
    border-left: 2px solid #e0e0e0;
    margin-left: 6px;
    font-size: 12px;
  }
  .price-timeline li::before {
    content: "";
    position: absolute;
    left: -7px;
    top: 14px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #46B962;
  }
  .price-timeline li.event-baisse::before { border-color: #d97706; }
  .price-timeline li.event-vente::before {
    background: #46B962;
    border-color: #46B962;
  }
  .timeline-date {
    font-size: 10px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .timeline-event {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 12px;
    margin: 1px 0;
  }
  .timeline-price {
    color: #46B962;
    font-weight: 700;
    font-size: 13px;
  }
  .timeline-price.neg { color: #d97706; }
  /* Notice */
  .data-notice {
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    color: #8a6500;
    line-height: 1.4;
  }
  /* Portail criteria table */
  .portail-criteres {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid #f3d4b8;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  .portail-critere-row {
    display: grid;
    grid-template-columns: 45% 55%;
    border-bottom: 1px solid #f7e8d6;
  }
  .portail-critere-row:nth-last-child(-n+2) {
    border-bottom: none;
  }
  .portail-critere-row:nth-last-child(2) {
    border-bottom: 1px solid #f7e8d6;
  }
  .portail-critere-label {
    background: #fef6f0;
    padding: 8px 12px;
    font-size: 11px;
    color: #8a5a30;
    font-weight: 500;
    border-right: 1px solid #f7e8d6;
    display: flex;
    align-items: center;
  }
  .portail-critere-value {
    padding: 8px 12px;
    font-size: 12px;
    color: #1a1a1a;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
  /* DVF parcel map */
  .parcel-map-wrap {
    position: relative;
    width: 100%;
    height: 280px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #eee;
    background: #f5f5f5;
  }
  .parcel-map {
    width: 100%;
    height: 100%;
  }
  .parcel-ref {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background: rgba(255, 255, 255, 0.95);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #333;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    z-index: 500;
  }
  .parcel-overlay-attribution {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.85);
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 9px;
    color: #666;
    z-index: 500;
  }
`;

function PhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0);
  if (!photos || photos.length === 0) return null;
  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i - 1 + photos.length) % photos.length); };
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i + 1) % photos.length); };
  return (
    <div className="photo-carousel">
      <img src={photos[idx]} alt={`Photo ${idx + 1}`} />
      {photos.length > 1 && (
        <>
          <button className="carousel-arrow left" onClick={prev}>‹</button>
          <button className="carousel-arrow right" onClick={next}>›</button>
          <div className="carousel-counter">{idx + 1} / {photos.length}</div>
          <div className="carousel-dots">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`carousel-dot ${i === idx ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function KeyFacts({ comp }) {
  return (
    <div className="key-facts">
      <div className="key-fact-item">
        <div className="key-fact-label">Prix</div>
        <div className="key-fact-value">{comp.prix} €</div>
      </div>
      <div className="key-fact-item">
        <div className="key-fact-label">Prix/m²</div>
        <div className="key-fact-value">{comp.prixM2} €</div>
      </div>
      <div className="key-fact-item">
        <div className="key-fact-label">Surface</div>
        <div className="key-fact-value">{comp.surface || '—'} m²</div>
      </div>
      <div className="key-fact-item">
        <div className="key-fact-label">Pièces</div>
        <div className="key-fact-value">{comp.pieces || '—'}</div>
      </div>
      <div className="key-fact-item">
        <div className="key-fact-label">Distance</div>
        <div className="key-fact-value">{comp.distance}</div>
      </div>
      <div className="key-fact-item">
        <div className="key-fact-label">Source</div>
        <div className="key-fact-value muted">{comp.sourceLabel}</div>
      </div>
    </div>
  );
}

function ProsCons({ atouts = [], contraintes = [] }) {
  if (atouts.length === 0 && contraintes.length === 0) return null;
  return (
    <div className="pros-cons">
      <div className="pros-cons-col pros">
        <div className="pros-cons-title">Atouts qualitatifs</div>
        <ul>
          {atouts.length === 0 && <li style={{ color: '#999', fontStyle: 'italic' }}>Aucun renseigné</li>}
          {atouts.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
      <div className="pros-cons-col cons">
        <div className="pros-cons-title">Points de contrainte</div>
        <ul>
          {contraintes.length === 0 && <li style={{ color: '#999', fontStyle: 'italic' }}>Aucun renseigné</li>}
          {contraintes.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
    </div>
  );
}

function RoomsTable({ rooms }) {
  if (!rooms || rooms.length === 0) return null;
  const totalSurface = rooms.reduce((s, r) => s + (Number(r.surface) || 0), 0);
  return (
    <table className="rooms-table">
      <thead>
        <tr>
          <th>Pièce</th>
          <th>Surface</th>
          <th>Étage</th>
          <th>État</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((r, i) => (
          <tr key={i}>
            <td><strong>{r.nom}</strong></td>
            <td>{r.surface} m²</td>
            <td>{r.etage !== undefined ? r.etage : '—'}</td>
            <td>{r.etat || '—'}</td>
          </tr>
        ))}
        <tr className="rooms-total">
          <td>Total</td>
          <td>{totalSurface.toFixed(1).replace('.0', '')} m²</td>
          <td colSpan={2}></td>
        </tr>
      </tbody>
    </table>
  );
}

function GeneralInfo({ data }) {
  if (!data) return null;
  const fields = [
    { label: 'Surface habitable', value: data.surfaceHabitable ? `${data.surfaceHabitable} m²` : null },
    { label: 'Surface extérieurs', value: data.surfaceExterieurs ? `${data.surfaceExterieurs} m²` : null },
    { label: 'Dépendances', value: data.dependances },
    { label: 'Chauffage', value: data.chauffage },
    { label: 'Rafraîchissement', value: data.rafraichissement },
    { label: 'Sol', value: data.sol },
    { label: 'Menuiseries', value: data.menuiseries },
    { label: 'Toiture / charpente', value: data.toitureCharpente },
    { label: 'Année construction', value: data.anneeConstruction },
    { label: 'Rénovation', value: data.renovationAnnee ? `Rénové en ${data.renovationAnnee}` : 'Non' },
    { label: 'État général', value: data.etatGeneral },
    { label: 'Emplacement', value: data.emplacement },
  ];
  return (
    <div className="general-info">
      {fields.filter(f => f.value).map((f, i) => (
        <div className="general-info-row" key={i}>
          <div className="general-info-label">{f.label}</div>
          <div className="general-info-value">{f.value}</div>
        </div>
      ))}
      {data.dpe && (
        <div className="general-info-row">
          <div className="general-info-label">DPE</div>
          <div className="general-info-value">
            <span className={`dpe-badge dpe-${data.dpe}`}>{data.dpe}</span>
            {data.ges && <span className={`dpe-badge dpe-${data.ges}`} style={{ marginLeft: 6 }}>GES {data.ges}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function CriteresPortail({ criteres }) {
  if (!criteres || criteres.length === 0) return null;
  return (
    <div className="portail-criteres">
      {criteres.map((c, i) => (
        <div className="portail-critere-row" key={i}>
          <div className="portail-critere-label">{c.label}</div>
          <div className="portail-critere-value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ParcelMap({ coords, addr, parcelleRef }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!coords || !mapRef.current) return;
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView(coords, 18);
    mapInstanceRef.current = map;

    // Tile cadastre IGN (parcelles + b\u00e2ti) — service public, pas de cl\u00e9
    L.tileLayer(
      'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(map);

    // Fond OSM en dessous pour le contexte
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map).bringToBack();

    // Marker au centre de la parcelle
    const icon = L.divIcon({
      className: 'parcel-marker',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#4a6cf7;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker(coords, { icon }).addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coords]);

  if (!coords) return null;
  return (
    <div className="parcel-map-wrap">
      <div ref={mapRef} className="parcel-map" />
      {parcelleRef && (
        <div className="parcel-ref">
          📍 Parcelle {parcelleRef}
        </div>
      )}
      <div className="parcel-overlay-attribution">
        Cadastre IGN / OSM
      </div>
    </div>
  );
}

function PriceEvolution({ historique, joursEnCommercialisation, source }) {
  const [hover, setHover] = useState(null); // index du point survolé
  if (!historique || historique.length === 0) return null;
  const prix = historique.map(h => h.prix);
  const minPrix = Math.min(...prix);
  const maxPrix = Math.max(...prix);
  const range = maxPrix - minPrix || 1;
  const W = 480;
  const H = 90;
  const PAD_X = 10;
  const PAD_Y = 12;
  const points = historique.map((h, i) => {
    const x = PAD_X + (i * (W - 2 * PAD_X)) / Math.max(historique.length - 1, 1);
    const y = H - PAD_Y - ((h.prix - minPrix) / range) * (H - 2 * PAD_Y);
    return { x, y, ...h };
  });
  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const initial = historique[0].prix;
  const final = historique[historique.length - 1].prix;
  const trendPositive = final >= initial;
  const lineColor = trendPositive ? '#46B962' : '#d97706';
  const days = joursEnCommercialisation || 0;
  const fmtPrix = (p) => p.toLocaleString('fr-FR') + ' €';
  const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // Position du tooltip : clamp horizontal pour ne pas d\u00e9border (min 14% / max 86%)
  // Le tooltip est positionn\u00e9 dans le rail du haut du wrap, donc pas de souci vertical
  const tooltipPos = hover !== null ? {
    leftPct: Math.max(14, Math.min(86, (points[hover].x / W) * 100)),
  } : null;

  return (
    <>
      <div className="price-evo-header">
        <span style={{ fontSize: 12, color: '#666' }}>
          {source === 'encours' ? 'En commercialisation depuis' : 'Durée de commercialisation'}
        </span>
        <span className={`days-badge ${days > 90 ? 'long' : ''}`}>
          {days} jours
        </span>
      </div>
      <div className="price-curve-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="price-curve-svg"
          preserveAspectRatio="none"
          style={{ height: H, overflow: 'visible' }}
        >
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            points={polyline}
          />
          {points.map((p, i) => {
            const ev = (p.evenement || '').toLowerCase();
            let color = '#46B962';
            if (ev.includes('baisse')) color = '#d97706';
            else if (ev.includes('vente') || ev.includes('compromis')) color = '#1f7a3f';
            return (
              <g key={i}>
                {/* Cercle invisible plus large pour faciliter le hover */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="14"
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer' }}
                />
                <circle
                  className="dot"
                  cx={p.x}
                  cy={p.y}
                  r={hover === i ? 6 : 4}
                  fill="#fff"
                  stroke={color}
                  strokeWidth="2"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })}
        </svg>
        {tooltipPos && (
          <div
            className="curve-tooltip"
            style={{ left: `${tooltipPos.leftPct}%` }}
          >
            <div className="curve-tooltip-date">{fmtDate(points[hover].date)}</div>
            <div className="curve-tooltip-event">{points[hover].evenement}</div>
            <div className="curve-tooltip-price">{fmtPrix(points[hover].prix)}</div>
          </div>
        )}
      </div>
      <ul className="price-timeline">
        {historique.map((h, i) => {
          const ev = (h.evenement || '').toLowerCase();
          const isBaisse = ev.includes('baisse');
          const isVente = ev.includes('vente') || ev.includes('compromis');
          const cls = isVente ? 'event-vente' : isBaisse ? 'event-baisse' : '';
          const prevPrix = i > 0 ? historique[i - 1].prix : null;
          const delta = prevPrix !== null ? h.prix - prevPrix : 0;
          return (
            <li key={i} className={cls}>
              <div className="timeline-date">{fmtDate(h.date)}</div>
              <div className="timeline-event">{h.evenement}</div>
              <div className={`timeline-price ${delta < 0 ? 'neg' : ''}`}>
                {fmtPrix(h.prix)}
                {delta !== 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: delta < 0 ? '#d97706' : '#2d8856' }}>
                    ({delta > 0 ? '+' : ''}{delta.toLocaleString('fr-FR')} €)
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function ComparableDrawer({ comp, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!comp) return null;
  const isDvf = comp.source === 'dvf';
  const isPortail = comp.source === 'portail';

  return (
    <div className="comp-drawer-overlay" onClick={onClose}>
      <style>{drawerCss}</style>
      <aside className="comp-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-header">
          <div className="drawer-header-text">
            <h2 className="drawer-title">{comp.title}</h2>
            <div className="drawer-subtitle">
              <span>{comp.addr}</span>
              <span>·</span>
              <span className={`source-badge ${comp.source}`}>{comp.sourceLabel}</span>
              {comp.portalName && <span className="portal-tag">{comp.portalName}</span>}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <div className="drawer-body">
          {/* Photos */}
          {comp.photos && comp.photos.length > 0 ? (
            <div className="drawer-section">
              <PhotoCarousel photos={comp.photos} />
            </div>
          ) : isDvf && comp.coords ? (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Vue cadastrale de la parcelle</h3>
              <ParcelMap coords={comp.coords} addr={comp.addr} parcelleRef={comp.parcelleRef} />
            </div>
          ) : isDvf ? (
            <div className="drawer-section">
              <div className="no-photo-block">
                Pas de photos — les transactions DVF ne contiennent pas d'images
              </div>
            </div>
          ) : null}

          {/* Key facts */}
          <div className="drawer-section">
            <KeyFacts comp={comp} />
          </div>

          {/* Atouts / contraintes */}
          {(comp.atoutsQualitatifs || comp.pointsContraintes) && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Qualité du bien</h3>
              <ProsCons
                atouts={comp.atoutsQualitatifs || []}
                contraintes={comp.pointsContraintes || []}
              />
            </div>
          )}

          {/* Critères mis en avant (Portails) — tags rapides */}
          {isPortail && comp.criteresEnAvant && comp.criteresEnAvant.length > 0 && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Critères mis en avant sur l'annonce</h3>
              <div className="highlights-tags">
                {comp.criteresEnAvant.map((c, i) => (
                  <span key={i} className="highlight-tag">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Critères structurés (label / valeur) tels qu'ils apparaissent sur le portail */}
          {isPortail && comp.criteresPortail && comp.criteresPortail.length > 0 && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Caractéristiques de l'annonce {comp.portalName ? `(${comp.portalName})` : ''}</h3>
              <CriteresPortail criteres={comp.criteresPortail} />
            </div>
          )}

          {/* Pièces */}
          {comp.rooms && comp.rooms.length > 0 && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Détail des pièces</h3>
              <RoomsTable rooms={comp.rooms} />
            </div>
          )}

          {/* Infos générales */}
          {comp.infosGenerales && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Informations générales</h3>
              <GeneralInfo data={comp.infosGenerales} />
            </div>
          )}

          {/* Descriptif annonce (Portails) */}
          {isPortail && comp.descriptifAnnonce && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Descriptif de l'annonce</h3>
              <div className="ad-description">{comp.descriptifAnnonce}</div>
            </div>
          )}

          {/* Description fallback */}
          {!isDvf && !comp.infosGenerales && !comp.descriptifAnnonce && comp.description && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Description du bien</h3>
              <div className="ad-description">{comp.description}</div>
            </div>
          )}

          {/* Agence (Portails) */}
          {isPortail && comp.agence && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Agence en charge</h3>
              <div className="agency-card">
                <div className="agency-name">{comp.agence.nom}</div>
                <div className="agency-agent">Agent : {comp.agence.agent}</div>
                <div className="agency-phone">{comp.agence.telephone}</div>
                {comp.urlAnnonce && (
                  <a href={comp.urlAnnonce} className="agency-link" onClick={(e) => e.preventDefault()}>
                    ↗ Voir l'annonce sur {comp.portalName}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Évolution prix */}
          {comp.historique && comp.historique.length > 0 && (
            <div className="drawer-section">
              <h3 className="drawer-section-title">Évolution du prix &amp; commercialisation</h3>
              <PriceEvolution
                historique={comp.historique}
                joursEnCommercialisation={comp.joursEnCommercialisation}
                source={comp.source}
              />
            </div>
          )}

          {/* DVF notice */}
          {isDvf && (
            <div className="drawer-section">
              <div className="data-notice">
                <strong>Données limitées — source DVF.</strong> Les transactions DVF (Demandes de Valeurs Foncières) ne contiennent que les informations cadastrales et le prix de mutation. Pour plus de détails, consultez l'annonce d'origine ou le mandat de l'époque.
                {comp.dateMutationISO && (
                  <div style={{ marginTop: 8 }}>
                    Date de mutation : <strong>{new Date(comp.dateMutationISO).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
