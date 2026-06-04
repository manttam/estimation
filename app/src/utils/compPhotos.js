/* Photos des comparables — source unique partagée par les cartes du pool
 * (Step3Comparables) et le tiroir de détail (ComparableDrawer), pour garantir
 * la cohérence (mêmes photos affichées des deux côtés).
 *
 * On exclut DVF (les transactions DVF sont anonymisées et n'ont jamais de
 * photo associée — afficher une fausse serait trompeur, on garde le
 * placeholder cadastre/satellite ou bloc gradient). */
export const STOCK_PHOTOS_BIEN = [
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&q=70',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&q=70',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=70',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400&q=70',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=70',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=70',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=70',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=70',
  'https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=400&q=70',
  'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=400&q=70',
  'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=400&q=70',
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=400&q=70',
];

/* Renvoie la LISTE des photos à afficher pour un comparable (carrousel) :
 *  - photos réelles si dispo (Ideeri / Portail avec data)
 *  - sinon 3 photos stock déterministes par id (offsets distincts dans le
 *    pool → pas de doublon ni de flicker), sauf DVF (anonymisé → []).
 *  - DVF sans photo réelle → [] (le caller affiche le placeholder gradient). */
export function getCompPhotos(comp) {
  if (Array.isArray(comp?.photos) && comp.photos.length > 0) return comp.photos;
  if (comp?.source === 'dvf') return [];
  const s = String(comp?.id || '');
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  const n = STOCK_PHOTOS_BIEN.length;
  // 3 photos distinctes : base, base+4, base+8 (modulo) → spread dans le pool.
  return [0, 4, 8].map((off) => STOCK_PHOTOS_BIEN[(sum + off) % n]);
}
