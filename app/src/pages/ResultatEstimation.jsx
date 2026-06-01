import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrix, formatPrixM2 } from '../utils/estimationCalculator';

const css = `
  .res-page {
    font-family: var(--font);
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px 20px 80px;
  }

  .res-back {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: none;
    color: #666; font-size: var(--fs-base); cursor: pointer;
    padding: 0; margin-bottom: 12px;
  }
  .res-back:hover { color: var(--green); }

  .res-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
  .res-subtitle { font-size: var(--fs-base); color: #888; margin-bottom: 24px; }

  /* PRIX HERO */
  .res-hero {
    background: linear-gradient(135deg, var(--green), var(--green-dark));
    color: white;
    border-radius: var(--radius-lg);
    padding: 32px 28px;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(70, 185, 98, 0.2);
  }
  .res-hero-label {
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.85;
    margin-bottom: 6px;
  }
  .res-hero-prix {
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 8px;
    letter-spacing: -1px;
  }
  .res-hero-m2 {
    font-size: var(--fs-lg);
    opacity: 0.9;
    margin-bottom: 16px;
  }
  .res-hero-fourchette {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.2);
    font-size: var(--fs-md);
  }
  .res-fr-bornes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }
  .res-fr-label { font-size: var(--fs-2xs); text-transform: uppercase; opacity: 0.8; letter-spacing: 0.5px; }
  .res-fr-value { font-size: 17px; font-weight: 600; }

  /* SECTIONS */
  .res-section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: var(--radius-md);
    padding: 18px 20px;
    margin-bottom: 16px;
  }
  .res-section-title {
    font-size: var(--fs-base); font-weight: 700; color: var(--text);
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 14px;
  }

  .res-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .res-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

  /* RECAP BIEN */
  .recap-row {
    display: flex; justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: var(--fs-base);
  }
  .recap-row:last-child { border-bottom: none; }
  .recap-label { color: #888; }
  .recap-value { color: var(--text); font-weight: 600; }

  /* BREAKDOWN */
  .bd-row {
    display: flex; justify-content: space-between;
    padding: 7px 10px;
    background: #fafafa;
    border-radius: var(--radius-sm);
    margin-bottom: 4px;
    font-size: var(--fs-sm);
  }
  .bd-label { color: var(--text-light); }
  .bd-coef {
    font-weight: 600;
    font-family: 'SF Mono', Monaco, monospace;
  }
  .bd-coef.pos { color: var(--green); }
  .bd-coef.neg { color: #c44; }
  .bd-coef.neutral { color: #888; }
  .bd-base {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #ddd;
    font-size: var(--fs-sm);
    color: #888;
    text-align: right;
  }

  /* COMPARABLES */
  .comp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .comp-table th {
    text-align: left;
    color: #888;
    font-weight: 600;
    padding: 8px 10px;
    border-bottom: 1px solid #e0e0e0;
    text-transform: uppercase;
    font-size: var(--fs-2xs);
    letter-spacing: 0.5px;
  }
  .comp-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f5f5f5;
    color: var(--text);
  }
  .comp-table tr:last-child td { border-bottom: none; }
  .comp-pm2 { font-weight: 700; color: var(--green); }
  .comp-distance { color: #888; font-size: var(--fs-xs); }

  /* ACTIONS */
  .res-actions {
    display: flex; gap: 12px; flex-wrap: wrap;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
  }
  .res-btn {
    padding: 11px 20px;
    border-radius: 6px;
    font-size: var(--fs-base);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid;
    transition: all 0.15s;
  }
  .res-btn-primary {
    background: var(--green);
    color: white;
    border-color: var(--green);
  }
  .res-btn-primary:hover { background: var(--green-dark); }
  .res-btn-secondary {
    background: white;
    color: var(--green);
    border-color: var(--green);
  }
  .res-btn-secondary:hover { background: #f0faf2; }
  .res-btn-ghost {
    background: white;
    color: var(--text-light);
    border-color: #d0d0d0;
  }
  .res-btn-ghost:hover { border-color: #888; }

  .res-empty {
    text-align: center; padding: 40px 20px;
    color: #888;
  }

  .res-saved {
    background: #f0faf2;
    border: 1px solid #c8e8d0;
    color: #2a8546;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: var(--fs-base);
    margin-bottom: 16px;
  }
`;

const TYPE_LABELS = { appartement: 'Appartement', maison: 'Maison' };
const ETAT_LABELS = {
  neuf: 'Neuf',
  refait: 'Refait \u00e0 neuf',
  bon: 'Bon \u00e9tat',
  a_rafraichir: '\u00c0 rafra\u00eechir',
  a_renover: '\u00c0 r\u00e9nover',
  a_reconstruire: '\u00c0 reconstruire',
};
const EXPO_LABELS = {
  sud: 'Sud', sud_est: 'Sud-Est', sud_ouest: 'Sud-Ouest',
  est: 'Est', ouest: 'Ouest',
  nord_est: 'Nord-Est', nord_ouest: 'Nord-Ouest', nord: 'Nord',
};
const EXT_LABELS = { aucun: 'Aucun', balcon: 'Balcon', terrasse: 'Terrasse', jardin: 'Jardin' };
const PARK_LABELS = { aucun: 'Aucun', place: 'Place de parking', box: 'Box / Garage' };

export default function ResultatEstimation() {
  const navigate = useNavigate();
  // Lecture paresseuse du sessionStorage : evite useEffect + setState
  const [data] = useState(() => {
    const raw = sessionStorage.getItem('ideeri_pending_estimation');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });
  const [saved, setSaved] = useState(false);

  if (!data) {
    return (
      <div className="res-page">
        <style>{css}</style>
        <div className="res-empty">
          <h2>Aucune estimation \u00e0 afficher</h2>
          <p>Lance une nouvelle estimation depuis le tableau de bord.</p>
          <button className="res-btn res-btn-primary" onClick={() => navigate('/')} style={{ marginTop: 12 }}>
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const { bien, adresse, result, dvfStats, dvfTopComparables = [] } = data;

  const handleSauvegarder = () => {
    // Genere un ID + ajoute aux estimations sauvegardees en localStorage
    const stored = JSON.parse(localStorage.getItem('ideeri_biens') || '[]');
    const id = Date.now();
    const entry = {
      id,
      adresse: adresse.label,
      postcode: adresse.postcode,
      city: adresse.city,
      coords: adresse.coords,
      bien,
      result,
      dvfStats,
      createdAt: data.createdAt,
    };
    stored.unshift(entry);
    localStorage.setItem('ideeri_biens', JSON.stringify(stored));
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
  };

  return (
    <div className="res-page">
      <style>{css}</style>

      <button className="res-back" onClick={() => navigate('/nouveau-bien')}>
        &#8592; Modifier la saisie
      </button>
      <h1 className="res-title">R\u00e9sultat de l'estimation</h1>
      <div className="res-subtitle">{adresse.label}</div>

      {saved && <div className="res-saved">\u2713 Estimation sauvegard\u00e9e dans ton tableau de bord.</div>}

      {/* PRIX HERO */}
      <div className="res-hero">
        <div className="res-hero-label">Prix estim\u00e9</div>
        <div className="res-hero-prix">{formatPrix(result.prix)}</div>
        <div className="res-hero-m2">soit {formatPrixM2(result.prixM2)}</div>
        <div className="res-hero-fourchette">
          <div className="res-fr-bornes">
            <div className="res-fr-label">Fourchette basse</div>
            <div className="res-fr-value">{formatPrix(result.prixBas)}</div>
          </div>
          <div className="res-fr-bornes">
            <div className="res-fr-label">Fourchette haute</div>
            <div className="res-fr-value">{formatPrix(result.prixHaut)}</div>
          </div>
        </div>
      </div>

      <div className="res-grid-2">
        {/* RECAP BIEN */}
        <div className="res-section">
          <div className="res-section-title">R\u00e9capitulatif du bien</div>
          <div className="recap-row">
            <span className="recap-label">Type</span>
            <span className="recap-value">{TYPE_LABELS[bien.type]}</span>
          </div>
          <div className="recap-row">
            <span className="recap-label">Surface</span>
            <span className="recap-value">{bien.surface} m\u00b2</span>
          </div>
          {bien.pieces && (
            <div className="recap-row">
              <span className="recap-label">Pi\u00e8ces</span>
              <span className="recap-value">{bien.pieces}</span>
            </div>
          )}
          {bien.chambres != null && (
            <div className="recap-row">
              <span className="recap-label">Chambres</span>
              <span className="recap-value">{bien.chambres}</span>
            </div>
          )}
          {bien.type === 'appartement' && bien.etage != null && (
            <div className="recap-row">
              <span className="recap-label">\u00c9tage</span>
              <span className="recap-value">
                {bien.etage === 0 ? 'RDC' : `${bien.etage}e`} {bien.ascenseur ? '(ascenseur)' : ''}
              </span>
            </div>
          )}
          {bien.annee && (
            <div className="recap-row">
              <span className="recap-label">Ann\u00e9e</span>
              <span className="recap-value">{bien.annee}</span>
            </div>
          )}
          {bien.etat && (
            <div className="recap-row">
              <span className="recap-label">\u00c9tat</span>
              <span className="recap-value">{ETAT_LABELS[bien.etat]}</span>
            </div>
          )}
          {bien.exposition && (
            <div className="recap-row">
              <span className="recap-label">Exposition</span>
              <span className="recap-value">{EXPO_LABELS[bien.exposition]}</span>
            </div>
          )}
          {bien.parking && bien.parking !== 'aucun' && (
            <div className="recap-row">
              <span className="recap-label">Stationnement</span>
              <span className="recap-value">{PARK_LABELS[bien.parking]}</span>
            </div>
          )}
          {bien.exterieur && bien.exterieur !== 'aucun' && (
            <div className="recap-row">
              <span className="recap-label">Ext\u00e9rieur</span>
              <span className="recap-value">{EXT_LABELS[bien.exterieur]}</span>
            </div>
          )}
        </div>

        {/* DETAIL DU CALCUL */}
        <div className="res-section">
          <div className="res-section-title">D\u00e9tail du calcul</div>
          <div className="bd-row">
            <span className="bd-label">Prix m\u00b2 de base ({dvfStats ? 'm\u00e9diane DVF' : 'estim\u00e9 par d\u00e9faut'})</span>
            <span className="bd-coef neutral">{formatPrixM2(result.prixM2Base)}</span>
          </div>
          {result.breakdown.length === 0 ? (
            <div style={{ fontSize: 12, color: '#888', padding: '8px 4px' }}>
              Aucun ajustement (caract\u00e9ristiques par d\u00e9faut).
            </div>
          ) : (
            result.breakdown.map((b, i) => (
              <div key={i} className="bd-row">
                <span className="bd-label">{b.label}</span>
                <span className={`bd-coef ${b.coef > 1 ? 'pos' : b.coef < 1 ? 'neg' : 'neutral'}`}>
                  {b.coef > 1 ? '+' : ''}{Math.round((b.coef - 1) * 100)} %
                </span>
              </div>
            ))
          )}
          <div className="bd-base">
            Coefficient total : <strong>{result.coef.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* COMPARABLES DVF */}
      <div className="res-section">
        <div className="res-section-title">
          Comparables march\u00e9 (DVF) {dvfTopComparables.length > 0 && `\u2014 top ${Math.min(dvfTopComparables.length, 10)} les plus proches`}
        </div>
        {dvfTopComparables.length === 0 ? (
          <div className="res-empty" style={{ padding: 20 }}>
            Aucune transaction r\u00e9cente trouv\u00e9e dans la commune.
          </div>
        ) : (
          <table className="comp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Adresse</th>
                <th>Type</th>
                <th>Surface</th>
                <th>Prix</th>
                <th>Prix/m\u00b2</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {dvfTopComparables.slice(0, 10).map((c, i) => (
                <tr key={i}>
                  <td>{c.date ? new Date(c.date).toLocaleDateString('fr-FR') : '-'}</td>
                  <td>{c.adresse || '-'}</td>
                  <td>{c.type}</td>
                  <td>{c.surface} m\u00b2</td>
                  <td>{formatPrix(c.prix)}</td>
                  <td className="comp-pm2">{formatPrixM2(c.prixM2)}</td>
                  <td className="comp-distance">
                    {c.distance != null && c.distance !== Infinity ? `${c.distance} m` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ACTIONS */}
      <div className="res-actions">
        <button className="res-btn res-btn-primary" onClick={handleSauvegarder}>
          {saved ? '\u2713 Sauvegard\u00e9' : 'Sauvegarder dans le tableau de bord'}
        </button>
        <button className="res-btn res-btn-secondary" onClick={() => navigate('/avis-valeur')}>
          G\u00e9n\u00e9rer un avis de valeur
        </button>
        <button className="res-btn res-btn-secondary" onClick={() => navigate('/report')}>
          G\u00e9n\u00e9rer un compte rendu
        </button>
        <button className="res-btn res-btn-ghost" onClick={() => navigate('/nouveau-bien')}>
          Nouvelle saisie
        </button>
      </div>
    </div>
  );
}
