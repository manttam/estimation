import { useNavigate } from 'react-router-dom';

const steps = [
  { num: 1, label: 'Relev\u00e9 d\u2019informations' },
  { num: 2, label: 'Contexte zone' },
  { num: 3, label: 'Comparables' },
  { num: 4, label: 'Tension marché' },
  { num: 5, label: 'Avis de valeur' },
];

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '18px 0 22px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'var(--font)',
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    transition: 'background 0.2s, color 0.2s',
  },
  circleCompleted: {
    background: '#46B962',
    color: '#fff',
  },
  circleActive: {
    background: '#46B962',
    color: '#fff',
    boxShadow: '0 0 0 3px rgba(70, 185, 98, 0.2)',
  },
  circleUpcoming: {
    background: '#e5e5e5',
    color: '#949494',
  },
  label: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  labelCompleted: {
    color: '#46B962',
  },
  labelActive: {
    color: '#393939',
  },
  labelUpcoming: {
    color: '#949494',
  },
  connector: {
    flex: 1,
    height: 2,
    minWidth: 24,
    margin: '0 10px',
  },
  connectorCompleted: {
    background: '#46B962',
  },
  connectorUpcoming: {
    background: '#e5e5e5',
  },
};

const Checkmark = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 7l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Stepper({ currentStep = 1 }) {
  const navigate = useNavigate();

  return (
    <div style={styles.wrapper}>
      {steps.map((step, idx) => {
        const isCompleted = step.num < currentStep;
        const isActive = step.num === currentStep;

        const circleStyle = {
          ...styles.circle,
          ...(isCompleted ? styles.circleCompleted : isActive ? styles.circleActive : styles.circleUpcoming),
        };
        const labelStyle = {
          ...styles.label,
          ...(isCompleted ? styles.labelCompleted : isActive ? styles.labelActive : styles.labelUpcoming),
        };

        return (
          <span key={step.num} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : 'none' }}>
            <button
              style={styles.step}
              onClick={() => navigate(`/step/${step.num}`)}
              title={`Étape ${step.num}: ${step.label}`}
            >
              <span style={circleStyle}>
                {isCompleted ? <Checkmark /> : step.num}
              </span>
              <span style={labelStyle}>{step.label}</span>
            </button>

            {idx < steps.length - 1 && (
              <span
                style={{
                  ...styles.connector,
                  ...(isCompleted ? styles.connectorCompleted : styles.connectorUpcoming),
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
