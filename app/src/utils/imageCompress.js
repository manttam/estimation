/**
 * imageCompress : redimensionne et compresse une image cote client.
 *
 * - Ne touche pas aux EXIF (le canvas perd l'orientation EXIF, mais on la
 *   normalise en lisant naturalWidth/naturalHeight - les navigateurs modernes
 *   appliquent l'orientation par defaut).
 * - Limite la dimension la plus grande a `maxDim` (default 1600px).
 * - Re-encode en JPEG (default qualite 0.75) - bon compromis taille/qualite
 *   pour des photos immobilieres affichees dans un carrousel.
 *
 * Usage :
 *   const blob = await compressImageFile(file, { maxDim: 1600, quality: 0.75 });
 */

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.75;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Impossible de charger l'image ${file.name}`));
    };
    img.src = url;
  });
}

/**
 * Calcule les dimensions cibles en respectant le ratio.
 */
function computeTargetDims(srcW, srcH, maxDim) {
  const longest = Math.max(srcW, srcH);
  if (longest <= maxDim) return { w: srcW, h: srcH };
  const scale = maxDim / longest;
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}

/**
 * Compresse un fichier image et renvoie un Blob JPEG.
 * Si le fichier d'origine est deja petit (< maxDim ET < 250 Ko en JPEG), on
 * peut le renvoyer tel quel pour ne pas perdre en qualite, sauf si le format
 * source est PNG (on convertit alors en JPEG pour gagner en place).
 *
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number, mimeType?: string }} opts
 * @returns {Promise<Blob>}
 */
export async function compressImageFile(file, opts = {}) {
  const maxDim = opts.maxDim || DEFAULT_MAX_DIM;
  const quality = opts.quality != null ? opts.quality : DEFAULT_QUALITY;
  const mimeType = opts.mimeType || 'image/jpeg';

  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Le fichier fourni n\'est pas une image');
  }

  const img = await loadImageFromFile(file);
  const { w, h } = computeTargetDims(img.naturalWidth, img.naturalHeight, maxDim);

  // Petite optim : si l'image est deja a la bonne taille ET en JPEG ET pas trop
  // lourde, on garde l'original (evite la double compression).
  if (
    w === img.naturalWidth &&
    h === img.naturalHeight &&
    file.type === 'image/jpeg' &&
    file.size <= 250 * 1024
  ) {
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponible');

  // Fond blanc pour les PNG transparents (eviter les artefacts noirs en JPEG)
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Echec de la compression image (toBlob)'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

/**
 * Compresse un lot de fichiers en parallele (Promise.all). Renvoie [{ file, blob }].
 * En cas d'erreur sur un fichier, on log et on l'exclut du resultat.
 */
export async function compressImageFiles(files, opts = {}) {
  const arr = Array.from(files || []);
  const results = await Promise.all(
    arr.map(async (file) => {
      try {
        const blob = await compressImageFile(file, opts);
        return { file, blob };
      } catch (err) {
        console.error('[imageCompress]', file.name, err);
        return { file, blob: null, error: err };
      }
    }),
  );
  return results.filter((r) => r.blob != null);
}
