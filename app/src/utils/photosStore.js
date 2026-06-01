/**
 * photosStore : stockage des photos uploadees pour le bien actif.
 *
 * Utilise IndexedDB pour la persistance entre rechargements.
 * Chaque photo est stockee comme Blob (compresse en amont via imageCompress).
 *
 * Structure d'une entree :
 * {
 *   id: string,         // uuid v4
 *   type: string,       // salon, cuisine, chambre, sdb, wc, bureau, exterieur, autre
 *   label: string,      // ex: "Vue jardin"
 *   blob: Blob,         // image compressee
 *   filename: string,   // nom de fichier original (pour reference)
 *   order: number,      // ordre dans le carrousel (auto-increment)
 *   createdAt: number,  // Date.now()
 * }
 */

const DB_NAME = 'ideeri-photos';
const DB_VERSION = 1;
const STORE = 'photos';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error || new Error('IndexedDB open error'));
  });
  return dbPromise;
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback simple
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Detecte le type photo a partir du nom de fichier (prefix avant le tiret).
 */
const ALLOWED_TYPES = ['salon', 'cuisine', 'chambre', 'sdb', 'wc', 'bureau', 'exterieur', 'autre'];

export function detectTypeFromFilename(filename) {
  if (!filename) return 'autre';
  const lower = filename.toLowerCase();
  for (const t of ALLOWED_TYPES) {
    if (lower.startsWith(t + '-') || lower.startsWith(t + '_') || lower.startsWith(t + '.')) {
      return t;
    }
  }
  return 'autre';
}

/**
 * Genere un label par defaut a partir du nom de fichier.
 * salon-01-vue-cheminee.jpg -> "Vue Cheminee"
 * cuisine.jpg -> "Cuisine"
 */
export function deriveLabelFromFilename(filename, type) {
  if (!filename) return '';
  const base = filename.replace(/\.[^.]+$/, ''); // retire extension
  const parts = base.split(/[-_]/).filter(Boolean);
  // si premiere partie = type, on la retire
  if (parts.length > 0 && parts[0].toLowerCase() === type) parts.shift();
  // si deuxieme partie = num (01, 02...), on la retire
  if (parts.length > 0 && /^\d{1,3}$/.test(parts[0])) parts.shift();
  if (parts.length === 0) {
    // fallback : on capitalise le type
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Ajoute une ou plusieurs photos. Renvoie le tableau des entrees creees.
 *
 * photos: Array<{ blob, filename?, type?, label?, order? }>
 */
export async function addPhotos(photos) {
  const db = await openDB();
  // Recupere l'ordre max actuel pour auto-incrementer
  const existing = await getAllPhotos();
  let nextOrder = existing.reduce((m, p) => Math.max(m, p.order || 0), 0);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const created = [];
    const now = Date.now();

    photos.forEach((p, idx) => {
      const filename = p.filename || `photo-${idx + 1}.jpg`;
      const type = p.type || detectTypeFromFilename(filename);
      const label = p.label || deriveLabelFromFilename(filename, type);
      nextOrder += 1;
      const entry = {
        id: genId(),
        type,
        label,
        blob: p.blob,
        filename,
        order: p.order != null ? p.order : nextOrder,
        createdAt: now + idx, // pour preserver l'ordre d'ajout
      };
      store.add(entry);
      created.push(entry);
    });

    tx.oncomplete = () => resolve(created);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Recupere toutes les photos triees par order asc.
 */
export async function getAllPhotos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const arr = (req.result || []).slice().sort((a, b) => {
        const oa = a.order || 0;
        const ob = b.order || 0;
        if (oa !== ob) return oa - ob;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Supprime une photo par id.
 */
export async function deletePhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Vide totalement le store (utile en debug ou en "reset bien actif").
 */
export async function clearAllPhotos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Met a jour un champ d'une photo (label, type, order). Le blob n'est pas modifie.
 */
export async function updatePhoto(id, patch) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const cur = getReq.result;
      if (!cur) {
        resolve(null);
        return;
      }
      const updated = { ...cur, ...patch, id: cur.id };
      store.put(updated);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Helper : transforme la liste IDB en objets compatibles avec le carrousel
 * de Step1 (meme shape que CUSTOM_PHOTOS / PROPERTY_PHOTOS).
 *
 * Renvoie : [{ id, src, type, label, order }]
 *
 * Important : les `src` sont des object URLs - l'appelant doit les revoker
 * via revokePhotoUrls() au demontage du composant pour eviter les fuites.
 */
export async function getPhotosForCarousel() {
  const photos = await getAllPhotos();
  return photos.map((p) => ({
    id: p.id,
    src: URL.createObjectURL(p.blob),
    type: p.type,
    label: p.label,
    order: p.order || 0,
    filename: p.filename,
  }));
}

/**
 * Revoke tous les object URLs d'un tableau de photos (issu de getPhotosForCarousel).
 */
export function revokePhotoUrls(photos) {
  if (!photos) return;
  photos.forEach((p) => {
    if (p && p.src && p.src.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(p.src);
      } catch {
        // ignore
      }
    }
  });
}
