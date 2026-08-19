import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  property,
  avisValeur,
  agence as agenceMock,
  agent as agentMock,
} from '../data/propertyData';
import { PROPERTY_PHOTOS } from '../data/propertyPhotos';
import { getReportState } from '../utils/reportStore';
import { getPhotosForCarousel, revokePhotoUrls } from '../utils/photosStore';

/* ---------------------------------------------------------------------------
 * Avis de valeur — V2
 *
 * Document remis au mandant lors du second rendez-vous.
 * Structure :
 *   1. En-tête (logo agence en image + titre + date/référence)
 *   2. Votre bien (photo principale + vignettes)
 *   3. Informations générales (encarts + descriptif rédigé)
 *   4. Argumentaire de valorisation (atouts / points de vigilance)
 *   5. Avis de valeur (prix médian comparables → prix retenu + fourchette)
 *   6. Votre interlocuteur (agent + agence)
 *   7. Mentions
 *
 * Sources de données, par ordre de priorité :
 *   reportStore (saisies utilisateur) → propertyData (mocks de démo)
 * Photos : IndexedDB (photos uploadées en Step 1) → PROPERTY_PHOTOS (démo)
 * ------------------------------------------------------------------------- */

const GREEN = '#46B962';

/* Ordre de préférence pour la sélection automatique des photos du document :
 * une pièce de vie en photo principale, puis les pièces les plus parlantes. */
const PHOTO_PRIORITY = ['salon', 'cuisine', 'chambre', 'sdb', 'exterieur', 'autre'];

function pickDocumentPhotos(photos, max = 5) {
  if (!photos || !photos.length) return [];
  const remaining = [...photos];
  const picked = [];
  // Un représentant par type, dans l'ordre de priorité
  for (const type of PHOTO_PRIORITY) {
    const i = remaining.findIndex((p) => p.type === type);
    if (i !== -1) picked.push(...remaining.splice(i, 1));
    if (picked.length >= max) return picked.slice(0, max);
  }
  // Complète avec ce qui reste
  return [...picked, ...remaining].slice(0, max);
}

function formatEuro(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n)).toLocaleString('fr-FR')} €`;
}

function formatNombre(n, decimales = 1) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

const CSS = `
.av-doc{
  --av-green:${GREEN};
  --av-green-dark:#2f8f47;
  --av-green-soft:#f0faf2;
  --av-green-border:#d0efd6;
  --av-ink:#393939;
  --av-muted:#949494;
  --av-line:#e5e5e5;
  --av-line-soft:#f0f0f0;
  --av-bg-soft:#f9fafb;
  max-width:900px;
  margin:0 auto;
  background:#fff;
  padding:40px 48px 32px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--av-ink);
  line-height:1.6;
  box-sizing:border-box;
}
.av-doc *{box-sizing:border-box}

/* --- En-tête --- */
.av-header{
  text-align:center;
  border-bottom:2px solid var(--av-green);
  padding-bottom:24px;
  margin-bottom:32px;
}
.av-logo{
  max-height:64px;
  max-width:240px;
  width:auto;
  display:block;
  margin:0 auto 14px;
  object-fit:contain;
}
.av-logo-fallback{
  font-size:24px;
  font-weight:700;
  color:var(--av-green);
  letter-spacing:1px;
  margin:0 0 6px;
}
.av-title{
  font-size:20px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:2px;
  margin:12px 0 4px;
  color:var(--av-ink);
}
.av-sub{font-size:13px;color:var(--av-muted);margin:4px 0}

/* --- Sections --- */
.av-section{margin-bottom:36px}
.av-section-title{
  font-size:15px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:1.5px;
  color:var(--av-green);
  border-bottom:1px solid var(--av-line);
  padding-bottom:8px;
  margin:0 0 20px;
}
.av-card{border:1px solid var(--av-line);border-radius:8px;padding:20px}
.av-label{font-size:12px;color:var(--av-muted);margin-bottom:2px;display:block}
.av-value{font-size:14px;font-weight:600;color:var(--av-ink)}

/* --- Photos --- */
.av-photo-hero{
  width:100%;
  height:340px;
  object-fit:cover;
  border-radius:10px;
  display:block;
  background:var(--av-bg-soft);
}
.av-photo-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}
.av-photo-strip figure{margin:0}
.av-photo-strip img{
  width:100%;
  height:96px;
  object-fit:cover;
  border-radius:8px;
  display:block;
  background:var(--av-bg-soft);
}
.av-photo-strip figcaption{font-size:11px;color:var(--av-muted);margin-top:4px;text-align:center}

/* --- Bien --- */
.av-adresse{font-size:18px;font-weight:700;line-height:1.35}
.av-tags{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 18px}
.av-tag{
  background:var(--av-green-soft);
  color:var(--av-green);
  border:1px solid var(--av-green-border);
  border-radius:4px;
  padding:2px 10px;
  font-size:12px;
  font-weight:600;
}
.av-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.av-info-item{
  padding:12px 16px;
  background:var(--av-bg-soft);
  border:1px solid var(--av-line-soft);
  border-radius:8px;
}
.av-descriptif{
  font-size:13.5px;
  color:#555;
  border-top:1px solid var(--av-line-soft);
  padding-top:16px;
}
.av-descriptif p{margin:0 0 10px}
.av-descriptif p:last-child{margin-bottom:0}
.av-meta-line{
  font-size:13px;
  color:var(--av-muted);
  border-top:1px solid var(--av-line-soft);
  margin-top:16px;
  padding-top:14px;
}
.av-meta-line strong{color:var(--av-ink)}

/* --- Argumentaire --- */
.av-argu-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.av-argu-block{border:1px solid var(--av-line);border-radius:8px;overflow:hidden}
.av-argu-head{
  font-size:12px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:1px;
  padding:10px 16px;
}
.av-argu-head.is-plus{
  background:var(--av-green-soft);
  color:var(--av-green-dark);
  border-bottom:1px solid var(--av-green-border);
}
.av-argu-head.is-vig{background:#fdf3f2;color:#b8402f;border-bottom:1px solid #f6d9d5}
.av-argu-block ul{margin:0;padding:14px 16px 16px;list-style:none}
.av-argu-block li{
  font-size:13px;
  color:#555;
  padding-left:18px;
  position:relative;
  margin-bottom:8px;
  line-height:1.5;
}
.av-argu-block li:last-child{margin-bottom:0}
.av-argu-block li::before{position:absolute;left:0;top:0;font-weight:700}
.av-argu-head.is-plus + ul li::before{content:"+";color:var(--av-green)}
.av-argu-head.is-vig + ul li::before{content:"!";color:#d8624f}

/* --- Prix --- */
.av-decomp-head{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom:8px;
  gap:12px;
}
.av-decomp-title{font-size:15px;font-weight:700;color:var(--av-ink)}
.av-decomp-val{
  font-size:14px;
  font-weight:700;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  color:var(--av-ink);
  white-space:nowrap;
}
.av-decomp-body{
  border-left:3px solid var(--av-line);
  padding-left:16px;
  margin-left:4px;
  font-size:13px;
  color:#666;
  line-height:1.8;
}
.av-sep{height:3px;background:var(--av-green);border:none;margin:28px 0 8px;border-radius:2px}
.av-final-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:18px 0 4px;
  gap:16px;
}
.av-final-label{
  font-size:18px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:1px;
  color:var(--av-ink);
}
.av-final-right{text-align:right}
.av-final-price{
  font-size:34px;
  font-weight:700;
  color:var(--av-green);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  line-height:1.1;
}
.av-final-range{font-size:13px;color:var(--av-muted);margin-top:6px}

/* --- Interlocuteur --- */
.av-interlo{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
.av-interlo-agent{display:flex;gap:20px;align-items:flex-start}
.av-avatar{
  width:96px;
  height:96px;
  border-radius:50%;
  background:var(--av-ink);
  color:#fff;
  font-size:30px;
  font-weight:700;
  letter-spacing:1px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex:0 0 96px;
  overflow:hidden;
}
.av-avatar img{width:100%;height:100%;object-fit:cover}
.av-agent-nom{font-size:18px;font-weight:700;color:var(--av-green);margin:0}
.av-agent-fonction{font-size:14px;color:var(--av-muted);margin:2px 0 12px}
.av-agent-contact{font-size:14px;color:#555;line-height:1.7}
.av-agence-logo{max-height:52px;max-width:200px;display:block;margin-bottom:14px;object-fit:contain}
.av-agence-nom{font-size:15px;font-weight:700;color:var(--av-green);margin:0 0 6px}
.av-agence-info{font-size:14px;color:#555;line-height:1.7}
.av-agence-legal{font-size:11.5px;color:var(--av-muted);margin-top:10px;line-height:1.6}

/* --- Mentions --- */
.av-mentions{border-top:1px solid var(--av-line);padding-top:20px;margin-top:8px}
.av-mentions h3{
  font-size:11px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:1px;
  color:var(--av-muted);
  margin:0 0 10px;
}
.av-mentions p{
  font-size:11px;
  color:#8a8a8a;
  line-height:1.65;
  margin:0 0 8px;
  text-align:justify;
}
.av-footer{
  text-align:center;
  border-top:2px solid var(--av-green);
  padding-top:18px;
  margin-top:28px;
  font-size:12px;
  color:var(--av-muted);
}
.av-actions{margin-top:18px}
.av-btn{
  font:inherit;
  font-size:14px;
  font-weight:600;
  border-radius:6px;
  padding:10px 24px;
  cursor:pointer;
  margin:0 6px;
}
.av-btn-primary{background:var(--av-green);color:#fff;border:none}
.av-btn-secondary{background:#fff;color:var(--av-green);border:2px solid var(--av-green);padding:8px 24px}

/* --- Impression --- */
@media print{
  @page{size:A4;margin:14mm 12mm}
  body{margin:0;padding:0;background:#fff !important}
  .av-doc{max-width:none;padding:0;margin:0}
  .av-no-print{display:none !important}
  .av-section,.av-card,.av-argu-block,.av-interlo{break-inside:avoid;page-break-inside:avoid}
  .av-page-break{break-before:page;page-break-before:always}
  .av-photo-hero{height:260px}
}

/* --- Responsive --- */
@media (max-width:760px){
  .av-doc{padding:24px 20px}
  .av-info-grid,.av-argu-grid,.av-interlo{grid-template-columns:1fr}
  .av-photo-strip{grid-template-columns:repeat(2,1fr)}
  .av-final-row{flex-direction:column;align-items:flex-start}
  .av-final-right{text-align:left}
}
`;

export default function AvisValeurDoc() {
  const navigate = useNavigate();
  const [uploaded, setUploaded] = useState(null);

  /* Photos réellement uploadées en Step 1 (IndexedDB). Fallback sur le jeu
   * de démo si la base est vide ou inaccessible. */
  useEffect(() => {
    let cancelled = false;
    let created = [];
    (async () => {
      try {
        const photos = await getPhotosForCarousel();
        created = photos;
        if (!cancelled) setUploaded(photos);
      } catch {
        if (!cancelled) setUploaded([]);
      }
    })();
    return () => {
      cancelled = true;
      revokePhotoUrls(created);
    };
  }, []);

  const reportState = useMemo(() => getReportState(), []);

  const agence = { ...agenceMock, ...(reportState.agence || {}) };
  const agent = { ...agentMock, ...(reportState.agent || {}) };

  const pointsForts = reportState.pointsForts?.length
    ? reportState.pointsForts
    : avisValeur.pointsForts;
  const pointsVigilance = reportState.pointsVigilance?.length
    ? reportState.pointsVigilance
    : avisValeur.pointsVigilance;

  const prixRetenu = reportState.customPrice || avisValeur.prixMedian;

  /* Prix médian des comparables — seul poste du détail affiché. */
  const prixM2Comparables = avisValeur.prixM2Comparables || 4172;
  const valeurComparables = prixM2Comparables * property.surface;

  const photosSource = uploaded && uploaded.length
    ? uploaded.map((p) => ({ ...p, url: p.src }))
    : PROPERTY_PHOTOS;
  const photos = pickDocumentPhotos(photosSource, 5);
  const [hero, ...vignettes] = photos;

  const initiales = (agent.nom || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0])
    .join('')
    .toUpperCase();

  const descriptif = property.descriptif || [];

  return (
    <>
      <style>{CSS}</style>

      <div className="av-doc">
        {/* ============ 1. EN-TÊTE ============ */}
        <header className="av-header">
          {agence.logo ? (
            <img className="av-logo" src={agence.logo} alt={agence.nom || 'Logo agence'} />
          ) : (
            <p className="av-logo-fallback">{agence.nom || 'ideeri'}</p>
          )}
          <h1 className="av-title">Avis de valeur</h1>
          <p className="av-sub">
            Date : {property.dateAvisValeur || '31 mars 2026'}
            {'  |  '}
            Référence : {property.reference}
          </p>
        </header>

        {/* ============ 2. PHOTOS ============ */}
        {hero && (
          <section className="av-section">
            <h2 className="av-section-title">Votre bien</h2>
            <img
              className="av-photo-hero"
              src={hero.url}
              alt={hero.label || 'Photo du bien'}
            />
            {vignettes.length > 0 && (
              <div className="av-photo-strip">
                {vignettes.map((p) => (
                  <figure key={p.id}>
                    <img src={p.url} alt={p.label || ''} />
                    <figcaption>{p.label}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ============ 3. INFORMATIONS GÉNÉRALES + DESCRIPTIF ============ */}
        <section className="av-section">
          <h2 className="av-section-title">Informations générales</h2>
          <div className="av-card">
            <span className="av-label">Adresse</span>
            <div className="av-adresse">{property.adresse}</div>

            {property.tags?.length > 0 && (
              <div className="av-tags">
                {property.tags.map((t) => (
                  <span key={t} className="av-tag">{t}</span>
                ))}
              </div>
            )}

            <div className="av-info-grid">
              <div className="av-info-item">
                <div className="av-label">Surface Carrez</div>
                <div className="av-value">{formatNombre(property.surface)} m²</div>
              </div>
              <div className="av-info-item">
                <div className="av-label">Pièces / Chambres</div>
                <div className="av-value">
                  {property.pieces} pièces / {property.chambres} chambres
                </div>
              </div>
              <div className="av-info-item">
                <div className="av-label">Étage</div>
                <div className="av-value">
                  {property.etage}<sup>e</sup>
                  {property.etagesTotal ? ` / ${property.etagesTotal}` : ''}
                  {property.ascenseur === true && ' — avec ascenseur'}
                  {property.ascenseur === false && ' — sans ascenseur'}
                </div>
              </div>
              <div className="av-info-item">
                <div className="av-label">Année de construction</div>
                <div className="av-value">{property.annee}</div>
              </div>
              <div className="av-info-item">
                <div className="av-label">Diagnostic de performance</div>
                <div className="av-value">DPE {property.dpe}</div>
              </div>
              <div className="av-info-item">
                <div className="av-label">Extérieur</div>
                <div className="av-value">
                  {property.balcon
                    ? `Balcon ${formatNombre(property.balcon)} m²`
                    : 'Aucun'}
                </div>
              </div>
            </div>

            {descriptif.length > 0 && (
              <div className="av-descriptif">
                <span className="av-label" style={{ marginBottom: 8 }}>Descriptif</span>
                {descriptif.map((par, i) => (
                  <p key={i}>{par}</p>
                ))}
              </div>
            )}

            <div className="av-meta-line">
              Bien visité le{' '}
              <strong>{avisValeur.lettre?.dateRDV || property.createdAt}</strong> par{' '}
              <strong>{agent.nom || property.collaborateur}</strong>
            </div>
          </div>
        </section>

        {/* ============ 4. ARGUMENTAIRE DE VALORISATION ============ */}
        <section className="av-section av-page-break">
          <h2 className="av-section-title">Argumentaire de valorisation</h2>
          <div className="av-argu-grid">
            <div className="av-argu-block">
              <div className="av-argu-head is-plus">Ce qui valorise votre bien</div>
              <ul>
                {pointsForts.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            <div className="av-argu-block">
              <div className="av-argu-head is-vig">Points de vigilance</div>
              <ul>
                {pointsVigilance.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* ============ 5. AVIS DE VALEUR ============ */}
        <section className="av-section">
          <h2 className="av-section-title">Avis de valeur</h2>
          <div className="av-card">
            <div>
              <div className="av-decomp-head">
                <div className="av-decomp-title">Prix médian des comparables</div>
                <div className="av-decomp-val">
                  {prixM2Comparables.toLocaleString('fr-FR')} €/m²
                </div>
              </div>
              <div className="av-decomp-body">
                × {formatNombre(property.surface)} m² = {formatEuro(valeurComparables)}
              </div>
            </div>

            <hr className="av-sep" />

            <div className="av-final-row">
              <div className="av-final-label">Avis de valeur</div>
              <div className="av-final-right">
                <div className="av-final-price">{formatEuro(prixRetenu)}</div>
                <div className="av-final-range">
                  Fourchette : {formatEuro(avisValeur.prixBas)} — {formatEuro(avisValeur.prixHaut)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 6. VOTRE INTERLOCUTEUR ============ */}
        <section className="av-section">
          <h2 className="av-section-title">Votre interlocuteur</h2>
          <div className="av-card">
            <div className="av-interlo">
              <div className="av-interlo-agent">
                <div className="av-avatar">
                  {agent.photo
                    ? <img src={agent.photo} alt={agent.nom} />
                    : (initiales || '—')}
                </div>
                <div>
                  <p className="av-agent-nom">{agent.nom}</p>
                  <p className="av-agent-fonction">{agent.fonction}</p>
                  <div className="av-agent-contact">
                    {(agent.telDirect || agent.telephone) && (
                      <>{agent.telDirect || agent.telephone}<br /></>
                    )}
                    {agent.email}
                  </div>
                </div>
              </div>
              <div>
                {agence.logo && (
                  <img className="av-agence-logo" src={agence.logo} alt={agence.nom} />
                )}
                <p className="av-agence-nom">{agence.nom}</p>
                <div className="av-agence-info">
                  {agence.adresse && <>{agence.adresse}<br /></>}
                  {agence.tel}
                  {agence.tel && agence.email && ' · '}
                  {agence.email}
                  {(agence.tel || agence.email) && <br />}
                  {agence.siteWeb}
                </div>
                {(agence.carteT || agence.rcs || agence.mentionsComplementaires) && (
                  <div className="av-agence-legal">
                    {agence.carteT}
                    {agence.carteT && agence.rcs && ' · '}
                    {agence.rcs}
                    {agence.mentionsComplementaires && (
                      <><br />{agence.mentionsComplementaires}</>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============ 7. MENTIONS ============ */}
        <div className="av-mentions">
          <h3>Mentions</h3>
          <p>
            Cet avis de valeur a été réalisé à la date de sa rédaction, dans les conditions
            du marché actuel. Il tient compte de la spécificité de votre bien, de sa
            situation géographique, de sa surface, de la tension du marché et de la
            comparaison avec des biens similaires.
          </p>
          <p>
            Cette estimation est délivrée sous réserve que des recherches ou examens plus
            approfondis (certificat d'urbanisme, titre de propriété, diagnostics
            immobiliers…) ne fassent apparaître aucun élément pénalisant, et que
            d'éventuelles servitudes n'aient pas d'incidence, à la hausse ou à la baisse,
            sur la détermination du prix du bien.
          </p>
          <p>
            Cette indication de prix ne peut, bien entendu, être assimilée à une expertise
            immobilière, laquelle doit être établie par un Expert Immobilier en possession
            de l'ensemble des paramètres et documents nécessaires.
          </p>
          <p>
            Seul un rapport d'expertise en bonne et due forme peut servir de base à la mise
            en place d'un partage, d'une donation, d'une déclaration d'IFI (Impôt sur la
            Fortune Immobilière), d'une déclaration de succession, d'une liquidation de
            communauté, d'une garantie hypothécaire, ou être produit dans le cadre d'un
            dossier contentieux ou judiciaire.
          </p>
        </div>

        <footer className="av-footer">
          <p style={{ margin: 0 }}>
            Document généré le {property.dateAvisValeur || '31 mars 2026'} — Réf.{' '}
            {property.reference}
          </p>
          <div className="av-actions av-no-print">
            <button className="av-btn av-btn-primary" onClick={() => window.print()}>
              Imprimer / PDF
            </button>
            <button className="av-btn av-btn-secondary" onClick={() => navigate('/step/5')}>
              Retour à l'estimation
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
