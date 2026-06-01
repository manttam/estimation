import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { searchAddresses } from '../utils/banClient';
import { fetchDvfByCommune, statsDvf, sortByDistance, filterByRecent } from '../utils/dvfClient';
import { estimerBien, formatPrixM2 } from '../utils/estimationCalculator';
import { setActiveBien } from '../utils/activeBien';

const css = `
  .creation-page {
    font-family: var(--font);
    max-width: 920px;
    margin: 0 auto;
    padding: 24px 20px 80px;
  }

  .cb-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #666;
    font-size: var(--fs-base);
    cursor: pointer;
    padding: 0;
    margin-bottom: 12px;
  }
  .cb-back:hover { color: var(--green); }

  .cb-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 4px;
  }
  .cb-subtitle {
    font-size: var(--fs-base);
    color: #888;
    margin-bottom: 24px;
  }

  .cb-section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: var(--radius-md);
    padding: 18px 18px 20px;
    margin-bottom: 16px;
  }

  .cb-section-title {
    font-size: var(--fs-base);
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cb-badge {
    background: #f0faf2;
    color: var(--green);
    font-size: var(--fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: var(--radius-card);
    letter-spacing: 0.5px;
  }

  /* ---- ADRESSE AUTOCOMPLETE ---- */
  .addr-wrapper { position: relative; }

  .addr-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: var(--fs-md);
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .addr-input:focus {
    outline: none;
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
  }

  .addr-results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 500;
    max-height: 280px;
    overflow-y: auto;
  }

  .addr-result {
    padding: 10px 14px;
    font-size: var(--fs-base);
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.1s;
  }
  .addr-result:last-child { border-bottom: none; }
  .addr-result:hover, .addr-result.active {
    background: #f0faf2;
  }
  .addr-result-label { color: var(--text); font-weight: 500; }
  .addr-result-context { color: #888; font-size: var(--fs-xs); margin-top: 2px; }

  .addr-loading {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: var(--fs-xs);
    color: #888;
  }

  .addr-selected {
    margin-top: 12px;
    padding: 10px 12px;
    background: #f0faf2;
    border-left: 3px solid var(--green);
    border-radius: var(--radius-sm);
    font-size: var(--fs-base);
    color: var(--text);
  }
  .addr-selected strong { font-weight: 600; }
  .addr-cp { color: #888; font-size: var(--fs-sm); margin-top: 2px; }

  .cb-mini-map {
    width: 100%;
    height: 220px;
    border-radius: 6px;
    margin-top: 12px;
    border: 1px solid #e0e0e0;
    overflow: hidden;
  }

  /* ---- FORM GRID ---- */
  .cb-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px 16px;
  }
  .cb-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px 16px;
  }

  .cb-field { display: flex; flex-direction: column; gap: 6px; }
  .cb-label {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-light);
  }
  .cb-input, .cb-select {
    padding: 10px 12px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: var(--fs-base);
    font-family: inherit;
    background: white;
    transition: border-color 0.15s;
  }
  .cb-input:focus, .cb-select:focus {
    outline: none;
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.1);
  }

  .cb-radio-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cb-radio {
    flex: 1;
    min-width: 100px;
    padding: 10px 12px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: var(--fs-base);
    font-weight: 500;
    color: var(--text-light);
    background: white;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
  }
  .cb-radio:hover { border-color: var(--green); }
  .cb-radio.active {
    background: var(--green);
    color: white;
    border-color: var(--green);
  }

  .cb-checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .cb-checkbox-row input { width: 16px; height: 16px; }
  .cb-checkbox-row label { font-size: var(--fs-base); color: var(--text-light); cursor: pointer; }

  /* ---- DVF PREVIEW ---- */
  .dvf-preview {
    padding: 14px;
    background: #fafafa;
    border-radius: 6px;
    border: 1px dashed #d8d8d8;
  }
  .dvf-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 12px;
  }
  .dvf-stat-box {
    text-align: center;
    padding: 8px 0;
  }
  .dvf-stat-value {
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--text);
  }
  .dvf-stat-label {
    font-size: var(--fs-2xs);
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }
  .dvf-empty {
    text-align: center;
    color: #888;
    font-size: var(--fs-base);
    padding: 12px 0;
  }
  .dvf-loading { color: var(--green); }

  /* ---- SUBMIT BAR ---- */
  .cb-submit-bar {
    position: sticky;
    bottom: 0;
    background: linear-gradient(to top, white 70%, rgba(255,255,255,0));
    padding: 16px 0 0;
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  .cb-btn {
    padding: 12px 24px;
    border-radius: 6px;
    font-size: var(--fs-md);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid;
    transition: all 0.15s;
  }
  .cb-btn-secondary {
    background: white;
    color: var(--text-light);
    border-color: #d0d0d0;
  }
  .cb-btn-secondary:hover { border-color: #888; }
  .cb-btn-primary {
    background: var(--green);
    color: white;
    border-color: var(--green);
  }
  .cb-btn-primary:hover:not(:disabled) { background: var(--green-dark); border-color: var(--green-dark); }
  .cb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .cb-error {
    background: #fff0f0;
    border: 1px solid #fdc8c8;
    color: #b00;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: var(--fs-base);
    margin-bottom: 12px;
  }
`;

const TYPES_BIEN = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
];

const ETATS = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'refait', label: 'Refait \u00e0 neuf' },
  { value: 'bon', label: 'Bon \u00e9tat' },
  { value: 'a_rafraichir', label: '\u00c0 rafra\u00eechir' },
  { value: 'a_renover', label: '\u00c0 r\u00e9nover' },
  { value: 'a_reconstruire', label: '\u00c0 reconstruire' },
];

const EXPOSITIONS = [
  { value: 'sud', label: 'Sud' },
  { value: 'sud_est', label: 'Sud-Est' },
  { value: 'sud_ouest', label: 'Sud-Ouest' },
  { value: 'est', label: 'Est' },
  { value: 'ouest', label: 'Ouest' },
  { value: 'nord_est', label: 'Nord-Est' },
  { value: 'nord_ouest', label: 'Nord-Ouest' },
  { value: 'nord', label: 'Nord' },
];

const PARKINGS = [
  { value: 'aucun', label: 'Aucun' },
  { value: 'place', label: 'Place' },
  { value: 'box', label: 'Box / Garage' },
];

const EXTERIEURS = [
  { value: 'aucun', label: 'Aucun' },
  { value: 'balcon', label: 'Balcon' },
  { value: 'terrasse', label: 'Terrasse' },
  { value: 'jardin', label: 'Jardin' },
];

export default function CreationBien() {
  const navigate = useNavigate();

  // Adresse ----------------------------------------------------------------
  const [addrQuery, setAddrQuery] = useState('');
  const [addrResults, setAddrResults] = useState([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrShowResults, setAddrShowResults] = useState(false);
  const [selectedAddr, setSelectedAddr] = useState(null); // {label, postcode, city, citycode, coords}
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Caracteristiques bien --------------------------------------------------
  const [type, setType] = useState('appartement');
  const [surface, setSurface] = useState('');
  const [pieces, setPieces] = useState('');
  const [chambres, setChambres] = useState('');
  const [etage, setEtage] = useState('');
  const [ascenseur, setAscenseur] = useState(false);
  const [annee, setAnnee] = useState('');
  const [etat, setEtat] = useState('bon');
  const [exposition, setExposition] = useState('');
  const [parking, setParking] = useState('aucun');
  const [exterieur, setExterieur] = useState('aucun');

  // DVF --------------------------------------------------------------------
  const [dvfData, setDvfData] = useState([]);
  const [dvfLoading, setDvfLoading] = useState(false);
  const [dvfStats, setDvfStatsState] = useState(null);

  // Submit -----------------------------------------------------------------
  const [submitError, setSubmitError] = useState('');

  // ---- Autocomplete adresse (debounce 300ms) ----
  // Tout le setState est dans le callback du setTimeout (et non dans le corps de l'effet)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!addrQuery || addrQuery.length < 3) return undefined;
    debounceRef.current = setTimeout(async () => {
      setAddrLoading(true);
      const results = await searchAddresses(addrQuery);
      setAddrResults(results);
      setAddrLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [addrQuery]);

  // ---- Click hors zone -> ferme la dropdown ----
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAddrShowResults(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ---- Selection d'une adresse ----
  // On reset les donnees DVF + on amorce le loading ici (handler) pour eviter setState dans effet.
  const handleSelectAddr = useCallback((addr) => {
    setSelectedAddr(addr);
    setAddrQuery(addr.label);
    setAddrShowResults(false);
    setDvfData([]);
    setDvfStatsState(null);
    setDvfLoading(true);
  }, []);

  // ---- Charge DVF apres choix d'adresse / changement de type ----
  // setState uniquement dans le .then() : pas dans le corps de l'effet.
  useEffect(() => {
    if (!selectedAddr?.citycode) return undefined;
    let cancelled = false;
    fetchDvfByCommune(selectedAddr.citycode).then((rows) => {
      if (cancelled) return;
      const recent = filterByRecent(rows, 24);
      const sorted = sortByDistance(recent, selectedAddr.coords);
      setDvfData(sorted);
      setDvfStatsState(statsDvf(sorted, type));
      setDvfLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedAddr, type]);

  // ---- Submit ----
  const canSubmit = selectedAddr && surface && parseFloat(surface) > 0;

  const handleEstimer = () => {
    setSubmitError('');
    if (!selectedAddr) {
      setSubmitError('Merci de saisir une adresse valide.');
      return;
    }
    const surfaceNum = parseFloat(surface);
    if (!surfaceNum || surfaceNum <= 0) {
      setSubmitError('La surface est obligatoire.');
      return;
    }

    const bien = {
      type,
      surface: surfaceNum,
      pieces: pieces ? parseInt(pieces, 10) : null,
      chambres: chambres ? parseInt(chambres, 10) : null,
      etage: etage !== '' ? parseInt(etage, 10) : null,
      ascenseur,
      annee: annee ? parseInt(annee, 10) : null,
      etat,
      exposition: exposition || null,
      parking,
      exterieur,
    };

    const result = estimerBien(bien, dvfStats);

    // Sauvegarde le bien actif (localStorage) -> consomme par PropertyCard
    // et l'ensemble du flow Step1 -> Step5.
    const payload = {
      bien,
      adresse: selectedAddr,
      result,
      dvfStats,
      dvfTopComparables: dvfData.slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    setActiveBien(payload);
    // On entre dans le flow d'estimation step par step.
    navigate('/step/1');
  };

  return (
    <div className="creation-page">
      <style>{css}</style>

      <button className="cb-back" onClick={() => navigate('/')}>
        &#8592; Retour au tableau de bord
      </button>
      <h1 className="cb-title">Nouvelle estimation</h1>
      <div className="cb-subtitle">
        Saisis l'adresse et les caract\u00e9ristiques du bien : on calcule l'estimation \u00e0 partir des transactions r\u00e9elles du quartier (DVF).
      </div>

      {/* SECTION ADRESSE */}
      <div className="cb-section">
        <div className="cb-section-title">
          1. Adresse du bien
          <span className="cb-badge">BAN officielle</span>
        </div>

        <div className="addr-wrapper" ref={wrapperRef}>
          <input
            type="text"
            className="addr-input"
            placeholder="Commencez \u00e0 taper l'adresse (ex. 12 rue des Lilas Lyon)"
            value={addrQuery}
            onChange={(e) => {
              const v = e.target.value;
              setAddrQuery(v);
              setAddrShowResults(true);
              if (selectedAddr && v !== selectedAddr.label) {
                setSelectedAddr(null);
              }
              if (v.length < 3) {
                setAddrResults([]);
                setAddrLoading(false);
              }
            }}
            onFocus={() => setAddrShowResults(true)}
          />
          {addrLoading && <span className="addr-loading">Recherche...</span>}

          {addrShowResults && addrResults.length > 0 && (
            <div className="addr-results">
              {addrResults.map((r, i) => (
                <div
                  key={i}
                  className="addr-result"
                  onClick={() => handleSelectAddr(r)}
                >
                  <div className="addr-result-label">{r.label}</div>
                  <div className="addr-result-context">{r.context}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedAddr && (
          <>
            <div className="addr-selected">
              <strong>{selectedAddr.label}</strong>
              <div className="addr-cp">
                {selectedAddr.postcode} {selectedAddr.city} (INSEE {selectedAddr.citycode})
              </div>
            </div>
            <div className="cb-mini-map">
              <MapContainer
                center={selectedAddr.coords}
                zoom={16}
                key={selectedAddr.coords.join(',')}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={selectedAddr.coords} />
              </MapContainer>
            </div>
          </>
        )}
      </div>

      {/* SECTION TYPE + SURFACE */}
      <div className="cb-section">
        <div className="cb-section-title">2. Type &amp; surface</div>

        <div className="cb-field" style={{ marginBottom: 16 }}>
          <label className="cb-label">Type de bien</label>
          <div className="cb-radio-row">
            {TYPES_BIEN.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`cb-radio ${type === t.value ? 'active' : ''}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cb-grid-3">
          <div className="cb-field">
            <label className="cb-label">Surface (m\u00b2) *</label>
            <input
              type="number"
              className="cb-input"
              placeholder="ex. 72"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              min="1"
            />
          </div>
          <div className="cb-field">
            <label className="cb-label">Nombre de pi\u00e8ces</label>
            <input
              type="number"
              className="cb-input"
              placeholder="ex. 3"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              min="1"
            />
          </div>
          <div className="cb-field">
            <label className="cb-label">Chambres</label>
            <input
              type="number"
              className="cb-input"
              placeholder="ex. 2"
              value={chambres}
              onChange={(e) => setChambres(e.target.value)}
              min="0"
            />
          </div>
        </div>
      </div>

      {/* SECTION CARACTERISTIQUES */}
      <div className="cb-section">
        <div className="cb-section-title">3. Caract\u00e9ristiques</div>

        <div className="cb-grid-3">
          {type === 'appartement' && (
            <div className="cb-field">
              <label className="cb-label">\u00c9tage</label>
              <input
                type="number"
                className="cb-input"
                placeholder="ex. 2 (0 = RDC)"
                value={etage}
                onChange={(e) => setEtage(e.target.value)}
                min="0"
              />
              <div className="cb-checkbox-row">
                <input
                  type="checkbox"
                  id="ascenseur"
                  checked={ascenseur}
                  onChange={(e) => setAscenseur(e.target.checked)}
                />
                <label htmlFor="ascenseur">Avec ascenseur</label>
              </div>
            </div>
          )}

          <div className="cb-field">
            <label className="cb-label">Ann\u00e9e de construction</label>
            <input
              type="number"
              className="cb-input"
              placeholder="ex. 1985"
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              min="1700"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="cb-field">
            <label className="cb-label">\u00c9tat g\u00e9n\u00e9ral</label>
            <select
              className="cb-select"
              value={etat}
              onChange={(e) => setEtat(e.target.value)}
            >
              {ETATS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="cb-field">
            <label className="cb-label">Exposition</label>
            <select
              className="cb-select"
              value={exposition}
              onChange={(e) => setExposition(e.target.value)}
            >
              <option value="">Non pr\u00e9cis\u00e9e</option>
              {EXPOSITIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="cb-field">
            <label className="cb-label">Stationnement</label>
            <select
              className="cb-select"
              value={parking}
              onChange={(e) => setParking(e.target.value)}
            >
              {PARKINGS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="cb-field">
            <label className="cb-label">Ext\u00e9rieur</label>
            <select
              className="cb-select"
              value={exterieur}
              onChange={(e) => setExterieur(e.target.value)}
            >
              {EXTERIEURS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION DVF PREVIEW */}
      <div className="cb-section">
        <div className="cb-section-title">
          4. R\u00e9f\u00e9rences march\u00e9 (DVF)
          <span className="cb-badge">{dvfStats ? `${dvfStats.count} transactions` : 'auto'}</span>
        </div>

        {!selectedAddr ? (
          <div className="dvf-preview">
            <div className="dvf-empty">Saisis une adresse pour charger les transactions r\u00e9elles du quartier.</div>
          </div>
        ) : dvfLoading ? (
          <div className="dvf-preview">
            <div className="dvf-empty dvf-loading">Chargement des transactions DVF&hellip;</div>
          </div>
        ) : !dvfStats ? (
          <div className="dvf-preview">
            <div className="dvf-empty">Aucune transaction r\u00e9cente trouv\u00e9e pour ce type de bien dans cette commune.</div>
          </div>
        ) : (
          <div className="dvf-preview">
            <div className="dvf-stats">
              <div className="dvf-stat-box">
                <div className="dvf-stat-value">{formatPrixM2(dvfStats.median)}</div>
                <div className="dvf-stat-label">M\u00e9diane</div>
              </div>
              <div className="dvf-stat-box">
                <div className="dvf-stat-value">{formatPrixM2(dvfStats.moyenne)}</div>
                <div className="dvf-stat-label">Moyenne</div>
              </div>
              <div className="dvf-stat-box">
                <div className="dvf-stat-value">{formatPrixM2(dvfStats.p25)}</div>
                <div className="dvf-stat-label">25e percentile</div>
              </div>
              <div className="dvf-stat-box">
                <div className="dvf-stat-value">{formatPrixM2(dvfStats.p75)}</div>
                <div className="dvf-stat-label">75e percentile</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
              {dvfStats.count} ventes de {type}s sur 24 mois &mdash; commune {selectedAddr.city}
            </div>
          </div>
        )}
      </div>

      {/* SUBMIT BAR */}
      {submitError && <div className="cb-error">{submitError}</div>}
      <div className="cb-submit-bar">
        <button className="cb-btn cb-btn-secondary" onClick={() => navigate('/')}>
          Annuler
        </button>
        <button
          className="cb-btn cb-btn-primary"
          onClick={handleEstimer}
          disabled={!canSubmit}
        >
          Estimer ce bien &rarr;
        </button>
      </div>
    </div>
  );
}
