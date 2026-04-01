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

const styles = {
  page: {
    background: '#fafafa',
    minHeight: '100vh',
    paddingBottom: 32,
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 20px',
  },
  card: {
    background: '#fff',
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.text,
    margin: '0 0 16px 0',
  },
  /* KPI row */
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 20,
  },
  kpiCard: {
    background: '#fff',
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '18px 16px',
    textAlign: 'center',
  },
  kpiIcon: {
    fontSize: 24,
    marginBottom: 6,
    display: 'block',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.text,
    lineHeight: 1.2,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  /* Gauge bars */
  gaugeRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: colors.text,
    width: 100,
    flexShrink: 0,
  },
  gaugeTrack: {
    flex: 1,
    height: 14,
    background: '#f0f0f0',
    borderRadius: 7,
    overflow: 'hidden',
  },
  gaugeValue: {
    fontSize: 13,
    fontWeight: 600,
    width: 45,
    textAlign: 'right',
    flexShrink: 0,
  },
  verdictText: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.green,
    marginTop: 16,
    textAlign: 'center',
  },
  /* Tables */
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: `2px solid ${colors.border}`,
    fontWeight: 600,
    color: colors.text,
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 12px',
    borderBottom: `1px solid #f0f0f0`,
    color: colors.text,
  },
  scoreBadge: (score) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 12,
    color: '#fff',
    background: score >= 0.8 ? colors.green : score >= 0.7 ? colors.orange : colors.blue,
  }),
  /* Radar */
  radarContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '10px 0',
  },
  /* Score breakdown bar */
  breakdownRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    fontSize: 13,
    color: colors.muted,
  },
  breakdownBar: {
    display: 'flex',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
    margin: '0 auto 8px',
  },
  /* Footer */
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1200,
    margin: '24px auto 0',
    padding: '0 20px',
  },
  btnBack: {
    padding: '10px 20px',
    border: `1px solid #ddd`,
    borderRadius: 8,
    background: '#fff',
    color: colors.text,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  btnNext: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 8,
    background: colors.green,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
};

function GaugeBar({ label, score, max = 10, color }) {
  const pct = (score / max) * 100;
  return (
    <div style={styles.gaugeRow}>
      <span style={styles.gaugeLabel}>{label}</span>
      <div style={styles.gaugeTrack}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 7,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ ...styles.gaugeValue, color }}>{score}/{max}</span>
    </div>
  );
}

function RadarChart({ axes, values, size = 300 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const n = axes.length;
  const angleStep = (2 * Math.PI) / n;
  const offset = -Math.PI / 2;

  const getPoint = (i, r) => {
    const angle = offset + i * angleStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const hexagonPath = (r) =>
    Array.from({ length: n }, (_, i) => getPoint(i, r))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
      .join(' ') + ' Z';

  const dataPath = values
    .map((v, i) => getPoint(i, v * radius))
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ') + ' Z';

  const labelOffset = 18;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background concentric hexagons */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <path
          key={pct}
          d={hexagonPath(radius * pct)}
          fill="none"
          stroke={colors.border}
          strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {axes.map((_, i) => {
        const [x, y] = getPoint(i, radius);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />
        );
      })}
      {/* Data polygon */}
      <path d={dataPath} fill={colors.green} fillOpacity={0.2} stroke={colors.green} strokeWidth={2} />
      {/* Data points */}
      {values.map((v, i) => {
        const [x, y] = getPoint(i, v * radius);
        return <circle key={i} cx={x} cy={y} r={4} fill={colors.green} />;
      })}
      {/* Axis labels */}
      {axes.map((label, i) => {
        const [x, y] = getPoint(i, radius + labelOffset);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={500}
            fill={colors.text}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function Step4TensionMarche() {
  const { kpis, tension, liquidite, concurrence, verdict, topAcquereurs, biensSimilaires, radarAxes, radarValues } = tensionMarche;

  return (
    <div style={styles.page}>
      <PropertyCard />
      <Stepper currentStep={4} />

      <div style={styles.container}>
        {/* KPI Cards */}
        <div style={styles.kpiRow}>
          {kpis.map((kpi, i) => (
            <div key={i} style={styles.kpiCard}>
              <span style={styles.kpiIcon}>{kpi.icon}</span>
              <div style={styles.kpiValue}>{kpi.value}</div>
              <div style={styles.kpiLabel}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Tension Verdict Card */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Verdict de tension</h3>
          <GaugeBar label={tension.label} score={tension.score} color={colors.green} />
          <GaugeBar label={liquidite.label} score={liquidite.score} color={colors.green} />
          <GaugeBar label={concurrence.label} score={concurrence.score} color={colors.red} />
          <div style={styles.verdictText}>{verdict}</div>
        </div>

        {/* Top 5 acquereurs */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Top 5 acqu&eacute;reurs compatibles</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Score</th>
                <th style={styles.th}>Budget</th>
                <th style={styles.th}>Crit&egrave;re principal</th>
                <th style={styles.th}>D&eacute;lai</th>
              </tr>
            </thead>
            <tbody>
              {topAcquereurs.map((acq, i) => (
                <tr key={i}>
                  <td style={styles.td}>{acq.id}</td>
                  <td style={styles.td}>
                    <span style={styles.scoreBadge(acq.score)}>
                      {(acq.score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td style={styles.td}>{acq.budget}</td>
                  <td style={styles.td}>{acq.critere}</td>
                  <td style={styles.td}>{acq.delai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Biens similaires en vente */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>7 biens similaires en vente</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Adresse</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Prix</th>
                <th style={styles.th}>Prix/m&sup2;</th>
                <th style={styles.th}>Jours en vente</th>
              </tr>
            </thead>
            <tbody>
              {biensSimilaires.map((bien, i) => (
                <tr key={i}>
                  <td style={styles.td}>{bien.adresse}</td>
                  <td style={styles.td}>{bien.type}</td>
                  <td style={styles.td}>{bien.prix}</td>
                  <td style={styles.td}>{bien.prixM2}</td>
                  <td style={styles.td}>{bien.jours}j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Radar Chart */}
        <div style={styles.card}>
          <h3 style={{ ...styles.sectionTitle, textAlign: 'center' }}>Matching acqu&eacute;reurs</h3>
          <div style={styles.radarContainer}>
            <RadarChart axes={radarAxes} values={radarValues} size={300} />
          </div>

          {/* Score breakdown bar */}
          <div style={styles.breakdownBar}>
            <div style={{ width: `${(8 / 31) * 100}%`, background: colors.green, height: '100%' }} />
            <div style={{ width: `${(2 / 31) * 100}%`, background: colors.red, height: '100%' }} />
            <div style={{ width: `${(21 / 31) * 100}%`, background: '#ddd', height: '100%' }} />
          </div>
          <div style={styles.breakdownRow}>
            <span><strong style={{ color: colors.green }}>8</strong> match&eacute;s</span>
            <span>&middot;</span>
            <span><strong style={{ color: colors.red }}>2</strong> non compatibles</span>
            <span>&middot;</span>
            <span><strong style={{ color: colors.muted }}>21</strong> neutres</span>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div style={styles.footer}>
        <Link to="/step/3" style={styles.btnBack}>
          &larr; Comparables
        </Link>
        <Link to="/step/5" style={styles.btnNext}>
          Avis de valeur &rarr;
        </Link>
      </div>
    </div>
  );
}
