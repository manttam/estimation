import { useState, useEffect, useMemo } from 'react';

/**
 * ComparableEditDrawer
 * --------------------
 * Drawer de réglage manuel de la similarité d'un comparable.
 *
 * Props :
 *   - comp            : objet comparable (titre, source, sourceLabel, addr…)
 *   - autoSimilarity  : nombre 0-100, valeur calculée par défaut (similarite auto)
 *   - overrideValue   : nombre 0-100 ou null/undefined si pas d'override actif
 *   - onClose()       : ferme le drawer sans rien valider
 *   - onCommit(val)   : valide la valeur du slider (val = nombre 0-100)
 *   - onReset()       : supprime l'override → retour à la similarité auto
 *
 * Le drawer maintient en interne un `tempVal` qui suit le slider en live.
 * Tant que l'utilisateur n'a pas cliqué "Valider", on ne touche pas au
 * state parent.
 */

const editCss = `
  .compedit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
    animation: compedit-fade-in 0.18s ease;
  }
  @keyframes compedit-fade-in {
    from { background: rgba(0, 0, 0, 0); }
    to { background: rgba(0, 0, 0, 0.42); }
  }
  .compedit-panel {
    width: 460px;
    max-width: 95vw;
    height: 100vh;
    background: #fff;
    overflow-y: auto;
    animation: compedit-slide-in 0.25s ease;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    font-family: var(--font);
    display: flex;
    flex-direction: column;
  }
  @keyframes compedit-slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .compedit-header {
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
  .compedit-header-text { flex: 1; min-width: 0; }
  .compedit-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px;
    color: #1a1a1a;
    line-height: 1.35;
  }
  .compedit-subtitle {
    font-size: 12px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .compedit-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: #f3f4f6;
    color: #374151;
  }
  .compedit-source-badge.dvf      { background: #ede9fe; color: #6d28d9; }
  .compedit-source-badge.ideeri   { background: var(--green-soft); color: var(--green); }
  .compedit-source-badge.encours  { background: #fef3c7; color: #b45309; }
  .compedit-source-badge.portail  { background: #dbeafe; color: #1d4ed8; }
  .compedit-close {
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
  .compedit-close:hover { background: #ececec; color: #1a1a1a; }
  .compedit-body {
    padding: 20px 22px 24px;
    flex: 1;
  }
  .compedit-section { margin-bottom: 22px; }
  .compedit-section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin: 0 0 10px;
  }
  .compedit-auto {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .compedit-auto-label {
    font-size: 12px;
    color: #555;
    line-height: 1.4;
  }
  .compedit-auto-value {
    font-weight: 700;
    font-size: 18px;
    color: #1a1a1a;
    font-variant-numeric: tabular-nums;
  }
  .compedit-slider-block {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px;
  }
  .compedit-slider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .compedit-slider-label {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
  }
  .compedit-slider-value {
    font-weight: 700;
    font-size: 22px;
    color: var(--green);
    font-variant-numeric: tabular-nums;
    min-width: 56px;
    text-align: right;
  }
  .compedit-slider-value.is-low  { color: #dc2626; }
  .compedit-slider-value.is-mid  { color: #d97706; }
  .compedit-slider-value.is-high { color: var(--green); }
  .compedit-slider {
    width: 100%;
    accent-color: var(--green);
    cursor: pointer;
    height: 4px;
  }
  .compedit-slider-ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 10px;
    color: #999;
  }
  .compedit-delta {
    margin-top: 10px;
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }
  .compedit-delta strong { color: #1a1a1a; }
  .compedit-delta .delta-pos { color: var(--green); }
  .compedit-delta .delta-neg { color: #dc2626; }
  .compedit-reset {
    margin-top: 14px;
    width: 100%;
    background: #fff;
    border: 1px dashed #cbd5e1;
    color: #475569;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .compedit-reset:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #1e293b;
  }
  .compedit-reset:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .compedit-hint {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
    background: #f9fafb;
    border-left: 3px solid #d1d5db;
    padding: 10px 12px;
    border-radius: 4px;
  }
  .compedit-footer {
    position: sticky;
    bottom: 0;
    background: #fff;
    border-top: 1px solid #eee;
    padding: 14px 22px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .compedit-btn {
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
    font-family: inherit;
  }
  .compedit-btn-ghost {
    background: #fff;
    border-color: #e5e7eb;
    color: #475569;
  }
  .compedit-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
  .compedit-btn-primary {
    background: var(--green);
    color: #fff;
  }
  .compedit-btn-primary:hover { background: var(--green-dark); }
  .compedit-btn-primary:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }
`;

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function classForValue(v) {
  if (v >= 80) return 'is-high';
  if (v >= 60) return 'is-mid';
  return 'is-low';
}

function sourceClass(source) {
  if (source === 'dvf') return 'dvf';
  if (source === 'ideeri') return 'ideeri';
  if (source === 'encours') return 'encours';
  return 'portail';
}

export default function ComparableEditDrawer({
  comp,
  autoSimilarity,
  overrideValue,
  onClose,
  onCommit,
  onReset,
  onViewDetail,
}) {
  const auto = clamp(Number(autoSimilarity) || 0, 0, 100);
  const initial = overrideValue !== undefined && overrideValue !== null
    ? clamp(Number(overrideValue), 0, 100)
    : auto;

  const [tempVal, setTempVal] = useState(initial);

  // Si on rouvre le drawer pour un autre comp, on resynchronise.
  useEffect(() => {
    setTempVal(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp?.id, autoSimilarity, overrideValue]);

  // Fermeture par ESC
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const delta = useMemo(() => Math.round(tempVal - auto), [tempVal, auto]);
  const valClass = classForValue(tempVal);
  const hasOverride = overrideValue !== undefined && overrideValue !== null;
  const hasPendingChange = tempVal !== (hasOverride ? overrideValue : auto);

  if (!comp) return null;

  const handleCommit = () => {
    if (typeof onCommit === 'function') onCommit(clamp(Math.round(tempVal), 0, 100));
  };

  const handleReset = () => {
    setTempVal(auto);
    if (typeof onReset === 'function') onReset();
  };

  return (
    <div
      className="compedit-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="R\u00e9glage de la similarit\u00e9"
    >
      <style>{editCss}</style>
      <div className="compedit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="compedit-header">
          <div className="compedit-header-text">
            <h2 className="compedit-title">{comp.title || 'Comparable'}</h2>
            <div className="compedit-subtitle">
              <span className={`compedit-source-badge ${sourceClass(comp.source)}`}>
                {comp.sourceLabel || comp.source || ''}
              </span>
              {comp.addr && <span style={{ color: '#888' }}>{comp.addr}</span>}
            </div>
          </div>
          <button
            type="button"
            className="compedit-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        <div className="compedit-body">
          <div className="compedit-section">
            <div className="compedit-section-title">Similarit&eacute; calcul&eacute;e</div>
            <div className="compedit-auto">
              <div className="compedit-auto-label">
                Score auto bas&eacute; sur la typologie, la surface et la distance
              </div>
              <div className="compedit-auto-value">{auto}%</div>
            </div>
          </div>

          <div className="compedit-section">
            <div className="compedit-section-title">Override manuel</div>
            <div className="compedit-slider-block">
              <div className="compedit-slider-row">
                <span className="compedit-slider-label">Similarit&eacute; retenue</span>
                <span className={`compedit-slider-value ${valClass}`}>{tempVal}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={tempVal}
                onChange={(e) => setTempVal(Number(e.target.value))}
                className="compedit-slider"
                aria-label="R\u00e9glage de la similarit\u00e9 0 \u00e0 100"
              />
              <div className="compedit-slider-ticks">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
              <div className="compedit-delta">
                {delta === 0 ? (
                  <>Identique au score auto.</>
                ) : delta > 0 ? (
                  <>
                    Override <strong className="delta-pos">+{delta} pts</strong> par rapport au score auto.
                  </>
                ) : (
                  <>
                    Override <strong className="delta-neg">{delta} pts</strong> par rapport au score auto.
                  </>
                )}
              </div>
              <button
                type="button"
                className="compedit-reset"
                onClick={handleReset}
                disabled={!hasOverride && tempVal === auto}
              >
                &#8634; Restaurer le score auto ({auto}%)
              </button>
            </div>
          </div>

          <div className="compedit-section">
            <div className="compedit-hint">
              La similarit&eacute; est utilis&eacute;e dans le calcul de pertinence
              (60% similarit&eacute; + 40% donn&eacute;es). Une valeur manuelle
              persiste tant que le comparable reste dans la liste.
            </div>
          </div>
        </div>

        <div className="compedit-footer">
          {typeof onViewDetail === 'function' && (
            <button
              type="button"
              className="compedit-btn compedit-btn-ghost"
              onClick={() => onViewDetail(comp)}
              style={{ marginRight: 'auto' }}
            >
              Voir le d&eacute;tail
            </button>
          )}
          <button type="button" className="compedit-btn compedit-btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="compedit-btn compedit-btn-primary"
            onClick={handleCommit}
            disabled={!hasPendingChange}
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
