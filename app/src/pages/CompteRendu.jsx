import React from 'react';
import { useNavigate } from 'react-router-dom';
import { property, contexteZone, comparables, tensionMarche, avisValeur } from '../data/propertyData';

const styles = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    background: '#fff',
    padding: '40px 48px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#393939',
    lineHeight: 1.6,
  },
  header: {
    textAlign: 'center',
    marginBottom: 36,
    borderBottom: '2px solid #46B962',
    paddingBottom: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    color: '#46B962',
    margin: 0,
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 2,
    margin: '12px 0 4px',
    color: '#393939',
  },
  subtitle: {
    fontSize: 14,
    color: '#949494',
    margin: '4px 0',
  },
  meta: {
    fontSize: 13,
    color: '#949494',
    marginTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#46B962',
    borderBottom: '1px solid #e5e5e5',
    paddingBottom: 8,
    marginBottom: 16,
  },
  card: {
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
  },
  propertyRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    display: 'inline-block',
    background: '#f0faf2',
    color: '#46B962',
    border: '1px solid #d0efd6',
    borderRadius: 4,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  label: {
    fontSize: 13,
    color: '#949494',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: 600,
    color: '#393939',
  },
  bigPrice: {
    fontSize: 42,
    fontWeight: 700,
    color: '#46B962',
    textAlign: 'center',
    margin: '16px 0 4px',
  },
  priceRange: {
    textAlign: 'center',
    fontSize: 15,
    color: '#949494',
    marginBottom: 16,
  },
  kpiRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 32,
    flexWrap: 'wrap',
  },
  kpiItem: {
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#393939',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#949494',
  },
  recommended: {
    display: 'inline-block',
    background: '#46B962',
    color: '#fff',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 6,
  },
  scoresRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  scoreCard: {
    flex: '1 1 0',
    minWidth: 100,
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    padding: '12px 8px',
    textAlign: 'center',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  scoreLabel: {
    fontSize: 11,
    color: '#949494',
    marginTop: 2,
  },
  marketRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
  },
  marketItem: {
    textAlign: 'center',
    flex: '1 1 0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '2px solid #e5e5e5',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#949494',
    letterSpacing: 0.5,
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid #f0f0f0',
  },
  gaugeRow: {
    display: 'flex',
    gap: 24,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  gaugeItem: {
    flex: '1 1 0',
    minWidth: 140,
  },
  gaugeBar: {
    height: 8,
    borderRadius: 4,
    background: '#eee',
    marginTop: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  gaugeLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    fontWeight: 600,
  },
  bulletList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  bulletItem: {
    padding: '4px 0',
    fontSize: 13,
    paddingLeft: 12,
    marginBottom: 6,
  },
  decompStep: {
    background: '#f7f7f7',
    border: '1px solid #e5e5e5',
    borderRadius: 6,
    padding: '8px 14px',
    flex: '1 1 0',
    minWidth: 0,
  },
  decompArrow: {
    fontSize: 18,
    color: '#949494',
    flexShrink: 0,
  },
  decompFinal: {
    background: '#f0faf2',
    border: '2px solid #46B962',
    borderRadius: 6,
    padding: '8px 14px',
    flex: '1 1 0',
    minWidth: 0,
    fontWeight: 700,
    color: '#46B962',
  },
  footer: {
    textAlign: 'center',
    borderTop: '2px solid #46B962',
    paddingTop: 20,
    marginTop: 40,
    fontSize: 13,
    color: '#949494',
  },
  btnPrimary: {
    display: 'inline-block',
    background: '#46B962',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: 12,
  },
  btnSecondary: {
    display: 'inline-block',
    background: '#fff',
    color: '#46B962',
    border: '2px solid #46B962',
    borderRadius: 6,
    padding: '8px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  verdictBadge: {
    display: 'inline-block',
    background: '#f0faf2',
    color: '#46B962',
    border: '1px solid #d0efd6',
    borderRadius: 6,
    padding: '6px 16px',
    fontWeight: 700,
    fontSize: 14,
  },
  twoCol: {
    display: 'flex',
    gap: 20,
  },
  col: {
    flex: '1 1 0',
    minWidth: 0,
  },
};

const scoreColor = (val) => {
  if (val >= 70) return '#46B962';
  if (val >= 50) return '#e8a838';
  return '#e05252';
};

const gaugeColor = (score) => {
  if (score >= 7) return '#46B962';
  if (score >= 4) return '#e8a838';
  return '#e05252';
};

export default function CompteRendu() {
  const navigate = useNavigate();

  const recommendedStrategy = avisValeur.strategies.find((s) => s.recommended);

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: #fff !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div style={styles.page}>
        {/* 1. Report header */}
        <header style={styles.header}>
          <p style={styles.logo}>ideeri</p>
          <h1 style={styles.title}>COMPTE RENDU D'ESTIMATION</h1>
          <p style={styles.subtitle}>Avis de Valeur</p>
          <p style={styles.meta}>
            Date : 31 mars 2026 &nbsp;|&nbsp; Référence : {property.reference}
          </p>
        </header>

        {/* 2. Property summary */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Bien estimé</h2>
          <div style={styles.card}>
            <div style={{ marginBottom: 8 }}>
              <span style={styles.label}>Adresse</span>
              <div style={styles.value}>{property.adresse}</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={styles.label}>Description</span>
              <div style={styles.value}>
                Appartement T{property.pieces}, {property.surface} m², Étage {property.etage}/6, DPE {property.dpe}
              </div>
            </div>
            <div style={{ ...styles.propertyRow, marginTop: 10 }}>
              {property.tags.map((t) => (
                <span key={t} style={styles.tag}>{t}</span>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#949494' }}>
              Collaborateur : <strong style={{ color: '#393939' }}>{property.collaborateur}</strong>
            </div>
          </div>
        </section>

        {/* 3. Valuation */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Avis de valeur</h2>
          <div style={styles.card}>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#949494' }}>Prix médian estimé</div>
            <div style={styles.bigPrice}>300 000 &euro;</div>
            <div style={styles.priceRange}>
              Fourchette : {avisValeur.prixBas.toLocaleString('fr-FR')} &euro; &mdash; {avisValeur.prixHaut.toLocaleString('fr-FR')} &euro;
            </div>
            <div style={styles.kpiRow}>
              <div style={styles.kpiItem}>
                <div style={styles.kpiValue}>{avisValeur.prixM2.toLocaleString('fr-FR')} &euro;/m²</div>
                <div style={styles.kpiLabel}>Prix au m²</div>
              </div>
              <div style={styles.kpiItem}>
                <div style={styles.kpiValue}>{avisValeur.confiance}/100</div>
                <div style={styles.kpiLabel}>Indice de confiance</div>
              </div>
              <div style={styles.kpiItem}>
                <div style={{ ...styles.kpiValue, color: '#46B962' }}>
                  {recommendedStrategy?.label}
                  <span style={styles.recommended}>Recommandé</span>
                </div>
                <div style={styles.kpiLabel}>Stratégie</div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Zone context */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Contexte de zone</h2>
          <div style={styles.scoresRow}>
            {contexteZone.scores.map((s) => (
              <div key={s.label} style={styles.scoreCard}>
                <div style={{ ...styles.scoreValue, color: scoreColor(s.value) }}>{s.value}</div>
                <div style={styles.scoreLabel}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={styles.marketRow}>
            <div style={styles.marketItem}>
              <div style={styles.kpiValue}>{contexteZone.market.prixM2} &euro;/m²</div>
              <div style={styles.kpiLabel}>Médiane secteur</div>
            </div>
            <div style={styles.marketItem}>
              <div style={{ ...styles.kpiValue, color: '#46B962' }}>{contexteZone.market.evolution}</div>
              <div style={styles.kpiLabel}>Évolution 12 mois</div>
            </div>
            <div style={styles.marketItem}>
              <div style={styles.kpiValue}>{contexteZone.market.delai}</div>
              <div style={styles.kpiLabel}>Délai moyen de vente</div>
            </div>
          </div>
        </section>

        {/* 5. Comparables */}
        <section style={styles.section} className="page-break">
          <h2 style={styles.sectionTitle}>Comparables retenus</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Source</th>
                <th style={styles.th}>Adresse</th>
                <th style={styles.th}>Surface</th>
                <th style={styles.th}>Prix/m²</th>
                <th style={styles.th}>Ajust.</th>
                <th style={styles.th}>Poids</th>
              </tr>
            </thead>
            <tbody>
              {avisValeur.comparablesTable.map((c, i) => (
                <tr key={i}>
                  <td style={styles.td}>{c.source}</td>
                  <td style={styles.td}>{c.adresse}</td>
                  <td style={styles.td}>{c.surface}</td>
                  <td style={styles.td}>{c.prixM2}</td>
                  <td style={styles.td}>{c.ajust}</td>
                  <td style={styles.td}>{c.poids}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: 10, fontSize: 14, fontWeight: 700, color: '#46B962' }}>
            Moyenne pondérée : 4 172 &euro;/m²
          </div>
        </section>

        {/* 6. Market tension */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Tension de marché</h2>
          <div style={{ ...styles.kpiRow, justifyContent: 'space-between', marginBottom: 20 }}>
            {tensionMarche.kpis.map((k, i) => (
              <div key={i} style={styles.kpiItem}>
                <div style={styles.kpiValue}>{k.value}</div>
                <div style={styles.kpiLabel}>{k.label}</div>
              </div>
            ))}
          </div>
          <div style={styles.gaugeRow}>
            {[tensionMarche.tension, tensionMarche.liquidite, tensionMarche.concurrence].map((g) => (
              <div key={g.label} style={styles.gaugeItem}>
                <div style={styles.gaugeLabel}>
                  <span>{g.label}</span>
                  <span style={{ color: gaugeColor(g.score) }}>{g.score}/10</span>
                </div>
                <div style={styles.gaugeBar}>
                  <div
                    style={{
                      ...styles.gaugeFill,
                      width: `${g.score * 10}%`,
                      background: gaugeColor(g.score),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={styles.verdictBadge}>{tensionMarche.verdict}</span>
          </div>
        </section>

        {/* 7. Argumentaire */}
        <section style={styles.section} className="page-break">
          <h2 style={styles.sectionTitle}>Argumentaire</h2>
          <div style={styles.twoCol}>
            <div style={styles.col}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#46B962' }}>
                Points forts
              </div>
              <ul style={styles.bulletList}>
                {avisValeur.pointsForts.map((p, i) => (
                  <li
                    key={i}
                    style={{
                      ...styles.bulletItem,
                      borderLeft: '3px solid #46B962',
                    }}
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div style={styles.col}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#e8a838' }}>
                Points de vigilance
              </div>
              <ul style={styles.bulletList}>
                {avisValeur.pointsVigilance.map((p, i) => (
                  <li
                    key={i}
                    style={{
                      ...styles.bulletItem,
                      borderLeft: '3px solid #e8a838',
                    }}
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 8. Price decomposition */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Décomposition du prix</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {avisValeur.decomposition.map((d, i) => (
              <React.Fragment key={i}>
                <div style={styles.decompStep}>
                  <div style={{ fontSize: 12, color: '#949494' }}>{d.step}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#393939' }}>{d.value}</div>
                  <div style={{ fontSize: 11, color: '#949494' }}>{d.detail}</div>
                </div>
                {i < avisValeur.decomposition.length - 1 && (
                  <span style={styles.decompArrow}>&rarr;</span>
                )}
              </React.Fragment>
            ))}
            <span style={styles.decompArrow}>&rarr;</span>
            <div style={styles.decompFinal}>
              <div style={{ fontSize: 12 }}>Prix final</div>
              <div style={{ fontSize: 18 }}>300 000 &euro;</div>
            </div>
          </div>
        </section>

        {/* 9. Footer */}
        <footer style={styles.footer}>
          <p>Document généré le 31 mars 2026 — Ideeri</p>
          <div className="no-print" style={{ marginTop: 16 }}>
            <button style={styles.btnPrimary} onClick={() => window.print()}>
              Imprimer le rapport
            </button>
            <button style={styles.btnSecondary} onClick={() => navigate('/step/5')}>
              Retour à l'estimation
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
