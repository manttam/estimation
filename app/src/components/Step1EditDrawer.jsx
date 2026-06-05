import { useEffect } from 'react';
import PhotoUploader from './PhotoUploader';

/**
 * Step1EditDrawer : drawer latéral slide-in d'édition (pattern Step2/3).
 *
 * Générique : édite soit une SECTION d'informations générales, soit une PIÈCE.
 * Le contenu est piloté par un `schema` (tableau de champs) + un objet `values`.
 *
 * Props :
 *   open      (bool)            : drawer ouvert ?
 *   title     (string)         : titre affiché en tête du drawer
 *   subtitle  (string?)        : sous-titre optionnel
 *   schema    (array)          : champs [{ key, label, type, options?, unit?, group?, placeholder? }]
 *   values    (object)         : valeurs courantes { [fieldKey]: value }
 *   onField   (fn(key, value)) : appelé à chaque saisie d'un champ
 *   onClose   (fn)             : fermeture du drawer
 *   // --- spécifiques pièce (optionnels) ---
 *   roomNameValue (string?)    : nom de la pièce (champ éditable en tête)
 *   onRoomName    (fn(value)?) : setter du nom de pièce
 *   roomTypeValue (string?)    : type de pièce (select)
 *   onRoomType    (fn(value)?) : setter du type de pièce
 *   roomTypeOptions (array?)   : [{ value, label }] pour le select de type
 *   photoRoomId   (string?)    : si fourni, affiche une galerie photo scoping cette pièce
 *   photoRoomType (string?)    : type photo appliqué aux uploads de la pièce
 *   onPhotosChange (fn?)       : callback après ajout/suppression de photos pièce
 */

const drawerStyles = `
  .s1-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 1200;
    opacity: 0;
    animation: s1d-fade 0.18s ease-out forwards;
  }
  @keyframes s1d-fade { to { opacity: 1; } }

  .s1-drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 460px;
    max-width: 92vw;
    background: #fff;
    z-index: 1201;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 32px rgba(0,0,0,0.18);
    transform: translateX(100%);
    animation: s1d-slide 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes s1d-slide { to { transform: translateX(0); } }

  .s1-drawer-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px;
    border-bottom: 1px solid var(--border, #eee);
    flex-shrink: 0;
  }
  .s1-drawer-title {
    font-size: var(--fs-lg, 16px);
    font-weight: 700;
    color: var(--text, #222);
    margin: 0;
  }
  .s1-drawer-sub {
    font-size: var(--fs-sm, 12px);
    color: #888;
    margin-top: 2px;
  }
  .s1-drawer-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border, #eee);
    background: #fff;
    color: #666;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .s1-drawer-close:hover { background: #f5f5f5; color: #222; }

  .s1-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .s1-drawer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 16px;
  }
  .s1-drawer-group-title {
    grid-column: 1 / -1;
    font-size: var(--fs-sm, 12px);
    font-weight: 700;
    color: var(--green-dark, #3da856);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-top: 8px;
  }
  .s1-drawer-group-title:first-child { margin-top: 0; }

  .s1-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .s1-field.full { grid-column: 1 / -1; }
  .s1-field-label {
    font-size: var(--fs-sm, 12px);
    font-weight: 500;
    color: #444;
  }
  .s1-field-unit { color: #aaa; font-weight: 400; }

  .s1-input,
  .s1-select,
  .s1-textarea {
    padding: 9px 11px;
    border: 1px solid var(--border, #e6e6e6);
    border-radius: 8px;
    font-size: var(--fs-base, 13px);
    color: #333;
    outline: none;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    transition: all 0.15s;
  }
  .s1-textarea { resize: vertical; min-height: 72px; }
  .s1-input:focus,
  .s1-select:focus,
  .s1-textarea:focus {
    border-color: var(--green, #46B962);
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.12);
  }
  .s1-select { appearance: auto; }

  .s1-toggle-row { display: flex; align-items: center; gap: 10px; }
  .s1-toggle {
    width: 44px; height: 24px;
    background: #ccc;
    border-radius: 12px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    border: none; padding: 0;
    flex-shrink: 0;
  }
  .s1-toggle.on { background: var(--green, #46B962); }
  .s1-toggle::after {
    content: '';
    position: absolute;
    width: 20px; height: 20px;
    background: #fff;
    border-radius: 50%;
    top: 2px; left: 2px;
    transition: left 0.2s;
  }
  .s1-toggle.on::after { left: 22px; }
  .s1-toggle-text { font-size: var(--fs-base, 13px); color: #444; }

  .s1-drawer-photos {
    grid-column: 1 / -1;
    margin-top: 8px;
    border-top: 1px solid #f0f0f0;
    padding-top: 4px;
  }
  .s1-drawer-photos-title {
    font-size: var(--fs-sm, 12px);
    font-weight: 700;
    color: var(--text, #222);
    margin-bottom: 4px;
  }

  .s1-drawer-foot {
    flex-shrink: 0;
    padding: 14px 20px;
    border-top: 1px solid var(--border, #eee);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .s1-drawer-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: var(--fs-base, 13px);
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: all 0.15s;
  }
  .s1-drawer-btn.primary { background: var(--green, #46B962); color: #fff; }
  .s1-drawer-btn.primary:hover { background: var(--green-dark, #3da856); }
`;

function FieldControl({ field, value, onChange }) {
  const { type, options, placeholder } = field;
  if (type === 'toggle') {
    const on = !!value;
    return (
      <div className="s1-toggle-row">
        <button
          type="button"
          className={`s1-toggle${on ? ' on' : ''}`}
          onClick={() => onChange(!on)}
          aria-pressed={on}
        />
        <span className="s1-toggle-text">{on ? 'Oui' : 'Non'}</span>
      </div>
    );
  }
  if (type === 'select') {
    return (
      <select
        className="s1-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder || '-- Choisir --'}</option>
        {(options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (type === 'textarea') {
    return (
      <textarea
        className="s1-textarea"
        value={value ?? ''}
        placeholder={placeholder || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className="s1-input"
      type={type === 'number' ? 'number' : (type === 'date' ? 'date' : 'text')}
      value={value ?? ''}
      placeholder={placeholder || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function Step1EditDrawer({
  open,
  title,
  subtitle,
  schema = [],
  values = {},
  onField,
  onClose,
  roomNameValue,
  onRoomName,
  roomTypeValue,
  onRoomType,
  roomTypeOptions,
  photoRoomId,
  photoRoomType,
  onPhotosChange,
}) {
  // ESC ferme + blocage scroll de fond
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const isRoom = typeof onRoomName === 'function';

  return (
    <>
      <style>{drawerStyles}</style>
      <div className="s1-drawer-overlay" onClick={onClose} />
      <div className="s1-drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="s1-drawer-head">
          <div>
            <h3 className="s1-drawer-title">{title}</h3>
            {subtitle && <div className="s1-drawer-sub">{subtitle}</div>}
          </div>
          <button type="button" className="s1-drawer-close" onClick={onClose} aria-label="Fermer">
            &times;
          </button>
        </div>

        <div className="s1-drawer-body">
          <div className="s1-drawer-grid">
            {/* En-tête pièce : nom + type éditables */}
            {isRoom && (
              <>
                <div className="s1-field">
                  <label className="s1-field-label">Nom de la pièce</label>
                  <input
                    className="s1-input"
                    type="text"
                    value={roomNameValue ?? ''}
                    onChange={(e) => onRoomName(e.target.value)}
                  />
                </div>
                <div className="s1-field">
                  <label className="s1-field-label">Type de pièce</label>
                  <select
                    className="s1-select"
                    value={roomTypeValue ?? ''}
                    onChange={(e) => onRoomType?.(e.target.value)}
                  >
                    {(roomTypeOptions || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Champs du schéma (avec titres de groupe optionnels) */}
            {schema.map((field, i) => {
              const prevGroup = i > 0 ? schema[i - 1].group : undefined;
              const showGroup = field.group && field.group !== prevGroup;
              const full = field.type === 'textarea';
              return (
                <div key={field.key} style={{ display: 'contents' }}>
                  {showGroup && (
                    <div className="s1-drawer-group-title">{field.group}</div>
                  )}
                  <div className={`s1-field${full ? ' full' : ''}`}>
                    <label className="s1-field-label">
                      {field.label}
                      {field.unit && <span className="s1-field-unit"> ({field.unit})</span>}
                    </label>
                    <FieldControl
                      field={field}
                      value={values[field.key]}
                      onChange={(v) => onField?.(field.key, v)}
                    />
                  </div>
                </div>
              );
            })}

            {/* Galerie photo de la pièce (mode pièce uniquement) */}
            {photoRoomId && (
              <div className="s1-drawer-photos">
                <div className="s1-drawer-photos-title">Photos de la pièce</div>
                <PhotoUploader
                  roomId={photoRoomId}
                  roomType={photoRoomType}
                  onChange={onPhotosChange}
                />
              </div>
            )}
          </div>
        </div>

        <div className="s1-drawer-foot">
          <button type="button" className="s1-drawer-btn primary" onClick={onClose}>
            Terminé
          </button>
        </div>
      </div>
    </>
  );
}
