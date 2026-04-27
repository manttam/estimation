import React from 'react';
import { useNavigate } from 'react-router-dom';
import { property, avisValeur, contexteZone } from '../data/propertyData';

const s = {
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
    marginBottom: 32,
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
    fontSize: 13,
    color: '#949494',
    margin: '4px 0',
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
  label: {
    fontSize: 12,
    color: '#949494',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: 600,
    color: '#393939',
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
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
    marginBottom: 16,
  },
  infoItem: {
    padding: '12px 16px',
    background: '#f9fafb',
    borderRadius: 8,
    border: '1px solid #f0f0f0',
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
  /* Decomposition */
  decompSection: {
    marginBottom: 24,
  },
  decompHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  decompTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#393939',
  },
  decompPct: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  decompBody: {
    borderLeft: '3px solid #e5e5e5',
    paddingLeft: 16,
    marginLeft: 4,
    fontSize: 13,
    color: '#666',
    lineHeight: 1.8,
  },
  decompResult: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 4,
  },
  separator: {
    height: 3,
    background: '#46B962',
    border: 'none',
    margin: '32px 0',
    borderRadius: 2,
  },
  finalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
  },
  finalLabel: {
    fontSize: 18,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#393939',
  },
  finalPrice: {
    fontSize: 32,
    fontWeight: 700,
    color: '#46B962',
    fontFamily: 'monospace',
  },
  finalRange: {
    fontSize: 13,
    color: '#949494',
    marginTop: 4,
  },
  footer: {
    textAlign: 'center',
    borderTop: '2px solid #46B962',
    paddingTop: 20,
    marginTop: 40,
    fontSize: 12,
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
};

export default function AvisValeurDoc() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: #fff !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div style={s.page}>
        {/* Header */}
        <header style={s.header}>
          <p style={s.logo}>ideeri</p>
          <h1 style={s.title}>Avis de Valeur</h1>
          <p style={s.subtitle}>
            Date : 31 mars 2026 &nbsp;|&nbsp; R&eacute;f&eacute;rence : {property.reference}
          </p>
        </header>

        {/* 1. Informations g&eacute;n&eacute;rales du bien */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={s.sectionTitle}>Bien estim&eacute;</h2>
          <div style={s.card}>
            <div style={{ marginBottom: 12 }}>
              <span style={s.label}>Adresse</span>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{property.adresse}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={s.label}>Description</span>
              <div style={s.value}>
                Appartement T{property.pieces}, {property.surface} m&sup2;, &Eacute;tage {property.etage}/6, DPE {property.dpe}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {property.tags.map((t) => (
                <span key={t} style={s.tag}>{t}</span>
              ))}
            </div>
            <div style={s.infoGrid}>
              <div style={s.infoItem}>
                <div style={s.label}>Surface Carrez</div>
                <div style={s.value}>{property.surface} m&sup2;</div>
              </div>
              <div style={s.infoItem}>
                <div style={s.label}>Pi&egrave;ces / Chambres</div>
                <div style={s.value}>{property.pieces} pi&egrave;ces / {property.chambres} chambres</div>
              </div>
              <div style={s.infoItem}>
                <div style={s.label}>Ann&eacute;e de construction</div>
                <div style={s.value}>{property.annee}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#949494' }}>
              Collaborateur : <strong style={{ color: '#393939' }}>{property.collaborateur}</strong>
            </div>
          </div>
        </section>

        {/* 2. Avis de valeur - D&eacute;composition */}
        <section style={{ marginBottom: 32 }} className="page-break">
          <h2 style={s.sectionTitle}>Avis de valeur</h2>
          <div style={s.card}>
            {/* 1. Prix m&eacute;dian comparables */}
            <div style={s.decompSection}>
              <div style={s.decompHeader}>
                <div style={s.decompTitle}>1. Prix m&eacute;dian comparables</div>
                <div style={{ ...s.decompPct, color: '#393939' }}>4 172 &euro;/m&sup2;</div>
              </div>
              <div style={s.decompBody}>
                &times; {property.surface}m&sup2; = {Math.round(4172 * property.surface).toLocaleString('fr-FR')} &euro;
              </div>
            </div>

            {/* 2. Impact tension march&eacute; */}
            <div style={s.decompSection}>
              <div style={s.decompHeader}>
                <div style={s.decompTitle}>2. Impact tension march&eacute;</div>
                <div style={{ ...s.decompPct, color: '#46B962' }}>+0.7%</div>
              </div>
              <div style={s.decompBody}>
                Ratio demande/offre 3.2x +0.5%<br />
                7 acqu&eacute;reurs forte compatibilit&eacute; +0.2%<br />
                <div style={{ ...s.decompResult, color: '#46B962' }}>&rarr; +2 117 &euro;</div>
              </div>
            </div>

            {/* 3. Corrections sp&eacute;cifiques */}
            <div style={s.decompSection}>
              <div style={s.decompHeader}>
                <div style={s.decompTitle}>3. Corrections sp&eacute;cifiques</div>
                <div style={{ ...s.decompPct, color: '#e74c3c' }}>&minus;1.5%</div>
              </div>
              <div style={s.decompBody}>
                DPE D (passoire thermique 2028) &minus;2.0%<br />
                Travaux copro vot&eacute;s (15k&euro;) &minus;0.5%<br />
                Balcon 5.2m&sup2; +1.0%<br />
                <div style={{ ...s.decompResult, color: '#e74c3c' }}>&rarr; &minus;4 537 &euro;</div>
              </div>
            </div>

            {/* Separator */}
            <hr style={s.separator} />

            {/* Final */}
            <div style={s.finalRow}>
              <div style={s.finalLabel}>Avis de valeur</div>
              <div>
                <div style={s.finalPrice}>300 000 &euro;</div>
                <div style={s.finalRange}>
                  Fourchette : {avisValeur.prixBas.toLocaleString('fr-FR')} &euro; &mdash; {avisValeur.prixHaut.toLocaleString('fr-FR')} &euro;
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={s.footer}>
          <p style={{ marginBottom: 4 }}>
            Ce document constitue un avis de valeur et non une expertise immobili&egrave;re au sens de la Charte de l'expertise.
          </p>
          <p>Document g&eacute;n&eacute;r&eacute; le 31 mars 2026 &mdash; Ideeri &mdash; R&eacute;f. {property.reference}</p>
          <div className="no-print" style={{ marginTop: 16 }}>
            <button style={s.btnPrimary} onClick={() => window.print()}>
              Imprimer / PDF
            </button>
            <button style={s.btnSecondary} onClick={() => navigate('/step/5')}>
              Retour &agrave; l'estimation
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
