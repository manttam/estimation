import { Link } from 'react-router-dom';
import PropertyCard from '../components/PropertyCard';
import Stepper from '../components/Stepper';
import { tensionMarche } from '../data/propertyData';

const colors = {
  green: '#46B962',
  blue: '#4a6cf7',
  orange: '#f5a623',
  red: '#e74c3c',
  text: '#393939',
  muted: '#949494',
  border: '#e5e5e5',
};

/* ─── SVG Icon components (sober, minimal) ─── */
function IconUsers({ color = '#555', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTarget({ color = '#555', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconTrend({ color = '#555', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconClock({ color = '#555', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

const KPI_ICONS = [IconUsers, IconTarget, IconTrend, IconClock];

/* ─── CSS ─── */
const cssStyles = `
  .step4-page {
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* KPI ROW */
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }
  .kpi-card {
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 18px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .kpi-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .kpi-text .kpi-value {
    font-size: 24px;
    font-weight: 700;
    color: #393939;
    line-height: 1.2;
  }
  .kpi-text .kpi-label {
    font-size: 11px;
    color: #949494;
    margin-top: 2px;
  }

  /* ─── HERO SECTION: Radar + Verdict ─── */
  .hero-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }
  .hero-card {
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 24px;
  }
  .hero-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #393939;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hero-card-title .title-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    background: #f0f8f3;
    color: #46B962;
  }

  /* Radar */
  .radar-wrap {
    display: flex;
    justify-content: center;
    margin: 0 0 16px 0;
  }
  .radar-detail-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .radar-detail-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
  }
  .radar-detail-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .radar-detail-label {
    font-size: 11px;
    color: #666;
    flex: 1;
  }
  .radar-detail-value {
    font-size: 13px;
    font-weight: 700;
  }

  /* Score breakdown */
  .score-breakdown {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }
  .breakdown-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .breakdown-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    font-size: 12px;
    color: #949494;
  }
  .breakdown-legend strong {
    margin-right: 3px;
  }

  /* Verdict gauges */
  .gauge-row {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
    gap: 12px;
  }
  .gauge-label {
    font-size: 12px;
    font-weight: 600;
    color: #393939;
    width: 100px;
    flex-shrink: 0;
  }
  .gauge-track {
    flex: 1;
    height: 10px;
    background: #f0f0f0;
    border-radius: 5px;
    overflow: hidden;
  }
  .gauge-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.4s ease;
  }
  .gauge-value {
    font-size: 13px;
    font-weight: 700;
    width: 50px;
    text-align: right;
    flex-shrink: 0;
  }
  .verdict-banner {
    margin-top: 20px;
    padding: 14px 20px;
    background: #f0f8f3;
    border: 1px solid #d4edda;
    border-radius: 10px;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: #46B962;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .verdict-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #46B962;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    flex-shrink: 0;
  }

  /* ─── TABLES ─── */
  .data-card {
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .data-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #393939;
    margin: 0 0 14px 0;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .data-table th {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 2px solid #f0f0f0;
    font-weight: 600;
    color: #949494;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .data-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #f5f5f5;
    color: #393939;
  }
  .data-table tbody tr:hover {
    background: #fafafa;
  }
  .score-pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 11px;
  }
  .score-pill.high { background: #f0f8f3; color: #2d8a47; }
  .score-pill.mid { background: #fef9f0; color: #b45309; }
  .score-pill.low { background: #f0f4ff; color: #4a6cf7; }
  .urgency-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .urgency-badge.urgent { background: #fef2f2; color: #e74c3c; }
  .urgency-badge.normal { background: #f5f5f5; color: #666; }
  .jours-badge {
    font-weight: 600;
    font-size: 12px;
  }
  .jours-badge.fast { color: #46B962; }
  .jours-badge.medium { color: #f5a623; }
  .jours-badge.slow { color: #e74c3c; }

  /* ─── FOOTER ─── */
  .footer-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 0;
  }
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: 'Open Sans', sans-serif;
    text-decoration: none;
  }
  .btn-primary { background: #46B962; color: white; }
  .btn-primary:hover { background: #3da856; }
  .btn-ghost { background: transparent; color: #393939; border: 1px solid #eee; }
  .btn-ghost:hover { background: #fafafa; }
`;

/* ─── Radar Chart — style dual Bien ↔ Acquéreur ─── */
const AXIS_COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#E11D48'];
const AXIS_POIDS = [18, 18, 16, 14, 12, 12, 10]; // poids par axe (total = 100)

// Données acquéreur simulées pour le matching
const ACQ_VALUES = [0.80, 0.85, 0.88, 0.75, 0.70, 0.72, 0.78];

function computeMatchScore(bienVals, acqVals) {
  let total = 0, totalPoids = 0;
  bienVals.forEach((b, i) => {
    const bien = b * 100, acq = acqVals[i] * 100;
    const coverage = acq > 0 ? Math.min(bien, acq) / acq : 1;
    total += coverage * AXIS_POIDS[i];
    totalPoids += AXIS_POIDS[i];
  });
  return Math.round(total / totalPoids * 100);
}

function RadarChart({ axes, values, acqValues = ACQ_VALUES, size = 440 }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.30;
  const n = axes.length;
  const levels = 5;

  const angle = (i) => (i * 2 * Math.PI / n) - Math.PI / 2;
  const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

  const polyPoints = (vals, scale = 100) =>
    vals.map((v, i) => { const p = pt(i, R * (typeof v === 'number' && v <= 1 ? v * 100 : v) / scale); return `${p[0]},${p[1]}`; }).join(' ');

  const bienPts = polyPoints(values.map(v => v * 100), 100);
  const acqPts = polyPoints(acqValues.map(v => v * 100), 100);

  const matchScore = computeMatchScore(values, acqValues);
  const scoreColor = matchScore >= 85 ? '#16A34A' : matchScore >= 70 ? '#D97706' : matchScore >= 55 ? '#EA580C' : '#DC2626';

  const labelR = R + 38;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid polygons */}
      {Array.from({ length: levels }, (_, lv) => {
        const r = R * (lv + 1) / levels;
        const pts = Array.from({ length: n }, (_, i) => { const p = pt(i, r); return `${p[0]},${p[1]}`; }).join(' ');
        const isLast = lv === levels - 1;
        return <polygon key={lv} points={pts} fill={isLast ? '#F5F3FF' : 'none'} stroke={isLast ? '#C7D2FE' : '#E5E7EB'} strokeWidth={isLast ? 1.5 : 0.8} />;
      })}
      {/* Axis lines */}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E5E7EB" strokeWidth={1.2} />;
      })}
      {/* Level numbers on axis 0 */}
      {Array.from({ length: levels }, (_, lv) => {
        const r = R * (lv + 1) / levels;
        const [x, y] = pt(0, r);
        return <text key={lv} x={x + 4} y={y - 4} fontFamily="Inter,-apple-system,sans-serif" fontSize={8} fill="#C7D2FE">{(lv + 1) * 20}</text>;
      })}
      {/* Acquéreur polygon (dashed amber) */}
      <polygon points={acqPts} fill="rgba(245,158,11,0.07)" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6,3" strokeLinejoin="round" />
      {/* Bien polygon (gradient fill) */}
      <defs>
        <linearGradient id="radarBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <polygon points={bienPts} fill="url(#radarBg)" stroke="#4F46E5" strokeWidth={2.5} strokeLinejoin="round" />
      {/* Bien dots (colored per axis) */}
      {values.map((v, i) => {
        const [x, y] = pt(i, R * v);
        return <circle key={`b${i}`} cx={x} cy={y} r={5} fill={AXIS_COLORS[i % AXIS_COLORS.length]} stroke="white" strokeWidth={2.5} />;
      })}
      {/* Acquéreur dots (amber outline) */}
      {acqValues.map((v, i) => {
        const [x, y] = pt(i, R * v);
        return <circle key={`a${i}`} cx={x} cy={y} r={4} fill="white" stroke="#F59E0B" strokeWidth={2.5} />;
      })}
      {/* Axis labels + poids */}
      {axes.map((label, i) => {
        const [x, y] = pt(i, labelR);
        const cosA = Math.cos(angle(i));
        const anchor = cosA > 0.12 ? 'start' : cosA < -0.12 ? 'end' : 'middle';
        return (
          <g key={i}>
            <text x={x} y={y - 5} textAnchor={anchor} dominantBaseline="middle" fontFamily="Inter,-apple-system,sans-serif" fontSize={10} fontWeight={700} fill="#374151">{label}</text>
            <text x={x} y={y + 8} textAnchor={anchor} dominantBaseline="middle" fontFamily="Inter,-apple-system,sans-serif" fontSize={9} fill="#A5B4FC">{AXIS_POIDS[i]}%</text>
          </g>
        );
      })}
      {/* Score central */}
      <circle cx={cx} cy={cy} r={28} fill="white" stroke="#E5E7EB" strokeWidth={1.5} />
      <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter,-apple-system,sans-serif" fontSize={16} fontWeight={800} fill={scoreColor}>{matchScore}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter,-apple-system,sans-serif" fontSize={8} fontWeight={600} fill="#9CA3AF">MATCH</text>
      {/* Legend */}
      <circle cx={30} cy={size - 18} r={5} fill="#4F46E5" />
      <text x={40} y={size - 18} dominantBaseline="middle" fontFamily="Inter,-apple-system,sans-serif" fontSize={10} fontWeight={600} fill="#374151">Bien</text>
      <circle cx={90} cy={size - 18} r={4} fill="white" stroke="#F59E0B" strokeWidth={2} />
      <text x={100} y={size - 18} dominantBaseline="middle" fontFamily="Inter,-apple-system,sans-serif" fontSize={10} fontWeight={600} fill="#374151">Acquéreur</text>
    </svg>
  );
}

export default function Step4TensionMarche() {
  const { kpis, tension, liquidite, concurrence, verdict, topAcquereurs, biensSimilaires, radarAxes, radarValues } = tensionMarche;

  const kpiColors = ['#f0f4ff', '#f0f8f3', '#fef9f0', '#f5f5f5'];
  const kpiIconColors = ['#4a6cf7', '#46B962', '#f5a623', '#949494'];

  const getScoreClass = (score) => score >= 0.8 ? 'high' : score >= 0.7 ? 'mid' : 'low';
  const getJoursClass = (j) => j <= 35 ? 'fast' : j <= 60 ? 'medium' : 'slow';
  const getDotColor = (val) => val >= 80 ? colors.green : val >= 65 ? colors.orange : colors.red;

  return (
    <div className="step4-page">
      <style>{cssStyles}</style>
      <PropertyCard />
      <Stepper currentStep={4} />

      {/* KPI Cards */}
      <div className="kpi-row">
        {kpis.map((kpi, i) => {
          const Icon = KPI_ICONS[i];
          return (
            <div key={i} className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: kpiColors[i] }}>
                <Icon color={kpiIconColors[i]} size={22} />
              </div>
              <div className="kpi-text">
                <div className="kpi-value">{kpi.value}</div>
                <div className="kpi-label">{kpi.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── HERO: Radar (left) + Verdict (right) ─── */}
      <div className="hero-section">
        {/* LEFT — Radar scoring */}
        <div className="hero-card">
          <h3 className="hero-card-title">
            Matching acquéreurs
            <span className="title-badge">8 matchés</span>
          </h3>
          {/* Legend chips */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 10px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5' }} /> Bien
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 10px' }}>
              <div style={{ width: 14, height: 2, borderRadius: 1, borderTop: '2.5px dashed #F59E0B' }} /> Acquéreur
            </div>
          </div>
          <div className="radar-wrap">
            <RadarChart axes={radarAxes} values={radarValues} size={440} />
          </div>
          {/* Radar detail table — Bien vs Acquéreur */}
          <div style={{ marginTop: 12, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Détail par axe — Bien vs Acquéreur
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: '7px 12px', color: '#9CA3AF', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #F3F4F6' }}>Dimension</th>
                  <th style={{ padding: '7px 12px', color: '#9CA3AF', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #F3F4F6' }}>Poids</th>
                  <th style={{ padding: '7px 12px', color: '#4F46E5', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #F3F4F6' }}>Bien</th>
                  <th style={{ padding: '7px 12px', color: '#F59E0B', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #F3F4F6' }}>Acquéreur</th>
                  <th style={{ padding: '7px 12px', color: '#9CA3AF', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #F3F4F6' }}>Écart</th>
                  <th style={{ padding: '7px 12px', color: '#9CA3AF', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #F3F4F6', width: 90 }}>Bien</th>
                </tr>
              </thead>
              <tbody>
                {radarAxes.map((axis, i) => {
                  const bien = Math.round(radarValues[i] * 100);
                  const acq = Math.round(ACQ_VALUES[i] * 100);
                  const gap = bien - acq;
                  const gapStr = (gap >= 0 ? '+' : '') + gap;
                  const gapCls = gap >= 0 ? '#16A34A' : gap >= -15 ? '#D97706' : '#DC2626';
                  const gapBg = gap >= 0 ? '#F0FDF4' : gap >= -15 ? '#FFFBEB' : '#FFF1F2';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '7px 12px', color: '#374151' }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: AXIS_COLORS[i], marginRight: 5 }} />
                        {axis}
                      </td>
                      <td style={{ padding: '7px 12px', color: '#6366F1', fontWeight: 700 }}>{AXIS_POIDS[i]}%</td>
                      <td style={{ padding: '7px 12px', color: '#4F46E5', fontWeight: 700 }}>{bien}</td>
                      <td style={{ padding: '7px 12px', color: '#F59E0B', fontWeight: 700 }}>{acq}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: gapBg, color: gapCls }}>{gapStr}</span>
                      </td>
                      <td style={{ padding: '7px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 80 }}>
                          <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${bien}%`, background: AXIS_COLORS[i] }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{bien}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Score breakdown */}
          <div className="score-breakdown">
            <div className="breakdown-bar">
              <div style={{ width: `${(8 / 31) * 100}%`, background: colors.green, height: '100%' }} />
              <div style={{ width: `${(2 / 31) * 100}%`, background: colors.red, height: '100%' }} />
              <div style={{ width: `${(21 / 31) * 100}%`, background: '#e8e8e8', height: '100%' }} />
            </div>
            <div className="breakdown-legend">
              <span><strong style={{ color: colors.green }}>8</strong> matchés</span>
              <span><strong style={{ color: colors.red }}>2</strong> non compatibles</span>
              <span><strong style={{ color: colors.muted }}>21</strong> neutres</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Verdict de tension */}
        <div className="hero-card">
          <h3 className="hero-card-title">Indices de marché</h3>

          <div className="gauge-row">
            <span className="gauge-label">Tension</span>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${tension.score * 10}%`, background: colors.green }} />
            </div>
            <span className="gauge-value" style={{ color: colors.green }}>{tension.score}/10</span>
          </div>
          <div className="gauge-row">
            <span className="gauge-label">Liquidité</span>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${liquidite.score * 10}%`, background: colors.green }} />
            </div>
            <span className="gauge-value" style={{ color: colors.green }}>{liquidite.score}/10</span>
          </div>
          <div className="gauge-row">
            <span className="gauge-label">Concurrence</span>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${concurrence.score * 10}%`, background: colors.red }} />
            </div>
            <span className="gauge-value" style={{ color: colors.red }}>{concurrence.score}/10</span>
          </div>

          <div className="verdict-banner">
            <span className="verdict-icon">&#x2713;</span>
            {verdict}
          </div>

          {/* Quick summary stats */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '14px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#949494', marginBottom: 4 }}>Délai de vente estimé</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>42 <span style={{ fontSize: 13, fontWeight: 500, color: '#949494' }}>jours</span></div>
            </div>
            <div style={{ padding: '14px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#949494', marginBottom: 4 }}>Ratio demande / offre</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.green }}>3.2x</div>
            </div>
            <div style={{ padding: '14px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#949494', marginBottom: 4 }}>Acquéreurs forte compat.</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.blue }}>7</div>
            </div>
            <div style={{ padding: '14px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#949494', marginBottom: 4 }}>Biens concurrents</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.orange }}>7 <span style={{ fontSize: 11, fontWeight: 500, color: '#949494' }}>en vente</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 acquéreurs */}
      <div className="data-card">
        <h3 className="data-card-title">Top 5 acquéreurs compatibles</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Acquéreur</th>
              <th>Score</th>
              <th>Budget</th>
              <th>Critère principal</th>
              <th>Délai</th>
            </tr>
          </thead>
          <tbody>
            {topAcquereurs.map((acq, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{acq.id}</td>
                <td><span className={`score-pill ${getScoreClass(acq.score)}`}>{(acq.score * 100).toFixed(0)}%</span></td>
                <td style={{ fontWeight: 500 }}>{acq.budget}</td>
                <td>{acq.critere}</td>
                <td><span className={`urgency-badge ${acq.delai === 'Urgent' ? 'urgent' : 'normal'}`}>{acq.delai}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Biens similaires en vente */}
      <div className="data-card">
        <h3 className="data-card-title">7 biens similaires en vente</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Adresse</th>
              <th>Type</th>
              <th>Prix</th>
              <th>Prix/m²</th>
              <th>Jours en vente</th>
            </tr>
          </thead>
          <tbody>
            {biensSimilaires.map((bien, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{bien.adresse}</td>
                <td>{bien.type}</td>
                <td style={{ fontWeight: 600 }}>{bien.prix}</td>
                <td>{bien.prixM2}</td>
                <td><span className={`jours-badge ${getJoursClass(bien.jours)}`}>{bien.jours}j</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="footer-buttons">
        <Link to="/step/3" className="btn btn-ghost">&larr; Étape précédente : Comparables</Link>
        <Link to="/step/5" className="btn btn-primary">Étape suivante : Avis de valeur &rarr;</Link>
      </div>
    </div>
  );
}
