import { useState, useMemo, useRef, useEffect } from 'react';
import { getReportState, setReportState } from '../utils/reportStore';

/* RdvPlanner
 * -----------
 * Planificateur des rendez-vous client présenté en bas du Step 5
 * (après le mandat). Deux vues dans un même bloc :
 *   - « Calendrier » : vue semaine reprenant le design Ideeri
 *     (barre latérale des types de RDV + grille jours/heures + formulaire).
 *   - « Timeline »  : frise sur 3 mois où l'agent place les jalons R1, R2…
 *     par glisser-déposer.
 *
 * Les jalons sont nommés « R1 », « R2 »… par défaut et renommables.
 * L'état est persisté dans reportStore sous la clé racine `rdvPlanner`
 * pour remonter dans le projet client de l'app Ideeri.
 */

const PALETTE = ['#46B962', '#4a6cf7', '#f5a623', '#9b59b6', '#e0556b', '#16b1c4'];

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/* Aligne une date sur le lundi de sa semaine (00:00). */
function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isoDate(d) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

function fromIso(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/* Jalons par défaut : R1 à J+3, R2 à J+30, R3 à J+60 (sur les 3 mois). */
function defaultJalons() {
  const base = new Date();
  base.setHours(10, 0, 0, 0);
  return [
    { id: 'r1', label: 'R1', date: isoDate(addDays(base, 3)), heure: '10:00', duree: 60, color: PALETTE[0] },
    { id: 'r2', label: 'R2', date: isoDate(addDays(base, 30)), heure: '14:00', duree: 60, color: PALETTE[1] },
    { id: 'r3', label: 'R3', date: isoDate(addDays(base, 60)), heure: '11:00', duree: 60, color: PALETTE[2] },
  ];
}

function loadJalons() {
  const st = getReportState();
  const stored = st && st.rdvPlanner && Array.isArray(st.rdvPlanner.jalons)
    ? st.rdvPlanner.jalons
    : null;
  if (stored && stored.length) return stored;
  return defaultJalons();
}

export default function RdvPlanner() {
  const [view, setView] = useState('calendar'); // 'calendar' | 'timeline'
  const [jalons, setJalons] = useState(loadJalons);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedId, setSelectedId] = useState(jalons[0]?.id || null);

  // Persistance reportStore (remonte dans le projet Ideeri).
  useEffect(() => {
    setReportState({ rdvPlanner: { jalons } });
  }, [jalons]);

  const selected = jalons.find((j) => j.id === selectedId) || null;

  /* ---- Helpers mutations ---- */
  const nextLabel = () => {
    let n = 1;
    const used = new Set(jalons.map((j) => j.label));
    while (used.has(`R${n}`)) n += 1;
    return `R${n}`;
  };

  const addJalon = () => {
    const base = new Date();
    base.setHours(10, 0, 0, 0);
    const id = `j${Date.now()}`;
    const color = PALETTE[jalons.length % PALETTE.length];
    const nj = { id, label: nextLabel(), date: isoDate(addDays(base, 7 + jalons.length * 14)), heure: '10:00', duree: 60, color };
    setJalons((prev) => [...prev, nj]);
    setSelectedId(id);
  };

  const updateJalon = (id, patch) => {
    setJalons((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const removeJalon = (id) => {
    setJalons((prev) => prev.filter((j) => j.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  /* ============ VUE CALENDRIER (semaine) ============ */
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = weekDays[6];
  const weekLabel = useMemo(() => {
    const d1 = weekStart.getDate();
    const d2 = weekEnd.getDate();
    const m1 = MONTH_NAMES[weekStart.getMonth()];
    const m2 = MONTH_NAMES[weekEnd.getMonth()];
    const y = weekEnd.getFullYear();
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `Semaine du ${d1} au ${d2} ${m2} ${y}`;
    }
    return `Semaine du ${d1} ${m1} au ${d2} ${m2} ${y}`;
  }, [weekStart, weekEnd]);

  const eventsByDay = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => { map[isoDate(d)] = []; });
    jalons.forEach((j) => {
      if (map[j.date] !== undefined) map[j.date].push(j);
    });
    return map;
  }, [jalons, weekDays]);

  const today = new Date();

  /* ============ VUE TIMELINE (3 mois) ============ */
  const timelineStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const timelineDays = 92; // ~3 mois
  const timelineEnd = useMemo(() => addDays(timelineStart, timelineDays), [timelineStart]);

  const monthsSpan = useMemo(() => {
    const out = [];
    let cur = new Date(timelineStart);
    for (let i = 0; i < 3; i += 1) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const startIdx = Math.max(0, Math.round((cur - timelineStart) / 86400000));
      const endIdx = Math.min(timelineDays, Math.round((next - timelineStart) / 86400000));
      out.push({ label: `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`, startIdx, endIdx });
      cur = next;
    }
    return out;
  }, [timelineStart]);

  const dayToPct = (iso) => {
    const d = fromIso(iso);
    const idx = (d - timelineStart) / 86400000;
    return Math.max(0, Math.min(100, (idx / timelineDays) * 100));
  };

  const trackRef = useRef(null);
  const dragId = useRef(null);

  const onDragStart = (e, id) => {
    dragId.current = id;
    setSelectedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // image fantôme transparente
    try {
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch { /* noop */ }
  };

  const pctToIso = (clientX) => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(pct * timelineDays);
    return isoDate(addDays(timelineStart, idx));
  };

  const onTrackDragOver = (e) => {
    if (!dragId.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onTrackDrop = (e) => {
    if (!dragId.current) return;
    e.preventDefault();
    const iso = pctToIso(e.clientX);
    if (iso) updateJalon(dragId.current, { date: iso });
    dragId.current = null;
  };

  const fmtDateFr = (iso) => {
    const d = fromIso(iso);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  };

  return (
    <div className="rdv-planner">
      <style>{rdvStyles}</style>

      {/* En-tête + onglets */}
      <div className="rdv-top">
        <div className="rdv-title-wrap">
          <h3 className="rdv-title">Calendrier des rendez-vous client</h3>
          <p className="rdv-sub">Programmez les échelons de suivi (R1, R2, R3…) avec votre client.</p>
        </div>
        <div className="rdv-tabs">
          <button
            className={`rdv-tab${view === 'calendar' ? ' active' : ''}`}
            onClick={() => setView('calendar')}
          >
            <span role="img" aria-label="cal">🗓️</span> Calendrier
          </button>
          <button
            className={`rdv-tab${view === 'timeline' ? ' active' : ''}`}
            onClick={() => setView('timeline')}
          >
            <span role="img" aria-label="time">📈</span> Timeline 3 mois
          </button>
        </div>
      </div>

      {/* Note de synchronisation Ideeri */}
      <div className="rdv-sync-note">
        <span className="rdv-sync-icon" role="img" aria-label="sync">🔗</span>
        <span>
          Ce calendrier de rendez-vous sera <strong>automatiquement repris dans le projet du client</strong> dans l&apos;application Ideeri.
        </span>
      </div>

      {view === 'calendar' && (
        <div className="cal-card">
          {/* Barre supérieure : navigation semaine + bascule de vue */}
          <div className="cal-header">
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={() => setWeekStart((d) => addDays(d, -7))}>‹</button>
              <span className="cal-week-label">{weekLabel}</span>
              <button className="cal-nav-btn" onClick={() => setWeekStart((d) => addDays(d, 7))}>›</button>
            </div>
            <div className="cal-view-switch">
              <button className="cal-vs-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>Aujourd&apos;hui</button>
              <button className="cal-vs-btn active">Semaine</button>
              <button className="cal-vs-btn" onClick={() => setView('timeline')}>Mois</button>
            </div>
          </div>

          <div className="cal-body">
            {/* Barre latérale : types de RDV */}
            <aside className="cal-sidebar">
              <div className="cal-side-title">Prospection client</div>
              <div className="cal-side-list">
                {jalons.map((j) => (
                  <button
                    key={j.id}
                    className={`cal-side-item${selectedId === j.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(j.id)}
                  >
                    <span className="cal-side-dot" style={{ background: j.color }} />
                    <span className="cal-side-label">{j.label}</span>
                    <span className="cal-side-date">{fmtDateFr(j.date)}</span>
                  </button>
                ))}
              </div>
              <button className="cal-add-btn" onClick={addJalon}>+ Ajouter un RDV</button>
            </aside>

            {/* Grille jours / heures */}
            <div className="cal-grid-wrap">
              <div className="cal-days-head">
                <div className="cal-hour-col-head" />
                {weekDays.map((d) => (
                  <div key={isoDate(d)} className={`cal-day-head${sameDay(d, today) ? ' today' : ''}`}>
                    <div className="cal-day-name">{DAY_NAMES[(d.getDay() + 6) % 7]}</div>
                    <div className="cal-day-num">{d.getDate()}</div>
                  </div>
                ))}
              </div>
              <div className="cal-grid-scroll">
                <div className="cal-grid">
                  <div className="cal-hour-col">
                    {HOURS.map((h) => (
                      <div key={h} className="cal-hour-cell">{String(h).padStart(2, '0')}:00</div>
                    ))}
                  </div>
                  {weekDays.map((d) => (
                    <div key={isoDate(d)} className="cal-day-col">
                      {HOURS.map((h) => (
                        <div key={h} className="cal-slot" />
                      ))}
                      {(eventsByDay[isoDate(d)] || []).map((ev) => {
                        const [hh, mm] = ev.heure.split(':').map(Number);
                        const top = (hh - HOURS[0]) * 44 + (mm / 60) * 44;
                        const height = Math.max(22, (ev.duree / 60) * 44);
                        return (
                          <button
                            key={ev.id}
                            className={`cal-event${selectedId === ev.id ? ' active' : ''}`}
                            style={{ top: `${top}px`, height: `${height}px`, background: ev.color }}
                            onClick={() => setSelectedId(ev.id)}
                          >
                            <span className="cal-event-label">{ev.label}</span>
                            <span className="cal-event-time">{ev.heure}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Formulaire d'édition du RDV sélectionné */}
          {selected && (
            <div className="cal-form">
              <div className="cal-form-field grow">
                <label>Type de rendez-vous</label>
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => updateJalon(selected.id, { label: e.target.value })}
                  placeholder="R1, R2…"
                />
              </div>
              <div className="cal-form-field">
                <label>Date</label>
                <input
                  type="date"
                  value={selected.date}
                  onChange={(e) => updateJalon(selected.id, { date: e.target.value })}
                />
              </div>
              <div className="cal-form-field">
                <label>Heure</label>
                <input
                  type="time"
                  value={selected.heure}
                  onChange={(e) => updateJalon(selected.id, { heure: e.target.value })}
                />
              </div>
              <div className="cal-form-field narrow">
                <label>Durée</label>
                <select
                  value={selected.duree}
                  onChange={(e) => updateJalon(selected.id, { duree: Number(e.target.value) })}
                >
                  <option value={30}>30 min</option>
                  <option value={60}>1 h</option>
                  <option value={90}>1 h 30</option>
                  <option value={120}>2 h</option>
                </select>
              </div>
              <div className="cal-form-field narrow">
                <label>Couleur</label>
                <div className="cal-colors">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`cal-color${selected.color === c ? ' active' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateJalon(selected.id, { color: c })}
                      aria-label={`couleur ${c}`}
                    />
                  ))}
                </div>
              </div>
              <button className="cal-del-btn" onClick={() => removeJalon(selected.id)}>Supprimer</button>
            </div>
          )}
        </div>
      )}

      {view === 'timeline' && (
        <div className="tl-card">
          <div className="tl-toolbar">
            <span className="tl-hint">
              Glissez-déposez les jalons pour les positionner sur les 3 mois. Cliquez sur le nom pour le renommer.
            </span>
            <button className="cal-add-btn" onClick={addJalon}>+ Ajouter un RDV</button>
          </div>

          {/* En-tête des mois */}
          <div className="tl-months">
            {monthsSpan.map((m) => (
              <div
                key={m.label}
                className="tl-month"
                style={{ width: `${((m.endIdx - m.startIdx) / timelineDays) * 100}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Piste de drop */}
          <div
            ref={trackRef}
            className="tl-track"
            onDragOver={onTrackDragOver}
            onDrop={onTrackDrop}
          >
            {/* Séparateurs de mois */}
            {monthsSpan.slice(1).map((m) => (
              <div key={`sep-${m.label}`} className="tl-sep" style={{ left: `${(m.startIdx / timelineDays) * 100}%` }} />
            ))}
            {/* Marqueur d'aujourd'hui */}
            <div className="tl-today" style={{ left: `${dayToPct(isoDate(today))}%` }}>
              <span className="tl-today-label">Aujourd&apos;hui</span>
            </div>
            {/* Jalons */}
            {jalons.map((j) => (
              <div
                key={j.id}
                className={`tl-milestone${selectedId === j.id ? ' active' : ''}`}
                style={{ left: `${dayToPct(j.date)}%`, borderColor: j.color }}
                draggable
                onDragStart={(e) => onDragStart(e, j.id)}
                onClick={() => setSelectedId(j.id)}
                title="Glisser pour déplacer"
              >
                <span className="tl-dot" style={{ background: j.color }} />
                <input
                  className="tl-milestone-label"
                  value={j.label}
                  onChange={(e) => updateJalon(j.id, { label: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  draggable={false}
                  size={Math.max(2, j.label.length)}
                />
                <span className="tl-milestone-date">{fmtDateFr(j.date)}</span>
              </div>
            ))}
          </div>

          {/* Légende / liste des jalons sous la frise */}
          <div className="tl-legend">
            {jalons.map((j) => (
              <div key={j.id} className={`tl-legend-item${selectedId === j.id ? ' active' : ''}`} onClick={() => setSelectedId(j.id)}>
                <span className="cal-side-dot" style={{ background: j.color }} />
                <span className="tl-legend-name">{j.label}</span>
                <span className="tl-legend-date">{fmtDateFr(j.date)}</span>
                <button className="tl-legend-del" onClick={(e) => { e.stopPropagation(); removeJalon(j.id); }} aria-label="supprimer">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const rdvStyles = `
  .rdv-planner {
    margin: 24px auto 0;
    max-width: 1180px;
    padding: 0 24px;
    font-family: var(--font);
    color: var(--text);
  }
  .rdv-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .rdv-title { font-size: 18px; font-weight: 700; margin: 0; color: var(--text); }
  .rdv-sub { font-size: 12px; color: #888; margin: 4px 0 0; }
  .rdv-tabs { display: flex; gap: 4px; background: #f0f0f0; padding: 4px; border-radius: 10px; }
  .rdv-tab {
    border: none; background: transparent; cursor: pointer;
    font-family: var(--font); font-size: 13px; font-weight: 600; color: #888;
    padding: 7px 16px; border-radius: 7px; display: flex; align-items: center; gap: 6px;
  }
  .rdv-tab.active { background: #fff; color: var(--green-dark, #3da856); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

  .rdv-sync-note {
    display: flex; align-items: center; gap: 10px;
    background: #eef4ff; border: 1px solid #d4e2ff; color: #2c4a8a;
    border-radius: 10px; padding: 10px 14px; font-size: 12.5px; margin-bottom: 16px;
  }
  .rdv-sync-icon { font-size: 15px; }

  /* ===== Calendrier ===== */
  .cal-card {
    background: #fff; border: 1px solid var(--border, #ececec); border-radius: var(--radius-card, 10px);
    overflow: hidden;
  }
  .cal-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 18px; border-bottom: 1px solid #f0f0f0; flex-wrap: wrap;
  }
  .cal-nav { display: flex; align-items: center; gap: 10px; }
  .cal-nav-btn {
    width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border, #e5e5e5);
    background: #fff; cursor: pointer; font-size: 18px; line-height: 1; color: #666;
  }
  .cal-nav-btn:hover { background: #f5f5f5; }
  .cal-week-label { font-size: 14px; font-weight: 600; color: var(--text); min-width: 230px; text-align: center; }
  .cal-view-switch { display: flex; gap: 2px; background: #f3f3f3; border-radius: 8px; padding: 3px; }
  .cal-vs-btn {
    border: none; background: transparent; cursor: pointer; font-family: var(--font);
    font-size: 12px; font-weight: 600; color: #888; padding: 6px 12px; border-radius: 6px;
  }
  .cal-vs-btn.active { background: #fff; color: var(--green-dark, #3da856); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
  .cal-vs-btn:hover:not(.active) { color: #555; }

  .cal-body { display: grid; grid-template-columns: 200px 1fr; }
  .cal-sidebar { border-right: 1px solid #f0f0f0; padding: 16px 14px; display: flex; flex-direction: column; gap: 10px; }
  .cal-side-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #aaa; }
  .cal-side-list { display: flex; flex-direction: column; gap: 6px; }
  .cal-side-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    border: 1px solid transparent; background: #fafafa; border-radius: 8px;
    padding: 8px 10px; cursor: pointer; font-family: var(--font); text-align: left;
  }
  .cal-side-item:hover { background: #f3f3f3; }
  .cal-side-item.active { background: var(--green-soft, #e8f6ec); border-color: #c5e8cf; }
  .cal-side-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
  .cal-side-label { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
  .cal-side-date { font-size: 11px; color: #999; }
  .cal-add-btn {
    margin-top: 2px; border: 1px dashed #cdd; background: #fff; color: var(--green-dark, #3da856);
    border-radius: 8px; padding: 8px; cursor: pointer; font-family: var(--font);
    font-size: 12px; font-weight: 600;
  }
  .cal-add-btn:hover { background: var(--green-soft, #e8f6ec); border-color: #c5e8cf; }

  .cal-grid-wrap { display: flex; flex-direction: column; min-width: 0; }
  .cal-days-head { display: grid; grid-template-columns: 52px repeat(7, 1fr); border-bottom: 1px solid #f0f0f0; }
  .cal-hour-col-head { }
  .cal-day-head { text-align: center; padding: 8px 0; }
  .cal-day-name { font-size: 11px; color: #999; text-transform: uppercase; }
  .cal-day-num { font-size: 15px; font-weight: 600; color: var(--text); }
  .cal-day-head.today .cal-day-num {
    background: var(--green, #46B962); color: #fff; border-radius: 50%;
    width: 26px; height: 26px; line-height: 26px; display: inline-block;
  }
  .cal-grid-scroll { max-height: 396px; overflow-y: auto; }
  .cal-grid { display: grid; grid-template-columns: 52px repeat(7, 1fr); }
  .cal-hour-col { display: flex; flex-direction: column; }
  .cal-hour-cell { height: 44px; font-size: 10px; color: #aaa; text-align: right; padding: 2px 6px 0 0; box-sizing: border-box; }
  .cal-day-col { position: relative; border-left: 1px solid #f4f4f4; }
  .cal-slot { height: 44px; border-bottom: 1px solid #f6f6f6; box-sizing: border-box; }
  .cal-event {
    position: absolute; left: 3px; right: 3px; border: none; border-radius: 6px;
    color: #fff; cursor: pointer; padding: 3px 6px; text-align: left; overflow: hidden;
    font-family: var(--font); box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    display: flex; flex-direction: column; gap: 1px;
  }
  .cal-event.active { outline: 2px solid rgba(0,0,0,0.35); outline-offset: 1px; }
  .cal-event-label { font-size: 11px; font-weight: 700; line-height: 1.1; }
  .cal-event-time { font-size: 10px; opacity: 0.9; }

  .cal-form {
    display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap;
    padding: 14px 18px; border-top: 1px solid #f0f0f0; background: #fcfcfc;
  }
  .cal-form-field { display: flex; flex-direction: column; gap: 4px; }
  .cal-form-field.grow { flex: 1; min-width: 150px; }
  .cal-form-field.narrow { min-width: 90px; }
  .cal-form-field label { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.3px; }
  .cal-form-field input, .cal-form-field select {
    border: 1px solid var(--border, #e0e0e0); border-radius: 8px; padding: 8px 10px;
    font-family: var(--font); font-size: 13px; color: var(--text); background: #fff;
  }
  .cal-form-field input:focus, .cal-form-field select:focus { outline: none; border-color: var(--green, #46B962); }
  .cal-colors { display: flex; gap: 5px; }
  .cal-color { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
  .cal-color.active { border-color: #333; }
  .cal-del-btn {
    border: 1px solid #f0c8c8; background: #fff; color: #d05050; border-radius: 8px;
    padding: 8px 14px; cursor: pointer; font-family: var(--font); font-size: 12px; font-weight: 600;
  }
  .cal-del-btn:hover { background: #fdf0f0; }

  /* ===== Timeline ===== */
  .tl-card {
    background: #fff; border: 1px solid var(--border, #ececec); border-radius: var(--radius-card, 10px);
    padding: 16px 18px 18px;
  }
  .tl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .tl-hint { font-size: 12px; color: #888; }
  .tl-months { display: flex; margin-left: 0; }
  .tl-month {
    font-size: 12px; font-weight: 700; color: #666; text-transform: capitalize;
    padding: 6px 8px; border-bottom: 2px solid #eee; box-sizing: border-box; text-align: center;
  }
  .tl-track {
    position: relative; height: 120px; margin-top: 4px;
    background: repeating-linear-gradient(90deg, #fafafa 0, #fafafa calc(100%/12 - 1px), #f0f0f0 calc(100%/12 - 1px), #f0f0f0 calc(100%/12));
    border: 1px solid #f0f0f0; border-radius: 8px;
  }
  .tl-sep { position: absolute; top: 0; bottom: 0; width: 1px; background: #e2e2e2; }
  .tl-today { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--green, #46B962); }
  .tl-today-label {
    position: absolute; top: -2px; left: 4px; font-size: 9px; font-weight: 700;
    color: var(--green-dark, #3da856); white-space: nowrap;
  }
  .tl-milestone {
    position: absolute; top: 38px; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: #fff; border: 2px solid #ccc; border-radius: 10px; padding: 6px 8px;
    cursor: grab; box-shadow: 0 2px 6px rgba(0,0,0,0.1); user-select: none;
  }
  .tl-milestone:active { cursor: grabbing; }
  .tl-milestone.active { box-shadow: 0 3px 10px rgba(0,0,0,0.2); z-index: 3; }
  .tl-dot { width: 12px; height: 12px; border-radius: 50%; }
  .tl-milestone-label {
    border: none; background: transparent; text-align: center; font-family: var(--font);
    font-size: 13px; font-weight: 700; color: var(--text); width: auto; min-width: 22px; padding: 0;
  }
  .tl-milestone-label:focus { outline: none; background: #f3f3f3; border-radius: 4px; }
  .tl-milestone-date { font-size: 10px; color: #999; white-space: nowrap; }

  .tl-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .tl-legend-item {
    display: flex; align-items: center; gap: 6px; background: #fafafa;
    border: 1px solid #eee; border-radius: 8px; padding: 5px 8px; cursor: pointer;
  }
  .tl-legend-item.active { background: var(--green-soft, #e8f6ec); border-color: #c5e8cf; }
  .tl-legend-name { font-size: 12px; font-weight: 600; color: var(--text); }
  .tl-legend-date { font-size: 11px; color: #999; }
  .tl-legend-del { border: none; background: transparent; color: #c66; cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
  .tl-legend-del:hover { color: #d05050; }
`;
