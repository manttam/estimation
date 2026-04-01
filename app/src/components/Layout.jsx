import { Outlet, useLocation, useNavigate } from 'react-router-dom';

/* Real Ideeri logo from Figma design system */
function IdeeriLogo() {
  return (
    <svg width="40" height="32" viewBox="0 0 48.9997 39.0002" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main fan shape — white */}
      <path d="M25.9121 29.4768C25.9174 29.3605 25.9954 29.3278 26.085 29.3997C26.1112 29.4214 27.6868 30.7394 28.0088 33.512C28.0293 33.4847 29.701 31.285 33.4463 31.3889C33.4385 31.4328 32.5697 36.2676 25.6924 38.9153L25.6963 38.9993C25.6607 38.9854 25.6261 38.9693 25.5908 38.9553C25.5533 38.9695 25.5164 38.9862 25.4785 39.0002L25.4824 38.9114C18.9153 36.2572 18.0977 31.4116 18.0938 31.3879C21.6721 31.2839 23.2669 33.4897 23.2822 33.511C23.5874 30.7265 25.0996 29.4144 25.1133 29.4026C25.2013 29.3277 25.2769 29.3601 25.2822 29.4768L25.5898 36.553L25.9121 29.4768ZM36.5566 6.46313C36.5566 6.46313 39.4299 7.58767 40.835 8.38598C40.7777 8.45407 35.004 15.3479 30.46 29.9114L29.374 30.8547C29.2864 30.9293 29.2176 30.8974 29.2217 30.7795C29.2217 30.781 29.5792 19.9814 36.5566 6.46313ZM8.53027 9.28051C18.8898 18.819 21.4072 30.6018 21.4072 30.6018C21.4316 30.7159 21.3636 30.7758 21.2549 30.7356L20.1025 30.3069C14.522 17.9262 5.60891 11.514 5.58301 11.4954C6.32193 10.2248 8.53027 9.28051 8.53027 9.28051ZM16.1787 5.88989C16.214 5.95684 22.5136 17.9338 23.625 28.9133L22.6074 30.3577C22.5401 30.4528 22.4535 30.441 22.4141 30.3313C22.4133 30.3317 15.9998 12.502 11.0244 8.00122C11.0244 8.00122 12.3933 6.35801 16.1787 5.88989ZM3.95898 12.4915C16.0378 21.9927 18.8924 30.1366 18.9092 30.1848C18.9475 30.2954 18.8892 30.3522 18.7803 30.3118L17.7256 29.9202C13.9708 20.921 2.25192 13.8527 2.20996 13.8274C2.99426 12.8665 3.93387 12.5012 3.95898 12.4915ZM42.8838 9.57055C42.8858 9.57146 45.4794 10.7575 46.3389 12.6956C46.3389 12.6956 39.4369 16.64 33.543 28.7952L32.1201 28.9875C32.0707 28.9987 32.0186 28.9832 31.9834 28.9465C31.9483 28.9096 31.9342 28.8563 31.9473 28.8069C31.9473 28.8069 33.332 20.8991 42.8838 9.57055ZM19.377 5.2063C19.3885 5.20064 22.2009 3.82516 26.4609 5.02466C26.4609 5.02466 23.7735 21.7822 25.5059 27.0686L24.3857 28.2717C24.3066 28.3564 24.2212 28.3328 24.1963 28.219L19.2324 5.5061C19.2112 5.38523 19.2696 5.26433 19.377 5.2063ZM0 11.7092C0 11.7092 21.3654 -13.9336 48.8564 10.676C48.8564 10.676 49.8104 12.7238 46.7949 12.0901C46.7949 12.0901 26.3163 -9.90825 2.21582 12.4299C2.19986 12.4444 0.518166 13.9197 0 11.7092Z" fill="white"/>
      {/* Gold accent blade */}
      <path d="M2.87923 0C2.87923 0 6.84576 0.608539 8 1.41527C8 1.41527 2.27876 12.9092 1.6564 25L0.321945 23.7771C0.229649 23.6829 0.170795 23.5607 0.154499 23.4295C0.154499 23.4295 -0.976032 7.43166 2.87923 0Z" fill="#EBBC00" transform="translate(26, 5)"/>
    </svg>
  );
}

const SIDEBAR_W = 70;

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
    width: SIDEBAR_W,
    background: '#2C2420',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 100,
    color: '#fff',
  },
  sidebarLogo: {
    paddingTop: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  /* ---- Topbar ---- */
  topbar: {
    position: 'fixed',
    top: 0,
    left: SIDEBAR_W,
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
    marginLeft: SIDEBAR_W,
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
      {/* Sidebar — logo only, no navigation icons */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <IdeeriLogo />
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
