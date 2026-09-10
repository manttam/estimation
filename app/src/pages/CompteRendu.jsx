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
import CarteCommodites from '../components/CarteCommodites';
import {
  buildMarcheLocal,
  STATUTS,
} from '../data/marcheLocalIdeeri';
import { POI_DEMO } from '../data/poiCategories';
import { PROPERTY_PHOTOS } from '../data/propertyPhotos';
import { pickDocumentPhotos } from '../utils/photosDocument';
import BlocAppIdeeri from '../components/BlocAppIdeeri';
import {
  MARCHE_FINANCEMENT_DEMO,
  mensualite,
  fetchMarcheFinancement,
} from '../data/marcheFinancement';
import { getCompPhotos } from '../utils/compPhotos';

/* ───── Marché local Ideeri ─────────────────────────────────────────────
 * Périmètre figé dans le document : le mandant doit lire un cadre stable,
 * pas les filtres que l'agent a fait bouger à l'écran en Step1.
 */
const MARCHE_LOCAL_RAYON_KM = 5;
const MARCHE_LOCAL_PERIODE_MOIS = 24;

/* Concurrence : un acquéreur élargit sa recherche bien au-delà de la rue, on
 * regarde donc plus large que le périmètre d'analyse des ventes signées. */
const CONCURRENCE_RAYON_KM = 10;
/* Lien de téléchargement de l'app, encodé dans le QR code de la section
 * « Votre bien ». Idéalement un lien intelligent qui redirige vers l'App
 * Store ou Google Play selon le téléphone : un seul QR à imprimer.
 * Surchargeable par agence via reportStore.agence.lienApp.
 * ⚠️ Valeur par défaut à remplacer par le vrai lien de production. */
const LIEN_APP_DEFAUT = 'https://ideeri.fr';

/* Marge appliquée à la borne haute de l'estimation : au-delà, un bien ne vise
 * plus les mêmes acquéreurs et ne concurrence donc pas celui-ci. */
const CONCURRENCE_MARGE_PRIX = 1.1;
/* Bande de surface acceptée autour de celle du bien : au-delà, on ne parle
 * plus du même produit. */
const CONCURRENCE_BANDE_SURFACE = 0.25;

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

/* Un point fort / de vigilance arrive soit comme une chaîne (saisie de
 * l'agent en étape 1) soit comme un objet valorisé { label, montant }.
 * `montant` à null signifie « non chiffré ». */
const normPoint = (pt) =>
  typeof pt === 'string'
    ? { label: pt, montant: null }
    : { label: pt?.label || '', montant: Number.isFinite(pt?.montant) ? pt.montant : null };

/* Montant signé, format français : « +7 000 € », « −15 000 € ». Le signe
 * moins est un vrai signe moins typographique, pas un trait d'union. */
const fmtMontant = (n) =>
  `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-FR')} €`;

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

/* Palette du plan de secteur.
 *
 * Le fond était noir : ça se tenait seul, mais le noir n'apparaissait nulle
 * part ailleurs dans le document, et un aplat sombre pleine largeur coûte
 * cher à l'impression. On reprend donc les gris du document — même famille
 * que les cartes, les filets et les libellés — et l'accent reste la couleur
 * d'agence, qui n'est plus figée en vert.
 */
const CARTE = {
  fond: '#fbfbfb',
  bloc: '#eceeef',
  route: '#dfe2e4',
  pastilleFond: '#ffffff',
  pastilleBord: '#d8dcde',
  texte: '#33383d',
  voie: '#8a9096',
  legende: '#6b7075',
  echelle: '#9aa0a6',
  accent: 'var(--primary)',
};

const CARTE_W = 1000;
const CARTE_H = 620;

/**
 * HistogrammeConcurrence — répartition des biens concurrents par distance.
 *
 * Un simple décompte par tranche d'un kilomètre : c'est la pression
 * concurrentielle qui parle au mandant, pas le détail des annonces adverses.
 * Rendu en SVG inline, sans librairie : ça sort tel quel à l'impression.
 */
function HistogrammeConcurrence({ tranches, vignettes = [], trancheProche }) {
  const W = 980;
  const H = 380;
  const M = { haut: 46, bas: 46, gauche: 42, droite: 18 };

  const maxCount = Math.max(1, ...tranches.map((t) => t.count));
  // Deux crans d'air au-dessus de la plus haute barre : les vignettes photo
  // se posent dans cet espace sans chevaucher la grille.
  const yMax = Math.max(3, maxCount + 2);

  const x0 = M.gauche;
  const x1 = W - M.droite;
  const yBase = H - M.bas;
  const yTop = M.haut;

  const slot = (x1 - x0) / tranches.length;
  const largeurBarre = slot * 0.62;
  const centreDe = (i) => x0 + slot * i + slot / 2;
  const yDe = (v) => yBase - (v / yMax) * (yBase - yTop);

  const graduations = Array.from({ length: yMax + 1 }, (_, i) => i);

  return (
    <svg
      className="conc-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Nombre de biens concurrents par tranche de distance, de 1 à ${tranches.length} kilomètres.`}
    >
      {/* Grille horizontale */}
      {graduations.map((v) => (
        <g key={v}>
          <line
            x1={x0}
            y1={yDe(v)}
            x2={x1}
            y2={yDe(v)}
            stroke={v === 0 ? '#9aa0a6' : '#e2e5e8'}
            strokeWidth={v === 0 ? 1.4 : 1}
            strokeDasharray={v === 0 ? undefined : '5 5'}
          />
          <text x={x0 - 10} y={yDe(v) + 4} textAnchor="end" fontSize="13" fill="#9aa0a6">
            {v}
          </text>
        </g>
      ))}

      {/* Repère de la tranche la plus proche */}
      {trancheProche && (
        <line
          x1={centreDe(trancheProche - 1)}
          y1={yTop - 10}
          x2={centreDe(trancheProche - 1)}
          y2={yBase}
          stroke="#c3c8cd"
          strokeWidth="1"
          strokeDasharray="5 5"
        />
      )}

      {/* Barres */}
      {tranches.map((t, i) => {
        if (t.count === 0) return null;
        const proche = t.km === trancheProche;
        return (
          <rect
            key={t.km}
            x={centreDe(i) - largeurBarre / 2}
            y={yDe(t.count)}
            width={largeurBarre}
            height={yBase - yDe(t.count)}
            fill="var(--primary)"
            opacity={proche ? 1 : 0.35}
          />
        );
      })}

      {/* Vignettes photo des concurrents les plus proches */}
      <defs>
        {vignettes.map((v) => (
          <clipPath id={`conc-clip-${v.id}`} key={v.id}>
            <circle cx={centreDe(v.km - 1)} cy={yDe(tranches[v.km - 1]?.count || 0) - 30} r="21" />
          </clipPath>
        ))}
      </defs>
      {vignettes.map((v) => {
        const cx = centreDe(v.km - 1);
        const cy = yDe(tranches[v.km - 1]?.count || 0) - 30;
        return (
          <g key={v.id}>
            <image
              href={v.src}
              x={cx - 21}
              y={cy - 21}
              width="42"
              height="42"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#conc-clip-${v.id})`}
            />
            <circle cx={cx} cy={cy} r="21" fill="none" stroke="var(--primary)" strokeWidth="2.5" />
          </g>
        );
      })}

      {/* Axe des distances */}
      {tranches.map((t, i) => (
        <text
          key={t.km}
          x={centreDe(i)}
          y={yBase + 24}
          textAnchor="middle"
          fontSize="14"
          fill="#6b7075"
        >
          {t.km}
        </text>
      ))}
      <text x={x1} y={yBase + 42} textAnchor="end" fontSize="13" fill="#9aa0a6">
        distance (km)
      </text>
    </svg>
  );
}

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
            fill={STATUTS[pt.statut]?.color || '#46B962'}
            stroke={pt.mine ? '#33383d' : CARTE.fond}
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
          fill="#ffffff"
          transform={`translate(${CX - 12}, ${CY - 60})`}
        />
        <rect x={CX - 74} y={CY - 108} width="148" height="31" rx="7" fill={CARTE.accent} />
        <text x={CX} y={CY - 87} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="700">
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
        "Notre méthodologie s'appuie sur l'analyse des ventes signées dans votre secteur, sur les projets d'achat actifs de notre fichier acquéreurs et sur les caractéristiques propres de votre bien.",
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

  /* ── Définition du prix ───────────────────────────────────────────────
   * Les points forts et de vigilance, chacun avec son impact chiffré, qui
   * expliquent l'écart entre la valeur des comparables et le prix retenu.
   *
   * La valeur des comparables est obtenue par différence (prix retenu moins
   * la somme des ajustements) : c'est la seule façon de garantir que le
   * décompte présenté au mandant tombe juste au centime. Un tableau qui ne
   * s'additionne pas ruinerait l'argumentaire qu'il est censé porter.
   */
  const definitionPrix = useMemo(() => {
    const lignes = [
      ...(effAvisValeur.pointsForts || []).map(normPoint),
      ...(effAvisValeur.pointsVigilance || []).map(normPoint),
    ].filter((pt) => pt.label);
    const somme = lignes.reduce((t, pt) => t + (pt.montant || 0), 0);
    const retenu = recommendedStrategy?.prix || 0;
    // Seuls les points chiffrés entrent dans le décompte : douze lignes de
    // même poids visuel, dont six « non chiffré », ne se lisaient plus. Les
    // autres sont renvoyés à l'argumentaire, qui les détaille déjà.
    const chiffrees = lignes.filter((pt) => pt.montant !== null);
    return {
      chiffrees,
      nbNonChiffrees: lignes.length - chiffrees.length,
      base: retenu - somme,
      retenu,
    };
  }, [effAvisValeur.pointsForts, effAvisValeur.pointsVigilance, recommendedStrategy]);

  // Projets d'achat dont le plafond de budget couvre le prix retenu.
  const projetsCompatibles = (effAvisValeur.acquereurs || []).filter(
    (a) => a.budget >= (recommendedStrategy?.prix || 0)
  ).length;

  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  /* Annexes : ce que les pastilles disaient, désormais une ligne de la fiche
   * (« Annexes : ascenseur, cave » plutôt qu'une rangée de badges). */
  const annexes = useMemo(() => {
    if (!isLive) return 'Balcon de 5,2 m², cave, ascenseur';
    const b = activeBien?.bien || {};
    const parts = [];
    if (b.exterieur && b.exterieur !== 'aucun') parts.push(b.exterieur);
    if (b.parking && b.parking !== 'aucun') parts.push(`parking ${b.parking}`);
    if (b.ascenseur) parts.push('ascenseur');
    if (parts.length === 0) return 'Aucune';
    const s = parts.join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [isLive, activeBien]);

  /* Marché communal et conditions de financement (DVF + INSEE + Banque de
   * France, via /api/marche-financement). En démo on affiche l'extrait réel
   * du millésime pour Lyon 3e. Échec silencieux : la section disparaît
   * plutôt que d'afficher des tirets. */
  const [marcheFi, setMarcheFi] = useState(isLive ? null : MARCHE_FINANCEMENT_DEMO);
  useEffect(() => {
    if (!isLive) return undefined;
    const citycode = activeBien?.adresse?.citycode;
    if (!citycode) return undefined;
    const ctrl = new AbortController();
    fetchMarcheFinancement(citycode, ctrl.signal).then((data) => {
      if (!ctrl.signal.aborted) setMarcheFi(data);
    });
    return () => ctrl.abort();
  }, [isLive, activeBien]);

  /* Simulation d'emprunt sur le prix retenu, au taux du millésime assurance
   * comprise. Sans apport ni frais d'acquisition : on annonce l'hypothèse
   * dans la note plutôt que de la masquer dans le calcul. */
  const simulation = useMemo(() => {
    const taux = marcheFi?.taux?.avecAssurance;
    const prix = recommendedStrategy?.prix;
    if (!Number.isFinite(taux) || !Number.isFinite(prix) || prix <= 0) return null;
    return {
      taux,
      durees: [20, 25].map((annees) => ({ annees, montant: mensualite(prix, taux, annees) })),
    };
  }, [marcheFi, recommendedStrategy]);

  // Lien encodé dans le QR : réglage d'agence si renseigné, défaut sinon.
  const lienApp = effAgence.lienApp || LIEN_APP_DEFAUT;

  /* Photos du document : photos uploadées en étape 2 si présentes, sinon le
   * catalogue de démo. Même sélection que l'avis de valeur (helper partagé) :
   * les deux documents montrent le même bien, ils montrent les mêmes photos. */
  const photosDoc = useMemo(() => {
    const source = isLive && livePhotos.length > 0
      ? livePhotos.map((ph) => ({ ...ph, url: ph.src }))
      : PROPERTY_PHOTOS;
    return pickDocumentPhotos(source, 5);
  }, [isLive, livePhotos]);
  const photoPrincipale = photosDoc[0]?.url || null;
  const photosVignettes = photosDoc.slice(1);

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

    /* ── Biens en concurrence ──────────────────────────────────────────
     * Un concurrent n'est pas n'importe quel bien à vendre dans le secteur :
     * c'est un bien qui vise les mêmes acquéreurs. On retient donc, en plus
     * du périmètre et du plafond de prix, les caractéristiques qui font qu'un
     * acquéreur hésite entre deux biens : même type, typologie à une pièce
     * près, surface dans une bande de ±CONCURRENCE_BANDE_SURFACE.
     */
    const typeCible = isLive
      ? (activeBien?.bien?.type === 'maison' ? 'Maison' : 'Appartement')
      : 'Appartement';
    const piecesCible = Number(effProperty.pieces);
    const surfaceCible = Number(effProperty.surface);
    const plafond = Math.round((effAvisValeur.prixHaut || 0) * CONCURRENCE_MARGE_PRIX);

    const concurrents = biens
      .filter((b) => b.statut === 'en_vente')
      .filter((b) => b.distance <= CONCURRENCE_RAYON_KM)
      .filter((b) => b.type === typeCible)
      .filter((b) => !Number.isFinite(piecesCible) || Math.abs(b.pieces - piecesCible) <= 1)
      .filter((b) => {
        // Surface non renseignée : on ne peut pas trancher, on garde le bien.
        if (!Number.isFinite(surfaceCible) || surfaceCible <= 0) return true;
        return Math.abs(b.surface - surfaceCible) / surfaceCible <= CONCURRENCE_BANDE_SURFACE;
      })
      .filter((b) => !plafond || b.prix <= plafond)
      .sort(parDistance);

    // Tranches d'un kilomètre : la tranche k regroupe les biens situés
    // entre k-1 et k km du bien estimé.
    const tranches = Array.from({ length: CONCURRENCE_RAYON_KM }, (_, i) => ({
      km: i + 1,
      count: concurrents.filter((b) => b.distance > i && b.distance <= i + 1).length,
    }));

    // Vignettes photo : les deux concurrents les plus proches, chacun au-dessus
    // de sa tranche. Au-delà de deux, le graphique devient illisible.
    const vignettes = [];
    concurrents.forEach((b) => {
      if (vignettes.length >= 2) return;
      const km = Math.max(1, Math.ceil(b.distance));
      if (vignettes.some((v) => v.km === km)) return;
      const photos = getCompPhotos({ id: b.id });
      if (photos[0]) vignettes.push({ km, src: photos[0], id: b.id });
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
      concurrence: {
        rayonKm: CONCURRENCE_RAYON_KM,
        total: concurrents.length,
        tranches,
        vignettes,
        // Tranche la plus proche occupée : c'est la concurrence immédiate,
        // celle qu'on met en avant.
        trancheProche: tranches.find((t) => t.count > 0)?.km || null,
      },
    };
  }, [activeBien, isLive, prixM2Reco, effAvisValeur.prixHaut, effProperty.pieces, effProperty.surface]);

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

  /* Profils triés par poids décroissant, « Autre » toujours en dernier :
   * c'est un réceptacle, pas un profil qui mérite la première place même
   * quand il pèse lourd. `teinte` dégrade l'opacité du plus gros au plus
   * petit, ce qui donne le dégradé de la barre sans figer une couleur (la
   * couleur d'agence reste pilotée par --primary). */
  const personasTries = useMemo(() => {
    const total = personasList.reduce((s, p) => s + (p.count || 0), 0) || 1;
    const tries = personasList
      .slice()
      .sort((x, y) => {
        if (x.key === 'autre') return 1;
        if (y.key === 'autre') return -1;
        return (y.count || 0) - (x.count || 0);
      });
    const nbColores = tries.filter((p) => p.key !== 'autre').length || 1;
    let rang = 0;
    return tries.map((p) => {
      const teinte = p.key === 'autre' ? 1 : 1 - (rang++ / nbColores) * 0.62;
      return { ...p, pct: Math.round(((p.count || 0) / total) * 100), teinte };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="cover-hero">
          {photoPrincipale ? (
            <>
              <img src={photoPrincipale} alt="Photo principale du bien" className="cover-hero-img" />
              {photosVignettes.length > 0 && (
                <div className="cover-strip">
                  {photosVignettes.map((ph, i) => (
                    <figure key={ph.id || i}>
                      <img src={ph.url} alt={ph.label || ''} />
                      {ph.label && <figcaption>{ph.label}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="cover-hero-placeholder">
              <span>{fmtNb(effProperty.surface)} m² · T{effProperty.pieces} · Étage {effProperty.etage}</span>
            </div>
          )}
        </div>
        <div className="cover-meta">
          <div>Référence : <strong className="mono">{effProperty.reference}</strong></div>
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
          {/* Aucun prix dans la lettre : le prix de présentation n'apparaît
              qu'une fois dans le document, en section « Notre proposition ». */}
          <p>
            Au terme de notre analyse, vous trouverez notre recommandation de prix
            de présentation en section « Notre proposition ».
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

        <div className="bien-grid">
          <aside>
            <div className="bien-photo">
              {photoPrincipale ? (
                <img className="bien-photo-img" src={photoPrincipale} alt="Photo du bien" />
              ) : (
                <div className="bien-photo-vide">photo du bien · à brancher</div>
              )}
              {photosVignettes.length > 0 && (
                <div className="bien-vignettes">
                  {photosVignettes.slice(0, 3).map((ph, i) => (
                    <div
                      key={ph.id || i}
                      className="bien-vignette"
                      style={{ backgroundImage: `url(${ph.url})` }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Échelle DPE : le mandant situe son bien d'un coup d'œil, sans
                avoir à interpréter une lettre isolée. */}
            {effProperty.dpe && effProperty.dpe !== '—' && (
              <div className="card dpe-card">
                <div className="eyebrow">Performance énergétique</div>
                <div className="dpe-echelle">
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => (
                    <span
                      key={l}
                      className={`dpe-lettre${l === effProperty.dpe ? ` active dpe-${l}` : ''}`}
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <p className="dpe-texte">
                  Étiquette énergie <strong>{effProperty.dpe}</strong>
                  {(isLive ? effProperty.ges : 'D') && (isLive ? effProperty.ges : 'D') !== '—' && (
                    <>
                      {' '}· gaz à effet de serre{' '}
                      <strong>{isLive ? effProperty.ges : 'D'}</strong>
                    </>
                  )}
                  . Diagnostic valable 10 ans à compter de sa réalisation.
                </p>
              </div>
            )}
          </aside>

          <div className="card">
            <div className="kv-row">
              <span className="kv-key">Type</span>
              <span className="kv-val">
                {isLive ? (activeBien?.bien?.type === 'maison' ? 'Maison' : 'Appartement') : 'Appartement'}{' '}
                T{effProperty.pieces}, {effProperty.chambres} chambre{plural(effProperty.chambres)}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Surface</span>
              <span className="kv-val">{fmtNb(effProperty.surface)} m² Carrez</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Étage</span>
              <span className="kv-val">{effProperty.etage}{isLive ? '' : ' / 6'}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Année</span>
              <span className="kv-val">{effProperty.annee}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Exposition</span>
              <span className="kv-val">{isLive ? (activeBien?.bien?.exposition || '—') : 'Sud-Est'}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Chauffage</span>
              <span className="kv-val">{isLive ? (effProperty.chauffage || '—') : 'Individuel gaz'}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Annexes</span>
              <span className="kv-val">{annexes}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">État</span>
              <span className="kv-val">{isLive ? (effProperty.etat || '—') : 'Bon état'}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Référence</span>
              <span className="kv-val mono">{effProperty.reference}</span>
            </div>

            {!isLive && (
              <p className="property-desc">
                Bel appartement T{effProperty.pieces} de {fmtNb(effProperty.surface)} m² traversant,
                situé au {effProperty.etage}ᵉ étage avec ascenseur d'un immeuble des années 1970 en
                bon état d'entretien. La cuisine ouverte sur le séjour lumineux offre un espace de
                vie agréable. Les menuiseries double vitrage performant et la chaudière gaz à
                condensation de 2018 permettent une consommation maîtrisée.
              </p>
            )}
          </div>
        </div>

        {/* Renvoi vers l'app : le document ne peut pas tout porter, le releve
            piece par piece y tiendrait dix pages. On oriente vers l'outil
            plutot que de le resumer mal. */}
        {/* Renvoi vers l'app : le document ne peut pas tout porter, le
            relevé pièce par pièce y tiendrait dix pages. */}
        <BlocAppIdeeri
          titre="Retrouvez tout le détail de votre bien, pièce par pièce, dans votre projet de vente."
          accent="pièce par pièce"
          sousTitre="Photos et relevé complet, accessibles à tout moment."
          lien={lienApp}
        />
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

        <div className="card">
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

        <p className="note">
          Source : DVF — transactions publiées par l'administration fiscale sur
          les 12 derniers mois dans le périmètre ci-dessus. Le délai de vente
          constaté et les ventes de notre réseau figurent en section
          « Notre activité dans votre secteur ».
        </p>

        <p className="market-caption">
          Fourchette de prix observée sur la typologie T{effProperty.pieces} dans votre secteur :
          <strong> {effContexteZone.market.fourchette} €/m²</strong>.
        </p>
        </div>

        {/* Carte du secteur : commodités relevées autour du bien et risques
            répertoriés sur la commune. En mode live les POI viennent
            d'Overpass via l'étape 3 ; en démo, du jeu fictif Lyon 3ᵉ. */}
        <div className="market-carte">
          <div className="eyebrow">Commodités et risques autour du bien</div>
          <CarteCommodites
            centre={
              isLive && Array.isArray(activeBien?.adresse?.coords)
                ? activeBien.adresse.coords
                : DEMO_COORDS
            }
            labelBien={effProperty.adresse || 'Votre bien'}
            poi={isLive ? effContexteZone.poi : POI_DEMO}
            risques={isLive ? effContexteZone.risques : contexteZone.risques}
            rayonMetres={effContexteZone.rayonMetres || 1000}
            print={isPrintMode}
          />
        </div>

      </section>

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

          <div className="card">
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
          </div>

          {marcheLocal.paliers.length > 0 && (
            <div className="card reseau-distrib">
              <div className="eyebrow">Prix au m² des ventes signées</div>
              {/* Distribution purement factuelle : aucun repère sur le prix
                  recommandé, qui n'apparaît qu'en section « Notre proposition ». */}
              {marcheLocal.paliers.map((pal) => (
                <div className="distrib-row" key={pal.from}>
                  <span className="distrib-label">{pal.label} €/m²</span>
                  <span className="distrib-bar">
                    <i style={{ width: `${pal.pct}%` }} />
                  </span>
                  <span className="distrib-count">{pal.count}</span>
                </div>
              ))}
              {marcheLocal.prixM2MedianVendus && (
                <p className="distrib-caption">
                  La médiane des ventes signées de notre réseau ressort à{' '}
                  <strong>{marcheLocal.prixM2MedianVendus.toLocaleString('fr-FR')} €/m²</strong>.
                </p>
              )}
            </div>
          )}

          {marcheLocal.carte.points.length > 0 && (
            <div className="card reseau-block">
              <div className="eyebrow">Les ventes signées autour de votre bien</div>
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
              <p className="note carte-legende">
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

          {marcheLocal.concurrence.total > 0 && (
            <div className="card reseau-block">
              <div className="eyebrow">Les biens en concurrence</div>
              <p className="reseau-sub">
                Les biens encore à vendre à moins de{' '}
                {marcheLocal.concurrence.rayonKm} km dont les caractéristiques sont
                comparables aux vôtres : même type de bien, typologie à une pièce
                près, surface à 25 % près et gamme de prix équivalente.
              </p>
              <HistogrammeConcurrence
                tranches={marcheLocal.concurrence.tranches}
                vignettes={marcheLocal.concurrence.vignettes}
                trancheProche={marcheLocal.concurrence.trancheProche}
              />
              <p className="conc-legende">
                {marcheLocal.concurrence.total} bien
                {plural(marcheLocal.concurrence.total)} en concurrence directe
                {marcheLocal.concurrence.trancheProche
                  ? `, le plus proche à moins de ${marcheLocal.concurrence.trancheProche} km.`
                  : '.'}
              </p>
            </div>
          )}

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
        {/* Répartition en barre empilée puis une ligne par profil. Aucun clic :
            le document part en PDF, un profil qu'il faut sélectionner pour voir
            son détail resterait invisible pour le mandant. */}
        <div className="card">
        <div className="prof-bar" aria-hidden="true">
          {personasTries.map((p) => (
            <span
              key={p.key}
              className="prof-bar-seg"
              style={{
                width: `${p.pct}%`,
                background: p.key === 'autre' ? '#c4c8cc' : 'var(--primary)',
                opacity: p.key === 'autre' ? 1 : p.teinte,
              }}
            />
          ))}
        </div>

        <ul className="prof-list">
          {personasTries.map((p) => (
            <li key={p.key}>
              <span
                className="prof-puce"
                style={{
                  background: p.key === 'autre' ? '#c4c8cc' : 'var(--primary)',
                  opacity: p.key === 'autre' ? 1 : p.teinte,
                }}
              />
              <span className="prof-nom">{p.name}</span>
              <span className="prof-part">
                {p.count} projet{plural(p.count)} · {p.pct} %
              </span>
              <span className="prof-budget">{p.budget}</span>
            </li>
          ))}
        </ul>
        </div>
        </>
        )}
      </section>

      {/* =============================================================
          SECTION 8 — Argumentaire de valorisation
          ============================================================= */}
      <section className="arguments">
        <h2 className="section-title">Argumentaire de valorisation</h2>

        <div className="card">
          <div className="split">
            <div className="arg-col arg-strong">
              <div className="eyebrow accent">Points forts</div>
              <ul className="bullets">
                {(effAvisValeur.pointsForts || []).length > 0 ? (
                  effAvisValeur.pointsForts.map((pt, i) => <li key={i}>{normPoint(pt).label}</li>)
                ) : (
                  <li className="arg-vide">Non renseigné</li>
                )}
              </ul>
            </div>
            <div className="arg-col arg-vigilance">
              <div className="eyebrow">Points de vigilance</div>
              <ul className="bullets">
                {(effAvisValeur.pointsVigilance || []).length > 0 ? (
                  effAvisValeur.pointsVigilance.map((pt, i) => <li key={i}>{normPoint(pt).label}</li>)
                ) : (
                  <li className="arg-vide">Non renseigné</li>
                )}
              </ul>
            </div>
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

        {/* Définition du prix : la valeur des comparables, puis chaque point
            fort ou de vigilance avec son impact chiffré. Les points non
            quantifiables restent affichés — ils comptent dans la décision
            même sans montant, et les masquer laisserait croire qu'ils ont
            été oubliés. */}
        {definitionPrix.chiffrees.length > 0 && (
          <div className="card def-prix">
            <div className="eyebrow">Définition du prix</div>

            <div className="def-row def-base">
              <span className="def-libelle">Méthode comparative</span>
              <span className="def-montant">
                {definitionPrix.base.toLocaleString('fr-FR')} €
              </span>
            </div>

            {definitionPrix.chiffrees.map((pt, i) => (
              <div className="def-row" key={i}>
                <span
                  className="def-puce"
                  style={{ background: pt.montant > 0 ? 'var(--primary)' : '#c0392b' }}
                />
                <span className="def-libelle">{pt.label}</span>
                <span className={`def-montant ${pt.montant > 0 ? 'def-plus' : 'def-moins'}`}>
                  {fmtMontant(pt.montant)}
                </span>
              </div>
            ))}

            <div className="def-row def-total">
              <span className="def-libelle">Base retenue</span>
              <span className="def-montant">
                {definitionPrix.retenu.toLocaleString('fr-FR')} €
              </span>
            </div>

            {definitionPrix.nbNonChiffrees > 0 && (
              <p className="note">
                {definitionPrix.nbNonChiffrees} autre
                {plural(definitionPrix.nbNonChiffrees)} point
                {plural(definitionPrix.nbNonChiffrees)} pèse
                {definitionPrix.nbNonChiffrees > 1 ? 'nt' : ''} sur la décision sans se
                traduire en euros — déjà intégré
                {plural(definitionPrix.nbNonChiffrees)} à la valeur des comparables du
                secteur, ou non chiffrable
                {plural(definitionPrix.nbNonChiffrees)} honnêtement. Ils sont présentés
                en section « Argumentaire de valorisation ».
              </p>
            )}
          </div>
        )}

        <div className="proposition">
          <div className="prop-main">
            <div className="prop-label">Avis de valeur</div>
            <div className="prop-price">
              {(recommendedStrategy.prix || 0).toLocaleString('fr-FR')} €
            </div>
            <div className="prop-m2">
              soit {(recommendedStrategy.prixM2 || 0).toLocaleString('fr-FR')} €/m²
            </div>
          </div>

          {/* Le chiffre qui appuie le prix : combien d'acquéreurs peuvent
              réellement l'acheter. Volet distinct pour qu'il ne concurrence
              pas le prix, mais assez gros pour compter. */}
          <div className="prop-aside">
            <div className="prop-stat">{projetsCompatibles}</div>
            <div className="prop-stat-label">
              projet{plural(projetsCompatibles)} d'achat
              <br />
              au budget compatible
            </div>
          </div>
        </div>
      </section>
      )}

      {/* =============================================================
          SECTION 10 ter — Le marché et le financement
          Source : /api/marche-financement (DVF + INSEE + Banque de France).
          Placé après le prix : ces chiffres l'éclairent, ils ne le
          construisent pas — la construction est dans « Définition du prix ».
          ============================================================= */}
      {marcheFi && (
        <section className="financement page-break">
          <h2 className="section-title">Le marché et le financement</h2>

          <div className="split">
            <div className="card">
              <div className="eyebrow">Le secteur en chiffres</div>
              <div className="kv-row">
                <span className="kv-key">Prix médian au m²</span>
                <span className="kv-val">
                  {marcheFi.marche.prixM2Median?.toLocaleString('fr-FR')} €/m²
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Vente médiane</span>
                <span className="kv-val">
                  {marcheFi.marche.valeurMediane?.toLocaleString('fr-FR')} € ·{' '}
                  {marcheFi.marche.surfaceMediane} m²
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Ventes en 2025</span>
                <span className="kv-val">{marcheFi.marche.nbVentes?.toLocaleString('fr-FR')}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Revenu du foyer médian</span>
                <span className="kv-val">
                  {marcheFi.foyer.revenuMensuel?.toLocaleString('fr-FR')} € / mois
                </span>
              </div>
              {marcheFi.acheteurs.partLocaux != null && (
                <div className="kv-row">
                  <span className="kv-key">Acheteurs récents</span>
                  <span className="kv-val">
                    {marcheFi.acheteurs.partLocaux} % habitaient déjà {marcheFi.commune}
                  </span>
                </div>
              )}
              {marcheFi.acheteurs.ageDominant && (
                <div className="kv-row">
                  <span className="kv-key">Profil dominant</span>
                  <span className="kv-val">
                    {marcheFi.acheteurs.ageDominant}
                    {marcheFi.acheteurs.categorieDominante
                      ? `, ${marcheFi.acheteurs.categorieDominante}`
                      : ''}
                  </span>
                </div>
              )}
              {marcheFi.acheteurs.origines.length > 0 && (
                <div className="kv-row">
                  <span className="kv-key">Viennent surtout de</span>
                  <span className="kv-val">
                    {marcheFi.acheteurs.origines
                      .map((o) => `${o.commune} (${o.pct} %)`)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div className="card">
              <div className="eyebrow">Financer votre bien</div>
              <div className="kv-row">
                <span className="kv-key">Taux moyen des crédits</span>
                <span className="kv-val">
                  {marcheFi.taux.banqueDeFrance?.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} %
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Taux de la simulation</span>
                <span className="kv-val">
                  {marcheFi.taux.avecAssurance?.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} % assurance comprise
                </span>
              </div>

              {simulation && (
                <div className="fi-simu">
                  {simulation.durees.map((d) => (
                    <div className="fi-simu-item" key={d.annees}>
                      <div className="fi-simu-montant">
                        {d.montant?.toLocaleString('fr-FR')} €
                      </div>
                      <div className="fi-simu-label">par mois sur {d.annees} ans</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Le rapprochement qui parle vraiment au mandant : la
                  mensualité de son bien face à la capacité du foyer médian
                  de sa commune. */}
              {marcheFi.foyer.mensualiteMax != null && (
                <p className="fi-lecture">
                  Le foyer médian de {marcheFi.commune} peut consacrer{' '}
                  <strong>{marcheFi.foyer.mensualiteMax.toLocaleString('fr-FR')} € par mois</strong>{' '}
                  à un crédit, soit un budget d'achat de{' '}
                  <strong>{marcheFi.foyer.budgetAchat?.toLocaleString('fr-FR')} €</strong> sur 25 ans.
                </p>
              )}
            </div>
          </div>

          <p className="note">
            Mensualités calculées sans apport ni frais d'acquisition, à titre
            indicatif : elles ne valent pas offre de prêt. Données par commune —
            à distinguer de la médiane du secteur immédiat, en section « Votre
            marché local ». Millésime {marcheFi.millesime}. Source :{' '}
            {marcheFi.source}
          </p>
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
          Le déroulé de la mise en vente et nos engagements de suivi, à compter
          de la signature du mandat.
        </p>

        <ol className="card plan-timeline">
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
          <div className="eyebrow accent">Nos engagements pendant toute la durée du mandat</div>
          <ul>
            {ENGAGEMENTS_COMMERCIALISATION.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>

        {/* Second rappel : ici le sujet n'est plus le bien mais le suivi de
            la vente. Le mandant vient de lire les jalons, c'est le moment de
            lui dire où il les suivra. */}
        <BlocAppIdeeri
          titre="Suivez votre vente en direct, depuis votre projet dans l'app."
          accent="en direct"
          points={[
            'Comptes rendus et retours après chaque visite',
            'Ce que les acquéreurs font de votre annonce : mise en favori, demande de renseignement, visite',
            'Messagerie directe avec votre conseiller',
            'Vos documents, à déposer et à consulter à tout moment',
          ]}
          note="L'app est connectée au logiciel de votre agence : chaque action de l'un est visible par l'autre."
          lien={lienApp}
        />

        <p className="note">
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
        <div className="eyebrow">Mentions légales</div>
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
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    /* Le --muted global de l'app (#949494) ne tient pas sur un document
       imprimé : 2,9:1 de contraste sur blanc, sous le seuil d'accessibilité,
       et franchement pâle une fois sorti de l'imprimante. On le redéfinit
       pour le rapport seulement — les écrans de saisie gardent le leur. */
    --muted: #6b7075;
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
    font-family: var(--mono);
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    /* Interlettrage réduit en même temps que le corps grossit : à 18 px, les
       2 px d'origine étiraient les titres longs sur toute la largeur. */
    letter-spacing: 1.4px;
    line-height: 1.3;
    color: var(--primary);
    border-bottom: 1px solid var(--border);
    padding-bottom: 14px;
    margin: 0 0 28px;
  }

  /* ⚠️ Ne jamais accoler un suffixe d'opacité à la variable de couleur
     d'agence (du type « var(--primary) » suivi de « 0a ») : la substitution
     de var() préserve les frontières de jetons, on obtient donc deux jetons
     — le hex puis le suffixe — et non un hex à 8 chiffres. La déclaration
     est invalide et silencieusement ignorée. Utiliser color-mix(), qui
     accepte en plus n'importe quel format fourni par l'agence. */

  /* ── Langage visuel : dossier technique ───────────────────────────────
     Cartes arrondies, lignes libellé / valeur, intertitres et valeurs
     techniques en monospace. Transposé sur fond clair : le document est fait
     pour être imprimé et remis en main propre. */
  /* Un cran plus foncé encore que --muted : en capitales de 11 px avec de
     l'interlettrage, il faut plus de densité pour rester lisible. */
  .eyebrow { font-family: var(--mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.6px; color: #555b61; margin: 0 0 12px; }
  .eyebrow.accent { color: var(--primary); }
  .card { border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; background: #fff; }

  .kv-row { display: grid; grid-template-columns: 150px 1fr; gap: 18px; align-items: baseline; padding: 8px 0; }
  .kv-row + .kv-row { border-top: 1px solid #f4f4f4; }
  .kv-key { font-size: 13px; color: var(--muted); }
  .kv-val { font-size: 14px; font-weight: 600; color: var(--secondary); }
  .mono { font-family: var(--mono); font-weight: 500; font-size: 13px; }

  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .bullets { list-style: none; padding: 0; margin: 0; }
  .bullets li { position: relative; padding: 5px 0 5px 15px; font-size: 13.5px; line-height: 1.55; color: var(--secondary); }
  .bullets li::before { content: '•'; position: absolute; left: 1px; top: 5px; color: var(--muted); }
  .note { margin: 24px 0 0; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); line-height: 1.65; }

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
  .cover-hero-img { display: block; width: 100%; height: 340px; object-fit: cover; border-radius: 12px; background: #f2f2f2; }
  .cover-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
  .cover-strip figure { margin: 0; }
  .cover-strip img { display: block; width: 100%; height: 92px; object-fit: cover; border-radius: 9px; background: #f2f2f2; }
  .cover-strip figcaption { font-size: 11px; color: var(--muted); margin-top: 5px; text-align: center; }
  .cover-hero-placeholder {
    width: 100%; aspect-ratio: 16 / 9; background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 13%, #fff), #f0f0f0);
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

  /* ====== KPI (sections Marché et Activité réseau) ====== */
  .kpi { text-align: center; flex: 1; }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--secondary); }
  .kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .kpi.kpi-highlight .kpi-value { color: var(--primary); }

  /* ====== 4. Votre bien ====== */
  .bien-grid { display: grid; grid-template-columns: 268px 1fr; gap: 16px; align-items: start; }
  .bien-photo { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: #f8f8f8; }
  .bien-photo-img { display: block; width: 100%; height: 196px; object-fit: cover; }
  .bien-photo-vide { height: 196px; display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 11px; letter-spacing: 1px; color: var(--muted); }
  .bien-vignettes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 6px; }
  .bien-vignette { height: 50px; border-radius: 7px; background: #ececec center / cover no-repeat; }

  /* Échelle DPE : la lettre du bien est remplie de sa couleur officielle,
     les autres restent en gris. */
  .dpe-card { margin-top: 14px; padding: 18px 20px; }
  .dpe-echelle { display: flex; gap: 4px; margin-bottom: 12px; }
  .dpe-lettre { flex: 1; text-align: center; padding: 6px 0; border-radius: 5px; background: #eeeff0; color: #a9adb1; font-family: var(--mono); font-size: 12px; font-weight: 700; }
  .dpe-lettre.active { color: #fff; }
  .dpe-lettre.active.dpe-C, .dpe-lettre.active.dpe-D { color: #33383d; }
  .dpe-texte { font-size: 12px; color: var(--muted); line-height: 1.65; margin: 0; }
  .dpe-texte strong { color: var(--secondary); font-weight: 700; }

  .property-desc { font-size: 13.5px; line-height: 1.7; color: var(--secondary); margin: 18px 0 0; }

  /* ── Renvoi vers l'app Ideeri ─────────────────────────────────────────
     Seul bloc de marque du document, donc seul endroit où l'on sort de la
     couleur d'agence pour la charte Ideeri : noir #1A1A1A, jaune #EBBC02,
     texte blanc. Le noir revient ici parce qu'il est identitaire — c'est
     différent du plan du secteur, qui était sombre sans raison. */
  .app-renvoi {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 22px;
    align-items: start;
    margin-top: 18px;
    padding: 26px 30px;
    border-radius: 16px;
    background: #1A1A1A;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .app-renvoi-logo { display: block; height: 26px; width: auto; margin-bottom: 16px; }
  .app-renvoi-titre { font-size: 15px; font-weight: 600; color: #fff; line-height: 1.5; margin: 0; }
  .app-renvoi-accent { color: #EBBC02; }
  .app-renvoi-sous { font-size: 12.5px; color: rgba(255, 255, 255, 0.62); margin: 6px 0 0; }
  /* Mention et non bouton : pas de bord, pas de fond, pas de coin arrondi. */
  .app-renvoi-points { list-style: none; padding: 0; margin: 12px 0 0; }
  .app-renvoi-points li { position: relative; padding: 3px 0 3px 15px; font-size: 12.5px; line-height: 1.5; color: rgba(255, 255, 255, 0.82); }
  .app-renvoi-points li::before { content: ''; position: absolute; left: 1px; top: 11px; width: 4px; height: 4px; border-radius: 50%; background: #EBBC02; }
  .app-renvoi-note { font-size: 12.5px; font-weight: 600; color: #EBBC02; line-height: 1.5; margin: 14px 0 0; }
  .app-renvoi-stores {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: #EBBC02;
    margin: 18px 0 0;
  }
  /* Icône de l'application, pas le picto seul : c'est ce que le mandant
     cherchera sur son téléphone. Le PNG porte déjà ses coins arrondis, on
     n'en rajoute pas. */
  /* Léger décalage vers le bas : le haut du wordmark tombe ainsi à peu près
     au tiers de l'icône, ce qui aligne l'ensemble optiquement. */
  .app-renvoi-icone-app { display: block; width: 64px; height: 64px; margin-top: 2px; }
  .app-renvoi-aside { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .app-renvoi-qr { padding: 7px; border-radius: 10px; background: #fff; line-height: 0; }
  .app-renvoi-qr-legende {
    font-family: var(--mono);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.55);
    margin: 0;
    text-align: center;
  }

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
  .market-kpis { display: flex; gap: 16px; margin-bottom: 20px; }
  .market-source { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0 0 20px; }
  .market-caption { font-size: 13px; color: var(--secondary); margin: 16px 0 0; }
  .market-commodites { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border); }
  .market-commodites > h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--secondary); margin: 0 0 14px; }
  .commod-cat { margin-bottom: 12px; }
  .commod-cat h4 { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px; }
  .commod-cat ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .commod-cat li { font-size: 13px; color: var(--secondary); line-height: 1.5; padding-left: 14px; position: relative; }
  .commod-cat li::before { content: '•'; position: absolute; left: 0; color: var(--primary); }
  .commod-cat li strong { font-weight: 600; color: var(--secondary); }
  .commod-cat li span { color: var(--muted); }

  /* Carte des commodités (composant CarteCommodites) */
  .market-carte { margin: 28px 0 4px; }
  .cc-wrap { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; align-items: start; }
  .cc-map-col { position: relative; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: #eee; }
  /* Hauteur calée sur celle du panneau compacté : le bloc ne grandit pas,
     la carte occupe simplement le blanc qui restait à côté. */
  .cc-map { height: 500px; width: 100%; }
  .cc-map .leaflet-container { font-family: inherit; }
  .cc-legende { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; padding: 8px 10px; background: #fff; border-top: 1px solid var(--border); font-size: 11px; color: var(--secondary); }
  .cc-legende-item { display: inline-flex; align-items: center; gap: 6px; }
  .cc-puce { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  .cc-panel { display: flex; flex-direction: column; gap: 10px; }
  .cc-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: #fff; }
  .cc-card-head { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
  .cc-card-icon { display: inline-flex; align-items: center; }
  .cc-card-head h3 { font-family: var(--mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.6px; color: var(--muted); margin: 0; }

  /* Une ligne par catégorie : compteur + distance du point le plus proche,
     puis le nom de ce point. Le détail complet se déplie à l'écran. */
  .cc-cat + .cc-cat { border-top: 1px solid #f2f2f2; }
  .cc-cat-head { display: grid; grid-template-columns: 15px 1fr auto auto; gap: 8px; align-items: center; width: 100%; padding: 7px 0 0; border: none; background: none; font-family: inherit; text-align: left; }
  .cc-cat-head.cliquable { cursor: pointer; }
  .cc-cat-head.cliquable:hover .cc-cat-label { color: var(--primary); }
  .cc-cat-label { font-size: 13px; font-weight: 600; color: var(--secondary); }
  .cc-cat-count { font-size: 11px; font-weight: 700; color: #fff; background: var(--muted); border-radius: 9px; min-width: 18px; padding: 0 5px; text-align: center; }
  .cc-cat-dist { font-size: 11px; color: var(--muted); white-space: nowrap; }
  .cc-cat-proche { font-size: 11px; color: var(--muted); padding: 1px 0 7px 23px; overflow-wrap: anywhere; }

  .cc-list { list-style: none; padding: 4px 0 7px 23px; margin: 0; }
  .cc-list li { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: baseline; padding: 3px 0; font-size: 11.5px; }
  .cc-type { color: var(--muted); font-size: 10.5px; white-space: nowrap; }
  .cc-name { color: var(--secondary); min-width: 0; overflow-wrap: anywhere; }
  .cc-dist { color: var(--secondary); font-weight: 600; white-space: nowrap; text-align: right; }

  .cc-list-risques { padding-left: 0; }
  .cc-list-risques li { grid-template-columns: 1fr auto; padding: 3px 0; }
  .cc-list-risques li + li { border-top: 1px solid #f7f7f7; }
  .cc-level-ok { color: #46B962; }
  .cc-level-warn { color: #d98407; }
  .cc-level-bad { color: #e74c3c; }
  .cc-source { font-size: 10px; color: var(--muted); margin: 8px 0 0; }

  /* ====== 6. Personas acquéreurs ====== */
  .section-intro { font-size: 14px; color: var(--secondary); margin: 0 0 20px; line-height: 1.6; }
  /* Barre de répartition des profils : segments proportionnels au nombre de
     projets, dégradé obtenu par opacité pour rester pilotable par --primary. */
  .prof-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin: 4px 0 16px; }
  .prof-bar-seg { display: block; height: 100%; }

  .prof-list { list-style: none; padding: 0; margin: 0; }
  .prof-list li { display: grid; grid-template-columns: 11px auto 1fr auto; gap: 10px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .prof-list li:last-child { border-bottom: none; }
  .prof-puce { width: 11px; height: 11px; border-radius: 3px; }
  .prof-nom { font-weight: 600; color: var(--secondary); white-space: nowrap; }
  .prof-part { font-size: 12px; color: var(--muted); }
  .prof-budget { font-weight: 700; color: var(--secondary); white-space: nowrap; }

  /* ====== 8. Argumentaire ====== */
  .arg-strong .bullets li::before { color: var(--primary); }
  .arg-vigilance .bullets li::before { color: #d98407; }
  .arg-vide { color: var(--muted); font-style: italic; }

  /* ====== 10. Proposition (prix unique) ====== */
  /* Définition du prix : décompte ligne à ligne, aligné à droite sur les
     montants. Les points valorisés portent une pastille verte ou rouge, les
     non chiffrés une pastille grise. */
  .def-prix { margin-bottom: 16px; }
  .def-row { display: grid; grid-template-columns: 9px 1fr auto; gap: 14px; align-items: baseline; padding: 10px 0; font-size: 13.5px; }
  .def-row + .def-row { border-top: 1px solid #f4f4f4; }
  .def-libelle { color: var(--secondary); }
  .def-puce { width: 9px; height: 9px; border-radius: 50%; align-self: center; }
  .def-montant { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; font-weight: 600; color: var(--secondary); }
  .def-plus { color: var(--primary); }
  .def-moins { color: #c0392b; }

  /* Base et total : pas de pastille, deux colonnes, et un cran de contraste
     au-dessus des ajustements pour qu'on lise d'abord d'où l'on part et où
     l'on arrive. */
  .def-base, .def-total { grid-template-columns: 1fr auto; border-top: none; }
  .def-base .def-libelle { font-family: var(--mono); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
  .def-base { padding: 0 0 14px; }
  .def-total { margin-top: 6px; padding: 15px 0 0; border-top: 1px solid var(--secondary); font-size: 16px; }
  .def-total .def-libelle { font-weight: 700; }
  .def-total .def-montant { font-weight: 700; }

  /* Deux volets : le prix occupe la surface, le nombre de projets solvables
     tient dans un panneau à part. Chaque volet est centré dans sa colonne,
     donc plus de grand vide au milieu de la carte. */
  .proposition { display: grid; grid-template-columns: 1.55fr 1fr; border: 2px solid var(--primary); border-radius: 14px; background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, #fff) 0%, #fff 65%); overflow: hidden; }
  .prop-main { display: flex; flex-direction: column; justify-content: center; padding: 32px 34px; text-align: center; }
  .prop-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.4px; }
  .prop-price { font-size: 50px; font-weight: 700; color: var(--primary); letter-spacing: -1.5px; line-height: 1.05; margin: 12px 0 6px; }
  .prop-m2 { font-size: 14px; color: var(--secondary); }
  .prop-aside { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 22px; text-align: center; background: #fff; border-left: 1px solid var(--border); }
  .prop-stat { font-size: 44px; font-weight: 700; color: var(--secondary); line-height: 1; }
  .prop-stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; line-height: 1.55; margin-top: 10px; }

  /* ====== 10 ter. Marché et financement ====== */
  .fi-simu { display: flex; gap: 12px; margin: 18px 0 0; }
  .fi-simu-item { flex: 1; text-align: center; padding: 14px 10px; border: 1px solid var(--border); border-radius: 12px; background: #fafafa; }
  .fi-simu-montant { font-size: 24px; font-weight: 700; color: var(--primary); line-height: 1.1; }
  .fi-simu-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 6px; }
  .fi-lecture { font-size: 12.5px; color: var(--secondary); line-height: 1.65; margin: 16px 0 0; }
  .fi-lecture strong { color: var(--primary); }

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
  .legal ul { padding-left: 18px; margin: 0 0 16px; }
  .legal li { margin-bottom: 6px; line-height: 1.6; }
  .legal-agence { padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); line-height: 1.6; }

  /* ====== 5 quater. Notre activité dans votre secteur ====== */
  .reseau-part { font-size: 14px; margin: 0 0 24px; padding: 12px 16px; background: color-mix(in srgb, var(--primary) 4%, #fff); border-left: 4px solid var(--primary); border-radius: 4px; }
  .reseau-part strong { color: var(--primary); }
  .card.reseau-block, .card.reseau-distrib { margin-bottom: 14px; }
  .reseau-sub { font-size: 13px; color: var(--muted); margin: 0 0 12px; line-height: 1.6; }

  .distrib-row { display: grid; grid-template-columns: 150px 1fr 90px; gap: 12px; align-items: center; padding: 4px 0; font-size: 12px; }
  .distrib-label { color: var(--secondary); white-space: nowrap; }
  .distrib-bar { display: block; height: 14px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
  .distrib-bar i { display: block; height: 100%; background: #b9bec4; border-radius: 3px; }
  .distrib-count { font-size: 12px; color: var(--muted); }
  .distrib-caption { font-size: 13px; color: var(--secondary); margin: 12px 0 0; line-height: 1.6; }

  /* Plan du secteur : même traitement que les autres cartes du document —
     bord fin, coins arrondis 14 px, fond clair. On force quand même le rendu
     des couleurs à l'impression pour les aplats des pastilles. */
  .carte-wrap { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: #fbfbfb; margin-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .carte-svg { display: block; width: 100%; height: auto; font-family: inherit; }
  .carte-legende { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 0; }

  .conc-svg { display: block; width: 100%; height: auto; margin: 4px 0 2px; font-family: inherit; }
  .conc-legende { font-size: 12px; color: var(--secondary); margin: 0; }


  /* ====== 10 bis. Plan de commercialisation ====== */
  .plan-timeline { list-style: none; margin: 0 0 14px; position: relative; }
  .plan-timeline::before { content: ''; position: absolute; left: 31px; top: 30px; bottom: 30px; width: 2px; background: var(--border); }
  .plan-step { display: grid; grid-template-columns: 24px 170px 1fr; gap: 12px; align-items: start; padding: 0 0 20px; position: relative; }
  .plan-step:last-child { padding-bottom: 0; }
  .plan-dot { width: 12px; height: 12px; margin-top: 3px; border-radius: 50%; background: #fff; border: 3px solid var(--primary); box-sizing: border-box; z-index: 1; }
  .plan-when { font-size: 12px; line-height: 1.5; }
  .plan-jour { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; background: var(--primary); padding: 1px 7px; border-radius: 8px; margin-bottom: 4px; }
  .plan-date { display: block; color: var(--muted); }
  .plan-titre { font-size: 14px; font-weight: 600; color: var(--secondary); }
  .plan-detail { font-size: 12px; color: var(--muted); line-height: 1.6; margin-top: 2px; }

  .plan-engagements { padding: 20px 24px; background: #fafafa; border: 1px solid var(--border); border-radius: 14px; margin-bottom: 16px; }
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

    /* Couverture : le min-height de 900 px + le gabarit d'écran la faisaient
       déborder sur une seconde page quasi vide. On resserre pour tenir sur
       une seule page A4. */
    .cover { min-height: 0 !important; padding: 28px 32px !important; }
    .cover-bar { margin-bottom: 30px; }
    .cover-title { font-size: 32px; letter-spacing: 3px; margin: 26px 0 12px; }
    .cover-address { font-size: 17px; margin-bottom: 24px; }
    .cover-hero { margin: 12px 0 24px; }
    .cover-hero-img { height: 250px; }
    .cover-strip { gap: 8px; margin-top: 8px; }
    .cover-strip img { height: 68px; }
    .cover-meta { margin: 22px 0; line-height: 1.65; }
    .cover-footer { padding-top: 22px; }
    .report-root section, .report-root footer { padding: 24px 32px; }
    .card, .plan-engagements { break-inside: avoid; page-break-inside: avoid; }
    .plan-step, .conc-list li, .carte-wrap { break-inside: avoid; page-break-inside: avoid; }
    .market-carte, .cc-card, .cc-map-col { break-inside: avoid; page-break-inside: avoid; }
    .proposition { break-inside: avoid; page-break-inside: avoid; }
    .leaflet-control-zoom, .leaflet-popup { display: none !important; }
    .cc-map { height: 320px; }
  }
`;
