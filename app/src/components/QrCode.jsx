import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * QrCode — QR code rendu en SVG, généré localement.
 *
 * Pas de service externe : une image appelée chez un tiers ferait fuiter
 * l'URL, ne s'afficherait pas hors ligne et laisserait un trou dans le PDF
 * le jour où le service tombe. `qrcode-generator` est sans dépendance et
 * synchrone, donc le code est là dès le premier rendu — ce qui compte pour
 * un document qu'on imprime aussitôt.
 *
 * Les modules sont dessinés en <rect> React plutôt qu'injectés en HTML :
 * on garde la main sur les couleurs, et rien n'est injecté dans le DOM.
 *
 * @param {string} value        contenu encodé (une URL, ici)
 * @param {number} [taille]     côté du rendu en pixels
 * @param {string} [couleur]    couleur des modules
 * @param {string} [fond]       couleur du fond
 * @param {'L'|'M'|'Q'|'H'} [correction] niveau de correction d'erreur
 */
export default function QrCode({
  value,
  taille = 96,
  couleur = '#1A1A1A',
  fond = '#ffffff',
  correction = 'M',
}) {
  const modules = useMemo(() => {
    if (!value) return null;
    try {
      // Type 0 = version choisie automatiquement selon la longueur du contenu.
      const qr = qrcode(0, correction);
      qr.addData(String(value));
      qr.make();
      const n = qr.getModuleCount();
      const cases = [];
      for (let ligne = 0; ligne < n; ligne += 1) {
        for (let col = 0; col < n; col += 1) {
          if (qr.isDark(ligne, col)) cases.push([col, ligne]);
        }
      }
      return { n, cases };
    } catch {
      // Contenu trop long pour le niveau de correction demandé : on n'affiche
      // pas de QR plutôt qu'un carré illisible.
      return null;
    }
  }, [value, correction]);

  if (!modules) return null;

  // Marge de 2 modules : la « zone de silence » exigée par la norme, sans
  // laquelle beaucoup de lecteurs échouent.
  const marge = 2;
  const cote = modules.n + marge * 2;

  return (
    <svg
      width={taille}
      height={taille}
      viewBox={`0 0 ${cote} ${cote}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code vers ${value}`}
    >
      <rect width={cote} height={cote} fill={fond} />
      {modules.cases.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + marge} y={y + marge} width="1" height="1" fill={couleur} />
      ))}
    </svg>
  );
}
