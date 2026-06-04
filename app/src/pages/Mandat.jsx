import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReportState, mergeReportSection } from '../utils/reportStore';
import { getActiveBien } from '../utils/activeBien';
import PropertyCard from '../components/PropertyCard';

/* ═══════════════════════════════════════════════════════════════
 * MANDAT — Page après l'avis de valeur (Step5)
 *
 * Deux modes selon mandat.statut :
 *  - 'non_signe' / 'brouillon' → Formulaire de création (cf. captures
 *    Papiris : Informations, Définition du prix, Honoraires, Récap).
 *  - 'actif' / 'suspendu' / 'clos' → Dashboard de suivi (diffusion,
 *    visites, offres, journal).
 *
 * Persistance : reportStore.mandat (clé unique pour le bien actif).
 * ═══════════════════════════════════════════════════════════════ */

const cssStyles = `
  .mandat-page {
    font-family: var(--font, 'Open Sans', sans-serif);
    color: #1a1a1a;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ── Breadcrumb header ── */
  .mandat-breadcrumb {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .mandat-breadcrumb-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mandat-breadcrumb-link {
    color: #888;
    font-size: 13px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
  }
  .mandat-breadcrumb-link:hover { color: #46B962; text-decoration: underline; }
  .mandat-breadcrumb-sep { color: #ccc; font-size: 13px; }
  .mandat-breadcrumb-current {
    color: #1a1a1a;
    font-size: 14px;
    font-weight: 700;
  }
  /* Lien "Annuler" discret en haut à droite */
  .mandat-cancel-link {
    background: none;
    border: none;
    color: #888;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.15s;
  }
  .mandat-cancel-link:hover { color: #1a1a1a; background: #f5f5f5; }

  /* ── Status badge ── */
  .mandat-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .mandat-status-badge.non_signe { background: #fff8e1; color: #b07800; border: 1px solid #ffe082; }
  .mandat-status-badge.brouillon { background: #f0f0f5; color: #555; border: 1px solid #d8d8e0; }
  .mandat-status-badge.actif { background: #f0f8f5; color: #2d8856; border: 1px solid #d4ead8; }
  .mandat-status-badge.suspendu { background: #fff1ed; color: #c25e1c; border: 1px solid #fdd8b8; }
  .mandat-status-badge.clos { background: #f5f5f5; color: #777; border: 1px solid #e5e5e5; }
  .mandat-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  /* ── Cards de section ── */
  .mandat-card {
    background: #fff;
    border-radius: 12px;
    padding: 22px 24px;
    margin-bottom: 14px;
    border: 1px solid #eee;
  }
  .mandat-card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
  }
  .mandat-card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #f0f8f5;
    color: #2d8856;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .mandat-card-title {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
  }

  /* ── Form grid ── */
  .mandat-form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px 22px;
  }
  .mandat-form-grid.full { grid-template-columns: 1fr; }
  .mandat-form-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .mandat-form-field label {
    font-size: 11px;
    font-weight: 600;
    color: #555;
  }
  .mandat-form-field label .req { color: #e74c3c; margin-left: 2px; }
  .mandat-form-field .hint {
    font-size: 10px;
    color: #aaa;
    margin-top: 2px;
  }
  .mandat-form-field .hint.warn { color: #b07800; }
  .mandat-form-field input[type="text"],
  .mandat-form-field input[type="number"],
  .mandat-form-field input[type="date"],
  .mandat-form-field select,
  .mandat-form-field textarea {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: #1a1a1a;
    background: #fff;
    transition: border-color 0.15s;
  }
  .mandat-form-field input:focus,
  .mandat-form-field select:focus,
  .mandat-form-field textarea:focus {
    outline: none;
    border-color: #46B962;
  }
  .mandat-form-field input[disabled],
  .mandat-form-field select[disabled] {
    background: #fafafa;
    color: #888;
    cursor: not-allowed;
  }

  /* ── Radio cards (Définition du prix / Honoraires) ── */
  .mandat-radio-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .mandat-radio-card {
    position: relative;
    border: 1.5px solid #e0e0e0;
    border-radius: 10px;
    padding: 16px 18px 16px 44px;
    cursor: pointer;
    background: #fff;
    transition: all 0.15s;
    user-select: none;
    text-align: left;
  }
  .mandat-radio-card:hover { border-color: #46B962; background: #fafdfb; }
  .mandat-radio-card.active {
    border-color: #46B962;
    background: #f7fbf8;
    box-shadow: 0 0 0 3px rgba(70, 185, 98, 0.08);
  }
  .mandat-radio-card::before {
    content: '';
    position: absolute;
    top: 18px;
    left: 16px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #d0d0d0;
    background: #fff;
    box-sizing: border-box;
    transition: all 0.15s;
  }
  .mandat-radio-card.active::before {
    border-color: #46B962;
    border-width: 6px;
  }
  .mandat-radio-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 6px;
  }
  .mandat-radio-card-desc {
    font-size: 12px;
    color: #777;
    line-height: 1.45;
    margin-bottom: 12px;
  }
  .mandat-radio-card-input {
    margin-top: 6px;
  }
  .mandat-radio-card-input input,
  .mandat-radio-card-input select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    background: #fff;
  }
  .mandat-radio-card-input .row-2 {
    display: grid;
    grid-template-columns: 1fr 100px;
    gap: 8px;
  }

  /* ── Récapitulatif (bandeau bas) ── */
  .mandat-recap {
    background: linear-gradient(135deg, #f7fbf8 0%, #effaf2 100%);
    border: 1.5px solid #d4ead8;
    border-radius: 12px;
    padding: 18px 22px;
    margin: 14px 0 18px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 22px;
  }
  .mandat-recap-block {
    display: flex;
    flex-direction: column;
  }
  .mandat-recap-label {
    font-size: 10px;
    color: #6b8b7a;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 4px;
  }
  .mandat-recap-value {
    font-size: 24px;
    font-weight: 800;
    color: #1a1a1a;
    line-height: 1.1;
  }
  .mandat-recap-unit {
    font-size: 14px;
    color: #777;
    font-weight: 600;
    margin-left: 3px;
  }
  .mandat-recap-sub {
    font-size: 11px;
    color: #6b8b7a;
    margin-top: 3px;
  }

  /* ── Actions bas de formulaire ── */
  .mandat-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .mandat-actions-right {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── Suivi : KPI grid + portails + listes ── */
  .mandat-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .mandat-kpi {
    background: #fafafa;
    border-radius: 10px;
    padding: 14px 16px;
    border: 1px solid #eee;
  }
  .mandat-kpi-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 4px;
  }
  .mandat-kpi-value {
    font-size: 22px;
    font-weight: 800;
    color: #1a1a1a;
    line-height: 1;
  }
  .mandat-kpi-unit {
    font-size: 11px;
    color: #888;
    font-weight: 600;
    margin-left: 3px;
  }
  .mandat-kpi-sub {
    font-size: 11px;
    color: #888;
    margin-top: 4px;
  }
  .mandat-kpi-sub.warn { color: #c25e1c; }
  .mandat-kpi-sub.ok { color: #2d8856; }

  /* ── Boutons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1.5px solid transparent;
    background: #fff;
    color: #1a1a1a;
    font-family: inherit;
    transition: all 0.15s;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary {
    background: #46B962;
    color: #fff;
    border-color: #46B962;
  }
  .btn-primary:hover:not(:disabled) { background: #3da653; border-color: #3da653; }
  .btn-secondary {
    background: #effaf2;
    color: #2d8856;
    border-color: #c8e6cf;
  }
  .btn-secondary:hover:not(:disabled) { background: #e0f4e7; }
  .btn-ghost {
    background: transparent;
    border-color: #ddd;
    color: #555;
  }
  .btn-ghost:hover:not(:disabled) { background: #f5f5f5; border-color: #ccc; color: #1a1a1a; }
  .btn-danger {
    background: #fff;
    border-color: #f3d4d4;
    color: #c0392b;
  }
  .btn-danger:hover:not(:disabled) { background: #fef6f6; border-color: #c0392b; }
  .btn-mini { padding: 6px 12px; font-size: 12px; }
`;

/* ── SVG icons pour les en-têtes de section (style cohérent Ideeri) ── */
function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function IconEuro() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 7a7 7 0 1 0 0 10" />
      <line x1="5" y1="10" x2="14" y2="10" />
      <line x1="5" y1="14" x2="14" y2="14" />
    </svg>
  );
}
function IconBars() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="20" x2="6" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </svg>
  );
}

/* ── Liste des types de mandat (français standard immobilier) ── */
const TYPES_MANDAT = [
  { value: '', label: 'Sélectionner un type…' },
  { value: 'exclusif', label: 'Exclusif' },
  { value: 'simple', label: 'Simple' },
  { value: 'co-exclusif', label: 'Co-exclusif' },
  { value: 'semi-exclusif', label: 'Semi-exclusif' },
];

/* ── Durées d'irrévocabilité possibles (en mois) ── */
const DUREES_IRREVOCABILITE = [0, 1, 2, 3];

/* ── Barème dégressif d'honoraires (par défaut Ideeri).
 * À terme : pourrait être lu depuis reportStore.agence.bareme.
 * Calcul : on prend le pct correspondant à la tranche du prix de vente. */
const BAREME_DEFAULT = [
  { max: 100000, pct: 8 },
  { max: 200000, pct: 7 },
  { max: 300000, pct: 6 },
  { max: 500000, pct: 5 },
  { max: 800000, pct: 4 },
  { max: Infinity, pct: 3 },
];

function pctBareme(prix) {
  if (!prix || prix <= 0) return 0;
  const tier = BAREME_DEFAULT.find((t) => prix <= t.max);
  return tier ? tier.pct : BAREME_DEFAULT[BAREME_DEFAULT.length - 1].pct;
}

/* ── Calcul des honoraires en € selon le mode et le prix de vente ── */
function calculHonoraires(prixVente, honorairesMode, customMode, customValeur) {
  if (!prixVente || prixVente <= 0) return 0;
  if (honorairesMode === 'custom') {
    if (customMode === 'pourcentage') {
      return Math.round((prixVente * (Number(customValeur) || 0)) / 100);
    }
    return Math.round(Number(customValeur) || 0);
  }
  // Barème
  const pct = pctBareme(prixVente);
  return Math.round((prixVente * pct) / 100);
}

/* ── Calcul du taux effectif (%) à partir du prix de vente + honoraires ── */
function tauxEffectif(prixVente, honoraires) {
  if (!prixVente || prixVente <= 0) return 0;
  return (honoraires / prixVente) * 100;
}

/* ── Génère un numéro de mandat unique (format M-YYYY-NNNN basé sur timestamp) ── */
function genererNumeroMandat() {
  const year = new Date().getFullYear();
  // Suffix : 4 derniers chiffres du timestamp (suffisant pour démo, en prod
  // l'agence aurait son compteur incrémental persistant côté serveur).
  const suffix = String(Date.now()).slice(-4);
  return `M-${year}-${suffix}`;
}

/* ── État initial vide d'un mandat ── */
function emptyMandat() {
  const today = new Date().toISOString().slice(0, 10);
  const fin = new Date();
  fin.setMonth(fin.getMonth() + 12);
  return {
    statut: 'non_signe',
    numero: null,
    // Informations
    type: '',
    dateDebut: today,
    dateFin: fin.toISOString().slice(0, 10),
    dureeIrrevocabilite: 0,
    paiementHonoraires: 'vendeur',
    // Définition du prix
    prixMode: 'vente',
    prixVente: 0,
    prixNetVendeur: 0,
    // Honoraires
    honorairesMode: 'bareme',
    honorairesCustomMode: 'pourcentage',
    honorairesCustomValeur: 0,
    // Suivi
    dateSignature: null,
    notes: '',
  };
}

function fmtDateFr(iso) {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function joursRestants(dateFin) {
  if (!dateFin) return null;
  try {
    const fin = new Date(dateFin);
    const now = new Date();
    const ms = fin - now;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export default function Mandat() {
  const navigate = useNavigate();
  const activeBien = useMemo(() => getActiveBien(), []);

  /* Chargement initial : récupère le mandat persisté ou crée un vide.
   * Le prix de vente est pré-rempli depuis l'avis de valeur (Step5). */
  const [mandat, setMandat] = useState(() => {
    const state = getReportState();
    const persisted = (state.mandat && typeof state.mandat === 'object') ? state.mandat : null;
    if (persisted && persisted.statut) {
      // Migration : ajoute les nouveaux champs manquants, retire les
      // anciens (diffusion/visites/offres/journal) qui ont été supprimés.
      const base = emptyMandat();
      const merged = { ...base, ...persisted };
      delete merged.diffusion;
      delete merged.visites;
      delete merged.offres;
      delete merged.journal;
      return merged;
    }
    // Premier passage : pré-remplissage depuis l'avis de valeur
    const init = emptyMandat();
    if (typeof state.customPrice === 'number' && state.customPrice > 0) {
      init.prixVente = state.customPrice;
    }
    return init;
  });

  /* Persistance auto à chaque modification. */
  useEffect(() => {
    mergeReportSection('mandat', mandat);
  }, [mandat]);

  const isSigne = mandat.statut === 'actif' || mandat.statut === 'suspendu' || mandat.statut === 'clos';

  /* Helper d'update partiel. */
  const update = (patch) => setMandat((m) => ({ ...m, ...patch }));

  /* Surface du bien pour le SuiviMode (header géré par PropertyCard) */
  const bienSurface = activeBien?.surface || 72.5;
  /* Adresse du bien pour la note discrète en bas du formulaire */
  const bienTitre = activeBien?.adresse?.label
    || activeBien?.titre
    || '12 rue des Lilas, Lyon 3e';

  return (
    <div className="mandat-page">
      <style>{cssStyles}</style>

      {/* ─── Header projet : identique aux Steps de la machine à estimation
       * (PropertyCard) — onglet "Mandat" surligné en vert. ─── */}
      <PropertyCard activeTab="Mandat" />

      {/* ─── Breadcrumb secondaire : "Nouveau mandat" / "Mandat M-XXXX"
       * + badge statut + lien Annuler à droite. ─── */}
      <div className="mandat-breadcrumb">
        <div className="mandat-breadcrumb-left">
          <span className="mandat-breadcrumb-current">
            {mandat.numero ? `Mandat ${mandat.numero}` : 'Nouveau mandat'}
          </span>
          {mandat.statut !== 'non_signe' && (
            <span className={`mandat-status-badge ${mandat.statut}`} style={{ marginLeft: 10 }}>
              <span className="mandat-status-dot" />
              {mandat.statut === 'brouillon' ? 'Brouillon'
                : mandat.statut === 'actif' ? 'Actif'
                : mandat.statut === 'suspendu' ? 'Suspendu'
                : 'Clôturé'}
            </span>
          )}
        </div>
        <button
          type="button"
          className="mandat-cancel-link"
          onClick={() => navigate('/step/5')}
        >
          ← Retour à l&rsquo;étude de marché
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
       * MODE CRÉATION — Informations + Prix + Honoraires + Récap
       * ════════════════════════════════════════════════════════ */}
      {!isSigne && (
        <CreationMode
          mandat={mandat}
          bienTitre={bienTitre}
          update={update}
          setMandat={setMandat}
          navigate={navigate}
        />
      )}

      {/* ════════════════════════════════════════════════════════
       * MODE SUIVI — synthèse minimaliste après signature
       * ════════════════════════════════════════════════════════ */}
      {isSigne && (
        <SuiviMode mandat={mandat} bienSurface={bienSurface} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * CREATION MODE — formulaire de création / signature du mandat
 * ═══════════════════════════════════════════════════════════════ */
function CreationMode({ mandat, bienTitre, update, setMandat, navigate }) {

  /* Calculs en cascade selon le mode (vente / net vendeur).
   * Le prix de vente reste la "vérité" interne — il sert au barème et au
   * calcul des honoraires. Si l'utilisateur saisit le net vendeur, on
   * déduit le prix de vente (en une seule passe d'approximation).
   *
   * Note : la formule en mode "net" n'est exacte qu'en mode % du barème ;
   * pour un forfait c'est trivial (prixVente = net + forfait). */
  const { prixVenteCalc, netVendeurCalc, honorairesCalc, tauxCalc } = useMemo(() => {
    if (mandat.prixMode === 'vente') {
      const pv = Number(mandat.prixVente) || 0;
      const hono = calculHonoraires(pv, mandat.honorairesMode, mandat.honorairesCustomMode, mandat.honorairesCustomValeur);
      return {
        prixVenteCalc: pv,
        netVendeurCalc: Math.max(pv - hono, 0),
        honorairesCalc: hono,
        tauxCalc: tauxEffectif(pv, hono),
      };
    }
    // Mode "net vendeur" : on remonte vers prixVente
    const net = Number(mandat.prixNetVendeur) || 0;
    if (net <= 0) {
      return { prixVenteCalc: 0, netVendeurCalc: 0, honorairesCalc: 0, tauxCalc: 0 };
    }
    let pv;
    if (mandat.honorairesMode === 'custom' && mandat.honorairesCustomMode === 'forfait') {
      pv = net + Number(mandat.honorairesCustomValeur || 0);
    } else if (mandat.honorairesMode === 'custom') {
      const pct = Number(mandat.honorairesCustomValeur || 0);
      pv = pct >= 100 ? net : Math.round(net / (1 - pct / 100));
    } else {
      // Barème : on suppose le pct estimé sur le net (approximation), puis on raffine
      const pctEstime = pctBareme(net);
      pv = Math.round(net / (1 - pctEstime / 100));
      // Vérif : le pv calculé tombe-t-il dans la même tranche du barème ?
      // Si non, on raffine une fois.
      const pctFinal = pctBareme(pv);
      if (pctFinal !== pctEstime) {
        pv = Math.round(net / (1 - pctFinal / 100));
      }
    }
    const hono = calculHonoraires(pv, mandat.honorairesMode, mandat.honorairesCustomMode, mandat.honorairesCustomValeur);
    return {
      prixVenteCalc: pv,
      netVendeurCalc: net,
      honorairesCalc: hono,
      tauxCalc: tauxEffectif(pv, hono),
    };
  }, [mandat.prixMode, mandat.prixVente, mandat.prixNetVendeur,
      mandat.honorairesMode, mandat.honorairesCustomMode, mandat.honorairesCustomValeur]);

  /* Pré-affichage du % barème quand on est en mode barème + prix vente connu. */
  const pctBaremeAffiche = mandat.honorairesMode === 'bareme' ? pctBareme(prixVenteCalc) : 0;

  /* Validation : pour enregistrer le mandat il faut au minimum un type et
   * un prix de vente strictement positif. */
  const canEnregistrer = mandat.type && prixVenteCalc > 0;

  /* Actions */
  const handleAnnuler = () => navigate('/step/5');

  const handleSupprimer = () => {
    if (!window.confirm('Supprimer ce mandat ? Cette action est irréversible.')) return;
    setMandat({
      ...emptyMandat(),
      // Repren le prix de l'avis de valeur si dispo
      prixVente: Number(mandat.prixVente) || 0,
    });
  };

  const handleBrouillon = () => {
    setMandat((m) => ({
      ...m,
      statut: 'brouillon',
      // Snapshots des calculs au moment de la sauvegarde
      prixVente: prixVenteCalc,
      prixNetVendeur: netVendeurCalc,
    }));
  };

  const handleEnregistrerNumero = () => {
    const numero = mandat.numero || genererNumeroMandat();
    const now = new Date().toISOString();
    setMandat((m) => ({
      ...m,
      statut: 'actif',
      numero,
      dateSignature: now,
      prixVente: prixVenteCalc,
      prixNetVendeur: netVendeurCalc,
    }));
  };

  return (
    <>
      {/* ─── Section : Informations sur le mandat ─── */}
      <div className="mandat-card">
        <div className="mandat-card-head">
          <div className="mandat-card-icon"><IconInfo /></div>
          <h2 className="mandat-card-title">Informations sur le mandat</h2>
        </div>

        <div className="mandat-form-grid">
          {/* Ligne 1 : numéro de mandat (sur 2 colonnes) */}
          <div className="mandat-form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Numéro de mandat</label>
            <input
              type="text"
              value={mandat.numero || ''}
              placeholder="Le numéro n'a pas encore été généré."
              disabled
            />
          </div>

          {/* Ligne 2 : type + date début */}
          <div className="mandat-form-field">
            <label>Type de mandat<span className="req">*</span></label>
            <select
              value={mandat.type}
              onChange={(e) => update({ type: e.target.value })}
            >
              {TYPES_MANDAT.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="mandat-form-field">
            <label>Date de début de mandat<span className="req">*</span></label>
            <input
              type="date"
              value={mandat.dateDebut}
              onChange={(e) => update({ dateDebut: e.target.value })}
            />
          </div>

          {/* Ligne 3 : date fin + durée irrévocabilité */}
          <div className="mandat-form-field">
            <label>Date de fin de mandat<span className="req">*</span></label>
            <input
              type="date"
              value={mandat.dateFin}
              onChange={(e) => update({ dateFin: e.target.value })}
            />
          </div>
          <div className="mandat-form-field">
            <label>Durée en mois de l&rsquo;irrévocabilité du mandat</label>
            <select
              value={mandat.dureeIrrevocabilite}
              onChange={(e) => update({ dureeIrrevocabilite: Number(e.target.value) })}
            >
              {DUREES_IRREVOCABILITE.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="hint">Période pendant laquelle le mandat ne peut être dénoncé.</span>
          </div>

          {/* Ligne 4 : paiement honoraires (pleine largeur pour matcher la capture) */}
          <div className="mandat-form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Paiement des honoraires par<span className="req">*</span></label>
            <select
              value={mandat.paiementHonoraires}
              onChange={(e) => update({ paiementHonoraires: e.target.value })}
            >
              <option value="vendeur">Vendeur(s)</option>
              <option value="acquereur">Acquéreur(s)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Section : Définition du prix ─── */}
      <div className="mandat-card">
        <div className="mandat-card-head">
          <div className="mandat-card-icon"><IconEuro /></div>
          <h2 className="mandat-card-title">Définition du prix</h2>
        </div>

        <div className="mandat-radio-cards">
          {/* Card "Saisir le prix de vente" — input visible uniquement si active */}
          <button
            type="button"
            className={`mandat-radio-card${mandat.prixMode === 'vente' ? ' active' : ''}`}
            onClick={() => update({ prixMode: 'vente' })}
          >
            <div className="mandat-radio-card-title">Saisir le prix de vente</div>
            <div className="mandat-radio-card-desc">
              Il s&rsquo;agit du prix public qui s&rsquo;affichera sur la page du bien et sur les annonces.
              Il comprend votre commission.
            </div>
            {mandat.prixMode === 'vente' && (
              <div className="mandat-radio-card-input" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={mandat.prixVente || ''}
                  onChange={(e) => update({ prixVente: Number(e.target.value) })}
                  placeholder="0 €"
                  autoFocus
                />
              </div>
            )}
          </button>

          {/* Card "Saisir le prix net vendeur" — input visible uniquement si active */}
          <button
            type="button"
            className={`mandat-radio-card${mandat.prixMode === 'net' ? ' active' : ''}`}
            onClick={() => update({ prixMode: 'net' })}
          >
            <div className="mandat-radio-card-title">Saisir le prix net vendeur</div>
            <div className="mandat-radio-card-desc">
              Il s&rsquo;agit du prix qui reviendra au(x) vendeur(s), après le décompte
              de vos honoraires.
            </div>
            {mandat.prixMode === 'net' && (
              <div className="mandat-radio-card-input" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={mandat.prixNetVendeur || ''}
                  onChange={(e) => update({ prixNetVendeur: Number(e.target.value) })}
                  placeholder="0 €"
                  autoFocus
                />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ─── Section : Honoraires ─── */}
      <div className="mandat-card">
        <div className="mandat-card-head">
          <div className="mandat-card-icon"><IconBars /></div>
          <h2 className="mandat-card-title">Honoraires</h2>
        </div>

        <div className="mandat-radio-cards">
          {/* Card "Utiliser le barème d'honoraire" */}
          <button
            type="button"
            className={`mandat-radio-card${mandat.honorairesMode === 'bareme' ? ' active' : ''}`}
            onClick={() => update({ honorairesMode: 'bareme' })}
          >
            <div className="mandat-radio-card-title">Utiliser le barème d&rsquo;honoraires</div>
            <div className="mandat-radio-card-desc">
              Il s&rsquo;agit du barème par défaut, défini par votre agence en fonction
              du prix de vente saisi.
            </div>
            {mandat.honorairesMode === 'bareme' && prixVenteCalc > 0 && (
              <div style={{ fontSize: 12, color: '#2d8856', fontWeight: 600, marginTop: 8 }}>
                Taux applicable : {pctBaremeAffiche}% du prix de vente
              </div>
            )}
          </button>

          {/* Card "Saisir mes propres honoraires" — input visible uniquement si active */}
          <button
            type="button"
            className={`mandat-radio-card${mandat.honorairesMode === 'custom' ? ' active' : ''}`}
            onClick={() => update({ honorairesMode: 'custom' })}
          >
            <div className="mandat-radio-card-title">Saisir mes propres honoraires</div>
            <div className="mandat-radio-card-desc">
              Somme personnalisée pour faire une remise commerciale, s&rsquo;aligner sur la
              concurrence, …
            </div>
            {mandat.honorairesMode === 'custom' && (
              <div className="mandat-radio-card-input" onClick={(e) => e.stopPropagation()}>
                <div className="row-2">
                  <input
                    type="number"
                    min="0"
                    step={mandat.honorairesCustomMode === 'pourcentage' ? '0.1' : '100'}
                    value={mandat.honorairesCustomValeur || ''}
                    onChange={(e) => update({ honorairesCustomValeur: Number(e.target.value) })}
                    placeholder="0"
                    autoFocus
                  />
                  <select
                    value={mandat.honorairesCustomMode}
                    onChange={(e) => update({ honorairesCustomMode: e.target.value })}
                  >
                    <option value="pourcentage">%</option>
                    <option value="forfait">€</option>
                  </select>
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ─── Récapitulatif (calcul auto) ─── */}
      <div className="mandat-recap">
        <div className="mandat-recap-block">
          <span className="mandat-recap-label">Prix de vente</span>
          <span className="mandat-recap-value">
            {Number(prixVenteCalc).toLocaleString('fr-FR')}
            <span className="mandat-recap-unit"> €</span>
          </span>
        </div>
        <div className="mandat-recap-block">
          <span className="mandat-recap-label">Net vendeur</span>
          <span className="mandat-recap-value">
            {Number(netVendeurCalc).toLocaleString('fr-FR')}
            <span className="mandat-recap-unit"> €</span>
          </span>
        </div>
        <div className="mandat-recap-block">
          <span className="mandat-recap-label">Honoraires</span>
          <span className="mandat-recap-value">
            {Number(honorairesCalc).toLocaleString('fr-FR')}
            <span className="mandat-recap-unit"> €</span>
          </span>
          <span className="mandat-recap-sub">
            Taux : {tauxCalc > 0 ? `${tauxCalc.toFixed(2).replace('.', ',')} %` : '—'}
          </span>
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="mandat-actions">
        <button type="button" className="btn btn-ghost" onClick={handleAnnuler}>
          Annuler
        </button>
        <div className="mandat-actions-right">
          <button type="button" className="btn btn-danger" onClick={handleSupprimer}>
            🗑 Supprimer
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleBrouillon} disabled={!canEnregistrer}>
            💾 Enregistrer un brouillon
          </button>
          <button type="button" className="btn btn-primary" onClick={handleEnregistrerNumero} disabled={!canEnregistrer}>
            💾 Enregistrer et prendre un numéro
          </button>
        </div>
      </div>

      {/* Adresse du bien en discret (info contextuelle) */}
      <div style={{ marginTop: 18, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
        Bien concerné : {bienTitre}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * SUIVI MODE — résumé minimaliste après signature
 *
 * Version épurée : ne garde que la synthèse (KPI prix de vente,
 * jours restants, taux d'honoraires, statut). Pas de gestion de
 * diffusion, visites, offres, baisse de prix ni journal — ces
 * fonctionnalités vivront ailleurs (CRM / module dédié).
 * ═══════════════════════════════════════════════════════════════ */
function SuiviMode({ mandat, bienSurface }) {
  const restants = joursRestants(mandat.dateFin);
  const prixM2 = bienSurface > 0 ? Math.round(mandat.prixVente / bienSurface) : 0;
  const honoraires = calculHonoraires(
    mandat.prixVente,
    mandat.honorairesMode,
    mandat.honorairesCustomMode,
    mandat.honorairesCustomValeur,
  );
  const taux = tauxEffectif(mandat.prixVente, honoraires);

  return (
    <div className="mandat-card">
      <div className="mandat-card-head">
        <div className="mandat-card-icon">📊</div>
        <h2 className="mandat-card-title">Synthèse du mandat</h2>
      </div>
      <div className="mandat-kpi-grid">
        <div className="mandat-kpi">
          <div className="mandat-kpi-label">Prix de vente</div>
          <div className="mandat-kpi-value">
            {Number(mandat.prixVente).toLocaleString('fr-FR')}
            <span className="mandat-kpi-unit"> €</span>
          </div>
          <div className="mandat-kpi-sub">soit {prixM2.toLocaleString('fr-FR')} €/m²</div>
        </div>
        <div className="mandat-kpi">
          <div className="mandat-kpi-label">Net vendeur</div>
          <div className="mandat-kpi-value">
            {Number(mandat.prixNetVendeur).toLocaleString('fr-FR')}
            <span className="mandat-kpi-unit"> €</span>
          </div>
          <div className="mandat-kpi-sub">après honoraires</div>
        </div>
        <div className="mandat-kpi">
          <div className="mandat-kpi-label">Honoraires</div>
          <div className="mandat-kpi-value">
            {Number(honoraires).toLocaleString('fr-FR')}
            <span className="mandat-kpi-unit"> €</span>
          </div>
          <div className="mandat-kpi-sub">
            {taux > 0 ? `${taux.toFixed(2).replace('.', ',')} % du prix` : '—'}
          </div>
        </div>
        <div className="mandat-kpi">
          <div className="mandat-kpi-label">Jours restants</div>
          <div className="mandat-kpi-value">
            {restants != null ? restants : '—'}
            {restants != null && <span className="mandat-kpi-unit"> j</span>}
          </div>
          <div className={`mandat-kpi-sub ${restants != null && restants < 30 ? 'warn' : 'ok'}`}>
            fin le {fmtDateFr(mandat.dateFin)}
          </div>
        </div>
      </div>
    </div>
  );
}
