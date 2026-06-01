import { useState, useEffect } from 'react';

/**
 * AcquereurEditDrawer
 * -------------------
 * Drawer de création / édition d'un acquéreur (Step 4).
 *
 * Props :
 *   - acquereur     : objet existant à éditer (null si création)
 *   - onClose()     : ferme le drawer sans rien valider
 *   - onSave(data)  : valide la fiche acquéreur (création ou maj)
 *
 * Le drawer maintient en interne un état `form` qui suit les inputs.
 * Tant que l'utilisateur n'a pas cliqué "Enregistrer", on ne touche pas
 * à l'état parent.
 */

const PERSONA_OPTIONS = [
  { value: 'familles',      label: 'Familles' },
  { value: 'investisseurs', label: 'Investisseurs' },
  { value: 'primo',         label: 'Primo-accédants' },
  { value: 'retraites',     label: 'Retraités' },
  { value: 'mono',          label: 'Mono-parentaux' },
  { value: 'autre',         label: 'Autre' },
];

const STATUT_OPTIONS = [
  { value: 'chaud',  label: 'Chaud — recherche active' },
  { value: 'actif',  label: 'Actif — visite régulière' },
  { value: 'passif', label: 'Passif — veille' },
];

const TYPE_OPTIONS = [
  { value: 'appartement',  label: 'Appartement' },
  { value: 'maison',       label: 'Maison' },
  { value: 'indifferent',  label: 'Indifférent' },
];

const ASCENSEUR_OPTIONS = [
  { value: 'obligatoire',  label: 'Obligatoire' },
  { value: 'souhaite',     label: 'Souhaité' },
  { value: 'indifferent',  label: 'Indifférent' },
];

const PARKING_OPTIONS = [
  { value: 'obligatoire',  label: 'Obligatoire' },
  { value: 'souhaite',     label: 'Souhaité' },
  { value: 'non',          label: 'Pas nécessaire' },
];

const EXTERIEUR_OPTIONS = [
  { value: 'obligatoire',  label: 'Obligatoire' },
  { value: 'souhaite',     label: 'Souhaité' },
  { value: 'non',          label: 'Pas nécessaire' },
];

const ETAT_OPTIONS = [
  { value: 'a-renover',     label: 'OK avec travaux' },
  { value: 'bon',           label: 'Bon état requis' },
  { value: 'neuf',          label: 'Neuf uniquement' },
  { value: 'indifferent',   label: 'Indifférent' },
];

const DPE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const drawerCss = `
  .acqedit-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.42); z-index: 9999;
    display: flex; justify-content: flex-end; animation: acqedit-fade-in 0.18s ease;
  }
  @keyframes acqedit-fade-in { from { background: rgba(0,0,0,0); } to { background: rgba(0,0,0,0.42); } }
  .acqedit-panel {
    width: 520px; max-width: 95vw; height: 100vh; background: #fff;
    overflow-y: auto; animation: acqedit-slide-in 0.25s ease;
    box-shadow: -4px 0 20px rgba(0,0,0,0.12);
    font-family: var(--font);
    display: flex; flex-direction: column;
  }
  @keyframes acqedit-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .acqedit-header {
    position: sticky; top: 0; background: #fff; z-index: 5;
    padding: 18px 22px 14px; border-bottom: 1px solid #eee;
    display: flex; align-items: flex-start; gap: 12px;
  }
  .acqedit-header-text { flex: 1; min-width: 0; }
  .acqedit-title { font-size: 16px; font-weight: 600; margin: 0 0 4px; color: #1a1a1a; }
  .acqedit-subtitle { font-size: 12px; color: #666; }
  .acqedit-close {
    background: #f5f5f5; border: none; width: 32px; height: 32px; border-radius: 8px;
    font-size: 18px; cursor: pointer; color: #555; flex-shrink: 0;
  }
  .acqedit-close:hover { background: #ececec; color: #111; }
  .acqedit-body { flex: 1; padding: 16px 22px 22px; }
  .acqedit-section { margin-bottom: 18px; }
  .acqedit-section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #888; margin-bottom: 10px;
  }
  .acqedit-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;
  }
  .acqedit-row.full { grid-template-columns: 1fr; }
  .acqedit-field { display: flex; flex-direction: column; gap: 4px; }
  .acqedit-label { font-size: 12px; color: #444; font-weight: 600; }
  .acqedit-input, .acqedit-select, .acqedit-textarea {
    border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px;
    font-size: 13px; font-family: inherit; background: #fff;
    transition: border-color 0.15s ease;
  }
  .acqedit-input:focus, .acqedit-select:focus, .acqedit-textarea:focus {
    outline: none; border-color: var(--green);
  }
  .acqedit-textarea { resize: vertical; min-height: 64px; }
  .acqedit-input.invalid { border-color: var(--red); }
  .acqedit-error { font-size: 11px; color: var(--red); margin-top: 2px; }
  .acqedit-footer {
    position: sticky; bottom: 0; background: #fff; padding: 14px 22px;
    border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: flex-end;
  }
  .acqedit-btn {
    padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: 1px solid transparent; font-family: inherit;
  }
  .acqedit-btn-ghost { background: #f5f5f5; color: #555; }
  .acqedit-btn-ghost:hover { background: #ececec; color: #111; }
  .acqedit-btn-primary { background: var(--green); color: #fff; border-color: var(--green); }
  .acqedit-btn-primary:hover { background: var(--green-dark); }
  .acqedit-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const EMPTY_FORM = {
  nom: '',
  persona: 'familles',
  statut: 'actif',
  budgetMin: '',
  budgetMax: '',
  type: 'appartement',
  surfaceMin: '',
  piecesMin: '',
  chambresMin: '',
  etageMax: '',
  ascenseur: 'indifferent',
  dpeMin: 'D',
  parking: 'souhaite',
  exterieur: 'souhaite',
  etat: 'bon',
  delaiMois: '',
  notes: '',
};

function toForm(acquereur) {
  if (!acquereur) return { ...EMPTY_FORM };
  return {
    nom: acquereur.nom || '',
    persona: acquereur.persona || 'familles',
    statut: acquereur.statut || 'actif',
    budgetMin: acquereur.budgetMin == null ? '' : String(acquereur.budgetMin),
    budgetMax: acquereur.budgetMax == null ? '' : String(acquereur.budgetMax),
    type: acquereur.type || 'appartement',
    surfaceMin: acquereur.surfaceMin == null ? '' : String(acquereur.surfaceMin),
    piecesMin: acquereur.piecesMin == null ? '' : String(acquereur.piecesMin),
    chambresMin: acquereur.chambresMin == null ? '' : String(acquereur.chambresMin),
    etageMax: acquereur.etageMax == null ? '' : String(acquereur.etageMax),
    ascenseur: acquereur.ascenseur || 'indifferent',
    dpeMin: acquereur.dpeMin || 'D',
    parking: acquereur.parking || 'souhaite',
    exterieur: acquereur.exterieur || 'souhaite',
    etat: acquereur.etat || 'bon',
    delaiMois: acquereur.delaiMois == null ? '' : String(acquereur.delaiMois),
    notes: acquereur.notes || '',
  };
}

function toPayload(form) {
  const num = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    nom: form.nom.trim(),
    persona: form.persona,
    statut: form.statut,
    budgetMin: num(form.budgetMin),
    budgetMax: num(form.budgetMax),
    type: form.type,
    surfaceMin: num(form.surfaceMin),
    piecesMin: num(form.piecesMin),
    chambresMin: num(form.chambresMin),
    etageMax: num(form.etageMax),
    ascenseur: form.ascenseur,
    dpeMin: form.dpeMin,
    parking: form.parking,
    exterieur: form.exterieur,
    etat: form.etat,
    delaiMois: num(form.delaiMois),
    notes: form.notes.trim(),
  };
}

function validate(form) {
  const errors = {};
  if (!form.nom.trim()) errors.nom = 'Nom obligatoire';
  const bMin = Number(form.budgetMin);
  const bMax = Number(form.budgetMax);
  if (form.budgetMax !== '' && Number.isFinite(bMax) && bMax <= 0) {
    errors.budgetMax = 'Budget max > 0';
  }
  if (form.budgetMin !== '' && form.budgetMax !== '' && Number.isFinite(bMin) && Number.isFinite(bMax) && bMin > bMax) {
    errors.budgetMax = 'Doit être ≥ budget min';
  }
  return errors;
}

export default function AcquereurEditDrawer({ acquereur, onClose, onSave }) {
  // Note : le drawer est monté/démonté à chaque ouverture côté parent,
  // donc l'initial state via useState suffit (pas de besoin de resync via useEffect).
  const [form, setForm] = useState(() => toForm(acquereur));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (typeof onSave === 'function') {
      onSave(toPayload(form));
    }
  };

  const isEdit = !!(acquereur && acquereur.id);

  return (
    <div
      className="acqedit-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Modifier un acqu\u00e9reur' : 'Ajouter un acqu\u00e9reur'}
    >
      <style>{drawerCss}</style>
      <div className="acqedit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="acqedit-header">
          <div className="acqedit-header-text">
            <h2 className="acqedit-title">
              {isEdit ? 'Modifier un acqu\u00e9reur' : 'Nouvel acqu\u00e9reur'}
            </h2>
            <div className="acqedit-subtitle">
              Saisie manuelle &mdash; donn&eacute;es non persist&eacute;es (session uniquement)
            </div>
          </div>
          <button type="button" className="acqedit-close" onClick={onClose} aria-label="Fermer">
            &times;
          </button>
        </div>

        <div className="acqedit-body">
          <div className="acqedit-section">
            <div className="acqedit-section-title">Identit&eacute;</div>
            <div className="acqedit-row full">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-nom">Nom / r&eacute;f&eacute;rence anonymis&eacute;e *</label>
                <input
                  id="acq-nom"
                  className={`acqedit-input ${errors.nom ? 'invalid' : ''}`}
                  value={form.nom}
                  onChange={update('nom')}
                  placeholder="Ex&nbsp;: Famille #F047"
                />
                {errors.nom && <div className="acqedit-error">{errors.nom}</div>}
              </div>
            </div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-persona">Persona</label>
                <select id="acq-persona" className="acqedit-select" value={form.persona} onChange={update('persona')}>
                  {PERSONA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-statut">Statut</label>
                <select id="acq-statut" className="acqedit-select" value={form.statut} onChange={update('statut')}>
                  {STATUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="acqedit-section">
            <div className="acqedit-section-title">Budget (en k&euro;)</div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-bmin">Budget min</label>
                <input
                  id="acq-bmin" type="number" className="acqedit-input"
                  value={form.budgetMin} onChange={update('budgetMin')} placeholder="280"
                />
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-bmax">Budget max</label>
                <input
                  id="acq-bmax" type="number"
                  className={`acqedit-input ${errors.budgetMax ? 'invalid' : ''}`}
                  value={form.budgetMax} onChange={update('budgetMax')} placeholder="320"
                />
                {errors.budgetMax && <div className="acqedit-error">{errors.budgetMax}</div>}
              </div>
            </div>
          </div>

          <div className="acqedit-section">
            <div className="acqedit-section-title">Crit&egrave;res durs</div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-type">Type recherch&eacute;</label>
                <select id="acq-type" className="acqedit-select" value={form.type} onChange={update('type')}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-surface">Surface min (m&sup2;)</label>
                <input
                  id="acq-surface" type="number" className="acqedit-input"
                  value={form.surfaceMin} onChange={update('surfaceMin')} placeholder="65"
                />
              </div>
            </div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-pieces">Pi&egrave;ces min</label>
                <input
                  id="acq-pieces" type="number" className="acqedit-input"
                  value={form.piecesMin} onChange={update('piecesMin')} placeholder="3"
                />
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-chambres">Chambres min</label>
                <input
                  id="acq-chambres" type="number" className="acqedit-input"
                  value={form.chambresMin} onChange={update('chambresMin')} placeholder="2"
                />
              </div>
            </div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-etage">&Eacute;tage max</label>
                <input
                  id="acq-etage" type="number" className="acqedit-input"
                  value={form.etageMax} onChange={update('etageMax')} placeholder="5"
                />
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-ascenseur">Ascenseur</label>
                <select id="acq-ascenseur" className="acqedit-select" value={form.ascenseur} onChange={update('ascenseur')}>
                  {ASCENSEUR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-dpe">DPE min</label>
                <select id="acq-dpe" className="acqedit-select" value={form.dpeMin} onChange={update('dpeMin')}>
                  {DPE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-etat">&Eacute;tat accept&eacute;</label>
                <select id="acq-etat" className="acqedit-select" value={form.etat} onChange={update('etat')}>
                  {ETAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="acqedit-section">
            <div className="acqedit-section-title">Crit&egrave;res souhait&eacute;s</div>
            <div className="acqedit-row">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-parking">Parking</label>
                <select id="acq-parking" className="acqedit-select" value={form.parking} onChange={update('parking')}>
                  {PARKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-exterieur">Ext&eacute;rieur</label>
                <select id="acq-exterieur" className="acqedit-select" value={form.exterieur} onChange={update('exterieur')}>
                  {EXTERIEUR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="acqedit-row full">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-delai">D&eacute;lai du projet (mois)</label>
                <input
                  id="acq-delai" type="number" className="acqedit-input"
                  value={form.delaiMois} onChange={update('delaiMois')} placeholder="3"
                />
              </div>
            </div>
            <div className="acqedit-row full">
              <div className="acqedit-field">
                <label className="acqedit-label" htmlFor="acq-notes">Notes libres</label>
                <textarea
                  id="acq-notes" className="acqedit-textarea"
                  value={form.notes} onChange={update('notes')}
                  placeholder="Quartier pr&eacute;f&eacute;r&eacute;, contraintes, contexte familial&hellip;"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="acqedit-footer">
          <button type="button" className="acqedit-btn acqedit-btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="acqedit-btn acqedit-btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Enregistrer les modifications' : 'Ajouter cet acqu\u00e9reur'}
          </button>
        </div>
      </div>
    </div>
  );
}
