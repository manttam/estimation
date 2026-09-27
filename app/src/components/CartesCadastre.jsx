import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchParcelle,
  fetchZoneUrba,
  CADASTRE_WMTS_URL,
  GPU_ZONE_URBA_WMTS_URL,
  PLAN_IGN_WMTS_URL,
  formatContenance,
} from '../utils/datagouv';

/**
 * CartesCadastre — parcelle cadastrale et zonage d'urbanisme du bien.
 *
 * Deux vues côte à côte, chacune sur fond Plan IGN avec sa couche métier en
 * surimpression : le parcellaire express pour le cadastre, le zonage du
 * Géoportail de l'urbanisme pour le PLU. Le contour du bien est tracé par
 * dessus, en couleur d'agence.
 *
 * Cartes volontairement inertes : ni zoom, ni déplacement, ni molette. Dans
 * un document, une carte qu'on ne peut pas manipuler doit avoir l'air
 * arrêtée — et la molette capturée fige la page en pleine lecture.
 *
 * Les deux sources sont interrogées séparément : une commune peut être
 * cadastrée sans avoir publié son PLU sur le GPU. Chaque carte disparaît
 * si sa donnée manque, et la section entière si les deux manquent.
 */

/* Un cadre par carte, rendu une fois la donnée reçue. */
function CarteFond({ centre, geometrie, couche, attribution }) {
  const ref = useRef(null);
  const instance = useRef(null);

  useEffect(() => {
    if (!ref.current || instance.current) return undefined;

    const map = L.map(ref.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: true,
    }).setView(centre, 18);

    L.tileLayer(PLAN_IGN_WMTS_URL, { attribution, maxZoom: 19 }).addTo(map);
    L.tileLayer(couche, { opacity: 0.85, maxZoom: 19 }).addTo(map);

    if (geometrie) {
      const contour = L.geoJSON(geometrie, {
        style: { color: 'var(--primary)', weight: 2.5, fillOpacity: 0.12 },
      }).addTo(map);
      // Cadrer sur la parcelle plutôt que sur un zoom fixe : une parcelle de
      // 200 m² et une de 2 ha n'appellent pas la même échelle.
      const bornes = contour.getBounds();
      if (bornes.isValid()) map.fitBounds(bornes.pad(0.45), { maxZoom: 19, animate: false });
    }

    L.marker(centre, {
      icon: L.divIcon({
        className: 'cad-point',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:var(--primary);border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(map);

    const t = setTimeout(() => map.invalidateSize({ animate: false }), 120);
    instance.current = map;
    return () => {
      clearTimeout(t);
      map.remove();
      instance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="cad-carte" />;
}

export default function CartesCadastre({ centre }) {
  const [parcelle, setParcelle] = useState(null);
  const [zone, setZone] = useState(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!Array.isArray(centre)) return undefined;
    let annule = false;
    const [lat, lon] = centre;
    // Échec silencieux des deux côtés : mieux vaut une carte en moins qu'un
    // encadré d'erreur dans un document remis au mandant.
    Promise.allSettled([fetchParcelle(lon, lat), fetchZoneUrba(lon, lat)]).then(
      ([p, z]) => {
        if (annule) return;
        setParcelle(p.status === 'fulfilled' ? p.value : null);
        setZone(z.status === 'fulfilled' ? z.value : null);
        setCharge(true);
      }
    );
    return () => {
      annule = true;
    };
  }, [centre]);

  const infosParcelle = useMemo(() => {
    const p = parcelle?.properties;
    if (!p) return null;
    return [
      { cle: 'Section', val: [p.prefixe, p.section].filter(Boolean).join(' ') || p.section },
      { cle: 'Numéro', val: p.numero },
      { cle: 'Contenance', val: formatContenance(p.contenance) },
      { cle: 'Commune', val: p.nom_com || p.commune },
    ].filter((l) => l.val);
  }, [parcelle]);

  const infosZone = useMemo(() => {
    const z = zone?.properties;
    if (!z) return null;
    /* `libelong` est du texte libre rédigé par la commune : deux mots ici,
     * un paragraphe de règlement d'urbanisme ailleurs. On le coupe au mot
     * pour que la carte de gauche et celle de droite gardent la même
     * hauteur — le détail se lit dans le document d'urbanisme, pas ici. */
    const intitule =
      typeof z.libelong === 'string' && z.libelong.length > 180
        ? `${z.libelong.slice(0, 180).replace(/\s+\S*$/, '')}…`
        : z.libelong;
    return [
      { cle: 'Zone', val: z.libelle },
      { cle: 'Type', val: z.typezone },
      { cle: 'Intitulé', val: intitule },
      { cle: 'Document', val: z.partition },
    ].filter((l) => l.val);
  }, [zone]);

  if (!charge || (!parcelle && !zone)) return null;

  return (
    <div className="cad-grille">
      {parcelle && (
        <div className="card cad-bloc">
          <div className="eyebrow">La parcelle</div>
          <CarteFond
            centre={centre}
            geometrie={parcelle.geometry}
            couche={CADASTRE_WMTS_URL}
            attribution="&copy; IGN — Cadastre"
          />
          {infosParcelle?.map((l) => (
            <div className="kv-row" key={l.cle}>
              <span className="kv-key">{l.cle}</span>
              <span className="kv-val mono">{l.val}</span>
            </div>
          ))}
        </div>
      )}

      {zone && (
        <div className="card cad-bloc">
          <div className="eyebrow">Le zonage d&apos;urbanisme</div>
          <CarteFond
            centre={centre}
            geometrie={zone.geometry}
            couche={GPU_ZONE_URBA_WMTS_URL}
            attribution="&copy; IGN — Géoportail de l'urbanisme"
          />
          {infosZone?.map((l) => (
            <div className="kv-row" key={l.cle}>
              <span className="kv-key">{l.cle}</span>
              <span className="kv-val">{l.val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
