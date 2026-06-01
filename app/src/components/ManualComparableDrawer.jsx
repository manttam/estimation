import { useEffect, useMemo, useState } from 'react';

/**
 * ManualComparableDrawer — Drawer de saisie manuelle d'un comparable.
 *
 * Permet à un utilisateur (commercial, agent) d'ajouter un bien comparable
 * issu d'une source externe (annonce SeLoger, mandat agence, vente DVF
 * complétée à la main, observation terrain, etc.) sans dépendre d'un
 * scraping live.
 *
 * Sortie : objet "other" compatible avec Step3Comparables (même shape
 * que dvfTxToOther / les mocks INITIAL_OTHERS), prêt à être stocké en
 * localStorage et rendu dans la liste / sur la carte.
 *
 * Pas de PII : l'utilisateur saisit ses propres données. Aucune donnée
 * personnelle n'est extraite ou re-publiée.
 */

const styles = `
  .mcd-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
    animation: mcd-fade-in 0.18s ease;
  }
  @keyframes mcd-fade-in {
    from { background: rgba(0, 0, 0, 0); }
    to { background: rgba(0, 0, 0, 0.42); }
  }
  .mcd-panel {
    width: 560px;
    max-width: 95vw;
    height: 100vh;
    background: #fff;
    overflow-y: auto;
    animation: mcd-slide-in 0.25s ease;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    font-family: var(--font);
    display: flex;
    flex-direction: column;
  }
  @keyframes mcd-slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .mcd-header {
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
  .mcd-header-text { flex: 1; min-width: 0; }
  .mcd-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px;
    color: #1a1a1a;
  }
  .mcd-subtitle {
    font-size: 12px;
    color: #666;
  }
  .mcd-close {
    background: #f5f5f5;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mcd-close:hover { background: #ececec; color: #1a1a1a; }

  .mcd-body {
    flex: 1;
    padding: 18px 22px 24px;
    overflow-y: auto;
  }
  .mcd-section { margin-bottom: 22px; }
  .mcd-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin: 0 0 10px;
  }
  .mcd-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .mcd-row.full { grid-template-columns: 1fr; }
  .mcd-row.thirds { grid-template-columns: 1fr 1fr 1fr; }

  .mcd-field { display: flex; flex-direction: column; gap: 4px; }
  .mcd-label {
    font-size: 11px;
    color: #555;
    font-weight: 500;
  }
  .mcd-label .req { color: var(--red); margin-left: 2px; }
  .mcd-input,
  .mcd-select,
  .mcd-textarea {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    color: #1a1a1a;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .mcd-input:focus,
  .mcd-select:focus,
  .mcd-textarea:focus {
    outline: none;
    border-color: var(--blue);
  }
  .mcd-input.computed {
    background: #fafafa;
    color: #777;
  }
  .mcd-textarea { min-height: 90px; resize: vertical; }
  .mcd-help {
    font-size: 10px;
    color: #888;
    margin-top: 2px;
  }
  .mcd-error-field {
    font-size: 10px;
    color: #c0392b;
    margin-top: 2px;
  }

  /* Toggle terrain (Oui/Non) */
  .mcd-toggle {
    display: inline-flex;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
  }
  .mcd-toggle button {
    background: #fff;
    border: none;
    padding: 7px 14px;
    font-size: 12px;
    cursor: pointer;
    color: #555;
    font-family: inherit;
  }
  .mcd-toggle button.active {
    background: var(--blue);
    color: #fff;
    font-weight: 600;
  }
  .mcd-toggle button + button { border-left: 1px solid #ddd; }
  .mcd-toggle button.active + button,
  .mcd-toggle button + button.active { border-left: none; }

  /* Checkbox lookalike row */
  .mcd-check-row {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .mcd-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #333;
    user-select: none;
  }
  .mcd-check input { accent-color: var(--blue); cursor: pointer; }

  /* Tags input */
  .mcd-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px;
    background: #fff;
    min-height: 38px;
  }
  .mcd-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #eef3ff;
    color: #2d4ab8;
    border-radius: 12px;
    padding: 3px 9px;
    font-size: 12px;
    font-weight: 500;
  }
  .mcd-tag.cons { background: #fef0ee; color: #b13a2b; }
  .mcd-tag button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    font-size: 13px;
    line-height: 1;
    opacity: 0.7;
  }
  .mcd-tag button:hover { opacity: 1; }
  .mcd-tags input {
    flex: 1;
    min-width: 100px;
    border: none;
    outline: none;
    font-size: 12px;
    padding: 4px 6px;
    color: #1a1a1a;
    background: transparent;
    font-family: inherit;
  }

  /* Photos */
  .mcd-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .mcd-photo-thumb {
    position: relative;
    width: 88px;
    height: 88px;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
    border: 1px solid #eee;
  }
  .mcd-photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mcd-photo-thumb button {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.55);
    border: none;
    color: #fff;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
  }
  .mcd-photo-add-url {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .mcd-photo-add-url button {
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .mcd-photo-add-url button:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Footer */
  .mcd-footer {
    position: sticky;
    bottom: 0;
    background: #fff;
    border-top: 1px solid #eee;
    padding: 14px 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    z-index: 6;
  }
  .mcd-footer-left { font-size: 11px; color: #888; }
  .mcd-footer-actions { display: flex; gap: 8px; }
  .mcd-btn {
    border: none;
    border-radius: 6px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .mcd-btn.secondary {
    background: #f5f5f5;
    color: #333;
  }
  .mcd-btn.secondary:hover { background: #ececec; }
  .mcd-btn.primary {
    background: var(--green);
    color: #fff;
  }
  .mcd-btn.primary:hover { background: var(--green-dark); }
  .mcd-btn.primary:disabled {
    background: #b8d8be;
    cursor: not-allowed;
  }

  .mcd-error {
    background: #fef0ee;
    border: 1px solid #f3d4d4;
    color: #b13a2b;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    margin-bottom: 14px;
  }
`;

/* Mapping source → libellé + couleur (cohérent avec Step3Comparables). */
const SOURCE_LABELS = {
  dvf: 'DVF',
  ideeri: 'Vendu par Ideeri',
  portail: 'Portail',
  encours: 'En cours',
};

/* Géocodage Adresse API gouv (gratuit, public). */
async function geocodeAdresse(query) {
  if (!query || query.length < 5) return null;
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const f = j?.features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry?.coordinates || [];
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    return {
      lat,
      lon,
      label: f.properties?.label || query,
      city: f.properties?.city || null,
      postcode: f.properties?.postcode || null,
      citycode: f.properties?.citycode || null,
    };
  } catch {
    return null;
  }
}

/* Distance haversine (mètres). */
function distanceM(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDistance(m) {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/* Génère un id stable pour un comparable manuel. */
function genId() {
  return `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* État initial vide d'un comparable. */
const EMPTY_FORM = {
  source: 'portail',
  portalName: '',
  type: 'appartement',
  surface: '',
  etage: '',
  etagesTotal: '',
  pieces: '',
  chambres: '',
  hasTerrain: false,
  surfaceTerrain: '',
  piscine: false,
  garage: false,
  adresse: '',
  prix: '',
  date: '',
  dpe: '',
  ges: '',
  etat: '',
  atouts: [],
  contraintes: [],
  photoUrls: [],
  description: '',
  urlSource: '',
};

export default function ManualComparableDrawer({
  open,
  onClose,
  onSave,
  targetCoords,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [atoutInput, setAtoutInput] = useState('');
  const [contrainteInput, setContrainteInput] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState(null); // { lat, lon, label, city, postcode }
  const [error, setError] = useState(null);

  /* Reset à chaque ouverture pour repartir d'une fiche vierge. */
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setAtoutInput('');
      setContrainteInput('');
      setPhotoUrlInput('');
      setGeocoded(null);
      setError(null);
    }
  }, [open]);

  /* Fermeture au clavier (Escape). */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Si type = maison, terrain présumé "oui" par défaut (mais réversible). */
  useEffect(() => {
    if (form.type === 'maison' && !form.hasTerrain) {
      setForm((f) => ({ ...f, hasTerrain: true }));
    }
    if (form.type === 'appartement' && form.hasTerrain) {
      setForm((f) => ({ ...f, hasTerrain: false, surfaceTerrain: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  /* Géocodage debouncé sur l'adresse. */
  useEffect(() => {
    if (!open) return undefined;
    if (!form.adresse || form.adresse.length < 5) {
      setGeocoded(null);
      return undefined;
    }
    let cancelled = false;
    setGeocoding(true);
    const t = setTimeout(async () => {
      const g = await geocodeAdresse(form.adresse);
      if (!cancelled) {
        setGeocoded(g);
        setGeocoding(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setGeocoding(false);
    };
  }, [form.adresse, open]);

  const prixM2 = useMemo(() => {
    const p = Number(form.prix);
    const s = Number(form.surface);
    if (!p || !s) return null;
    return Math.round(p / s);
  }, [form.prix, form.surface]);

  const distanceLabel = useMemo(() => {
    if (!geocoded || !targetCoords) return null;
    const m = distanceM(targetCoords, [geocoded.lat, geocoded.lon]);
    return fmtDistance(m);
  }, [geocoded, targetCoords]);

  if (!open) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addTag = (kind, value) => {
    const v = (value || '').trim();
    if (!v) return;
    const key = kind === 'atout' ? 'atouts' : 'contraintes';
    if (form[key].includes(v)) return;
    setForm((f) => ({ ...f, [key]: [...f[key], v] }));
    if (kind === 'atout') setAtoutInput('');
    else setContrainteInput('');
  };

  const removeTag = (kind, idx) => {
    const key = kind === 'atout' ? 'atouts' : 'contraintes';
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  };

  const addPhotoUrl = () => {
    const u = (photoUrlInput || '').trim();
    if (!u) return;
    if (!u.startsWith('http')) {
      setError('URL photo invalide (doit commencer par http:// ou https://)');
      return;
    }
    setForm((f) => ({ ...f, photoUrls: [...f.photoUrls, u] }));
    setPhotoUrlInput('');
    setError(null);
  };

  const removePhoto = (i) => {
    setForm((f) => ({ ...f, photoUrls: f.photoUrls.filter((_, idx) => idx !== i) }));
  };

  /* Validation + transformation en objet "other". */
  const handleSave = () => {
    setError(null);
    if (!form.surface || Number(form.surface) <= 0) {
      setError('La surface est requise (en m²).');
      return;
    }
    if (!form.prix || Number(form.prix) <= 0) {
      setError('Le prix est requis.');
      return;
    }
    if (!form.adresse) {
      setError("L'adresse est requise.");
      return;
    }
    if (form.source === 'portail' && !form.portalName) {
      setError('Le nom du portail est requis (SeLoger, Leboncoin, Bien\'ici…).');
      return;
    }

    const coords = geocoded ? [geocoded.lat, geocoded.lon] : null;
    const distM = (coords && targetCoords) ? distanceM(targetCoords, coords) : null;

    const surface = Number(form.surface);
    const prix = Number(form.prix);
    const surfaceTerrain = form.hasTerrain && form.surfaceTerrain
      ? Number(form.surfaceTerrain) : null;

    const titreBase = form.type === 'maison'
      ? `Maison ${form.pieces ? `${form.pieces}p ` : ''}${surface} m²`
      : `Appartement ${form.pieces ? `T${form.pieces} ` : ''}${surface} m²`;

    const infosGenerales = {
      surfaceHabitable: surface,
      surfaceExterieurs: surfaceTerrain,
      etatGeneral: form.etat || null,
      dpe: form.dpe || null,
      ges: form.ges || null,
      anneeConstruction: null,
      renovationAnnee: null,
      chauffage: null,
      sol: null,
      menuiseries: null,
      toitureCharpente: null,
      emplacement: null,
      rafraichissement: null,
      dependances: [
        form.garage ? 'Garage' : null,
        form.piscine ? 'Piscine' : null,
      ].filter(Boolean).join(', ') || null,
    };

    /* Format compatible Step3 / ComparableDrawer. */
    const other = {
      id: genId(),
      manual: true, // flag pour pouvoir filtrer / éditer / supprimer plus tard
      source: form.source,
      sourceLabel: SOURCE_LABELS[form.source] || form.source,
      portalName: form.source === 'portail' ? form.portalName : null,
      title: titreBase,
      addr: geocoded?.label || form.adresse,
      coords,
      distance: distM != null ? fmtDistance(distM) : '—',
      distanceM: distM,
      prix: prix.toLocaleString('fr-FR'),
      prixRaw: prix,
      prixM2: prixM2 ? prixM2.toLocaleString('fr-FR') : null,
      prixM2Raw: prixM2,
      surface,
      pieces: form.pieces ? Number(form.pieces) : null,
      chambres: form.chambres ? Number(form.chambres) : null,
      type: form.type,
      etage: form.etage || null,
      etagesTotal: form.etagesTotal || null,
      hasTerrain: !!form.hasTerrain,
      surfaceTerrain,
      piscine: !!form.piscine,
      garage: !!form.garage,
      photos: form.photoUrls,
      description: form.description || null,
      descriptifAnnonce: form.source === 'portail' ? (form.description || null) : null,
      urlAnnonce: form.urlSource || null,
      atoutsQualitatifs: form.atouts,
      pointsContraintes: form.contraintes,
      infosGenerales,
      dateMutationISO: form.date ? new Date(form.date).toISOString() : null,
      dateLabel: form.date || null,
      createdAt: new Date().toISOString(),
    };

    onSave?.(other);
  };

  return (
    <div className="mcd-overlay" onClick={onClose}>
      <style>{styles}</style>
      <aside className="mcd-panel" onClick={(e) => e.stopPropagation()}>
        <header className="mcd-header">
          <div className="mcd-header-text">
            <h2 className="mcd-title">Ajouter un comparable manuel</h2>
            <div className="mcd-subtitle">
              Saisis une annonce, un mandat ou une vente que tu souhaites
              utiliser comme référence d'estimation.
            </div>
          </div>
          <button
            type="button"
            className="mcd-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <div className="mcd-body">
          {error && <div className="mcd-error">{error}</div>}

          {/* Source */}
          <section className="mcd-section">
            <h3 className="mcd-section-title">Origine du comparable</h3>
            <div className="mcd-row">
              <div className="mcd-field">
                <label className="mcd-label">Source<span className="req">*</span></label>
                <select
                  className="mcd-select"
                  value={form.source}
                  onChange={(e) => set({ source: e.target.value, portalName: '' })}
                >
                  <option value="portail">Portail (SeLoger, Leboncoin…)</option>
                  <option value="ideeri">Vendu par Ideeri</option>
                  <option value="encours">En cours de commercialisation</option>
                  <option value="dvf">DVF (vente publique)</option>
                </select>
              </div>
              {form.source === 'portail' && (
                <div className="mcd-field">
                  <label className="mcd-label">
                    Nom du portail<span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="mcd-input"
                    placeholder="SeLoger, Leboncoin, Bien'ici…"
                    value={form.portalName}
                    onChange={(e) => set({ portalName: e.target.value })}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Caractéristiques */}
          <section className="mcd-section">
            <h3 className="mcd-section-title">Caractéristiques du bien</h3>
            <div className="mcd-row">
              <div className="mcd-field">
                <label className="mcd-label">Type<span className="req">*</span></label>
                <select
                  className="mcd-select"
                  value={form.type}
                  onChange={(e) => set({ type: e.target.value })}
                >
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                  <option value="terrain">Terrain</option>
                </select>
              </div>
              <div className="mcd-field">
                <label className="mcd-label">Surface habitable (m²)<span className="req">*</span></label>
                <input
                  type="number"
                  className="mcd-input"
                  placeholder="70"
                  value={form.surface}
                  onChange={(e) => set({ surface: e.target.value })}
                />
              </div>
            </div>

            {form.type === 'appartement' && (
              <div className="mcd-row">
                <div className="mcd-field">
                  <label className="mcd-label">Étage</label>
                  <input
                    type="text"
                    className="mcd-input"
                    placeholder="3"
                    value={form.etage}
                    onChange={(e) => set({ etage: e.target.value })}
                  />
                </div>
                <div className="mcd-field">
                  <label className="mcd-label">Sur (étages totaux)</label>
                  <input
                    type="text"
                    className="mcd-input"
                    placeholder="6"
                    value={form.etagesTotal}
                    onChange={(e) => set({ etagesTotal: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="mcd-row">
              <div className="mcd-field">
                <label className="mcd-label">Nombre de pièces</label>
                <input
                  type="number"
                  className="mcd-input"
                  placeholder="3"
                  value={form.pieces}
                  onChange={(e) => set({ pieces: e.target.value })}
                />
              </div>
              <div className="mcd-field">
                <label className="mcd-label">Nombre de chambres</label>
                <input
                  type="number"
                  className="mcd-input"
                  placeholder="2"
                  value={form.chambres}
                  onChange={(e) => set({ chambres: e.target.value })}
                />
              </div>
            </div>

            {/* Terrain */}
            <div className="mcd-row">
              <div className="mcd-field">
                <label className="mcd-label">Terrain ?</label>
                <div className="mcd-toggle">
                  <button
                    type="button"
                    className={!form.hasTerrain ? 'active' : ''}
                    onClick={() => set({ hasTerrain: false, surfaceTerrain: '' })}
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    className={form.hasTerrain ? 'active' : ''}
                    onClick={() => set({ hasTerrain: true })}
                  >
                    Oui
                  </button>
                </div>
              </div>
              {form.hasTerrain && (
                <div className="mcd-field">
                  <label className="mcd-label">Surface terrain (m²)</label>
                  <input
                    type="number"
                    className="mcd-input"
                    placeholder="350"
                    value={form.surfaceTerrain}
                    onChange={(e) => set({ surfaceTerrain: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Equipements */}
            <div className="mcd-field">
              <label className="mcd-label">Équipements</label>
              <div className="mcd-check-row">
                <label className="mcd-check">
                  <input
                    type="checkbox"
                    checked={form.piscine}
                    onChange={(e) => set({ piscine: e.target.checked })}
                  />
                  Piscine
                </label>
                <label className="mcd-check">
                  <input
                    type="checkbox"
                    checked={form.garage}
                    onChange={(e) => set({ garage: e.target.checked })}
                  />
                  Garage
                </label>
              </div>
            </div>
          </section>

          {/* Localisation */}
          <section className="mcd-section">
            <h3 className="mcd-section-title">Localisation</h3>
            <div className="mcd-row full">
              <div className="mcd-field">
                <label className="mcd-label">
                  Adresse<span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="mcd-input"
                  placeholder="12 rue Duguesclin, 69003 Lyon"
                  value={form.adresse}
                  onChange={(e) => set({ adresse: e.target.value })}
                />
                {geocoding && (
                  <div className="mcd-help">Géolocalisation en cours…</div>
                )}
                {!geocoding && geocoded && (
                  <div className="mcd-help" style={{ color: '#2d8856' }}>
                    ✓ {geocoded.label}
                    {distanceLabel && ` — à ${distanceLabel} du bien`}
                  </div>
                )}
                {!geocoding && !geocoded && form.adresse.length >= 5 && (
                  <div className="mcd-error-field">
                    Adresse non trouvée — la saisie sera conservée mais sans
                    géolocalisation (pas de pin sur la carte).
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Prix */}
          <section className="mcd-section">
            <h3 className="mcd-section-title">Prix</h3>
            <div className="mcd-row thirds">
              <div className="mcd-field">
                <label className="mcd-label">Prix (€)<span className="req">*</span></label>
                <input
                  type="number"
                  className="mcd-input"
                  placeholder="350000"
                  value={form.prix}
                  onChange={(e) => set({ prix: e.target.value })}
                />
              </div>
              <div className="mcd-field">
                <label className="mcd-label">Prix/m² (calculé)</label>
                <input
                  type="text"
                  className="mcd-input computed"
                  value={prixM2 ? `${prixM2.toLocaleString('fr-FR')} €` : '—'}
                  readOnly
                />
              </div>
              <div className="mcd-field">
                <label className="mcd-label">Date de référence</label>
                <input
                  type="date"
                  className="mcd-input"
                  value={form.date}
                  onChange={(e) => set({ date: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Qualité */}
          <section className="mcd-section">
            <h3 className="mcd-section-title">Qualité du bien</h3>
            <div className="mcd-row thirds">
              <div className="mcd-field">
                <label className="mcd-label">DPE</label>
                <select
                  className="mcd-select"
                  value={form.dpe}
                  onChange={(e) => set({ dpe: e.target.value })}
                >
                  <option value="">—</option>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="mcd-field">
                <label className="mcd-label">GES</label>
                <select
                  className="mcd-select"
                  value={form.ges}
                  onChange={(e) => set({ ges: e.target.value })}
                >
                  <option value="">—</option>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="mcd-field">
                <label className="mcd-label">État général</label>
                <select
                  className="mcd-select"
                  value={form.etat}
                  onChange={(e) => set({ etat: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="Neuf">Neuf</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Bon">Bon</option>
                  <option value="À rafraîchir">À rafraîchir</option>
                  <option value="À rénover">À rénover</option>
                </select>
              </div>
            </div>

            {/* Atouts */}
            <div className="mcd-field" style={{ marginTop: 12 }}>
              <label className="mcd-label">Atouts qualitatifs</label>
              <div className="mcd-tags">
                {form.atouts.map((t, i) => (
                  <span key={`a-${i}`} className="mcd-tag">
                    + {t}
                    <button type="button" onClick={() => removeTag('atout', i)}>×</button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="ex: balcon, calme, exposé sud — Entrée ↵"
                  value={atoutInput}
                  onChange={(e) => setAtoutInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag('atout', atoutInput);
                    }
                  }}
                  onBlur={() => addTag('atout', atoutInput)}
                />
              </div>
            </div>

            {/* Contraintes */}
            <div className="mcd-field" style={{ marginTop: 8 }}>
              <label className="mcd-label">Points de contrainte</label>
              <div className="mcd-tags">
                {form.contraintes.map((t, i) => (
                  <span key={`c-${i}`} className="mcd-tag cons">
                    − {t}
                    <button type="button" onClick={() => removeTag('contrainte', i)}>×</button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="ex: RDC, à rafraîchir, sans ascenseur — Entrée ↵"
                  value={contrainteInput}
                  onChange={(e) => setContrainteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag('contrainte', contrainteInput);
                    }
                  }}
                  onBlur={() => addTag('contrainte', contrainteInput)}
                />
              </div>
            </div>
          </section>

          {/* Photos + descriptif */}
          <section className="mcd-section">
            <h3 className="mcd-section-title">Photos &amp; descriptif</h3>
            <div className="mcd-field">
              <label className="mcd-label">Photos (URL)</label>
              <div className="mcd-photos">
                {form.photoUrls.map((u, i) => (
                  <div key={i} className="mcd-photo-thumb">
                    <img src={u} alt={`Photo ${i + 1}`} />
                    <button type="button" onClick={() => removePhoto(i)} aria-label="Retirer">×</button>
                  </div>
                ))}
              </div>
              <div className="mcd-photo-add-url">
                <input
                  type="url"
                  className="mcd-input"
                  placeholder="https://… (URL d'une image)"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhotoUrl();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addPhotoUrl}
                  disabled={!photoUrlInput.trim()}
                >
                  Ajouter
                </button>
              </div>
              <div className="mcd-help">
                Colle l'URL d'une photo de l'annonce (clic droit → copier
                l'image). L'upload de fichiers locaux n'est pas encore branché.
              </div>
            </div>

            <div className="mcd-field" style={{ marginTop: 14 }}>
              <label className="mcd-label">Description</label>
              <textarea
                className="mcd-textarea"
                placeholder="Description libre du bien…"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>

            <div className="mcd-field" style={{ marginTop: 12 }}>
              <label className="mcd-label">URL de la source (optionnel)</label>
              <input
                type="url"
                className="mcd-input"
                placeholder="https://www.seloger.com/…"
                value={form.urlSource}
                onChange={(e) => set({ urlSource: e.target.value })}
              />
            </div>
          </section>
        </div>

        {/* Footer fixe */}
        <footer className="mcd-footer">
          <div className="mcd-footer-left">
            {form.surface && form.prix
              ? `${Number(form.surface)} m² · ${Number(form.prix).toLocaleString('fr-FR')} €${prixM2 ? ` · ${prixM2.toLocaleString('fr-FR')} €/m²` : ''}`
              : 'Surface et prix requis'}
          </div>
          <div className="mcd-footer-actions">
            <button type="button" className="mcd-btn secondary" onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              className="mcd-btn primary"
              onClick={handleSave}
              disabled={!form.surface || !form.prix || !form.adresse}
            >
              Ajouter le comparable
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
