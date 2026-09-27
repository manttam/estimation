import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  POI_CATEGORIES,
  POI_ORDER,
  typeLisible,
  fmtDistance,
  distanceMetres,
} from '../data/poiCategories';
import { itemsRisques } from '../utils/risquesAffichage';

/* Les popups Leaflet prennent du HTML, et leur contenu vient de l'extérieur :
 * noms de POI renvoyés par Overpass, adresse saisie par l'agent. On échappe. */
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Épingle Leaflet : goutte de la couleur de la catégorie, pictogramme blanc. */
function pinHtml(cat) {
  return `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 1c-7.7 0-14 6.3-14 14 0 9.9 14 24 14 24s14-14.1 14-24c0-7.7-6.3-14-14-14z"
          fill="${cat.color}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(7.8 7.4) scale(0.6)" fill="none" stroke="#fff"
       stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${cat.svg}</g>
  </svg>`;
}

/**
 * CarteCommodites — carte du secteur + panneau des commodités.
 *
 * Carte Leaflet réelle (tuiles OpenStreetMap) centrée sur le bien, avec le
 * périmètre analysé et une épingle par commodité. Le panneau reprend les
 * mêmes catégories, avec le type, le nom et la distance de chaque point.
 *
 * Pensé pour un document : molette désactivée (sinon la page se fige sous le
 * curseur), et en mode impression toutes les listes sont dépliées puisqu'on
 * ne peut pas cliquer sur du papier.
 */
export default function CarteCommodites({
  centre,
  labelBien = 'Votre bien',
  poi,
  risques,
  rayonMetres = 1000,
  print = false,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [deplies, setDeplies] = useState({});

  /* Items par catégorie : distance recalculée quand la source ne la porte
   * pas (les jeux de démo n'ont que le texte du détail). */
  const parCategorie = useMemo(() => {
    const out = {};
    POI_ORDER.forEach((cle) => {
      const brut = Array.isArray(poi?.[cle]) ? poi[cle] : [];
      out[cle] = brut
        .map((p) => ({
          ...p,
          distance: Number.isFinite(p.distance) ? p.distance : distanceMetres(centre, p.coords),
        }))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    });
    return out;
  }, [poi, centre]);

  const risquesItems = useMemo(() => itemsRisques(risques), [risques]);

  /* ─── Carte : montage unique, puis mise à jour des marqueurs ─────────── */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return undefined;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      // Un document ne doit pas capturer la molette : la page continue de
      // défiler quand le curseur passe sur la carte.
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView(centre, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (!print) L.control.zoom({ position: 'topleft' }).addTo(map);

    // Périmètre analysé
    L.circle(centre, {
      radius: rayonMetres,
      color: '#46B962',
      fillColor: '#46B962',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '8 6',
      opacity: 0.7,
    }).addTo(map);

    // Bien estimé
    L.marker(centre, {
      zIndexOffset: 1000,
      icon: L.divIcon({
        className: 'cc-target',
        html: `<div style="width:38px;height:38px;background:#46B962;border:3px solid #fff;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      }),
    })
      .addTo(map)
      .bindPopup(`<strong>${esc(labelBien)}</strong>`);

    // Commodités
    const points = [centre];
    POI_ORDER.forEach((cle) => {
      const cat = POI_CATEGORIES[cle];
      (parCategorie[cle] || []).forEach((p) => {
        if (!Array.isArray(p.coords)) return;
        points.push(p.coords);
        L.marker(p.coords, {
          icon: L.divIcon({
            className: 'cc-pin',
            html: pinHtml(cat),
            iconSize: [30, 40],
            iconAnchor: [15, 40],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<strong style="color:${cat.color}">${esc(p.name)}</strong><br><span style="color:#666">${
              esc([typeLisible(p.detail), fmtDistance(p.distance)].filter(Boolean).join(' · '))
            }</span>`
          );
      });
    });

    // Cadrage sur l'ensemble des points, sans descendre trop bas en zoom :
    // un unique POI voisin ne doit pas coller la carte au niveau de la rue.
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.12), { maxZoom: 16, animate: false });
    }

    // Le conteneur est dimensionné par le CSS : on laisse Leaflet remesurer
    // une fois la mise en page stabilisée, sinon les tuiles laissent du gris.
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 120);

    mapInstanceRef.current = map;
    return () => {
      clearTimeout(t);
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculer = (cle) => setDeplies((prev) => ({ ...prev, [cle]: !prev[cle] }));

  return (
    <div className="cc-wrap">
      <div className="cc-map-col">
        <div ref={mapRef} className="cc-map" />
        <div className="cc-legende">
          {POI_ORDER.filter((cle) => (parCategorie[cle] || []).length > 0).map((cle) => (
            <span className="cc-legende-item" key={cle}>
              <span className="cc-puce" style={{ background: POI_CATEGORIES[cle].color }} />
              {POI_CATEGORIES[cle].label}
            </span>
          ))}
        </div>
      </div>

      <aside className="cc-panel">
        <div className="cc-card">
          <div className="cc-card-head">
            <h3>Commodités à proximité</h3>
          </div>

          {POI_ORDER.map((cle) => {
            const cat = POI_CATEGORIES[cle];
            const items = parCategorie[cle] || [];
            const plusProche = items[0];
            const ouvert = !print && deplies[cle];

            return (
              <div className="cc-cat" key={cle}>
                <button
                  type="button"
                  className={`cc-cat-head${items.length > 1 && !print ? ' cliquable' : ''}`}
                  onClick={() => items.length > 1 && !print && basculer(cle)}
                  aria-expanded={ouvert || undefined}
                >
                  <span
                    className="cc-card-icon"
                    style={{ color: cat.color }}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{
                      __html: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cat.svg}</svg>`,
                    }}
                  />
                  <span className="cc-cat-label">{cat.label}</span>
                  <span className="cc-cat-count">{items.length}</span>
                  <span className="cc-cat-dist">
                    {plusProche ? `dès ${fmtDistance(plusProche.distance)}` : '—'}
                  </span>
                </button>

                {/* Repère concret : le point le plus proche est nommé, même
                    replié. C'est ce qui donne du corps à un simple compteur. */}
                {plusProche && !ouvert && (
                  <div className="cc-cat-proche">
                    {[typeLisible(plusProche.detail), plusProche.name].filter(Boolean).join(' · ')}
                  </div>
                )}

                {ouvert && (
                  <ul className="cc-list">
                    {items.map((pt, k) => (
                      <li key={`${pt.name}-${k}`}>
                        <span className="cc-type">{typeLisible(pt.detail)}</span>
                        <span className="cc-name">{pt.name}</span>
                        <span className="cc-dist">{fmtDistance(pt.distance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {risquesItems.length > 0 && (
          <div className="cc-card cc-card-risques">
            <div className="cc-card-head">
              <span
                className="cc-card-icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
                }}
              />
              <h3>Risques</h3>
            </div>
            <ul className="cc-list cc-list-risques">
              {risquesItems.map((it, k) => (
                <li key={k}>
                  <span className="cc-name">{it.label}</span>
                  <span className={`cc-dist cc-level-${it.level}`}>{it.value}</span>
                </li>
              ))}
            </ul>
            <p className="cc-source">Source : Géorisques — data.gouv.fr</p>
          </div>
        )}
      </aside>
    </div>
  );
}
