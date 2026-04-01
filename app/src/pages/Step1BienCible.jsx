import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { bienCibleCategories } from '../data/propertyData';

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

const cssStyles = `
  .step1-page {
    background: #fafafa;
    min-height: 100vh;
    padding-bottom: 32px;
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
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
    border-radius: 12px;
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
    color: #393939;
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
    background: #46B962;
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
    background: #e74c3c;
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
    border-color: #46B962;
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
  }

  .form-input.error,
  .form-select.error {
    border-color: #e74c3c;
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
    border-radius: 12px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    border: none;
    padding: 0;
    flex-shrink: 0;
  }

  .toggle-switch.on {
    background: #46B962;
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
    color: #393939;
    font-weight: 500;
  }

  /* SIDEBAR SECTIONS */
  .photos-section {
    background: white;
    border: 1px solid #eee;
    border-radius: 12px;
    padding: 16px;
  }

  .photos-header {
    font-size: 14px;
    font-weight: 600;
    color: #393939;
    margin-bottom: 12px;
  }

  .photos-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .photo-placeholder {
    aspect-ratio: 1;
    background: #e8e8e8;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 24px;
  }

  .photos-count {
    font-size: 12px;
    color: #888;
    margin-bottom: 12px;
  }

  .btn-add-photos {
    width: 100%;
    padding: 10px;
    background: #f0f0f0;
    border: 1px solid #eee;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #393939;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .btn-add-photos:hover {
    background: #e8e8e8;
  }

  /* MAP */
  .map-section {
    background: white;
    border: 1px solid #eee;
    border-radius: 12px;
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

  .map-iris {
    font-size: 12px;
    color: #888;
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
    color: #e74c3c;
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
    border-radius: 12px;
    padding: 16px;
  }

  .notes-label {
    font-size: 13px;
    font-weight: 600;
    color: #393939;
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
    border-color: #46B962;
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
  }

  .notes-textarea::placeholder {
    color: #bbb;
  }

  /* BUTTONS AREA */
  .buttons-area {
    background: white;
    border: 1px solid #eee;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
  }

  .btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
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

  .btn-primary {
    background: #46B962;
    color: white;
  }

  .btn-primary:hover {
    background: #3d9a52;
    box-shadow: 0 4px 12px rgba(70, 185, 98, 0.3);
  }

  .btn-ghost {
    background: transparent;
    color: #393939;
    border: 1px solid #eee;
  }

  .btn-ghost:hover {
    background: #f9f9f9;
    border-color: #393939;
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
  // Find the index with defaultOpen, fallback to index 1
  const defaultOpenIdx = bienCibleCategories.findIndex((c) => c.defaultOpen);
  const initialOpen = defaultOpenIdx >= 0 ? defaultOpenIdx : 1;
  const [openSection, setOpenSection] = useState(initialOpen);
  const [toggleStates, setToggleStates] = useState({});

  const toggleSection = (idx) => {
    setOpenSection((prev) => (prev === idx ? null : idx));
  };

  const handleToggle = (catIdx, fieldIdx, currentOn) => {
    const key = `${catIdx}-${fieldIdx}`;
    setToggleStates((prev) => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : !currentOn,
    }));
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
                                defaultValue={field.value || ''}
                              >
                                {field.value ? (
                                  <option value={field.value}>{field.value}</option>
                                ) : (
                                  <option value="">
                                    {field.placeholder || '-- Choisir --'}
                                  </option>
                                )}
                                {field.options &&
                                  field.options
                                    .filter((o) => o !== field.value)
                                    .map((o, oi) => (
                                      <option key={oi} value={o}>
                                        {o}
                                      </option>
                                    ))}
                              </select>
                            ) : (
                              <input
                                className={`form-input${field.error ? ' error' : ''}`}
                                type={field.type || 'text'}
                                defaultValue={field.value}
                                placeholder={field.placeholder || ''}
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
              <div className="photos-header">&#x1F4F8; Photos du bien</div>
              <div className="photos-grid">
                <div className="photo-placeholder">&#x1F4F7;</div>
                <div className="photo-placeholder">&#x1F4F7;</div>
                <div className="photo-placeholder">&#x1F4F7;</div>
                <div className="photo-placeholder">&#x1F4F7;</div>
              </div>
              <div className="photos-count">12 photos</div>
              <button className="btn-add-photos">+ Ajouter des photos</button>
            </div>

            {/* Map */}
            <div className="map-section">
              <MapContainer
                center={[45.758, 4.859]}
                zoom={16}
                zoomControl={false}
                scrollWheelZoom={false}
                style={{ width: '100%', height: 220, borderRadius: 8, marginBottom: 12, border: '1px solid #e0e0e0', zIndex: 0 }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[45.758, 4.859]}>
                  <Popup>
                    <strong>12 rue des Lilas</strong><br />69003 Lyon
                  </Popup>
                </Marker>
              </MapContainer>
              <div className="map-address">
                <strong>12 rue des Lilas</strong><br />69003 Lyon
              </div>
              <div className="map-iris"><strong>IRIS:</strong> 690353501</div>
            </div>

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
