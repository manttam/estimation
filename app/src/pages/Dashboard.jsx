import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import { property } from '../data/propertyData';
import { clearActiveBien } from '../utils/activeBien';

const INITIAL_VERSIONS = [
  {
    id: 1,
    version: 'V0',
    date: '12/06/2003',
    heure: '10:00',
    agent: 'Jean-Pierre Duval',
    prix: '122 000 \u20ac',
    prixM2: '1 683 \u20ac/m\u00b2',
    statut: 'compte_rendu',
    note: '',
  },
  {
    id: 2,
    version: 'V1',
    date: '15/01/2026',
    heure: '09:30',
    agent: 'Marie Dupont',
    prix: '295 000 \u20ac',
    prixM2: '4 069 \u20ac/m\u00b2',
    statut: 'avis_valeur',
    note: '',
  },
  {
    id: 3,
    version: 'V2',
    date: '25/03/2026',
    heure: '14:15',
    agent: 'Marie Dupont',
    prix: '300 000 \u20ac',
    prixM2: '4 138 \u20ac/m\u00b2',
    statut: 'en_cours',
    note: '',
  },
];

const STATUT_CONFIG = {
  sauvegarde: { label: 'Sauvegard\u00e9e', icon: '\ud83d\udcbe', color: '#949494', bg: '#f5f5f5', border: '#e5e5e5' },
  avis_valeur: { label: 'Avis de valeur', icon: '\ud83d\udcc4', color: '#e87722', bg: '#fff8f0', border: '#fdd8b8' },
  compte_rendu: { label: 'Compte rendu', icon: '\u2705', color: '#46B962', bg: '#f0faf2', border: '#d0efd6' },
  en_cours: { label: 'En cours', icon: '\u270f\ufe0f', color: '#4a6cf7', bg: '#f0f4ff', border: '#c8d6f7' },
};

const css = `
  .dashboard-page {
    font-family: var(--font);
  }

  /* ---- Historique section ---- */
  .hist-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .hist-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hist-count {
    font-size: var(--fs-xs);
    color: var(--muted);
    font-weight: 500;
    background: #f5f5f5;
    padding: 3px 10px;
    border-radius: 12px;
  }
  .btn-new-est {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--green);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: background 0.15s;
  }
  .btn-new-est:hover { background: var(--green-dark); }

  /* ---- Timeline ---- */
  .timeline {
    position: relative;
    padding-left: 28px;
  }
  .timeline::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 20px;
    bottom: 20px;
    width: 2px;
    background: var(--border);
  }
  .timeline-item {
    position: relative;
    margin-bottom: 12px;
  }
  .timeline-dot {
    position: absolute;
    left: -24px;
    top: 18px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 2px var(--border);
    z-index: 1;
  }
  .timeline-dot.active {
    box-shadow: 0 0 0 2px var(--blue);
  }
  .timeline-card {
    background: #fff;
    border: 1px solid #eee;
    border-radius: var(--radius-card);
    padding: 16px 20px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .timeline-card:hover {
    border-color: #ddd;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .timeline-card.active {
    border-color: var(--blue);
    border-width: 2px;
    background: #fafbff;
  }
  .tl-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .tl-version {
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--text);
  }
  .tl-version-active {
    color: var(--blue);
  }
  .tl-date {
    font-size: var(--fs-sm);
    color: var(--muted);
    margin-left: 8px;
    font-weight: 400;
  }
  .tl-prix {
    font-size: var(--fs-xl);
    font-weight: 700;
    color: var(--green);
  }
  .tl-prix-m2 {
    font-size: var(--fs-xs);
    color: var(--muted);
    font-weight: 500;
  }
  .tl-middle {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    font-size: var(--fs-sm);
    color: #666;
  }
  .tl-agent {
    font-weight: 500;
  }
  .tl-note {
    font-size: var(--fs-sm);
    color: var(--muted);
    font-style: italic;
    margin-bottom: 10px;
  }
  .statut-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: var(--fs-xs);
    font-weight: 600;
    white-space: nowrap;
  }
  .tl-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #f0f0f0;
  }
  .tl-btn {
    padding: 5px 12px;
    border-radius: 6px;
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #eee;
    background: white;
    color: var(--text-light);
    font-family: var(--font);
    transition: all 0.15s;
    white-space: nowrap;
  }
  .tl-btn:hover {
    border-color: var(--green);
    color: var(--green);
    background: #f0faf2;
  }
  .tl-btn.primary {
    background: var(--green);
    color: white;
    border-color: var(--green);
  }
  .tl-btn.primary:hover {
    background: var(--green-dark);
  }
  .tl-btn.blue {
    background: var(--blue);
    color: white;
    border-color: var(--blue);
  }
  .tl-btn.blue:hover {
    background: #3a5ce0;
  }
  .evolution-tag {
    font-size: var(--fs-xs);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-card);
    margin-left: 6px;
  }
  .evolution-tag.up {
    color: var(--green);
    background: #f0faf2;
  }
  .evolution-tag.down {
    color: var(--red);
    background: #fef2f2;
  }
`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [versions, setVersions] = useState(INITIAL_VERSIONS);

  // Merge saved estimations from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('ideeri_estimations') || '[]');
    const current = saved.find(e => e.reference === property.reference);
    if (current) {
      setVersions(prev => {
        const exists = prev.find(v => v.version === 'V2' && v.statut === 'sauvegarde');
        if (exists) return prev;
        return prev.map(v =>
          v.version === 'V2' ? { ...v, statut: 'sauvegarde', date: current.date, heure: current.heure } : v
        );
      });
    }
  }, []);

  return (
    <div className="dashboard-page">
      <style>{css}</style>

      <PropertyCard />

      <div style={{ marginTop: 4 }}>
        <div className="hist-header">
          <div className="hist-title">
            Historique des estimations
            <span className="hist-count">{versions.length} version{versions.length > 1 ? 's' : ''}</span>
          </div>
          <button className="btn-new-est" onClick={() => navigate('/nouveau-bien')}>
            + Nouvelle estimation
          </button>
        </div>

        <div className="timeline">
          {versions.slice().reverse().map((v, idx) => {
            const st = STATUT_CONFIG[v.statut] || STATUT_CONFIG.sauvegarde;
            const isActive = v.statut === 'en_cours';
            const isFirst = idx === 0;

            // Compute evolution vs previous version
            let evolution = null;
            const reversedIdx = versions.length - 1 - idx;
            if (reversedIdx > 0) {
              const prevPrix = parseInt(versions[reversedIdx - 1].prix.replace(/[^\d]/g, ''));
              const currPrix = parseInt(v.prix.replace(/[^\d]/g, ''));
              const diff = ((currPrix - prevPrix) / prevPrix * 100).toFixed(1);
              evolution = { value: diff, up: currPrix >= prevPrix };
            }

            return (
              <div key={v.id} className="timeline-item">
                <div className={`timeline-dot ${isActive ? 'active' : ''}`} style={{ background: isActive ? '#4a6cf7' : st.color }} />
                <div className={`timeline-card ${isActive ? 'active' : ''}`}>
                  <div className="tl-top">
                    <div>
                      <span className={`tl-version ${isActive ? 'tl-version-active' : ''}`}>
                        {v.version} {isActive && '\u2014 Estimation active'}
                      </span>
                      <span className="tl-date">{v.date} &agrave; {v.heure}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tl-prix">
                        {v.prix}
                        {evolution && (
                          <span className={`evolution-tag ${evolution.up ? 'up' : 'down'}`}>
                            {evolution.up ? '+' : ''}{evolution.value}%
                          </span>
                        )}
                      </div>
                      <div className="tl-prix-m2">{v.prixM2}</div>
                    </div>
                  </div>
                  <div className="tl-middle">
                    <span className="tl-agent">{v.agent}</span>
                    <span
                      className="statut-badge"
                      style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}
                    >
                      {st.icon} {st.label}
                    </span>
                  </div>
                  {v.note && <div className="tl-note">{v.note}</div>}
                  <div className="tl-actions">
                    {isActive ? (
                      <>
                        <button className="tl-btn blue" onClick={() => navigate('/step/1')}>
                          Continuer l&apos;estimation
                        </button>
                        <button className="tl-btn" onClick={() => navigate('/avis-valeur')}>
                          Avis de valeur
                        </button>
                        <button className="tl-btn" onClick={() => navigate('/report')}>
                          Compte rendu
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="tl-btn"
                          onClick={() => { clearActiveBien(); navigate('/step/1'); }}
                        >
                          Consulter
                        </button>
                        <button
                          className="tl-btn"
                          onClick={() => { clearActiveBien(); navigate('/avis-valeur'); }}
                        >
                          Avis de valeur
                        </button>
                        <button
                          className="tl-btn"
                          onClick={() => { clearActiveBien(); navigate('/report'); }}
                        >
                          Compte rendu
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
