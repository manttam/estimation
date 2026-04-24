import React from 'react';
import { calculerFiabilite } from '../utils/reliability';

/**
 * Badge visuel d'indice de fiabilité d'un comparable (V2).
 * Affiche : étoiles (5 max, demi-étoile possible) + score + label + couleur.
 *
 * @param {object} props
 * @param {object} props.comparable - comparable enrichi
 * @param {object} [props.bienRef]  - bien de référence (pour critère similarité)
 * @param {"sm"|"md"} [props.size]  - taille du badge
 */
export default function ReliabilityBadge({ comparable, bienRef, size = 'md' }) {
  const { score, label, color } = calculerFiabilite({ ...comparable, bienRef });
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.5;

  const fontSize = size === 'sm' ? 11 : 13;
  const starSize = size === 'sm' ? 12 : 14;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize,
      }}
    >
      <div style={{ display: 'flex', gap: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const full = i <= fullStars;
          const half = i === fullStars + 1 && hasHalf;
          return (
            <span
              key={i}
              style={{
                color: full || half ? color : '#e5e5e5',
                fontSize: starSize,
                lineHeight: 1,
              }}
            >
              {half ? '✮' : '★'}
            </span>
          );
        })}
      </div>
      <span style={{ color, fontWeight: 600 }}>{score.toFixed(1)}/5</span>
      <span style={{ color: '#949494' }}>— {label}</span>
    </div>
  );
}
