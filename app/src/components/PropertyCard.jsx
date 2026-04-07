import { useNavigate } from 'react-router-dom';
import { property } from '../data/propertyData';

const tabs = [
  'Dashboard',
  'Détails du projet',
  'Documents',
  'Estimation active',
  'Publication',
  'Participants',
  'Administration',
  'Notes',
  'Mandat',
];

const styles = {
  wrapper: {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginBottom: 20,
  },
  header: {
    padding: '16px 20px 0',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: '#949494',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: '#393939',
    flex: 1,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
    fontSize: 12,
    color: '#949494',
    marginBottom: 12,
    paddingLeft: 36,
  },
  metaLabel: {
    color: '#949494',
    fontWeight: 400,
  },
  metaValue: {
    color: '#393939',
    fontWeight: 600,
    marginLeft: 4,
  },
  tagsRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 36,
    marginBottom: 12,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: '#f0f0f0',
    color: '#555',
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    padding: '0 20px 14px',
  },
  dispoBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
  },
  dispoLabel: {
    color: '#949494',
    fontWeight: 500,
  },
  dispoInput: {
    border: '1px solid #e5e5e5',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
    color: '#393939',
    width: 130,
  },
  completudeBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
  },
  completudeBar: {
    width: 140,
    height: 6,
    background: '#eee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  completudeFill: {
    height: '100%',
    borderRadius: 3,
    background: '#f5a623',
  },
  completudePct: {
    fontWeight: 700,
    color: '#f5a623',
  },
  completudeDetail: {
    color: '#949494',
    fontSize: 11,
  },

  /* Tabs */
  tabBar: {
    display: 'flex',
    borderTop: '1px solid #e5e5e5',
    overflowX: 'auto',
  },
  tab: {
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 500,
    color: '#949494',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    fontFamily: 'var(--font)',
    transition: 'color 0.15s',
  },
  tabActive: {
    color: '#46B962',
    borderBottomColor: '#46B962',
    fontWeight: 600,
  },
};

export default function PropertyCard() {
  const navigate = useNavigate();

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        {/* Title row */}
        <div style={styles.topRow}>
          <button style={styles.backBtn} onClick={() => navigate('/')} title="Historique des versions">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15l-5-5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={styles.title}>{property.title}</span>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: '#f0f4ff',
              color: '#4a6cf7',
              border: '1px solid #c8d6f7',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
            onClick={() => navigate('/')}
            title="Voir l'historique des estimations"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 14A6 6 0 108 2a6 6 0 000 12z" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 8H1M3.5 3.5L2.8 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Historique
          </button>
        </div>

        {/* Meta row */}
        <div style={styles.metaRow}>
          <span>
            <span style={styles.metaLabel}>Collaborateur :</span>
            <span style={styles.metaValue}>{property.collaborateur}</span>
          </span>
          <span>
            <span style={styles.metaLabel}>Référence :</span>
            <span style={styles.metaValue}>{property.reference}</span>
          </span>
          <span>
            <span style={styles.metaLabel}>Créé le :</span>
            <span style={styles.metaValue}>{property.createdAt}</span>
          </span>
          <span>
            <span style={styles.metaLabel}>Source :</span>
            <span style={styles.metaValue}>{property.source}</span>
          </span>
        </div>

        {/* Tags */}
        <div style={styles.tagsRow}>
          {property.tags.map((tag) => (
            <span key={tag} style={styles.tag}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Disponibilité + Complétude */}
      <div style={styles.bottomRow}>
        <div style={styles.dispoBlock}>
          <span style={styles.dispoLabel}>Disponibilité :</span>
          <input
            type="date"
            defaultValue={property.disponibilite}
            style={styles.dispoInput}
          />
        </div>

        <div style={styles.completudeBlock}>
          <span style={styles.completudePct}>{property.completude.pct}%</span>
          <div style={styles.completudeBar}>
            <div style={{ ...styles.completudeFill, width: `${property.completude.pct}%` }} />
          </div>
          <span style={styles.completudeDetail}>
            {property.completude.critiques} critiques
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(tab === 'Estimation active' ? styles.tabActive : {}),
            }}
            onMouseEnter={(e) => {
              if (tab !== 'Estimation active') e.currentTarget.style.color = '#393939';
            }}
            onMouseLeave={(e) => {
              if (tab !== 'Estimation active') e.currentTarget.style.color = '#949494';
            }}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
