import React from 'react';
import { calculerFiabilite, CRITERES_FIABILITE } from '../utils/reliability';

/**
 * Badge visuel d'indice de fiabilité d'un comparable (V2).
 *
 * Affiche une suite de 10 ronds (pleins = donnée croisée, vides = manquante)
 * + compteur "N / 10" + label coloré.
 *
 * @param {object} props
 * @param {object} props.comparable - comparable enrichi avec donneesCroisees
 * @param {"sm"|"md"} [props.size]  - taille du badge (par défaut "md")
 */
export default function ReliabilityBadge({ comparable, size = 'md' }) {
  const { count, total, checks, label, color } = calculerFiabilite(comparable);
  const dotSize = size === 'sm' ? 7 : 9;
  const fontSize = size === 'sm' ? 11 : 13;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize,
        lineHeight: 1.4,
      }}
    >
      <div
        style={{ display: 'flex', gap: 3 }}
        aria-label={`${count} données croisées sur ${total}`}
      >
        {checks.map((ok, i) => (
          <span
            key={i}
            title={
              CRITERES_FIABILITE[i].label +
              (ok ? ' — vérifié' : ' — non disponible')
            }
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: ok ? color : 'transparent',
              border: ok ? `1px solid ${color}` : '1px solid #d4d4d4',
              display: 'inline-block',
            }}
          />
        ))}
      </div>
      <span style={{ color, fontWeight: 600 }}>
        {count} / {total}
      </span>
      <span style={{ color: '#949494' }}>données croisées · {label}</span>
    </div>
  );
}
