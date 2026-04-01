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
    grid-template-columns: 1fr 300px;
    gap: 12px;
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
    height: 260px;
    width: 100%;
    z-index: 0;
  }
  .map-controls {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    border-top: 1px solid #e5e5e5;
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
  .radius-btns {
    display: flex;
    gap: 4px;
    margin-left: auto;
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

  /* MARKET CARD */
  .market-card {
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e5e5e5;
    padding: 14px;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .market-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #393939;
  }
  .market-price {
    text-align: center;
    padding: 10px 0;
    margin-bottom: 8px;
  }
  .market-price .big {
    font-size: 24px;
    font-weight: 700;
    color: #46B962;
  }
  .market-price .unit {
    font-size: 12px;
    color: #949494;
  }
  .market-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    flex: 1;
  }
  .market-stat {
    background: #f7f7f8;
    border-radius: 6px;
    padding: 8px;
  }
  .market-stat .val {
    font-size: 14px;
    font-weight: 700;
    color: #393939;
  }
  .market-stat .val.up {
    color: #46B962;
  }
  .market-stat .lbl {
    font-size: 9px;
    color: #666;
    margin-top: 2px;
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

export default function Step2ContexteZone() {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState({});
  const [activeRadius, setActiveRadius] = useState('1km');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const toggleSection = (idx) => {
    setOpenSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const { scores, market, sections } = contexteZone;

  // Initialize Leaflet map
  useEffect(() => {
    if (mapInstanceRef.current) return; // already initialized
    const L = window.L;
    if (!L || !mapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([45.7580, 4.8590], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.marker([45.7580, 4.8590])
      .addTo(map)
      .bindPopup('<strong>12 rue des Lilas</strong><br>69003 Lyon');
    L.circle([45.7580, 4.8590], {
      radius: 1000,
      color: '#46B962',
      fillColor: '#46B962',
      fillOpacity: 0.06,
      weight: 1.5,
    }).addTo(map);

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
            <label><input type="checkbox" defaultChecked /> Transports</label>
            <label><input type="checkbox" defaultChecked /> Commerces</label>
            <label><input type="checkbox" /> &Eacute;ducation</label>
            <label><input type="checkbox" /> Sant&eacute;</label>
            <div className="radius-btns">
              {['500m', '1km', '2km'].map((r) => (
                <button
                  key={r}
                  className={`radius-btn ${activeRadius === r ? 'active' : ''}`}
                  onClick={() => setActiveRadius(r)}
                >
                  {r}
                </button>
              ))}
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
