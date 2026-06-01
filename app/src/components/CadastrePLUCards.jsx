import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchParcelle,
  fetchZoneUrba,
  CADASTRE_WMTS_URL,
  GPU_ZONE_URBA_WMTS_URL,
  PLAN_IGN_WMTS_URL,
  formatContenance,
} from '../utils/datagouv';

const styles = `
  .cplu-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
    margin-bottom: 4px;
  }

  .cplu-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
  }

  .cplu-card:hover {
    border-color: #46B962;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .cplu-card[disabled] {
    opacity: 0.6;
    cursor: wait;
  }

  .cplu-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #f5f5f5;
  }

  .cplu-thumb .leaflet-container {
    width: 100%;
    height: 100%;
  }

  .cplu-zoom {
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
    z-index: 401;
    pointer-events: none;
  }

  .cplu-meta {
    padding: 8px 10px 10px;
  }

  .cplu-title {
    font-size: 12px;
    font-weight: 600;
    color: #393939;
  }

  .cplu-sub {
    font-size: 11px;
    color: #949494;
    margin-top: 2px;
  }

  /* Modale plein \u00e9cran */
  .cplu-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    animation: cplu-fadein 0.15s ease-out;
  }

  @keyframes cplu-fadein {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .cplu-modal-content {
    position: relative;
    width: 90vw;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .cplu-modal-map {
    width: 100%;
    height: 70vh;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    box-shadow: 0 4px 32px rgba(0,0,0,0.5);
  }

  .cplu-modal-map .leaflet-container {
    width: 100%;
    height: 100%;
  }

  .cplu-modal-caption {
    color: white;
    text-align: center;
    font-size: 13px;
    background: rgba(0,0,0,0.4);
    padding: 8px 16px;
    border-radius: 6px;
    max-width: 90vw;
  }

  .cplu-modal-caption .mm-title {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 2px;
  }

  .cplu-modal-close {
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

  .cplu-modal-close:hover {
    background: rgba(255,255,255,0.25);
  }
`;

/**
 * Affiche deux cartes interactives (Cadastre + Plan de zone PLU)
 * pour les coordonn\u00e9es donn\u00e9es. Donn\u00e9es : APIs publiques data.gouv / IGN.
 */
export default function CadastrePLUCards({ lat = 45.758, lon = 4.859, address = '' }) {
  const [parcelle, setParcelle] = useState(null);
  const [zoneUrba, setZoneUrba] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'cadastre' | 'plu' | null

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchParcelle(lon, lat).catch((e) => { console.warn('Cadastre KO', e); return null; }),
      fetchZoneUrba(lon, lat).catch((e) => { console.warn('GPU KO', e); return null; }),
    ]).then(([parc, zu]) => {
      if (cancelled) return;
      setParcelle(parc);
      setZoneUrba(zu);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [lat, lon]);

  // ESC pour fermer la modale + lock scroll
  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [modal]);

  const cadastreSub = loading
    ? 'Chargement…'
    : parcelle
      ? `${parcelle.properties.idu} • ${formatContenance(parcelle.properties.contenance)}`
      : 'Parcelle indisponible';

  const pluSub = loading
    ? 'Chargement…'
    : zoneUrba
      ? `Zone ${zoneUrba.properties.libelle} • ${zoneUrba.properties.typezone}`
      : 'Zonage non disponible';

  const cadastreCaption = parcelle
    ? `Parcelle ${parcelle.properties.idu} — ${formatContenance(parcelle.properties.contenance)} — ${parcelle.properties.nom_com}`
    : 'Parcelle cadastrale';

  const pluCaption = zoneUrba
    ? `Zone ${zoneUrba.properties.libelle} (${zoneUrba.properties.typezone})${zoneUrba.properties.libelong ? ' — ' + zoneUrba.properties.libelong : ''}`
    : 'Plan local d’urbanisme';

  return (
    <>
      <style>{styles}</style>

      <div className="cplu-grid">
        {/* Carte Cadastre */}
        <button
          type="button"
          className="cplu-card"
          onClick={() => setModal('cadastre')}
          disabled={loading}
        >
          <div className="cplu-thumb">
            <MapContainer
              center={[lat, lon]}
              zoom={18}
              zoomControl={false}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
              attributionControl={false}
            >
              <TileLayer url={PLAN_IGN_WMTS_URL} />
              <TileLayer url={CADASTRE_WMTS_URL} opacity={0.85} />
              <Marker position={[lat, lon]} />
            </MapContainer>
            <span className="cplu-zoom">&#x2922;</span>
          </div>
          <div className="cplu-meta">
            <div className="cplu-title">Cadastre</div>
            <div className="cplu-sub">{cadastreSub}</div>
          </div>
        </button>

        {/* Carte Plan de zone (PLU) */}
        <button
          type="button"
          className="cplu-card"
          onClick={() => setModal('plu')}
          disabled={loading}
        >
          <div className="cplu-thumb">
            <MapContainer
              center={[lat, lon]}
              zoom={16}
              zoomControl={false}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
              attributionControl={false}
            >
              <TileLayer url={PLAN_IGN_WMTS_URL} />
              <TileLayer url={GPU_ZONE_URBA_WMTS_URL} opacity={0.6} />
              <Marker position={[lat, lon]} />
            </MapContainer>
            <span className="cplu-zoom">&#x2922;</span>
          </div>
          <div className="cplu-meta">
            <div className="cplu-title">Plan de zone</div>
            <div className="cplu-sub">{pluSub}</div>
          </div>
        </button>
      </div>

      {/* Modale plein \u00e9cran */}
      {modal && (
        <div
          className="cplu-modal-overlay"
          onClick={() => setModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label={modal === 'cadastre' ? 'Cadastre' : 'Plan de zone'}
        >
          <div className="cplu-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="cplu-modal-close"
              onClick={() => setModal(null)}
              aria-label="Fermer"
            >&times;</button>
            <div className="cplu-modal-map">
              <MapContainer
                center={[lat, lon]}
                zoom={modal === 'cadastre' ? 18 : 16}
              >
                <TileLayer url={PLAN_IGN_WMTS_URL} attribution="&copy; IGN — data.gouv.fr" />
                {modal === 'cadastre' && (
                  <TileLayer url={CADASTRE_WMTS_URL} opacity={0.85} />
                )}
                {modal === 'plu' && (
                  <TileLayer url={GPU_ZONE_URBA_WMTS_URL} opacity={0.6} />
                )}
                <Marker position={[lat, lon]}>
                  {address && (
                    <Popup>
                      <strong>{address}</strong>
                    </Popup>
                  )}
                </Marker>
              </MapContainer>
            </div>
            <div className="cplu-modal-caption">
              <div className="mm-title">
                {modal === 'cadastre' ? 'Cadastre' : 'Plan de zone (PLU)'}
              </div>
              <div>{modal === 'cadastre' ? cadastreCaption : pluCaption}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
