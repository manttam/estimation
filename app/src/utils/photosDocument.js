/**
 * Sélection des photos affichées dans les documents remis au mandant.
 *
 * Source unique partagée par le compte rendu et l'avis de valeur : les deux
 * documents portent le même bien, ils doivent en montrer les mêmes photos,
 * dans le même ordre.
 */

/* Ordre de préférence : une pièce de vie en photo principale, puis les pièces
 * les plus parlantes pour un acquéreur. */
const PHOTO_PRIORITY = ['salon', 'cuisine', 'chambre', 'sdb', 'exterieur', 'autre'];

/**
 * Retient au plus `max` photos : un représentant par type dans l'ordre de
 * priorité, puis complète avec ce qui reste.
 *
 * @param {Array<{id?, type?, label?, url?}>} photos
 * @param {number} [max]
 */
export function pickDocumentPhotos(photos, max = 5) {
  if (!photos || !photos.length) return [];
  const remaining = [...photos];
  const picked = [];
  for (const type of PHOTO_PRIORITY) {
    const i = remaining.findIndex((p) => p.type === type);
    if (i !== -1) picked.push(...remaining.splice(i, 1));
    if (picked.length >= max) return picked.slice(0, max);
  }
  return [...picked, ...remaining].slice(0, max);
}
