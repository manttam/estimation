/**
 * Active bien : bien actuellement en cours d'estimation.
 *
 * Sauvegarde en localStorage (persistant entre les Steps et entre rechargements
 * de la page) pour que tout le flow Step1 -> Step5 + PropertyCard travaille
 * sur le meme bien saisi par l'utilisateur depuis /nouveau-bien.
 *
 * Si aucun bien actif n'est saisi, les pages retombent sur la donnee fictive
 * exportee dans data/propertyData.js (12 rue des Lilas).
 */

const STORAGE_KEY = 'ideeri_active_bien';

/**
 * Sauvegarde le bien actif (toutes les donnees saisies + resultat d'estimation).
 *
 * Structure attendue :
 * {
 *   adresse: { label, postcode, city, citycode, coords },
 *   bien:    { type, surface, pieces, chambres, etage, ascenseur, annee,
 *              etat, exposition, parking, exterieur },
 *   result:  { prix, prixBas, prixHaut, prixM2, prixM2Base, coef, breakdown },
 *   dvfStats: { median, moyenne, ... } | null,
 *   dvfTopComparables: [...],
 *   createdAt: ISO string
 * }
 */
export function setActiveBien(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('[activeBien] setActiveBien error', err);
  }
}

/**
 * Recupere le bien actif, ou null si rien n'est stocke.
 */
export function getActiveBien() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[activeBien] getActiveBien error', err);
    return null;
  }
}

/**
 * Supprime le bien actif (retour au mode demo / 12 rue des Lilas).
 */
export function clearActiveBien() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[activeBien] clearActiveBien error', err);
  }
}

/**
 * Helper : derive un objet "property" compatible avec PropertyCard
 * a partir du bien actif. Renvoie null si aucun bien actif.
 *
 * @returns {{
 *   title, reference, collaborateur, createdAt, source, tags,
 *   disponibilite, completude, adresse, lat, lng, surface, pieces,
 *   chambres, etage, dpe, annee, prix_m2_estime
 * } | null}
 */
export function getActiveBienAsProperty() {
  const a = getActiveBien();
  if (!a || !a.adresse || !a.bien) return null;

  const b = a.bien;
  const adr = a.adresse;
  const r = a.result || {};

  // Tags : type + pieces + surface + ville
  const tags = [];
  if (b.type) tags.push(b.type === 'appartement' ? 'Appartement' : 'Maison');
  if (b.pieces) tags.push(`${b.pieces} pi\u00e8ces`);
  if (b.surface) tags.push(`${b.surface} m\u00b2`);
  if (adr.city) tags.push(adr.city);

  const refDate = a.createdAt ? new Date(a.createdAt) : new Date();
  const ref = `IDR-${refDate.getFullYear()}-${(Math.floor(Math.random() * 90000) + 10000)}`;

  // Date au format "25 Mars 2026"
  const months = ['Janvier', 'F\u00e9vrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Ao\u00fbt', 'Septembre', 'Octobre', 'Novembre', 'D\u00e9cembre'];
  const formattedDate = `${refDate.getDate()} ${months[refDate.getMonth()]} ${refDate.getFullYear()}`;

  // Title : "Vente Appartement T3 a Lyon 3eme"
  const typeLabel = b.type === 'maison' ? 'Maison' : 'Appartement';
  const tLabel = b.pieces ? `T${b.pieces}` : '';
  const cityLabel = adr.city ? `\u00e0 ${adr.city}` : '';
  const title = `Vente ${typeLabel} ${tLabel} ${cityLabel}`.replace(/\s+/g, ' ').trim();

  return {
    title,
    reference: ref,
    collaborateur: 'Marie Dupont',
    createdAt: formattedDate,
    source: 'Ideeri',
    tags,
    disponibilite: '',
    completude: { pct: 100, critiques: '19/19', importants: '50/50' },
    adresse: adr.label || '',
    lat: adr.coords ? adr.coords[0] : null,
    lng: adr.coords ? adr.coords[1] : null,
    surface: b.surface || 0,
    pieces: b.pieces || 0,
    chambres: b.chambres || 0,
    etage: b.etage != null ? b.etage : null,
    dpe: '-',
    annee: b.annee || null,
    prix_m2_estime: r.prixM2 || 0,
  };
}

// ============================================================================
// Mappings : convertir les valeurs internes (CreationBien) en libelles UI
// (ceux affiches dans les <select> de bienCibleCategories).
// ============================================================================

const TYPE_TO_LABEL = {
  appartement: 'Appartement',
  maison: 'Maison individuelle',
};

const EXPOSITION_TO_LABEL = {
  sud: 'Sud',
  sud_est: 'Sud-Est',
  sud_ouest: 'Sud-Ouest',
  est: 'Est',
  ouest: 'Ouest',
  nord_est: 'Nord-Est',
  nord_ouest: 'Nord-Ouest',
  nord: 'Nord',
};

function etageToLabel(e) {
  if (e == null || e === '') return null;
  const n = parseInt(e, 10);
  if (Number.isNaN(n)) return null;
  if (n === 0) return 'Rez-de-chauss\u00e9e';
  if (n === 1) return '1er \u00e9tage';
  if (n >= 7) return '7\u00e8me \u00e9tage et +';
  return `${n}\u00e8me \u00e9tage`;
}

function anneeToEpoque(a) {
  if (!a) return null;
  if (a < 1850) return 'Avant 1850';
  if (a < 1948) return '1850-1948';
  if (a < 1975) return '1948-1975';
  if (a < 2000) return '1975-2000';
  return 'Post-2000';
}

/**
 * Helper : trouve un field par label dans une categorie et override sa value.
 * Mute la categorie pour eviter une recopie complete couteuse.
 */
function setField(category, label, newValue, opts = {}) {
  const f = category.fields.find((x) => x.label === label);
  if (!f) return;
  if (newValue !== undefined && newValue !== null && newValue !== '') {
    f.value = String(newValue);
    if (opts.clearError) delete f.error;
  }
}

function setToggle(category, label, on) {
  const f = category.fields.find((x) => x.label === label);
  if (!f) return;
  f.on = !!on;
}

/**
 * Reconstruit bienCibleCategories en injectant les valeurs du bien actif.
 *
 * - base : tableau statique exporte par data/propertyData.js
 * - active : bien actif (resultat de getActiveBien()), peut etre null
 *
 * Si active est null, renvoie une COPIE du base (sans modifications).
 * Sinon, override les champs connus (adresse, type, surface, pieces, etage,
 * orientation, ascenseur, exterieur, parking, annee, epoque).
 *
 * Recalcule aussi le `progress` de chaque categorie en comptant les champs remplis.
 */
export function buildBienCibleCategories(base, active) {
  // Deep-clone via JSON pour ne jamais muter le module statique original.
  const cats = JSON.parse(JSON.stringify(base));
  if (!active || !active.bien || !active.adresse) {
    return cats;
  }

  const b = active.bien;
  const adr = active.adresse;

  // ---- Section 1 : Identification ----
  const sec1 = cats.find((c) => c.title === 'Identification et Statut Juridique');
  if (sec1) {
    setField(sec1, 'Adresse compl\u00e8te', adr.label);
    setField(sec1, 'Type de bien', TYPE_TO_LABEL[b.type]);
    // On vide les autres champs (lot, cadastre, servitudes) pour eviter de
    // garder les valeurs du bien demo qui n'ont rien a voir avec l'adresse saisie.
    ['R\u00e9f\u00e9rence cadastrale', 'Num\u00e9ro de lot', 'Quote-part (milli\u00e8mes)', 'Servitudes']
      .forEach((lbl) => {
        const f = sec1.fields.find((x) => x.label === lbl);
        if (f) f.value = '';
      });
  }

  // ---- Section 2 : Caracteristiques Generales ----
  const sec2 = cats.find((c) => c.title === 'Caract\u00e9ristiques G\u00e9n\u00e9rales');
  if (sec2) {
    setField(sec2, 'Surface Carrez (m\u00b2)', b.surface);
    setField(sec2, 'Nombre de pi\u00e8ces', b.pieces);
    setField(sec2, 'Nombre de chambres', b.chambres);

    const etgLabel = etageToLabel(b.etage);
    if (etgLabel) {
      const f = sec2.fields.find((x) => x.label === '\u00c9tage du bien');
      if (f) {
        f.value = etgLabel;
        // On s'assure que le label saisi est bien dans les options pour le rendu.
        if (f.options && !f.options.includes(etgLabel)) f.options.unshift(etgLabel);
      }
    }

    const expoLabel = EXPOSITION_TO_LABEL[b.exposition];
    if (expoLabel) setField(sec2, 'Orientation', expoLabel);

    setToggle(sec2, 'Ascenseur', b.ascenseur);

    // Exterieur : balcon / terrasse / jardin (m2 = on connait pas, on met juste 1
    // pour signaler la presence ; l'utilisateur ajustera).
    const balcon = sec2.fields.find((x) => x.label === 'Balcon (m\u00b2)');
    const terrasse = sec2.fields.find((x) => x.label === 'Terrasse (m\u00b2)');
    const jardin = sec2.fields.find((x) => x.label === 'Jardin privatif (m\u00b2)');
    if (balcon) balcon.value = b.exterieur === 'balcon' ? '1' : '0';
    if (terrasse) terrasse.value = b.exterieur === 'terrasse' ? '1' : '0';
    if (jardin) jardin.value = b.exterieur === 'jardin' ? '1' : '0';

    // Parking
    const garage = sec2.fields.find((x) => x.label === 'Garage / Box ferm\u00e9');
    if (garage) {
      garage.value = b.parking === 'box' ? '1' : '0';
      delete garage.error;
    }
    setToggle(sec2, 'Parking ext\u00e9rieur', b.parking === 'place');
  }

  // ---- Section 3 : Structure et Gros Oeuvre (annee + epoque) ----
  const sec3 = cats.find((c) => c.title === 'Structure et Gros \u0152uvre');
  if (sec3 && b.annee) {
    setField(sec3, 'Ann\u00e9e de construction', b.annee);
    const epoque = anneeToEpoque(b.annee);
    if (epoque) setField(sec3, '\u00c9poque de construction', epoque);
  }

  // ---- Recalcul du progress de chaque categorie ----
  cats.forEach((cat) => {
    const total = cat.fields.length;
    const filled = cat.fields.filter((f) => {
      if (f.type === 'toggle') return true; // toggle = toujours un etat (on/off)
      return f.value !== undefined && f.value !== null && f.value !== '';
    }).length;
    cat.progress = `${filled}/${total}`;
    cat.low = filled / total < 0.4;
  });

  return cats;
}
