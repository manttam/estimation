import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { contexteZone } from '../data/propertyData';

const COLOR_MAP = {
  green: '#46B962',
  orange: '#f5a623',
  red: '#e74c3c',
  blue: '#4a6cf7',
};

const TYPE_COLOR = {
  dist: '#4a6cf7',
  'risk-ok': '#46B962',
  'risk-warn': '#f5a623',
  'risk-bad': '#e74c3c',
  green: '#46B962',
};

const cssStyles = `
  .step2-page {
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* ═══ INFO BANNER ═══ */
  .info-banner {
    background: #f7f7f8;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 8px 14px;
    margin-bottom: 14px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #949494;
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
    border: 1px solid #e5e5e5;
    border-top: 3px solid #e5e5e5;
    position: relative;
  }
  .score-card.green { border-top-color: #46B962; }
  .score-card.orange { border-top-color: #f5a623; }
  .score-card.red { border-top-color: #e74c3c; }
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
  .score-num.green { color: #46B962; }
  .score-num.orange { color: #f5a623; }
  .score-num.red { color: #e74c3c; }

  /* ═══ MAP + MARKET GRID ═══ */
  .grid-top {
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: 10px;
    margin-bottom: 14px;
  }

  /* MAP CARD */
  .map-card {
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e5e5e5;
    overflow: hidden;
    position: relative;
  }
  .map-container {
    height: 340px;
    width: 100%;
    z-index: 0;
  }
  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.15); opacity: 0.15; }
    100% { transform: scale(1); opacity: 0.4; }
  }
  .map-controls {
    border-top: 1px solid #e5e5e5;
  }
  .map-controls-row {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .map-controls-row + .map-controls-row {
    border-top: 1px solid #f0f0f0;
  }
  .map-controls label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    cursor: pointer;
    color: #949494;
  }
  .map-controls input[type="checkbox"] {
    width: 13px;
    height: 13px;
    accent-color: #46B962;
  }
  .radius-label {
    font-size: 10px;
    font-weight: 600;
    color: #949494;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }
  .radius-btns {
    display: flex;
    gap: 4px;
  }
  .radius-btn {
    padding: 3px 8px;
    border: 1px solid #e5e5e5;
    border-radius: 5px;
    background: #fff;
    font-size: 10px;
    cursor: pointer;
    color: #949494;
    font-family: 'Open Sans', sans-serif;
  }
  .radius-btn.active {
    background: #46B962;
    color: white;
    border-color: #46B962;
  }
  .radius-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: #e5e5e5;
    outline: none;
  }
  .radius-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #46B962;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    cursor: pointer;
  }
  .radius-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #46B962;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    cursor: pointer;
  }

  /* MARKET CARD */
  .market-card {
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e5e5e5;
    padding: 10px;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .market-title {
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 6px;
    color: #393939;
  }
  .market-price {
    text-align: center;
    padding: 6px 0;
    margin-bottom: 6px;
  }
  .market-price .big {
    font-size: 20px;
    font-weight: 700;
    color: #46B962;
  }
  .market-price .unit {
    font-size: 11px;
    color: #949494;
  }
  .market-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    flex: 1;
  }
  .market-stat {
    background: #f7f7f8;
    border-radius: 5px;
    padding: 6px;
  }
  .market-stat .val {
    font-size: 12px;
    font-weight: 700;
    color: #393939;
  }
  .market-stat .val.up {
    color: #46B962;
  }
  .market-stat .lbl {
    font-size: 8px;
    color: #666;
    margin-top: 1px;
  }

  /* ═══ COLLAPSIBLE SECTIONS ═══ */
  .section-group {
    margin-bottom: 14px;
  }
  .collapse-card {
    background: #fff;
    border: 1px solid #e5e5e5;
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
    background: #949494;
    flex-shrink: 0;
  }
  .collapse-dot.green { background: #46B962; }
  .collapse-dot.orange { background: #f5a623; }
  .collapse-dot.red { background: #e74c3c; }
  .collapse-title {
    font-size: 12px;
    font-weight: 500;
    color: #393939;
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
    color: #949494;
  }
  .collapse-score.green { color: #46B962; }
  .collapse-score.orange { color: #f5a623; }
  .collapse-score.red { color: #e74c3c; }
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
    color: #393939;
    text-align: right;
  }
  .d-row .val.dist { color: #4a6cf7; font-weight: 600; }
  .d-row .val.risk-ok { color: #46B962; }
  .d-row .val.risk-warn { color: #f5a623; font-weight: 600; }
  .d-row .val.risk-bad { color: #e74c3c; font-weight: 600; }
  .d-row.risk-impact {
    background: #fff5f5;
    border-radius: 6px;
    padding: 6px 8px;
    margin-top: 4px;
  }
  .d-row.risk-impact .lbl {
    color: #e74c3c;
    font-weight: 600;
  }

  /* OVERRIDE NOTE */
  .override-note {
    font-size: 10px;
    color: #949494;
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
    background: #46B962;
    color: white;
  }
  .btn-primary:hover {
    background: #3da856;
  }
  .btn-ghost {
    background: transparent;
    color: #393939;
    border: 1px solid #e5e5e5;
  }
`;

const TARGET_COORDS = [45.7580, 4.8590];

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
  const [openSections, setOpenSections] = useState({});
  const [radiusMeters, setRadiusMeters] = useState(1000);
  const [activeLayers, setActiveLayers] = useState({ transports: true, commerces: true, education: false, sante: false });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const poiLayersRef = useRef({});

  const toggleSection = (idx) => {
    setOpenSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const { scores, market, sections } = contexteZone;

  // Radius presets → meters
  const RADIUS_PRESETS = [
    { label: '500m', value: 500 },
    { label: '1km', value: 1000 },
    { label: '2km', value: 2000 },
  ];

  const setRadius = (meters) => {
    setRadiusMeters(meters);
    if (circleRef.current) {
      circleRef.current.setRadius(meters);
    }
    const map = mapInstanceRef.current;
    if (map) {
      const zoom = meters <= 500 ? 16 : meters <= 1000 ? 15 : 14;
      map.setView(TARGET_COORDS, zoom, { animate: true });
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

    const map = L.map(mapRef.current, { zoomControl: false }).setView(TARGET_COORDS, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Target marker
    const targetIcon = L.divIcon({
      className: 'target-marker-icon',
      html: `<div style="width:36px;height:36px;position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:-6px;border:2px solid #46B962;border-radius:50%;opacity:0.4;animation:pulse 2s infinite"></div>
        <div style="width:36px;height:36px;background:#46B962;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(70,185,98,0.45);display:flex;align-items:center;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    L.marker(TARGET_COORDS, { icon: targetIcon, zIndexOffset: 1000 }).addTo(map)
      .bindPopup('<strong>12 rue des Lilas</strong><br>69003 Lyon');

    // Radius circle
    const circle = L.circle(TARGET_COORDS, {
      radius: 1000,
      color: '#46B962',
      fillColor: '#46B962',
      fillOpacity: 0.06,
      weight: 2,
      dashArray: '8, 6',
      opacity: 0.6,
    }).addTo(map);
    circleRef.current = circle;

    // POI layers per category
    Object.entries(POI_DATA).forEach(([cat, pois]) => {
      const style = POI_STYLES[cat];
      const layerGroup = L.layerGroup();

      pois.forEach((poi) => {
        const icon = L.divIcon({
          className: 'poi-icon',
          html: `<div style="width:26px;height:26px;background:${style.color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1">${style.icon}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker(poi.coords, { icon }).addTo(layerGroup)
          .bindPopup(`<div style="font-family:'Open Sans',sans-serif;font-size:12px"><strong style="color:${style.color}">${poi.name}</strong><br><span style="color:#666">${poi.detail}</span></div>`);
      });

      poiLayersRef.current[cat] = layerGroup;
      // Add initially active layers
      if (cat === 'transports' || cat === 'commerces') {
        layerGroup.addTo(map);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

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

      {/* Score Cards */}
      <div className="scores-row">
        {scores.map((s) => (
          <div key={s.label} className={`score-card ${s.color}`}>
            <div className="score-label">{s.label}</div>
            <div className={`score-num ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Map + Market Card */}
      <div className="grid-top">
        <div className="map-card">
          <div ref={mapRef} className="map-container" id="leaflet-map-zone" />
          <div className="map-controls">
            {/* Ligne 1 : catégories POI */}
            <div className="map-controls-row">
              {Object.entries(POI_STYLES).map(([cat, style]) => (
                <label key={cat} style={{ color: activeLayers[cat] ? style.color : '#949494' }}>
                  <input type="checkbox" checked={activeLayers[cat]} onChange={() => toggleCategory(cat)} />
                  {style.label}
                </label>
              ))}
            </div>
            {/* Ligne 2 : rayon — presets + slider + champ */}
            <div className="map-controls-row">
              <span className="radius-label">Rayon</span>
              <div className="radius-btns">
                {RADIUS_PRESETS.map((r) => (
                  <button
                    key={r.label}
                    className={`radius-btn ${radiusMeters === r.value ? 'active' : ''}`}
                    onClick={() => setRadius(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                className="radius-slider"
                min={100}
                max={3000}
                step={50}
                value={radiusMeters}
                onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={50}
                  value={radiusMeters}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v >= 100 && v <= 5000) setRadius(v);
                  }}
                  style={{
                    width: 56,
                    padding: '3px 4px',
                    border: '1px solid #e5e5e5',
                    borderRadius: 5,
                    fontSize: 11,
                    fontFamily: 'Open Sans, sans-serif',
                    textAlign: 'center',
                    color: '#393939',
                  }}
                />
                <span style={{ fontSize: 10, color: '#949494' }}>m</span>
              </div>
            </div>
          </div>
        </div>

        <div className="market-card">
          <div className="market-title">March&eacute; Local &mdash; IRIS 693830107</div>
          <div className="market-price">
            <span className="big">{market.prixM2} &euro;</span>
            <span className="unit">/m&sup2;</span>
          </div>
          <div className="market-stats">
            <div className="market-stat">
              <div className="val up">{market.evolution}</div>
              <div className="lbl">&Eacute;volution 12 mois</div>
            </div>
            <div className="market-stat">
              <div className="val">{market.transactions}</div>
              <div className="lbl">Transactions/an</div>
            </div>
            <div className="market-stat">
              <div className="val">{market.delai}</div>
              <div className="lbl">D&eacute;lai moyen vente</div>
            </div>
            <div className="market-stat">
              <div className="val">{market.fourchette} &euro;</div>
              <div className="lbl">Fourchette P25&ndash;P75/m&sup2;</div>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="section-group">
        {sections.map((section, idx) => {
          const isOpen = !!openSections[idx];
          return (
            <div key={idx} className="collapse-card">
              <div className="collapse-header" onClick={() => toggleSection(idx)}>
                <div className="collapse-header-left">
                  <span className={`collapse-dot ${section.color}`} />
                  <span className="collapse-title">{section.title}</span>
                  <span className="collapse-summary">{section.summary}</span>
                </div>
                <div className="collapse-header-right">
                  <span className={`collapse-score ${section.color}`}>{section.score}</span>
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

      {/* Override Note */}
      <div className="override-note">
        Donn&eacute;es enrichies automatiquement. Cliquez sur une valeur pour la corriger &mdash; les surcharges sont trac&eacute;es.
      </div>

      {/* Footer */}
      <div className="footer-buttons">
        <button className="btn btn-ghost" onClick={() => navigate('/step/1')}>
          &larr; Bien cible
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/step/3')}>
          Comparables &rarr;
        </button>
      </div>
    </div>
  );
}
