import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const sidebarNav = [
  {
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    label: 'Agenda',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 7h14" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 1v4M12 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Mes clients',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 16c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Collaborateurs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="6.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 16c0-2.8 2.5-5 5.5-5 1.2 0 2.3.3 3.2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 16c0-2.8 1.6-5 3.5-5s5.5 2.2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Mes tâches',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5.5 9.5l2 2 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'Secteurs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1.5C5.9 1.5 3.5 4 3.5 7c0 4.5 5.5 9.5 5.5 9.5s5.5-5 5.5-9.5c0-3-2.4-5.5-5.5-5.5z" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="9" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
  },

  /* ---- Sidebar ---- */
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 220,
    background: '#4D4545',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    color: '#fff',
  },
  sidebarLogo: {
    padding: '20px 24px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  sidebarNav: {
    flex: 1,
    padding: '12px 0',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 24px',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textDecoration: 'none',
    border: 'none',
    background: 'none',
    width: '100%',
    fontFamily: 'var(--font)',
  },
  navItemActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },

  /* ---- Topbar ---- */
  topbar: {
    position: 'fixed',
    top: 0,
    left: 220,
    right: 0,
    height: 52,
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 90,
  },
  topbarLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    fontSize: 13,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#46B962',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  userName: {
    fontWeight: 600,
    color: '#393939',
    fontSize: 13,
  },
  userRole: {
    color: '#949494',
    fontSize: 11,
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #e5e5e5',
    borderRadius: 4,
    padding: '5px 12px',
    fontSize: 12,
    color: '#949494',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },

  /* ---- Main content ---- */
  mainArea: {
    marginLeft: 220,
    marginTop: 52,
    flex: 1,
    minHeight: 'calc(100vh - 52px)',
    background: '#fafafa',
  },
  mainContent: {
    padding: '24px 28px 40px',
  },
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <svg width="110" height="28" viewBox="0 0 110 28">
            <text x="0" y="22" fill="#46B962" fontFamily="Open Sans, sans-serif" fontWeight="700" fontSize="22">
              ideeri
            </text>
          </svg>
        </div>
        <nav style={styles.sidebarNav}>
          {sidebarNav.map((item) => (
            <button
              key={item.label}
              style={{
                ...styles.navItem,
                ...(item.label === 'Mes clients' ? styles.navItemActive : {}),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                const isActive = item.label === 'Mes clients';
                e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.1)' : 'transparent';
                e.currentTarget.style.color = isActive ? '#fff' : 'rgba(255,255,255,0.65)';
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          v2.4.1
        </div>
      </aside>

      {/* Topbar */}
      <header style={styles.topbar}>
        <div style={styles.topbarLogo}>
          <svg width="80" height="24" viewBox="0 0 80 24">
            <text x="0" y="19" fill="#46B962" fontFamily="Open Sans, sans-serif" fontWeight="700" fontSize="18">
              ideeri
            </text>
          </svg>
          <span style={{ color: '#e5e5e5', fontSize: 18 }}>|</span>
          <span style={{ color: '#949494', fontSize: 12, fontWeight: 500 }}>Estimation</span>
        </div>
        <div style={styles.topbarRight}>
          <div style={styles.avatar}>MM</div>
          <div>
            <div style={styles.userName}>Manon MATRAT</div>
            <div style={styles.userRole}>Administratif</div>
          </div>
          <button
            style={styles.logoutBtn}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ccc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.mainArea}>
        <div style={styles.mainContent}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
