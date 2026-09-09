import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  property,
  contexteZone,
  avisValeur,
  agence,
  agent,
  mandant,
  personasAcquereurs,
} from '../data/propertyData';
import { getActiveBien } from '../utils/activeBien';
import { getAcquereurs } from '../utils/acquereursStore';
import { getPhotosForCarousel, revokePhotoUrls } from '../utils/photosStore';
import { getReportState } from '../utils/reportStore';
import {
  buildMarcheLocal,
  adresseLisible,
  STATUTS,
} from '../data/marcheLocalIdeeri';

/* ───── Marché local Ideeri ─────────────────────────────────────────────
 * Périmètre figé dans le document : le mandant doit lire un cadre stable,
 * pas les filtres que l'agent a fait bouger à l'écran en Step1.
 */
const MARCHE_LOCAL_RAYON_KM = 5;
const MARCHE_LOCAL_PERIODE_MOIS = 24;

/* Bien de démonstration (12 rue des Lilas, Lyon 3e) : centre du marché local
 * quand aucun bien n'a été saisi via /nouveau-bien. */
const DEMO_COORDS = [45.758, 4.859];
const DEMO_VILLE = 'Lyon 3e';

/* Plan de commercialisation type — utilisé tant que l'agent n'a pas posé ses
 * propres jalons dans le RdvPlanner (reportStore.rdvPlanner.jalons).
 * `jours` = décalage depuis la date d'édition du document. */
const PLAN_COMMERCIALISATION_DEFAUT = [
  {
    jours: 0,
    titre: 'Signature du mandat',
    detail: "Validation du prix de présentation, des modalités de visite et des supports de diffusion.",
  },
  {
    jours: 2,
    titre: 'Reportage photo et rédaction de l\u2019annonce',
    detail: 'Photos professionnelles, plan coté, descriptif rédigé puis validé avec vous avant publication.',
  },
  {
    jours: 4,
    titre: 'Mise en ligne et diffusion',
    detail: 'Publication sur les portails nationaux, notre site, nos réseaux sociaux et diffusion aux agences du réseau.',
  },
  {
    jours: 7,
    titre: 'Activation de notre fichier acquéreurs',
    detail: 'Appel des projets d\u2019achat déjà qualifiés dont les critères correspondent à votre bien.',
  },
  {
    jours: 21,
    titre: 'Premier point d\u2019étape',
    detail: 'Bilan des contacts et des visites réalisées, retours qualitatifs des acquéreurs, compte rendu écrit.',
  },
  {
    jours: 45,
    titre: 'Bilan à six semaines',
    detail: 'Analyse des statistiques de diffusion. Ajustement du prix ou de la stratégie si les indicateurs le justifient.',
  },
  {
    jours: 90,
    titre: 'Point trimestriel',
    detail: 'Révision complète : positionnement prix, qualité des supports, périmètre de diffusion.',
  },
];

/* Engagements de suivi affichés sous la timeline. */
const ENGAGEMENTS_COMMERCIALISATION = [
  'Un compte rendu écrit après chaque visite, sous 24 heures.',
  'Un point téléphonique programmé toutes les deux semaines.',
  'Les statistiques de diffusion (vues, contacts, visites) communiquées à chaque point d\u2019étape.',
  'Aucune visite sans acquéreur préalablement qualifié : capacité de financement vérifiée en amont.',
  'Une proposition d\u2019ajustement toujours argumentée par des faits de marché, jamais une baisse subie.',
];

/* Pluriel simple pour les libellés générés. */
const plural = (n) => (Number(n) > 1 ? 's' : '');

/* Nombre au format français (virgule décimale). Les valeurs déjà textuelles
 * ou absentes passent telles quelles. */
const fmtNb = (v) => (typeof v === 'number' ? v.toLocaleString('fr-FR') : v);

/* Distance en km, format français : « 800 m » sous le kilomètre. */
const fmtKm = (km) =>
  km < 1
    ? `${Math.round(km * 1000)} m`
    : `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

/* PRNG déterministe (mulberry32) : la trame de rues du plan doit être
 * identique d'un tirage du document à l'autre pour un même bien. */
function prngDepuis(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Palette du plan de secteur — fond sombre assumé : le plan se détache du
 * reste du document et les pastilles de prix ressortent. */
const CARTE = {
  fond: '#1c1a19',
  bloc: '#282523',
  route: '#332f2c',
  pastilleFond: '#232120',
  pastilleBord: '#413d3a',
  texte: '#ffffff',
  voie: '#8d8781',
  legende: '#9a948f',
  echelle: '#6f6a66',
  accent: '#46B962',
};

const CARTE_W = 1000;
const CARTE_H = 620;

/**
 * CarteSecteur — plan du secteur autour du bien estimé.
 *
 * Les points sont placés d'après les coordonnées réelles des biens
 * (projection équirectangulaire locale, fidèle à cette échelle). La trame de
 * rues et les îlots bâtis sont en revanche DÉCORATIFS : ils donnent la
 * lisibilité d'un plan sans prétendre reproduire la voirie réelle. C'est
 * pourquoi aucun nom n'est porté par les rues — les libellés de voie sont
 * attachés aux points, donc à la donnée.
 */
function CarteSecteur({ carte, libelleBien = 'Votre bien' }) {
  const { points = [], rayonKm = 1, seed = 1 } = carte || {};

  const CX = CARTE_W / 2;
  const CY = CARTE_H / 2;
  // Le cercle occupe presque toute la hauteur : plus le rayon est grand en
  // pixels, plus les points s'écartent et plus les étiquettes trouvent place.
  const R = 290;
  const pxParKm = R / rayonKm;
  const rnd = prngDepuis(seed);

  const fmtDistance = (km) =>
    km < 1
      ? `${Math.round(km * 1000)} M`
      : `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} KM`;

  // ── Trame de rues (décorative) ──────────────────────────────────────
  const xsRoutes = [0.16, 0.47, 0.73].map((f) => Math.round(CARTE_W * f + (rnd() - 0.5) * 40));
  const ysRoutes = [0.2, 0.45, 0.7].map((f) => Math.round(CARTE_H * f + (rnd() - 0.5) * 30));

  // ── Îlots bâtis : on pave chaque cellule délimitée par les rues ─────
  const blocs = [];
  const bordsX = [0, ...xsRoutes, CARTE_W];
  const bordsY = [0, ...ysRoutes, CARTE_H];
  const MARGE = 17;
  for (let i = 0; i < bordsX.length - 1; i += 1) {
    for (let j = 0; j < bordsY.length - 1; j += 1) {
      const x0 = bordsX[i] + (i === 0 ? 12 : MARGE);
      const x1 = bordsX[i + 1] - (i === bordsX.length - 2 ? 12 : MARGE);
      const y0 = bordsY[j] + (j === 0 ? 12 : MARGE);
      const y1 = bordsY[j + 1] - (j === bordsY.length - 2 ? 12 : MARGE);
      const pasX = 47;
      const pasY = 42;
      const cols = Math.floor((x1 - x0 + 9) / pasX);
      const rows = Math.floor((y1 - y0 + 9) / pasY);
      for (let c = 0; c < cols; c += 1) {
        for (let l = 0; l < rows; l += 1) {
          // Dents creuses : un tissu urbain parfaitement régulier fait faux.
          if (rnd() < 0.16) continue;
          blocs.push({
            x: x0 + c * pasX,
            y: y0 + l * pasY,
            w: 38 + Math.round(rnd() * 6),
            h: 30 + Math.round(rnd() * 5),
          });
        }
      }
    }
  }

  // ── Points : projection km → pixels ─────────────────────────────────
  const pts = points.map((pt) => ({
    ...pt,
    cx: CX + pt.dxKm * pxParKm,
    cy: CY - pt.dyKm * pxParKm,
  }));

  /* ── Placement des étiquettes ──────────────────────────────────────
   * Glouton : on essaie une série d'ancrages autour du point et on retient
   * le premier qui ne chevauche rien. Une étiquette qui ne trouve pas de
   * place est simplement omise — mieux vaut un point nu qu'un plan illisible.
   */
  // Emprise réservée au marqueur du bien : l'épingle monte au-dessus du point,
  // sa pointe seule occupe l'emplacement exact — les biens très proches du
  // bien estimé restent ainsi visibles.
  const occupes = [
    { x: CX - 78, y: CY - 112, w: 156, h: 124 },
    // Libellé « RAYON … », désormais à l'intérieur du cercle.
    { x: CX + 8, y: CY - R + 12, w: 190, h: 26 },
  ];
  const libre = (b) =>
    b.x >= 12 &&
    b.y >= 12 &&
    b.x + b.w <= CARTE_W - 12 &&
    b.y + b.h <= CARTE_H - 12 &&
    !occupes.some(
      (o) =>
        b.x < o.x + o.w + 6 &&
        b.x + b.w + 6 > o.x &&
        b.y < o.y + o.h + 6 &&
        b.y + b.h + 6 > o.y
    );
  const placer = (cx, cy, w, h, ancrages) => {
    for (const [dx, dy] of ancrages) {
      const b = { x: cx + dx - w / 2, y: cy + dy - h / 2, w, h };
      if (libre(b)) {
        occupes.push(b);
        return b;
      }
    }
    return null;
  };

  // Deux ventes sur la même voie donneraient deux libellés identiques côte à
  // côte : ça se lit comme un bug. On ne nomme la voie qu'une fois.
  const voiesNommees = new Set();

  const etiquettes = pts.map((pt) => {
    if (!pt.labellise) return { ...pt, pastille: null, voieBoite: null };

    const texte = `${(pt.prixM2 || 0).toLocaleString('fr-FR')} €/m²`;
    const w = texte.length * 8.4 + 22;
    const pastille = placer(pt.cx, pt.cy, w, 30, [
      [0, -32], [0, 34], [-w / 2 - 22, 0], [w / 2 + 22, 0],
      [0, -66], [0, 68], [-w / 2 - 22, -36], [w / 2 + 22, -36],
    ]);

    // Nom de voie : accroché à la pastille (elle a déjà trouvé sa place, donc
    // le dessous est presque toujours libre) et, à défaut, autour du point.
    const voieTexte = voiesNommees.has(pt.voie) ? '' : pt.voie || '';
    if (voieTexte) voiesNommees.add(voieTexte);
    const wv = voieTexte.length * 6.1 + 8;
    let voieBoite = null;
    if (voieTexte && pastille) {
      voieBoite = placer(pastille.x + pastille.w / 2, pastille.y + pastille.h / 2, wv, 17, [
        [0, 24], [0, -24],
      ]);
    }
    if (voieTexte && !voieBoite) {
      voieBoite = placer(pt.cx, pt.cy, wv, 17, [
        [wv / 2 + 16, 5], [-wv / 2 - 16, 5], [0, 28], [0, -28],
      ]);
    }

    return { ...pt, texte, pastille, voieTexte, voieBoite };
  });

  // ── Échelle : on cherche une distance ronde qui tienne en 90–210 px ──
  const PALIERS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5];
  const dEchelle =
    PALIERS.find((d) => d * pxParKm >= 90 && d * pxParKm <= 210) ||
    PALIERS.reduce(
      (best, d) => (Math.abs(d * pxParKm - 140) < Math.abs(best * pxParKm - 140) ? d : best),
      PALIERS[0]
    );
  const largeurEchelle = Math.round(dEchelle * pxParKm);
  const labelEchelle =
    dEchelle < 1
      ? `${Math.round(dEchelle * 1000)} m`
      : `${dEchelle.toLocaleString('fr-FR')} km`;

  return (
    <svg
      className="carte-svg"
      viewBox={`0 0 ${CARTE_W} ${CARTE_H}`}
      role="img"
      aria-label={`Plan du secteur : ${pts.length} biens situés dans un rayon de ${fmtDistance(rayonKm).toLowerCase()} autour du bien estimé.`}
    >
      <rect x="0" y="0" width={CARTE_W} height={CARTE_H} rx="10" fill={CARTE.fond} />

      {/* Îlots bâtis (décoratifs) */}
      <g>
        {blocs.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="3" fill={CARTE.bloc} />
        ))}
      </g>

      {/* Rues (décoratives, volontairement sans nom) */}
      <g stroke={CARTE.route} strokeWidth="15" strokeLinecap="square">
        {ysRoutes.map((y, i) => (
          <line key={`h${i}`} x1="0" y1={y} x2={CARTE_W} y2={y} />
        ))}
        {xsRoutes.map((x, i) => (
          <line key={`v${i}`} x1={x} y1="0" x2={x} y2={CARTE_H} />
        ))}
      </g>

      {/* Périmètre analysé */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke={CARTE.accent}
        strokeWidth="1.5"
        strokeDasharray="7 7"
        opacity="0.5"
      />
      <text
        x={CX + 14}
        y={CY - R + 30}
        fill={CARTE.accent}
        fontSize="15"
        letterSpacing="2.5"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {`RAYON ${fmtDistance(rayonKm)}`}
      </text>

      {/* Biens du secteur */}
      {etiquettes.map((pt) => (
        <g key={pt.id}>
          <circle
            cx={pt.cx}
            cy={pt.cy}
            r={pt.labellise ? 10 : 8}
            fill={STATUTS[pt.statut]?.color || CARTE.accent}
            stroke={pt.mine ? '#ffffff' : CARTE.fond}
            strokeWidth={pt.mine ? 2.5 : 2}
          />
          {pt.voieBoite && (
            <text
              x={pt.voieBoite.x + pt.voieBoite.w / 2}
              y={pt.voieBoite.y + 13}
              textAnchor="middle"
              fill={CARTE.voie}
              fontSize="12.5"
            >
              {pt.voieTexte}
            </text>
          )}
          {pt.pastille && (
            <g>
              <rect
                x={pt.pastille.x}
                y={pt.pastille.y}
                width={pt.pastille.w}
                height={pt.pastille.h}
                rx="7"
                fill={CARTE.pastilleFond}
                stroke={CARTE.pastilleBord}
                strokeWidth="1"
              />
              <text
                x={pt.pastille.x + pt.pastille.w / 2}
                y={pt.pastille.y + 20}
                textAnchor="middle"
                fill={CARTE.texte}
                fontSize="15"
                fontWeight="700"
              >
                {pt.texte}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Marqueur du bien estimé — dessiné en dernier pour rester au-dessus */}
      <g>
        <line x1={CX} y1={CY - 6} x2={CX} y2={CY - 26} stroke={CARTE.accent} strokeWidth="2.5" />
        <rect x={CX - 23} y={CY - 71} width="46" height="46" rx="12" fill={CARTE.accent} />
        <path
          d="M12 3.4 20.6 10.2 20.6 20.4 3.4 20.4 3.4 10.2 Z"
          fill="#102a17"
          transform={`translate(${CX - 12}, ${CY - 60})`}
        />
        <rect x={CX - 74} y={CY - 108} width="148" height="31" rx="7" fill={CARTE.accent} />
        <text
          x={CX}
          y={CY - 87}
          textAnchor="middle"
          fill="#102a17"
          fontSize="15"
          fontWeight="700"
        >
          {libelleBien}
        </text>
        {/* Pointe : l'emplacement exact du bien */}
        <circle cx={CX} cy={CY} r="5.5" fill={CARTE.accent} stroke={CARTE.fond} strokeWidth="2" />
      </g>

      {/* Légende */}
      <g>
        {['vendu', 'compromis', 'en_vente'].map((k, i) => (
          <g key={k} transform={`translate(30, ${CARTE_H - 76 + i * 23})`}>
            <circle cx="7" cy="0" r="6.5" fill={STATUTS[k].color} />
            <text x="22" y="5" fill={CARTE.legende} fontSize="13">
              {STATUTS[k].label}
            </text>
          </g>
        ))}
      </g>

      {/* Échelle */}
      <g>
        <text
          x={CARTE_W - 30}
          y={CARTE_H - 44}
          textAnchor="end"
          fill={CARTE.echelle}
          fontSize="13"
        >
          {labelEchelle}
        </text>
        <g stroke={CARTE.echelle} strokeWidth="2">
          <line
            x1={CARTE_W - 30 - largeurEchelle}
            y1={CARTE_H - 32}
            x2={CARTE_W - 30}
            y2={CARTE_H - 32}
          />
          <line
            x1={CARTE_W - 30 - largeurEchelle}
            y1={CARTE_H - 38}
            x2={CARTE_W - 30 - largeurEchelle}
            y2={CARTE_H - 26}
          />
          <line x1={CARTE_W - 30} y1={CARTE_H - 38} x2={CARTE_W - 30} y2={CARTE_H - 26} />
        </g>
      </g>
    </svg>
  );
}

/**
 * CompteRendu — V2
 *
 * Document commercial d'avis de valeur remis au mandant.
 * 12 sections, personnalisation agence via variables CSS --primary / --secondary,
 * comparables enrichis avec indice de fiabilité, cascade V2 (sans ajustement zone).
 *
 * Mode ?print=1 → masque les boutons d'action pour rendu PDF serverless (Puppeteer).
 */
export default function CompteRendu() {
  const navigate = useNavigate();

  /* ───── Mode live : bien actif + acquéreurs réels ─────
   * En mode live (un bien a été saisi via /nouveau-bien), on dérive toutes
   * les sections depuis activeBien / getAcquereurs / IndexedDB photos.
   * En mode démo (aucun bien actif), on garde les mocks 12 rue des Lilas.
   */
  const activeBien = useMemo(() => getActiveBien(), []);
  const isLive = !!(activeBien?.adresse?.label);
  const realAcquereurs = useMemo(() => (isLive ? getAcquereurs() : []), [isLive]);

  // État persisté par Step3/Step5 (points forts/vigilance édités, prix retenu,
  // stratégie sélectionnée, comparables sélectionnés en Top 3).
  const reportState = useMemo(() => (isLive ? getReportState() : {}), [isLive]);

  // Photos IndexedDB (mode live uniquement) : chargement async + revoke au démontage
  const [livePhotos, setLivePhotos] = useState([]);
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const photos = await getPhotosForCarousel();
        if (!cancelled) setLivePhotos(photos || []);
      } catch (err) {
        console.warn('[CompteRendu] photos load error', err);
      }
    })();
    return () => {
      cancelled = true;
      revokePhotoUrls(livePhotos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // Lookup tolérant : trouve une valeur dans bienDetails par fin de clé
  // (les clés sont slugifiées "${catSlug}__${fieldSlug}" mais on cherche
  // souvent par fieldSlug seul).
  const findDetail = (bd, ...fieldSlugs) => {
    if (!bd) return undefined;
    const keys = Object.keys(bd);
    for (const slug of fieldSlugs) {
      const hit = keys.find((k) => k.endsWith(`__${slug}`) || k === slug);
      if (hit && bd[hit] !== undefined && bd[hit] !== '' && bd[hit] !== null) return bd[hit];
    }
    return undefined;
  };

  // effProperty : forme identique à property{} mais dérivée d'activeBien
  // + enrichie par les saisies détaillées de Step1 (reportState.bienDetails).
  const effProperty = useMemo(() => {
    if (!isLive) return property;
    const b = activeBien.bien || {};
    const adr = activeBien.adresse || {};
    const bd = reportState.bienDetails || {};
    return {
      ...property,
      adresse: adr.label || '',
      surface: b.surface ?? findDetail(bd, 'surface_carrez_m', 'surface_totale_m', 'surface') ?? '—',
      pieces: b.pieces ?? findDetail(bd, 'nombre_de_pieces') ?? '—',
      chambres: b.chambres ?? findDetail(bd, 'nombre_de_chambres') ?? '—',
      etage: b.etage != null ? b.etage : (findDetail(bd, 'etage_du_bien') ?? '—'),
      annee: b.annee ?? findDetail(bd, 'annee_de_construction') ?? '—',
      // Les slugs sont dérivés du label exact des champs Step1 par slugifyKey.
      // Pour DPE/GES, le label réel est "DPE — Étiquette énergie" / "...GES",
      // d'où les slugs 'dpe_etiquette_energie' et 'dpe_etiquette_ges'. On
      // garde les anciens slugs en fallback pour la rétrocompatibilité.
      dpe: b.dpe
        || findDetail(bd, 'dpe_etiquette_energie', 'classe_dpe', 'dpe')
        || '—',
      ges: findDetail(bd, 'dpe_etiquette_ges', 'classe_ges', 'ges') || '',
      chauffage: findDetail(bd, 'type_de_chauffage') || '',
      // État saisi en Step0 (CreationBien) → activeBien.bien.etat ;
      // fallback sur "État général" de Step1 si présent.
      etat: b.etat || findDetail(bd, 'etat_general') || '',
      // Référence stable : dérivée de createdAt (sinon elle changeait à chaque
      // rafraîchissement de la page à cause de Math.random).
      reference: (() => {
        const dt = new Date(activeBien.createdAt || Date.now());
        const y = dt.getFullYear();
        const seed = Math.abs(dt.getTime()) % 90000 + 10000;
        return `IDR-${y}-${seed}`;
      })(),
    };
  }, [isLive, activeBien, reportState]);

  // effContexteZone : marché local depuis reportState.contexteMarche (Step2)
  // si dispo, sinon depuis dvfStats du bien actif, sinon fallback contexteZone.
  const effContexteZone = useMemo(() => {
    if (!isLive) return contexteZone;
    const ctx = reportState.contexteMarche || {};
    const dvfLive = ctx.dvfLive || {};
    const dvf = (activeBien.dvfStats && activeBien.dvfStats.median) ? activeBien.dvfStats : dvfLive;
    const city = activeBien.adresse?.city || '';

    // Format helpers
    const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') : (n || '—'));
    const fourchetteFromDvf = (d) => (d.p25 && d.p75 ? `${fmt(d.p25)} – ${fmt(d.p75)}` : (d.fourchette || ctx.fourchette || '—'));

    return {
      ...contexteZone,
      zoneLabel: ctx.zoneLabel || (city ? `${city} (secteur du bien)` : 'Secteur du bien'),
      rayonMetres: ctx.rayon || contexteZone.rayonMetres,
      market: {
        ...contexteZone.market,
        prixM2: ctx.prixM2Median || (dvf.median ? Math.round(dvf.median).toLocaleString('fr-FR') : '—'),
        evolution: ctx.evolution || dvf.evolution || '—',
        transactions: ctx.transactions ?? dvf.count ?? '—',
        delai: ctx.delaiMoyen || dvf.delaiMoyen || '—',
        fourchette: ctx.fourchette || fourchetteFromDvf(dvf),
      },
      tensionLabel: dvf.tensionLabel || ctx.tensionLabel || '—',
      tensionScore: dvf.tensionScore ?? ctx.tensionScore ?? '—',
      commodites: [], // POI rendus dans une section dédiée plus bas
      poi: ctx.poi || null,
      risques: ctx.risques || null,
    };
  }, [isLive, activeBien, reportState]);

  // effAvisValeur : prix depuis activeBien.result + génération auto des
  // points forts / vigilance depuis les caractéristiques du bien
  // (mêmes règles qu'en Step5AvisValeur — DPE, étage, exposition, exterieur,
  // parking, état, année).
  const effAvisValeur = useMemo(() => {
    if (!isLive) return avisValeur;
    const r = activeBien.result || {};
    const prixBas = r.prixBas || 0;
    const prixHaut = r.prixHaut || 0;
    const prixMedian = r.prix || Math.round((prixBas + prixHaut) / 2);
    const surface = activeBien.bien?.surface || 1;
    const prixM2 = r.prixM2 || Math.round(prixMedian / surface);

    // Step0 saisit type/surface/pieces/.../etat/exposition mais PAS le DPE
    // (qui est saisi en Step1 dans la catégorie « Isolation Thermique »).
    // On enrichit donc 'bien' depuis reportState.bienDetails pour que les
    // règles auto (points forts / vigilance) voient bien le DPE saisi.
    const bd = reportState.bienDetails || {};
    const bienRaw = activeBien.bien || {};
    const bien = {
      ...bienRaw,
      dpe: bienRaw.dpe
        || findDetail(bd, 'dpe_etiquette_energie', 'classe_dpe', 'dpe')
        || null,
      ges: bienRaw.ges
        || findDetail(bd, 'dpe_etiquette_ges', 'classe_ges', 'ges')
        || null,
    };
    const forts = [];
    const vigilance = [];

    const dpe = bien.dpe ? String(bien.dpe).toUpperCase() : null;
    if (dpe && ['A', 'B', 'C'].includes(dpe)) {
      forts.push(`DPE ${dpe} — bien performant énergétiquement`);
    } else if (dpe && ['F', 'G'].includes(dpe)) {
      vigilance.push(`DPE ${dpe} — passoire thermique (interdiction de location 2025/2028)`);
    } else if (dpe === 'E') {
      vigilance.push(`DPE E — interdiction de location prévue en 2034`);
    }

    if (bien.type === 'appartement' && bien.etage != null && bien.etage !== '') {
      const e = Number(bien.etage);
      if (e === 0) vigilance.push('Rez-de-chaussée — vis-à-vis et sécurité à anticiper');
      else if (e >= 6 && !bien.ascenseur) vigilance.push(`${e}e étage sans ascenseur — frein commercial fort`);
      else if (e >= 3 && bien.ascenseur) forts.push(`${e}e étage avec ascenseur — vue dégagée et confort`);
    }

    if (bien.exposition && /sud/i.test(bien.exposition)) {
      forts.push(`Exposition ${bien.exposition.replace('_', '-')} — luminosité optimale`);
    } else if (bien.exposition === 'nord') {
      vigilance.push('Exposition nord — luminosité réduite');
    }

    if (bien.exterieur === 'jardin') forts.push('Jardin — atout différenciant rare en zone urbaine');
    else if (bien.exterieur === 'terrasse') forts.push('Terrasse — extérieur très recherché');
    else if (bien.exterieur === 'balcon') forts.push('Balcon — extérieur appréciable');
    else if (bien.exterieur === 'aucun' && bien.type === 'appartement') {
      vigilance.push('Absence d’extérieur — frein post-Covid');
    }

    if (bien.parking === 'box') forts.push('Box / garage fermé — valorise le bien (+5%)');
    else if (bien.parking === 'place') forts.push('Place de parking — confort apprécié en centre-ville');
    else if (bien.parking === 'aucun') vigilance.push('Pas de stationnement — frein dans certains quartiers');

    if (bien.etat === 'neuf') forts.push('État neuf — aucun travaux à prévoir');
    else if (bien.etat === 'refait') forts.push('Récemment rénové — prêt à emménager');
    else if (bien.etat === 'a_renover') vigilance.push('À rénover — anticiper budget travaux');
    else if (bien.etat === 'a_reconstruire') vigilance.push('À reconstruire — projet lourd, public restreint');

    if (bien.annee) {
      const a = Number(bien.annee);
      if (a >= 2010) forts.push(`Construction ${a} — récent, normes thermiques actuelles`);
      else if (a < 1948) vigilance.push(`Construction ${a} — ancien, vigilance sur structure et isolation`);
    }

    // Si l'agent a édité les points dans Step5, on prend SES saisies ;
    // sinon on retombe sur les règles auto calculées ci-dessus.
    const fortsEdites = Array.isArray(reportState.pointsForts) && reportState.pointsForts.length > 0
      ? reportState.pointsForts
      : forts;
    const vigilanceEdites = Array.isArray(reportState.pointsVigilance) && reportState.pointsVigilance.length > 0
      ? reportState.pointsVigilance
      : vigilance;

    // Stratégies : le customPrice retenu en Step5 prime sur le prix médian.
    const customPrice = typeof reportState.customPrice === 'number' && reportState.customPrice > 0
      ? reportState.customPrice
      : prixMedian;
    const customPrixM2 = surface > 0 ? Math.round(customPrice / surface) : prixM2;
    const selectedIdx = typeof reportState.selectedStrategy === 'number'
      ? reportState.selectedStrategy
      : 1; // par défaut "Recommandé"

    // Le document n'affiche que la stratégie retenue, et d'elle que le prix :
    // délai, profil cible, risque et argumentaire ne sont plus rendus.
    const strategies = [
      { label: 'Prudent', prix: prixBas, prixM2: Math.round(prixBas / surface), recommended: selectedIdx === 0 },
      { label: 'Recommandé', prix: customPrice, prixM2: customPrixM2, recommended: selectedIdx === 1 },
      { label: 'Ambitieux', prix: prixHaut, prixM2: Math.round(prixHaut / surface), recommended: selectedIdx === 2 },
    ];

    return {
      ...avisValeur,
      prixBas,
      prixHaut,
      prixM2: customPrixM2,
      strategies,
      pointsForts: fortsEdites,
      pointsVigilance: vigilanceEdites,
      acquereurs: realAcquereurs.map((a) => ({ budget: (a.budgetMax || 0) * 1000 })),
      afficherCommodites: false,
    };
  }, [isLive, activeBien, realAcquereurs, reportState]);

  // Identités effectives — on prend en priorité les saisies persistées
  // (reportState.agence/agent/mandant), et on retombe sur les mocks
  // propertyData pour tout champ vide. Cela permet à l'agent de
  // surcharger n'importe quel champ depuis une fiche de réglages sans
  // perdre les valeurs par défaut de démo.
  const effAgence = useMemo(() => {
    const persisted = (reportState.agence && typeof reportState.agence === 'object')
      ? reportState.agence : {};
    const merged = { ...agence };
    Object.keys(persisted).forEach((k) => {
      const v = persisted[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
    return merged;
  }, [reportState]);

  const effAgent = useMemo(() => {
    const persisted = (reportState.agent && typeof reportState.agent === 'object')
      ? reportState.agent : {};
    const merged = { ...agent };
    Object.keys(persisted).forEach((k) => {
      const v = persisted[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
    return merged;
  }, [reportState]);

  const effMandant = useMemo(() => {
    const persisted = (reportState.mandant && typeof reportState.mandant === 'object')
      ? reportState.mandant : {};
    const merged = { ...mandant };
    Object.keys(persisted).forEach((k) => {
      const v = persisted[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
    return merged;
  }, [reportState]);

  // effLettre : textes de la lettre page 2 saisis dans Réglages, avec
  // fallback sur les phrases par défaut (propertyData.avisValeur.lettre +
  // fallbacks hard-codés pour l'objet / la formule d'appel / la formule
  // de politesse qui n'existaient pas en mock).
  const effLettre = useMemo(() => {
    const persisted = (reportState.lettre && typeof reportState.lettre === 'object')
      ? reportState.lettre : {};
    const pick = (key, fallback) => {
      const v = persisted[key];
      return (typeof v === 'string' && v.trim() !== '') ? v : fallback;
    };
    return {
      objet: pick('objet', null),                             // null → format auto avec adresse
      formuleAppel: pick('formuleAppel', null),               // null → format auto avec civilité + nom
      introParagraphe: pick('introParagraphe', avisValeur?.lettre?.introParagraphe || ''),
      paragrapheMethodologie: pick(
        'paragrapheMethodologie',
        "Notre méthodologie s'appuie sur l'analyse des ventes signées dans votre secteur, la mesure de la tension de marché et les caractéristiques propres de votre bien.",
      ),
      cloture: pick('cloture', avisValeur?.lettre?.cloture || ''),
      formulePolitesse: pick(
        'formulePolitesse',
        "Veuillez agréer l'expression de mes salutations distinguées,",
      ),
    };
  }, [reportState]);

  const themeStyle = {
    '--primary': effAgence.couleurPrimaire,
    '--secondary': effAgence.couleurSecondaire,
  };

  const recommendedStrategy = effAvisValeur.strategies.find((s) => s.recommended) || effAvisValeur.strategies[0];

  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Prix/m² de la stratégie recommandée : repère dans la distribution des
  // ventes du secteur (section « Notre activité dans votre secteur »).
  const prixM2Reco = Number(recommendedStrategy?.prixM2) || 0;

  /* ───── Marché local Ideeri — activité du réseau autour du bien ─────
   * Biens vendus, sous compromis et en vente relevés par notre agence et les
   * agences partenaires. La génération est déterministe (seed = coordonnées
   * du bien) : deux éditions du même document décrivent le même marché.
   *
   * À remplacer par l'appel réel `GET /marche-local?lat&lon&rayon` — la forme
   * des objets `bien` est déjà celle du contrat d'API.
   */
  const marcheLocal = useMemo(() => {
    const lat = activeBien?.adresse?.coords?.[0] ?? DEMO_COORDS[0];
    const lon = activeBien?.adresse?.coords?.[1] ?? DEMO_COORDS[1];
    const ville = activeBien?.adresse?.city || DEMO_VILLE;
    // Référence de prix du secteur : le prix/m² calculé pour le bien, sinon
    // la médiane DVF, sinon le prix/m² recommandé — pour que le marché simulé
    // et le prix de présentation restent sur la même échelle.
    const prixM2Ref =
      activeBien?.result?.prixM2 || activeBien?.dvfStats?.median || prixM2Reco || 2600;

    const { biens } = buildMarcheLocal({ lat, lon, ville, prixM2Ref });

    // Périmètre : rayon + antériorité. Les biens encore en vente ne sont pas
    // filtrés sur la date — ils sont actuels par définition.
    const perimetre = biens.filter(
      (b) =>
        b.distance <= MARCHE_LOCAL_RAYON_KM &&
        (b.statut === 'en_vente' || b.moisEcoules <= MARCHE_LOCAL_PERIODE_MOIS)
    );

    const vendus = perimetre.filter((b) => b.statut === 'vendu');
    const compromis = perimetre.filter((b) => b.statut === 'compromis');
    const enVente = perimetre.filter((b) => b.statut === 'en_vente');

    const mediane = (nums) => {
      if (!nums.length) return null;
      const s = nums.slice().sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };

    const delais = vendus.map((b) => b.delaiJours).filter((n) => Number.isFinite(n));
    const delaiMoyen = delais.length
      ? Math.round(delais.reduce((s, n) => s + n, 0) / delais.length)
      : null;

    // Distribution des prix/m² signés en 5 paliers d'amplitude égale (arrondie
    // à 50 €) : support visuel du positionnement du prix recommandé.
    const prixM2Vendus = vendus.map((b) => b.prixM2).filter((n) => Number.isFinite(n));
    let paliers = [];
    if (prixM2Vendus.length >= 5) {
      const min = Math.min(...prixM2Vendus);
      const max = Math.max(...prixM2Vendus);
      const pas = Math.max(50, Math.ceil((max - min) / 5 / 50) * 50);
      const base = Math.floor(min / pas) * pas;
      const brut = Array.from({ length: 5 }, (_, i) => {
        const from = base + i * pas;
        const to = from + pas;
        return { from, to, count: prixM2Vendus.filter((v) => v >= from && v < to).length };
      });
      const maxCount = Math.max(...brut.map((b) => b.count), 1);
      paliers = brut.map((b) => ({
        ...b,
        label: `${b.from.toLocaleString('fr-FR')} – ${b.to.toLocaleString('fr-FR')}`,
        pct: Math.round((b.count / maxCount) * 100),
      }));
    }

    const parDistance = (a, b) => a.distance - b.distance;
    // Décimale française : « à 0,2 km », pas « à 0.2 km ».
    const avecDistanceFr = (b) => ({
      ...b,
      distanceLabel: `${(b.distance ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`,
    });

    /* ── Plan du secteur ────────────────────────────────────────────────
     * Projection équirectangulaire locale : à cette échelle (quelques km)
     * l'erreur est négligeable, et on gagne un placement des points fidèle
     * aux coordonnées réelles — la trame de rues, elle, reste décorative.
     */
    const KM_PAR_DEG_LAT = 110.57;
    const KM_PAR_DEG_LON = 111.32 * Math.cos((lat * Math.PI) / 180);
    const projeter = (b) => ({
      ...b,
      dxKm: ((b.coords?.[1] ?? lon) - lon) * KM_PAR_DEG_LON,
      dyKm: ((b.coords?.[0] ?? lat) - lat) * KM_PAR_DEG_LAT,
    });

    /* Cadrage : on englobe les 6 ventes signées les plus proches, sur le
     * palier de rayon rond immédiatement supérieur. Serrer le cadre est ce
     * qui rend le plan lisible — à 3 km tout se tasse au centre et plus
     * aucune étiquette ne trouve sa place. */
    const PALIERS_RAYON = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5];
    const vendusProches = vendus.slice().sort(parDistance).slice(0, 6);
    const dMax = vendusProches[vendusProches.length - 1]?.distance || 0.5;
    const rayonCarteKm = PALIERS_RAYON.find((d) => d >= dMax) || Math.ceil(dMax);
    const idsLabellises = new Set(vendusProches.map((b) => b.id));

    const pointsCarte = perimetre
      .filter((b) => b.distance <= rayonCarteKm)
      .sort(parDistance)
      .slice(0, 18)
      .map(projeter)
      .map((b) => ({
        id: b.id,
        statut: b.statut,
        mine: b.mine,
        dxKm: b.dxKm,
        dyKm: b.dyKm,
        prixM2: b.prixM2,
        voie: b.adresse || b.voie,
        // Seules les ventes signées portent un prix : c'est la donnée qui
        // fait référence. Le reste situe l'activité sans surcharger le plan.
        labellise: b.statut === 'vendu' && idsLabellises.has(b.id),
      }));

    return {
      rayonKm: MARCHE_LOCAL_RAYON_KM,
      periodeMois: MARCHE_LOCAL_PERIODE_MOIS,
      ville,
      total: perimetre.length,
      vendus: vendus.length,
      vendusAgence: vendus.filter((b) => b.mine).length,
      compromis: compromis.length,
      enVente: enVente.length,
      delaiMoyen,
      prixM2MedianVendus: mediane(prixM2Vendus),
      paliers,
      carte: {
        rayonKm: rayonCarteKm,
        // Seed stable : la trame de rues ne doit pas changer d'un tirage
        // du document à l'autre.
        seed: Math.abs(Math.round(lat * 10000) ^ Math.round(lon * 10000)) || 1,
        points: pointsCarte,
      },
      offreConcurrente: enVente.slice().sort(parDistance).slice(0, 5).map(avecDistanceFr),
    };
  }, [activeBien, prixM2Reco]);

  /* ───── Plan de commercialisation ───────────────────────────────────
   * Priorité aux jalons réellement posés par l'agent dans le RdvPlanner ;
   * à défaut, plan type calé sur la date d'édition du document.
   */
  const planCommercialisation = useMemo(() => {
    const fmtLong = (d) =>
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const jalonsAgent = Array.isArray(reportState.rdvPlanner?.jalons)
      ? reportState.rdvPlanner.jalons.filter((j) => j && j.date)
      : [];

    if (jalonsAgent.length) {
      return {
        source: 'agent',
        etapes: jalonsAgent
          .slice()
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((j) => {
            const [y, m, d] = String(j.date).split('-').map(Number);
            const date = new Date(y, (m || 1) - 1, d || 1);
            return {
              dateLabel: fmtLong(date),
              titre: j.label || 'Point d\u2019étape',
              detail: [j.heure, j.duree ? `${j.duree} min` : null].filter(Boolean).join(' · '),
              color: j.color,
            };
          }),
      };
    }

    const base = new Date();
    return {
      source: 'defaut',
      etapes: PLAN_COMMERCIALISATION_DEFAUT.map((e) => {
        const date = new Date(base);
        date.setDate(date.getDate() + e.jours);
        return {
          dateLabel: fmtLong(date),
          jourLabel: e.jours === 0 ? 'Jour J' : `J+${e.jours}`,
          titre: e.titre,
          detail: e.detail,
        };
      }),
    };
  }, [reportState]);

  const isPrintMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('print') === '1';

  // Mode partage : le rapport est ouvert via un lien sécurisé (?t=JWT).
  // On masque les actions agent (bouton Retour, Partager) pour le mandant.
  const shareToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('t')
      : null;
  const isSharedView = Boolean(shareToken);

  const [shareStatus, setShareStatus] = useState('idle'); // idle|loading|copied|error

  // Personas d'acquéreurs : en web on sélectionne, en PDF tout est déplié.
  // En mode live, on ne dispose pas de personas regroupés → on affichera
  // une liste plate des acquéreurs réels dans la section 6.
  const personasList = Object.values(personasAcquereurs);
  const [activePersonaKey, setActivePersonaKey] = useState(personasList[0].key);

  // Prix de référence pour le filtre acquéreur : on prend le prix retenu
  // par l'agent (customPrice → médiane) ; on ne considère un acquéreur
  // comme "compatible budget" que si son plafond couvre ce prix.
  const prixReference = isLive
    ? (typeof reportState.customPrice === 'number' && reportState.customPrice > 0
        ? reportState.customPrice
        : (activeBien.result?.prix || 0))
    : 0;
  // Partitionnement : compatibles (budgetMax * 1000 >= prixReference) vs
  // hors budget. Si l'acquéreur n'a pas de budgetMax → considéré inconnu
  // donc on l'affiche (pas d'exclusion arbitraire).
  const acquereursCompatibles = isLive
    ? realAcquereurs.filter((a) => {
        const bm = Number(a.budgetMax);
        if (!Number.isFinite(bm) || bm <= 0) return true;
        if (!prixReference) return true;
        return bm * 1000 >= prixReference;
      })
    : [];
  const acquereursHorsBudget = isLive
    ? realAcquereurs.filter((a) => {
        const bm = Number(a.budgetMax);
        if (!Number.isFinite(bm) || bm <= 0) return false;
        if (!prixReference) return false;
        return bm * 1000 < prixReference;
      })
    : [];
  const totalProjets = isLive
    ? acquereursCompatibles.length
    : personasList.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="report-root" style={themeStyle}>
      <style>{reportCss}</style>

      {/* =============================================================
          SECTION 1 — Couverture
          ============================================================= */}
      <section className="cover">
        <img src={effAgence.logo} alt={effAgence.nom} className="cover-logo" />
        <div className="cover-bar" />
        <h1 className="cover-title">ÉTUDE DE MARCHÉ</h1>
        <p className="cover-address">{effProperty.adresse || '—'}</p>
        <div className="cover-hero" aria-hidden="true">
          {isLive && livePhotos[0]?.src ? (
            <img src={livePhotos[0].src} alt="Photo principale" className="cover-hero-img" />
          ) : (
            <div className="cover-hero-placeholder">
              <span>{fmtNb(effProperty.surface)} m² · T{effProperty.pieces} · Étage {effProperty.etage}</span>
            </div>
          )}
        </div>
        <div className="cover-meta">
          <div>Référence : <strong>{effProperty.reference}</strong></div>
          <div>Établi le {dateEdition}</div>
          <div>Par {effAgent.nom}, {effAgent.fonction}</div>
        </div>
        <div className="cover-footer">
          Document confidentiel · Établi par {effAgence.nom} · {dateEdition}
        </div>
      </section>

      {/* =============================================================
          SECTION 2 — Lettre d'accompagnement
          ============================================================= */}
      <section className="letter page-break">
        <div className="letter-header">
          <div className="letter-from">
            <strong>{effAgence.nom}</strong>
            <div>{effAgence.adresse}</div>
            <div>{effAgence.tel}</div>
            <div>{effAgence.email}</div>
          </div>
          <div className="letter-to">
            <strong>{effMandant.civilite} {effMandant.prenom} {effMandant.nom}</strong>
            <div>{effMandant.adresseCorrespondance}</div>
          </div>
        </div>

        <p className="letter-date">{(effAgence.adresse || '').split(',').slice(-1)[0].trim().split(' ').slice(-1)[0] /* ville */ ? `Lyon, le ${dateEdition}` : `Le ${dateEdition}`}</p>

        <p className="letter-object">
          <strong>Objet :</strong> {effLettre.objet || `Étude de marché — ${effProperty.adresse || '—'}`}
        </p>

        <div className="letter-body">
          <p>{effLettre.formuleAppel || `${effMandant.civilite || ''} ${effMandant.nom || ''}`.trim() + ','}</p>
          <p>{effLettre.introParagraphe || effAvisValeur.lettre.introParagraphe}</p>
          <p>
            Au terme de notre analyse, nous recommandons un prix de présentation
            de <strong>{(recommendedStrategy?.prix || 0).toLocaleString('fr-FR')} €</strong>,
            soit {(recommendedStrategy?.prixM2 || 0).toLocaleString('fr-FR')} €/m².
          </p>
          <p>{effLettre.paragrapheMethodologie}</p>
          <p>{effLettre.cloture || effAvisValeur.lettre.cloture}</p>
          <p>{effLettre.formulePolitesse}</p>
        </div>

        <div className="letter-signature">
          {effAgent.signature && (
            <img src={effAgent.signature} alt="Signature" className="signature-img" />
          )}
          <div><strong>{effAgent.nom}</strong></div>
          <div>{effAgent.fonction}</div>
          <div>{effAgent.telDirect || effAgent.telephone} · {effAgent.email}</div>
        </div>
      </section>

      {/* Section Synthèse supprimée à la demande — le prix/fourchette est
          présenté directement en section Proposition commerciale. */}

      {/* =============================================================
          SECTION 4 — Votre bien
          ============================================================= */}
      <section className="property page-break">
        <h2 className="section-title">Votre bien</h2>

        <div className="property-gallery">
          {isLive ? (
            livePhotos.length > 0 ? (
              <>
                <div className="photo-main" style={{ backgroundImage: `url(${livePhotos[0].src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div className="photo-grid">
                  {livePhotos.slice(1, 4).map((p, i) => (
                    <div
                      key={p.id || i}
                      className="photo-thumb"
                      style={{ backgroundImage: `url(${p.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="photo-main" style={{ color: '#999' }}>Aucune photo ajoutée</div>
            )
          ) : (
            <>
              <div className="photo-main">Photo principale</div>
              <div className="photo-grid">
                <div className="photo-thumb">Séjour</div>
                <div className="photo-thumb">Cuisine</div>
                <div className="photo-thumb">Chambre</div>
              </div>
            </>
          )}
        </div>

        <div className="property-specs">
          <div className="spec-col">
            <div className="spec-row"><span>Type</span><strong>{isLive ? (activeBien?.bien?.type === 'maison' ? 'Maison' : 'Appartement') : 'Appartement'} T{effProperty.pieces}</strong></div>
            <div className="spec-row"><span>Surface</span><strong>{fmtNb(effProperty.surface)} m²</strong></div>
            <div className="spec-row"><span>Pièces</span><strong>{effProperty.pieces}</strong></div>
            <div className="spec-row"><span>Chambres</span><strong>{effProperty.chambres}</strong></div>
            <div className="spec-row"><span>Étage</span><strong>{effProperty.etage}{isLive ? '' : ' / 6'}</strong></div>
            <div className="spec-row"><span>Année</span><strong>{effProperty.annee}</strong></div>
          </div>
          <div className="spec-col">
            <div className="spec-row">
              <span>DPE</span>
              <strong className={`dpe-badge dpe-${effProperty.dpe}`}>{effProperty.dpe}</strong>
            </div>
            <div className="spec-row">
              <span>GES</span>
              <strong className={`dpe-badge dpe-${isLive ? (effProperty.ges || 'D') : 'D'}`}>{isLive ? (effProperty.ges || '—') : 'D'}</strong>
            </div>
            <div className="spec-row"><span>Exposition</span><strong>{isLive ? (activeBien?.bien?.exposition || '—') : 'Sud-Est'}</strong></div>
            <div className="spec-row"><span>Chauffage</span><strong>{isLive ? (effProperty.chauffage || '—') : 'Individuel gaz'}</strong></div>
            <div className="spec-row"><span>État</span><strong>{isLive ? (effProperty.etat || '—') : 'Bon état'}</strong></div>
            <div className="spec-row"><span>Ascenseur</span><strong>{isLive ? (activeBien?.bien?.ascenseur ? 'Oui' : 'Non') : 'Oui'}</strong></div>
          </div>
        </div>

        {!isLive && (
          <p className="property-desc">
            Bel appartement T{effProperty.pieces} de {fmtNb(effProperty.surface)} m² traversant, situé au {effProperty.etage}ᵉ
            étage avec ascenseur d'un immeuble des années 1970 en bon état d'entretien.
            Il dispose d'un balcon de 5,2 m² exposé Sud-Est et d'une cave. La cuisine
            ouverte sur le séjour lumineux offre un espace de vie agréable. Les
            menuiseries double vitrage performant et la chaudière gaz à condensation
            de 2018 permettent une consommation maîtrisée.
          </p>
        )}

        {!isLive && (
          <div className="property-tags">
            <span className="pill">Balcon</span>
            <span className="pill">Ascenseur</span>
            <span className="pill">Cave</span>
            <span className="pill">DPE D</span>
            <span className="pill">Métro 280 m</span>
          </div>
        )}
        {isLive && (
          <div className="property-tags">
            {activeBien?.bien?.exterieur && activeBien.bien.exterieur !== 'aucun' && (
              <span className="pill">{activeBien.bien.exterieur.charAt(0).toUpperCase() + activeBien.bien.exterieur.slice(1)}</span>
            )}
            {activeBien?.bien?.ascenseur && <span className="pill">Ascenseur</span>}
            {activeBien?.bien?.parking && activeBien.bien.parking !== 'aucun' && (
              <span className="pill">Parking {activeBien.bien.parking}</span>
            )}
            {effProperty.dpe && effProperty.dpe !== '—' && <span className="pill">DPE {effProperty.dpe}</span>}
          </div>
        )}
      </section>

      {/* =============================================================
          SECTION 4 bis — Fiche technique détaillée (mode live)
          Affiche toutes les saisies des accordéons Step1 (bienDetails),
          regroupées par catégorie. Seuls les champs non vides sont rendus.
          ============================================================= */}
      {isLive && reportState.bienDetails && Object.keys(reportState.bienDetails).length > 0 && (
        <section className="fiche-technique page-break">
          <h2 className="section-title">Fiche technique du bien</h2>
          <p className="section-intro" style={{ marginBottom: 24, color: '#666' }}>
            Ensemble des caractéristiques relevées lors de la visite et de la saisie
            du dossier. Ces informations alimentent la valorisation et permettent
            de qualifier précisément l'état du bien.
          </p>

          {(() => {
            // Groupe les clés par préfixe catégorie (`${catSlug}__${fieldSlug}`)
            const bd = reportState.bienDetails || {};
            const groups = {};
            Object.entries(bd).forEach(([key, value]) => {
              // Filtre : on ignore les valeurs vides / nulles / false (pour les toggles non cochés)
              if (value === '' || value === null || value === undefined) return;
              if (value === false) return;
              const idx = key.indexOf('__');
              const catSlug = idx > 0 ? key.slice(0, idx) : '_autres';
              const fieldSlug = idx > 0 ? key.slice(idx + 2) : key;
              if (!groups[catSlug]) groups[catSlug] = [];
              groups[catSlug].push({ fieldSlug, value });
            });

            // Helpers d'affichage : slug -> libellé humain
            const humanize = (slug) => {
              if (!slug) return '';
              return slug
                .split('_')
                .filter(Boolean)
                .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
                .join(' ');
            };
            const formatValue = (v) => {
              if (v === true) return 'Oui';
              if (v === false) return 'Non';
              if (typeof v === 'number') return v.toLocaleString('fr-FR');
              return String(v);
            };

            // Ordre privilégié des catégories
            const CAT_ORDER = [
              'identification_juridique',
              'caracteristiques_generales',
              'structure',
              'revetements_muraux',
              'revetements_de_sol',
              'menuiseries',
              'portes',
              'electrique',
              'plomberie',
              'chauffage',
            ];
            const catKeys = Object.keys(groups).sort((a, b) => {
              const ia = CAT_ORDER.indexOf(a);
              const ib = CAT_ORDER.indexOf(b);
              if (ia === -1 && ib === -1) return a.localeCompare(b);
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            });

            return catKeys.map((catKey) => (
              <div key={catKey} className="fiche-cat" style={{ marginBottom: 28 }}>
                <h3 style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--primary, #1a3a52)',
                  marginBottom: 12,
                  paddingBottom: 6,
                  borderBottom: '1px solid #e5e7eb',
                }}>
                  {humanize(catKey)}
                </h3>
                <div className="fiche-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  columnGap: 32,
                  rowGap: 8,
                }}>
                  {groups[catKey].map(({ fieldSlug, value }) => (
                    <div key={fieldSlug} className="fiche-row" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px dotted #eee',
                      fontSize: 14,
                    }}>
                      <span style={{ color: '#666' }}>{humanize(fieldSlug)}</span>
                      <strong style={{ color: '#111', marginLeft: 16, textAlign: 'right' }}>
                        {formatValue(value)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </section>
      )}

      {/* =============================================================
          SECTION 5 — Votre marché local (V2, factuel uniquement)
          ============================================================= */}
      <section className="market page-break">
        <h2 className="section-title">Votre marché local</h2>
        <p className="market-zone">
          {effContexteZone.zoneLabel} · rayon {effContexteZone.rayonMetres} m autour du bien
        </p>

        <div className="market-kpis">
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.prixM2} €/m²</div>
            <div className="kpi-label">Médiane secteur</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.evolution}</div>
            <div className="kpi-label">Évolution 12 mois</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{effContexteZone.market.transactions}</div>
            <div className="kpi-label">Transactions 12 mois</div>
          </div>
        </div>

        <p className="market-source">
          Source : DVF — transactions publiées par l'administration fiscale sur
          les 12 derniers mois dans le périmètre ci-dessus. Le délai de vente
          constaté et les ventes de notre réseau figurent en section
          « Notre activité dans votre secteur ».
        </p>

        <div className="market-tension">
          <strong>Tension du marché : </strong>
          <span className="tension-badge">{effContexteZone.tensionLabel}</span>
          <span className="tension-score">{effContexteZone.tensionScore}/10</span>
        </div>

        <p className="market-caption">
          Fourchette de prix observée sur la typologie T{effProperty.pieces} dans votre secteur :
          <strong> {effContexteZone.market.fourchette} €/m²</strong>.
        </p>

        {effAvisValeur.afficherCommodites && effContexteZone.commodites?.length > 0 && (
          <div className="market-commodites">
            <h3>Commodités à proximité</h3>
            {Object.entries(
              effContexteZone.commodites.reduce((acc, c) => {
                (acc[c.categorie] ||= []).push(c);
                return acc;
              }, {})
            ).map(([cat, items]) => (
              <div className="commod-cat" key={cat}>
                <h4>{cat}</h4>
                <ul>
                  {items
                    .slice()
                    .sort((a, b) => a.distance - b.distance)
                    .map((c, i) => (
                      <li key={i}>
                        <strong>{c.nom}</strong>
                        <span> · {c.distance} m · {c.tempsAPied} min à pied</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =============================================================
          SECTION 5 bis — Commodités à proximité (POI Overpass / Step2)
          Source : reportState.contexteMarche.poi (persisté par Step2).
          ============================================================= */}
      {isLive && effContexteZone.poi && Object.keys(effContexteZone.poi).some((k) => Array.isArray(effContexteZone.poi[k]) && effContexteZone.poi[k].length > 0) && (
        <section className="commodites page-break">
          <h2 className="section-title">Commodités à proximité</h2>
          <p className="section-intro" style={{ marginBottom: 24, color: '#666' }}>
            Points d'intérêt relevés dans un rayon de {effContexteZone.rayonMetres || 1000} m
            autour du bien (source OpenStreetMap).
          </p>

          {(() => {
            const POI_LABELS = {
              transports: 'Transports & accessibilité',
              commerces: 'Commerces & services',
              education: 'Éducation',
              sante: 'Santé',
              environnement: 'Environnement & cadre de vie',
            };
            const POI_ORDER = ['transports', 'commerces', 'education', 'sante', 'environnement'];
            const fmtDist = (d) => {
              if (d == null) return '—';
              return d < 1000 ? `${d} m` : `${(d / 1000).toFixed(1)} km`;
            };

            return POI_ORDER
              .filter((cat) => Array.isArray(effContexteZone.poi[cat]) && effContexteZone.poi[cat].length > 0)
              .map((cat) => (
                <div key={cat} className="poi-cat" style={{ marginBottom: 24 }}>
                  <h3 style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--primary, #1a3a52)',
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    {POI_LABELS[cat]}
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {effContexteZone.poi[cat].slice(0, 6).map((p, i) => (
                      <li key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '5px 0',
                        borderBottom: '1px dotted #eee',
                        fontSize: 13,
                      }}>
                        <span style={{ color: '#222' }}>{p.name}</span>
                        <strong style={{ color: '#46B962', marginLeft: 12 }}>{fmtDist(p.distance)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ));
          })()}
        </section>
      )}

      {/* =============================================================
          SECTION 5 ter — Risques & Aléas (Géorisques / Step2)
          Source : reportState.contexteMarche.risques.
          ============================================================= */}
      {isLive && effContexteZone.risques && (() => {
        const r = effContexteZone.risques;
        // Au moins une donnée présente
        return !!(r.inondation || r.argile || r.sismique || r.radon || r.mouvement || r.basias);
      })() && (
        <section className="risques page-break">
          <h2 className="section-title">Risques & Aléas</h2>
          <p className="section-intro" style={{ marginBottom: 24, color: '#666' }}>
            Synthèse des risques naturels et technologiques répertoriés sur la commune
            (source : Géorisques — data.gouv.fr).
          </p>

          {(() => {
            const r = effContexteZone.risques;
            const items = [];
            if (r.inondation) {
              items.push({
                label: 'Inondation (PPRI)',
                value: r.inondation.present ? (r.inondation.niveau || 'Présent') : 'Aucun',
                level: r.inondation.present ? 'warn' : 'ok',
              });
            }
            if (r.argile && r.argile.niveau) {
              const niv = String(r.argile.niveau).toLowerCase();
              const isBad = /fort|élev/.test(niv);
              const isWarn = /moy/.test(niv);
              items.push({
                label: 'Retrait-gonflement argiles',
                value: r.argile.niveau,
                level: isBad ? 'bad' : isWarn ? 'warn' : 'ok',
              });
            }
            if (r.sismique && r.sismique.niveau) {
              const z = parseInt(r.sismique.zone, 10);
              const lvl = z >= 4 ? 'bad' : z === 3 ? 'warn' : 'ok';
              items.push({
                label: `Sismicité (zone ${r.sismique.zone || '?'})`,
                value: r.sismique.niveau,
                level: lvl,
              });
            }
            if (r.radon && r.radon.potentiel) {
              const lvl = r.radon.potentiel === 'Élevé' ? 'bad' : r.radon.potentiel === 'Moyen' ? 'warn' : 'ok';
              items.push({
                label: 'Potentiel radon',
                value: r.radon.potentiel,
                level: lvl,
              });
            }
            if (r.mouvement) {
              items.push({
                label: 'Mouvements de terrain (500 m)',
                value: r.mouvement.present ? `${r.mouvement.count} signalé(s)` : 'Aucun',
                level: r.mouvement.present ? 'warn' : 'ok',
              });
            }
            if (r.basias) {
              items.push({
                label: 'Sites BASIAS (500 m)',
                value: r.basias.present ? `${r.basias.count} signalé(s)` : 'Aucun',
                level: r.basias.present ? 'warn' : 'ok',
              });
            }

            const COLORS = { ok: '#46B962', warn: '#f5a623', bad: '#e74c3c' };

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}>
                {items.map((it, i) => (
                  <div key={i} style={{
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${COLORS[it.level]}`,
                    borderRadius: 6,
                    padding: '10px 14px',
                    background: '#fff',
                  }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>{it.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS[it.level] }}>
                      {it.value}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* =============================================================
          SECTION 5 quater — Notre activité dans votre secteur
          Source : data/marcheLocalIdeeri (réseau Ideeri). Preuve d'activité :
          prix réellement signés, offre concurrente, délais constatés.
          ============================================================= */}
      {marcheLocal.total > 0 && (
        <section className="reseau page-break">
          <h2 className="section-title">Notre activité dans votre secteur</h2>
          <p className="section-intro">
            {marcheLocal.total} biens suivis par notre réseau dans un rayon de{' '}
            {marcheLocal.rayonKm} km autour du vôtre, sur les {marcheLocal.periodeMois}{' '}
            derniers mois. Ce sont des prix réellement signés — pas des prix affichés.
          </p>

          <div className="market-kpis">
            <div className="kpi kpi-highlight">
              <div className="kpi-value">{marcheLocal.vendus}</div>
              <div className="kpi-label">Ventes signées</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{marcheLocal.compromis}</div>
              <div className="kpi-label">Sous compromis</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{marcheLocal.enVente}</div>
              <div className="kpi-label">Actuellement en vente</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">
                {marcheLocal.delaiMoyen ? `${marcheLocal.delaiMoyen} j` : '—'}
              </div>
              <div className="kpi-label">Délai moyen de vente</div>
            </div>
          </div>

          {marcheLocal.vendusAgence > 0 && (
            <p className="reseau-part">
              Dont <strong>{marcheLocal.vendusAgence} vente{plural(marcheLocal.vendusAgence)}</strong>{' '}
              conclue{plural(marcheLocal.vendusAgence)} directement par {effAgence.nom}.
            </p>
          )}

          {marcheLocal.paliers.length > 0 && (
            <div className="reseau-distrib">
              <h3>Prix au m² des ventes signées</h3>
              {marcheLocal.paliers.map((pal) => {
                const contientReco = prixM2Reco >= pal.from && prixM2Reco < pal.to;
                return (
                  <div className={`distrib-row${contientReco ? ' reco' : ''}`} key={pal.from}>
                    <span className="distrib-label">{pal.label} €/m²</span>
                    <span className="distrib-bar">
                      <i style={{ width: `${pal.pct}%` }} />
                    </span>
                    <span className="distrib-count">
                      {pal.count}
                      {contientReco && <em>votre prix</em>}
                    </span>
                  </div>
                );
              })}
              {prixM2Reco > 0 && (
                <p className="distrib-caption">
                  Le prix de présentation que nous recommandons ressort à{' '}
                  <strong>{prixM2Reco.toLocaleString('fr-FR')} €/m²</strong>
                  {marcheLocal.prixM2MedianVendus
                    ? `, pour une médiane de ${marcheLocal.prixM2MedianVendus.toLocaleString('fr-FR')} €/m² sur les ventes signées de notre réseau.`
                    : '.'}
                </p>
              )}
            </div>
          )}

          {marcheLocal.carte.points.length > 0 && (
            <div className="reseau-block">
              <h3>Les ventes signées autour de votre bien</h3>
              <div className="carte-wrap">
                <CarteSecteur
                  carte={marcheLocal.carte}
                  libelleBien={
                    String(activeBien?.bien?.type || '').toLowerCase().startsWith('maison')
                      ? 'Votre maison'
                      : 'Votre bien'
                  }
                />
              </div>
              <p className="carte-legende">
                Chaque pastille porte le prix au m² réellement signé. Les points
                cerclés de blanc sont les ventes conclues par notre agence. Le
                plan est cadré sur les ventes les plus proches
                ({fmtKm(marcheLocal.carte.rayonKm)}) ; le périmètre analysé,
                lui, s'étend à {fmtKm(marcheLocal.rayonKm)}. Positions à
                l'échelle d'après les coordonnées des biens ; la trame de rues
                est schématique.
              </p>
            </div>
          )}

          {marcheLocal.offreConcurrente.length > 0 && (
            <div className="reseau-block">
              <h3>L'offre face à laquelle vous serez</h3>
              <p className="reseau-sub">
                Les biens actuellement en vente autour du vôtre : ceux que vos
                acquéreurs visiteront avant ou après, et auxquels ils vous
                compareront.
              </p>
              <ul className="conc-list">
                {marcheLocal.offreConcurrente.map((b) => (
                  <li key={b.id}>
                    <span className="conc-dot" style={{ background: STATUTS.en_vente.color }} />
                    <span className="conc-main">
                      <strong>{b.type} · T{b.pieces} · {b.surface} m²</strong>
                      <span className="conc-loc">{adresseLisible(b)} · à {b.distanceLabel}</span>
                    </span>
                    <span className="conc-prix">
                      {(b.prix || 0).toLocaleString('fr-FR')} €
                      <em>{(b.prixM2 || 0).toLocaleString('fr-FR')} €/m²</em>
                    </span>
                    <span className="conc-age">
                      en ligne depuis {b.enLigneDepuisJours} j
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="reseau-source">
            Source : réseau Ideeri — biens suivis par notre agence et les agences
            partenaires. Les adresses sont volontairement réduites à la voie et à
            la commune.
          </p>
        </section>
      )}

      {/* =============================================================
          SECTION 6 — Profils d'acquéreurs en recherche
          (5 personas, reprend Acte 2 de Step4 — interactif en web, déplié en PDF)
          ============================================================= */}
      <section className="personas page-break">
        <h2 className="section-title">Profils d'acquéreurs en recherche</h2>
        <p className="section-intro">
          {isLive ? (
            realAcquereurs.length === 0 ? (
              <>Aucun acquéreur n'a été enregistré pour ce bien. Ajoutez-en depuis l'étape 4.</>
            ) : totalProjets > 0 ? (
              <>
                <strong>{totalProjets} projet{totalProjets > 1 ? 's' : ''} d'achat actif{totalProjets > 1 ? 's' : ''}</strong> dans votre fichier acquéreurs
                {prixReference > 0 ? (
                  <> dont le budget max couvre le prix de {prixReference.toLocaleString('fr-FR')} €</>
                ) : null}
                .
                {acquereursHorsBudget.length > 0 && (
                  <> {acquereursHorsBudget.length} autre{acquereursHorsBudget.length > 1 ? 's' : ''} acquéreur{acquereursHorsBudget.length > 1 ? 's' : ''} hors budget (voir ci-dessous).</>
                )}
              </>
            ) : (
              <>
                Aucun acquéreur de votre fichier ne couvre le prix de {prixReference.toLocaleString('fr-FR')} €.
                {acquereursHorsBudget.length > 0 && (
                  <> {acquereursHorsBudget.length} acquéreur{acquereursHorsBudget.length > 1 ? 's sont' : ' est'} hors budget — voir ci-dessous.</>
                )}
              </>
            )
          ) : (
            <>
              <strong>{totalProjets} projets d'achat actifs</strong> dans votre périmètre
              correspondent aux critères de votre bien (typologie, surface, secteur),
              répartis en 5 profils. Leur budget, en revanche, ne couvre pas toujours
              le prix de présentation : le nombre de projets réellement solvables
              à ce prix figure en section « Notre proposition ».
            </>
          )}
        </p>

        {isLive && acquereursCompatibles.length > 0 && (
          <div className="live-acquereurs-list">
            <h4 className="live-acquereurs-title">Acquéreurs compatibles ({acquereursCompatibles.length})</h4>
            <ul>
              {acquereursCompatibles.map((a, i) => (
                <li key={a.id || i} style={{ marginBottom: '8px' }}>
                  <strong>{a.prenom || ''} {a.nom || `Acquéreur ${i + 1}`}</strong>
                  {a.budgetMax && <> · Budget max <strong>{(Number(a.budgetMax) * 1000).toLocaleString('fr-FR')} €</strong></>}
                  {a.surfaceMin && <> · Surface min <strong>{a.surfaceMin} m²</strong></>}
                  {a.type && a.type !== 'indifferent' && <> · Type {a.type}</>}
                  {a.dpeMin && <> · DPE min {a.dpeMin}</>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLive && acquereursHorsBudget.length > 0 && (
          <div className="live-acquereurs-list live-acquereurs-out">
            <h4 className="live-acquereurs-title">Acquéreurs hors budget ({acquereursHorsBudget.length})</h4>
            <p className="live-acquereurs-note">
              Ces acquéreurs ont un budget max inférieur au prix retenu
              ({prixReference.toLocaleString('fr-FR')} €) — ils ne sont
              comptés ni dans les projets actifs ni dans le score de tension.
            </p>
            <ul>
              {acquereursHorsBudget.map((a, i) => (
                <li key={a.id || i} style={{ marginBottom: '6px', opacity: 0.65 }}>
                  <strong>{a.prenom || ''} {a.nom || `Acquéreur ${i + 1}`}</strong>
                  {a.budgetMax && <> · Budget max <strong>{(Number(a.budgetMax) * 1000).toLocaleString('fr-FR')} €</strong> (manque {((prixReference - Number(a.budgetMax) * 1000)).toLocaleString('fr-FR')} €)</>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isLive && !reportState.displayConfig?.hideDemo && (
        <>
        <div className="personas-row">
          {personasList.map((p) => {
            const isActive = activePersonaKey === p.key;
            return (
              <div
                key={p.key}
                className={`persona-card ${isActive ? 'active' : ''}`}
                onClick={() => !isPrintMode && setActivePersonaKey(p.key)}
                role={isPrintMode ? undefined : 'button'}
                tabIndex={isPrintMode ? undefined : 0}
              >
                <div className="persona-count">{p.count}</div>
                <div className="persona-name">{p.name}</div>
                <div className="persona-sub">{p.sub}</div>
              </div>
            );
          })}
        </div>

        {/* En PDF → tous les personas dépliés ; en web → seul l'actif */}
        {(isPrintMode ? personasList : personasList.filter((p) => p.key === activePersonaKey))
          .map((p) => (
            <div className="persona-focus" key={`focus-${p.key}`}>
              <div className="persona-focus-header">
                <div className="persona-focus-title">
                  <span className="dot" />
                  <span>{p.name}</span>
                  <span className="count-pill">{p.count} projet{plural(p.count)}</span>
                </div>
                <div className="persona-focus-meta">
                  <span>Budget moyen <strong>{p.budget}</strong></span>
                  <span>Délai cible <strong>{p.delai}</strong></span>
                  <span>Compatibilité <strong className="compat">{p.compat}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </>
        )}
      </section>

      {/* =============================================================
          SECTION 8 — Argumentaire de valorisation
          ============================================================= */}
      <section className="arguments">
        <h2 className="section-title">Argumentaire de valorisation</h2>

        <div className="arg-cols">
          <div className="arg-col arg-strong">
            <h3>Points forts</h3>
            <ul>
              {(effAvisValeur.pointsForts || []).length > 0 ? (
                effAvisValeur.pointsForts.map((p, i) => <li key={i}>{p}</li>)
              ) : (
                <li style={{ color: '#999' }}>Non renseigné</li>
              )}
            </ul>
          </div>
          <div className="arg-col arg-vigilance">
            <h3>Points de vigilance</h3>
            <ul>
              {(effAvisValeur.pointsVigilance || []).length > 0 ? (
                effAvisValeur.pointsVigilance.map((p, i) => <li key={i}>{p}</li>)
              ) : (
                <li style={{ color: '#999' }}>Non renseigné</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* =============================================================
          SECTION 10 — Proposition commerciale
          Un seul prix : celui que l'agent a retenu en Step5 (stratégie
          sélectionnée → recommendedStrategy). La fourchette et les variantes
          restent dans l'outil, elles ne sortent pas dans le document.
          ============================================================= */}
      {!reportState.displayConfig?.hideStrategie && recommendedStrategy && (
      <section className="strategies page-break">
        <h2 className="section-title">Notre proposition</h2>

        <div className="proposition">
          <div className="prop-label">Prix de présentation recommandé</div>
          <div className="prop-price">
            {(recommendedStrategy.prix || 0).toLocaleString('fr-FR')} €
          </div>
          <div className="prop-m2">
            soit {(recommendedStrategy.prixM2 || 0).toLocaleString('fr-FR')} €/m²
          </div>

          <div className="prop-row">
            <span>Projets d'achat compatibles avec ce budget</span>
            <strong>
              {(effAvisValeur.acquereurs || []).filter((a) => a.budget >= recommendedStrategy.prix).length}
            </strong>
          </div>
        </div>
      </section>
      )}

      {/* =============================================================
          SECTION 10 bis — Plan de commercialisation
          Jalons posés par l'agent (reportStore.rdvPlanner) sinon plan type
          calé sur la date d'édition du document.
          ============================================================= */}
      <section className="plan page-break">
        <h2 className="section-title">Plan de commercialisation</h2>
        <p className="section-intro">
          Le bon prix ne suffit pas. Voici ce que nous engageons, et à quelle
          échéance, à compter de la signature du mandat.
        </p>

        <ol className="plan-timeline">
          {planCommercialisation.etapes.map((e, i) => (
            <li className="plan-step" key={i}>
              <span
                className="plan-dot"
                style={e.color ? { background: e.color, borderColor: e.color } : undefined}
              />
              <div className="plan-when">
                {e.jourLabel && <span className="plan-jour">{e.jourLabel}</span>}
                <span className="plan-date">{e.dateLabel}</span>
              </div>
              <div className="plan-what">
                <div className="plan-titre">{e.titre}</div>
                {e.detail && <div className="plan-detail">{e.detail}</div>}
              </div>
            </li>
          ))}
        </ol>

        <div className="plan-engagements">
          <h3>Nos engagements pendant toute la durée du mandat</h3>
          <ul>
            {ENGAGEMENTS_COMMERCIALISATION.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>

        <p className="plan-note">
          {planCommercialisation.source === 'defaut'
            ? 'Les échéances ci-dessus sont calculées à partir de la date d’édition du présent document. Elles seront confirmées à la signature du mandat.'
            : 'Rendez-vous convenus avec vous et inscrits à notre agenda.'}
        </p>
      </section>

      {/* =============================================================
          SECTION 11 — Votre interlocuteur
          ============================================================= */}
      <section className="contact">
        <h2 className="section-title">Votre interlocuteur</h2>

        <div className="contact-card">
          {effAgent.photo && (
            <img src={effAgent.photo} alt={effAgent.nom} className="agent-photo" />
          )}
          <div className="contact-identity">
            <div className="agent-name">{effAgent.nom}</div>
            <div className="agent-role">{effAgent.fonction}</div>
            <div>{effAgent.telDirect || effAgent.telephone}</div>
            <div>{effAgent.email}</div>
          </div>
          <div className="contact-agence">
            <img src={effAgence.logo} alt={effAgence.nom} className="agence-logo" />
            <div><strong>{effAgence.nom}</strong></div>
            <div>{effAgence.adresse}</div>
            <div>{effAgence.tel} · {effAgence.email}</div>
            <div>{effAgence.siteWeb}</div>
          </div>
        </div>
      </section>

      {/* =============================================================
          SECTION 12 — Mentions légales
          ============================================================= */}
      <footer className="legal page-break">
        <h3>Mentions légales</h3>
        <ul>
          {(effAvisValeur.mentionsLegales || []).map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <div className="legal-agence">
          {effAgence.carteT} · {effAgence.rcs}
          {effAgence.mentionsComplementaires && (
            <div>{effAgence.mentionsComplementaires}</div>
          )}
        </div>
      </footer>

      {/* Actions (non imprimées) */}
      {!isPrintMode && (
        <div className="actions no-print">
          <button className="btn primary" onClick={() => downloadPdf()}>
            Télécharger en PDF
          </button>

          {/* Bouton de partage — visible uniquement côté agent (pas dans la vue partagée) */}
          {!isSharedView && (
            <button
              className="btn share"
              onClick={() => handleShare(setShareStatus)}
              disabled={shareStatus === 'loading'}
            >
              {shareStatus === 'loading' && 'Génération du lien...'}
              {shareStatus === 'copied' && '✓ Lien copié (valide 7 jours)'}
              {shareStatus === 'error' && '⚠ Erreur, réessayer'}
              {shareStatus === 'idle' && 'Copier le lien de partage'}
            </button>
          )}

          {/* Retour à l'app — caché en vue partagée (le mandant n'a pas accès à l'app) */}
          {!isSharedView && (
            <button className="btn secondary" onClick={() => navigate('/step/6')}>
              Retour
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Génère un lien de partage côté client (pas d'API à appeler).
 *
 * Le token est une chaîne base64url encodant { exp: timestampMs + 7j }.
 * Pas de signature cryptographique (MVP avec données fictives).
 * Pour de vraies données sensibles, repasser par /api/share-token (JWT signé).
 */
async function handleShare(setShareStatus) {
  setShareStatus('loading');
  try {
    const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = btoa(JSON.stringify({ exp: expMs, v: 1 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = `${window.location.origin}/#/report?t=${token}`;

    // Copie dans le presse-papier avec fallback si l'API Clipboard est indispo
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch (_) {
      // ignore, on tente le fallback
    }
    if (!copied) {
      // Fallback : textarea temporaire + execCommand('copy')
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch (_) {
        /* noop */
      }
      ta.remove();
    }

    if (!copied) {
      // Dernier recours : afficher le lien dans un prompt pour copie manuelle
      window.prompt('Copiez ce lien de partage (valide 7 jours) :', url);
    }

    setShareStatus('copied');
    setTimeout(() => setShareStatus('idle'), 4000);
  } catch (e) {
    console.error('Partage impossible', e);
    setShareStatus('error');
    setTimeout(() => setShareStatus('idle'), 4000);
  }
}

/**
 * Déclenche l'impression PDF via le navigateur.
 *
 * Utilise window.print() (natif, fonctionne partout). L'utilisateur choisit
 * ensuite "Enregistrer au format PDF" dans la boîte de dialogue d'impression.
 *
 * L'endpoint serverless /api/report-pdf (Puppeteer) reste en place pour une
 * future évolution où on voudrait un PDF généré côté serveur sans prompt.
 */
function downloadPdf() {
  window.print();
}

// ===========================================================================
// Styles (embarqués) — utilise les variables CSS --primary / --secondary
// alimentées par l'objet agence.
// ===========================================================================
const reportCss = `
  .report-root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--secondary);
    background: #f5f5f5;
    max-width: 900px;
    margin: 0 auto;
    padding: 0;
    line-height: 1.55;
  }
  .report-root section,
  .report-root footer {
    background: #fff;
    padding: 40px 48px;
    margin: 0;
  }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--primary);
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
    margin: 0 0 24px;
  }

  /* ====== 1. Cover ====== */
  .cover {
    min-height: 900px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 60px 48px !important;
  }
  .cover-logo { max-width: 180px; max-height: 80px; margin-bottom: 20px; align-self: flex-start; }
  .cover-bar { width: 100%; height: 4px; background: var(--primary); margin-bottom: 60px; }
  .cover-title { font-size: 42px; font-weight: 700; letter-spacing: 4px; margin: 40px 0 16px; color: var(--secondary); }
  .cover-address { font-size: 20px; font-weight: 600; margin: 0 0 40px; color: var(--secondary); }
  .cover-hero { width: 100%; margin: 20px 0 40px; }
  .cover-hero-placeholder {
    width: 100%; aspect-ratio: 16 / 9; background: linear-gradient(135deg, var(--primary)22, #f0f0f0);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 14px; font-weight: 600;
  }
  .cover-meta { margin: 40px 0; font-size: 14px; color: var(--secondary); line-height: 1.8; }
  .cover-meta strong { color: var(--primary); }
  .cover-footer { margin-top: auto; padding-top: 40px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); width: 100%; }

  /* ====== 2. Letter ====== */
  .letter-header { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 13px; line-height: 1.6; }
  .letter-from, .letter-to { max-width: 45%; }
  .letter-from strong, .letter-to strong { color: var(--secondary); display: block; margin-bottom: 4px; }
  .letter-date { text-align: right; font-size: 13px; color: var(--secondary); margin: 0 0 24px; }
  .letter-object { font-size: 14px; margin: 0 0 24px; padding-bottom: 8px; border-bottom: 2px solid var(--primary); }
  .letter-body { font-size: 14px; line-height: 1.7; }
  .letter-body p { margin: 0 0 14px; }
  .letter-signature { margin-top: 40px; font-size: 13px; line-height: 1.6; }
  .letter-signature strong { color: var(--primary); }
  .signature-img { max-height: 60px; display: block; margin-bottom: 8px; }

  /* ====== 3. Summary ====== */
  .summary-hero { text-align: center; padding: 32px 0; border: 2px solid var(--primary); border-radius: 12px; background: linear-gradient(180deg, #fff 0%, var(--primary)0a 100%); margin-bottom: 24px; }
  .summary-label { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .summary-price { font-size: 54px; font-weight: 700; color: var(--primary); margin: 8px 0; letter-spacing: -1px; }
  .summary-range { font-size: 15px; color: var(--secondary); }
  .summary-kpis { display: flex; justify-content: space-around; gap: 16px; margin: 24px 0; }
  .kpi { text-align: center; flex: 1; }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--secondary); }
  .kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .kpi.kpi-highlight .kpi-value { color: var(--primary); }
  .summary-reco { padding: 16px 20px; background: #f7f7f7; border-left: 4px solid var(--primary); border-radius: 4px; font-size: 14px; }

  /* ====== 4. Property ====== */
  .property-gallery { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 24px; height: 280px; }
  .photo-main { background: linear-gradient(135deg, var(--border), #c5c5c5); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: 600; font-size: 13px; }
  .photo-grid { display: grid; grid-template-rows: repeat(3, 1fr); gap: 12px; }
  .photo-thumb { background: linear-gradient(135deg, var(--border), #d0d0d0); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: 500; font-size: 12px; }
  .property-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 20px; }
  .spec-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .spec-row span { color: var(--muted); }
  .spec-row strong { color: var(--secondary); }
  .property-desc { font-size: 14px; line-height: 1.7; color: var(--secondary); margin: 16px 0; }
  .property-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-block; background: var(--primary)15; color: var(--primary); border: 1px solid var(--primary)40; border-radius: 14px; padding: 3px 12px; font-size: 12px; font-weight: 600; }

  /* DPE badge */
  .dpe-badge { display: inline-block; min-width: 20px; padding: 2px 6px; border-radius: 4px; color: #fff; font-weight: 700; text-align: center; }
  .dpe-A { background: #319c3a; }
  .dpe-B { background: #67b045; }
  .dpe-C { background: #cadb2c; color: var(--text); }
  .dpe-D { background: #f5e638; color: var(--text); }
  .dpe-E { background: #f1a025; }
  .dpe-F { background: #e86a2e; }
  .dpe-G { background: #d63024; }

  /* ====== 5. Market ====== */
  .market-zone { margin: -16px 0 18px; font-size: 13px; color: var(--muted); font-style: italic; }
  /* Flex plutôt que grid : la grille sert à 3 tuiles (marché local) et à 4
     (activité réseau), et auto-fit créait des colonnes vides. */
  .market-kpis { display: flex; gap: 16px; margin-bottom: 24px; }
  .market-source { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0 0 20px; }
  .market-tension { margin: 16px 0; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .tension-badge { display: inline-block; background: var(--primary)15; color: var(--primary); border: 1px solid var(--primary)40; border-radius: 6px; padding: 4px 12px; font-weight: 600; font-size: 13px; }
  .tension-score { font-size: 13px; color: var(--muted); font-weight: 600; }
  .market-caption { font-size: 13px; color: var(--secondary); }
  .market-commodites { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border); }
  .market-commodites > h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--secondary); margin: 0 0 14px; }
  .commod-cat { margin-bottom: 12px; }
  .commod-cat h4 { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px; }
  .commod-cat ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .commod-cat li { font-size: 13px; color: var(--secondary); line-height: 1.5; padding-left: 14px; position: relative; }
  .commod-cat li::before { content: '•'; position: absolute; left: 0; color: var(--primary); }
  .commod-cat li strong { font-weight: 600; color: var(--secondary); }
  .commod-cat li span { color: var(--muted); }

  /* ====== 6. Personas acquéreurs ====== */
  .section-intro { font-size: 14px; color: var(--secondary); margin: 0 0 20px; line-height: 1.6; }
  .personas-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
  .persona-card { border: 1px solid var(--border); border-radius: 10px; padding: 18px 10px; background: #fff; text-align: center; cursor: pointer; transition: all 0.18s; position: relative; }
  .persona-card:hover { border-color: var(--primary)60; background: var(--primary)05; }
  .persona-card.active { border: 1px solid var(--primary); background: var(--primary)15; }
  .persona-card.active::after { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid var(--primary); }
  .persona-count { font-size: 28px; font-weight: 700; color: var(--secondary); line-height: 1; }
  .persona-card.active .persona-count { color: var(--primary); }
  .persona-name { font-size: 12px; font-weight: 700; color: var(--secondary); margin-top: 8px; }
  .persona-sub { font-size: 10px; color: var(--muted); margin-top: 2px; line-height: 1.3; }

  .persona-focus { border: 1px solid var(--primary)40; border-radius: 10px; background: linear-gradient(180deg, var(--primary)0a 0%, #fff 60%); padding: 20px 22px; margin-bottom: 16px; }
  .persona-focus-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .persona-focus-title { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: var(--secondary); }
  .persona-focus-title .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
  .count-pill { background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
  .persona-focus-meta { display: flex; gap: 16px; font-size: 11px; color: var(--muted); flex-wrap: wrap; }
  .persona-focus-meta strong { color: var(--secondary); }
  .persona-focus-meta .compat { color: var(--primary); }


  /* ====== 8. Arguments ====== */
  .arg-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .arg-col { padding: 20px; border-radius: 8px; background: #fafafa; }
  .arg-col h3 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .arg-strong h3 { color: var(--primary); }
  .arg-vigilance h3 { color: #e8a838; }
  .arg-col ul { list-style: none; padding: 0; margin: 0; }
  .arg-col li { padding: 8px 0 8px 16px; border-bottom: 1px solid #ebebeb; font-size: 13px; position: relative; }
  .arg-col li:last-child { border-bottom: none; }
  .arg-col li::before { content: ''; position: absolute; left: 0; top: 14px; width: 6px; height: 6px; border-radius: 50%; }
  .arg-strong li::before { background: var(--primary); }
  .arg-vigilance li::before { background: #e8a838; }

  /* ====== 10. Proposition (prix unique) ====== */
  .proposition { border: 2px solid var(--primary); border-radius: 12px; background: linear-gradient(180deg, var(--primary)0a 0%, #fff 70%); padding: 32px 36px; text-align: center; }
  .prop-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; }
  .prop-price { font-size: 52px; font-weight: 700; color: var(--primary); letter-spacing: -1px; line-height: 1.1; margin: 10px 0 4px; }
  .prop-m2 { font-size: 15px; color: var(--secondary); }
  .prop-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin: 26px auto 0; max-width: 460px; padding-top: 16px; border-top: 1px solid var(--primary)25; text-align: left; }
  .prop-row span { font-size: 13px; color: var(--secondary); }
  .prop-row strong { font-size: 24px; font-weight: 700; color: var(--primary); }

  /* ====== 11. Contact ====== */
  .contact-card { display: grid; grid-template-columns: auto 1fr 1fr; gap: 24px; align-items: start; padding: 20px; border: 1px solid var(--border); border-radius: 10px; }
  .agent-photo { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; }
  .contact-identity { font-size: 14px; line-height: 1.7; }
  .agent-name { font-size: 17px; font-weight: 700; color: var(--primary); }
  .agent-role { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
  .contact-agence { font-size: 13px; line-height: 1.7; color: var(--secondary); }
  .contact-agence strong { color: var(--primary); }
  .agence-logo { max-width: 120px; max-height: 50px; margin-bottom: 8px; }

  /* ====== 12. Legal ====== */
  .legal { font-size: 11px; color: #6b6b6b; }
  .legal h3 { color: var(--secondary); text-transform: uppercase; letter-spacing: 1px; font-size: 12px; margin: 0 0 12px; }
  .legal ul { padding-left: 18px; margin: 0 0 16px; }
  .legal li { margin-bottom: 6px; line-height: 1.6; }
  .legal-agence { padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); line-height: 1.6; }

  /* ====== 5 quater. Notre activité dans votre secteur ====== */
  .reseau-part { font-size: 14px; margin: 0 0 24px; padding: 12px 16px; background: var(--primary)0a; border-left: 4px solid var(--primary); border-radius: 4px; }
  .reseau-part strong { color: var(--primary); }
  .reseau-block { margin-bottom: 28px; }
  .reseau h3, .reseau-distrib h3 { font-size: 14px; font-weight: 600; color: var(--primary); margin: 0 0 10px; }
  .reseau-sub { font-size: 13px; color: var(--muted); margin: 0 0 12px; line-height: 1.6; }

  .reseau-distrib { margin: 0 0 28px; }
  .distrib-row { display: grid; grid-template-columns: 150px 1fr 90px; gap: 12px; align-items: center; padding: 4px 0; font-size: 12px; }
  .distrib-label { color: var(--secondary); white-space: nowrap; }
  .distrib-bar { display: block; height: 14px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
  .distrib-bar i { display: block; height: 100%; background: var(--border); border-radius: 3px; }
  .distrib-row.reco .distrib-bar i { background: var(--primary); }
  .distrib-row.reco .distrib-label { font-weight: 700; color: var(--primary); }
  .distrib-count { font-size: 12px; color: var(--muted); }
  .distrib-count em { display: inline-block; margin-left: 6px; font-style: normal; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #fff; background: var(--primary); padding: 1px 6px; border-radius: 8px; }
  .distrib-caption { font-size: 13px; color: var(--secondary); margin: 12px 0 0; line-height: 1.6; }

  /* Plan du secteur : fond sombre assumé — on force le rendu des couleurs à
     l'impression, sinon le navigateur vide les aplats et le plan disparaît. */
  .carte-wrap { border-radius: 10px; overflow: hidden; background: #1c1a19; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .carte-svg { display: block; width: 100%; height: auto; font-family: inherit; }
  .carte-legende { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0; }

  .conc-list { list-style: none; padding: 0; margin: 0; }
  .conc-list li { display: grid; grid-template-columns: 10px 1fr auto auto; gap: 12px; align-items: center; padding: 9px 0; border-bottom: 1px solid #f2f2f2; font-size: 12px; }
  .conc-dot { width: 8px; height: 8px; border-radius: 50%; }
  .conc-main strong { display: block; font-size: 13px; color: var(--secondary); }
  .conc-loc { font-size: 11px; color: var(--muted); }
  .conc-prix { text-align: right; font-weight: 700; color: var(--secondary); white-space: nowrap; }
  .conc-prix em { display: block; font-style: normal; font-weight: 500; font-size: 11px; color: var(--muted); }
  .conc-age { font-size: 11px; color: var(--muted); white-space: nowrap; min-width: 130px; text-align: right; }
  .reseau-source { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0; padding-top: 12px; border-top: 1px solid var(--border); }

  /* ====== 10 bis. Plan de commercialisation ====== */
  .plan-timeline { list-style: none; padding: 0; margin: 0 0 28px; position: relative; }
  .plan-timeline::before { content: ''; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 2px; background: var(--border); }
  .plan-step { display: grid; grid-template-columns: 24px 170px 1fr; gap: 12px; align-items: start; padding: 0 0 20px; position: relative; }
  .plan-step:last-child { padding-bottom: 0; }
  .plan-dot { width: 12px; height: 12px; margin-top: 3px; border-radius: 50%; background: #fff; border: 3px solid var(--primary); box-sizing: border-box; z-index: 1; }
  .plan-when { font-size: 12px; line-height: 1.5; }
  .plan-jour { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; background: var(--primary); padding: 1px 7px; border-radius: 8px; margin-bottom: 4px; }
  .plan-date { display: block; color: var(--muted); }
  .plan-titre { font-size: 14px; font-weight: 600; color: var(--secondary); }
  .plan-detail { font-size: 12px; color: var(--muted); line-height: 1.6; margin-top: 2px; }

  .plan-engagements { padding: 18px 22px; background: #f7f7f7; border-left: 4px solid var(--primary); border-radius: 4px; margin-bottom: 16px; }
  .plan-engagements h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--primary); margin: 0 0 10px; }
  .plan-engagements ul { list-style: none; padding: 0; margin: 0; }
  .plan-engagements li { position: relative; padding: 5px 0 5px 18px; font-size: 13px; color: var(--secondary); line-height: 1.6; }
  .plan-engagements li::before { content: '✓'; position: absolute; left: 0; color: var(--primary); font-weight: 700; }
  .plan-note { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0; }

  /* ====== Actions (UI-only) ====== */
  .actions { text-align: center; padding: 32px; background: #fff; border-top: 1px solid var(--border); }
  .btn { display: inline-block; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; margin: 0 6px; }
  .btn.primary { background: var(--primary); color: #fff; }
  .btn.secondary { background: #fff; color: var(--primary); border: 2px solid var(--primary); }
  .btn.share { background: #fff; color: var(--secondary); border: 2px solid var(--border); }
  .btn.share:disabled { opacity: 0.6; cursor: wait; }

  /* ====== Print media ====== */
  @media print {
    body { margin: 0; padding: 0; background: #fff !important; }
    .report-root { max-width: none; background: #fff; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    .report-root section, .report-root footer { padding: 24px 32px; }
    .reseau-block, .reseau-distrib, .plan-engagements { break-inside: avoid; page-break-inside: avoid; }
    .plan-step, .conc-list li, .carte-wrap { break-inside: avoid; page-break-inside: avoid; }
  }
`;
