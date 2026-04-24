import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  property,
  contexteZone,
  comparables,
  avisValeur,
  agence,
  agent,
  mandant,
  personasAcquereurs,
} from '../data/propertyData';
import ReliabilityBadge from '../components/ReliabilityBadge';

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

  const themeStyle = {
    '--primary': agence.couleurPrimaire,
    '--secondary': agence.couleurSecondaire,
  };

  const recommendedStrategy = avisValeur.strategies.find((s) => s.recommended);

  // Projets d'achat budget-compatibles : budget ≥ prix de présentation recommandé
  const projetsMatch = (avisValeur.acquereurs || []).filter(
    (a) => a.budget >= recommendedStrategy.prix
  ).length;

  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isPrintMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('print') === '1';

  const selectedComps = comparables.filter((c) => c.selected);

  // Personas d'acquéreurs : en web on sélectionne, en PDF tout est déplié.
  const personasList = Object.values(personasAcquereurs);
  const [activePersonaKey, setActivePersonaKey] = useState(personasList[0].key);
  const totalProjets = personasList.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="report-root" style={themeStyle}>
      <style>{reportCss}</style>

      {/* =============================================================
          SECTION 1 — Couverture
          ============================================================= */}
      <section className="cover">
        <img src={agence.logo} alt={agence.nom} className="cover-logo" />
        <div className="cover-bar" />
        <h1 className="cover-title">AVIS DE VALEUR</h1>
        <p className="cover-address">{property.adresse}</p>
        <div className="cover-hero" aria-hidden="true">
          <div className="cover-hero-placeholder">
            <span>{property.surface} m² · T{property.pieces} · Étage {property.etage}</span>
          </div>
        </div>
        <div className="cover-meta">
          <div>Référence : <strong>{property.reference}</strong></div>
          <div>Établi le {dateEdition}</div>
          <div>Par {agent.nom}, {agent.fonction}</div>
        </div>
        <div className="cover-footer">
          Document confidentiel · Établi par {agence.nom} · {dateEdition}
        </div>
      </section>

      {/* =============================================================
          SECTION 2 — Lettre d'accompagnement
          ============================================================= */}
      <section className="letter page-break">
        <div className="letter-header">
          <div className="letter-from">
            <strong>{agence.nom}</strong>
            <div>{agence.adresse}</div>
            <div>{agence.tel}</div>
            <div>{agence.email}</div>
          </div>
          <div className="letter-to">
            <strong>{mandant.civilite} {mandant.prenom} {mandant.nom}</strong>
            <div>{mandant.adresseCorrespondance}</div>
          </div>
        </div>

        <p className="letter-date">{agence.adresse.split(',').slice(-1)[0].trim().split(' ').slice(-1)[0] /* ville */ ? `Lyon, le ${dateEdition}` : `Le ${dateEdition}`}</p>

        <p className="letter-object">
          <strong>Objet :</strong> Avis de valeur — {property.adresse}
        </p>

        <div className="letter-body">
          <p>{mandant.civilite} {mandant.nom},</p>
          <p>{avisValeur.lettre.introParagraphe}</p>
          <p>
            Au terme de notre analyse, nous évaluons la valeur vénale de votre bien
            à <strong>{avisValeur.prixBas.toLocaleString('fr-FR')} € — {avisValeur.prixHaut.toLocaleString('fr-FR')} €</strong>,
            avec une recommandation de prix de présentation à <strong>{recommendedStrategy.prix.toLocaleString('fr-FR')} €</strong>.
          </p>
          <p>
            Notre méthodologie s'appuie sur l'analyse de biens comparables, la mesure
            de la tension de marché dans votre secteur et les caractéristiques propres
            de votre bien. Vous retrouverez le détail dans les pages suivantes.
          </p>
          <p>{avisValeur.lettre.cloture}</p>
          <p>Je reste à votre disposition,</p>
        </div>

        <div className="letter-signature">
          {agent.signature && (
            <img src={agent.signature} alt="Signature" className="signature-img" />
          )}
          <div><strong>{agent.nom}</strong></div>
          <div>{agent.fonction}</div>
          <div>{agent.telDirect} · {agent.email}</div>
        </div>
      </section>

      {/* =============================================================
          SECTION 3 — Synthèse exécutive
          ============================================================= */}
      <section className="summary page-break">
        <h2 className="section-title">Synthèse</h2>

        <div className="summary-hero">
          <div className="summary-label">Prix de présentation recommandé</div>
          <div className="summary-price">
            {recommendedStrategy.prix.toLocaleString('fr-FR')} €
          </div>
          <div className="summary-range">
            Fourchette : <strong>{avisValeur.prixBas.toLocaleString('fr-FR')} €</strong> — <strong>{avisValeur.prixHaut.toLocaleString('fr-FR')} €</strong>
          </div>
        </div>

        <div className="summary-kpis">
          <div className="kpi">
            <div className="kpi-value">{avisValeur.prixM2.toLocaleString('fr-FR')} €/m²</div>
            <div className="kpi-label">Prix au m²</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{avisValeur.confiance}/100</div>
            <div className="kpi-label">Indice de confiance</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{recommendedStrategy.label}</div>
            <div className="kpi-label">Stratégie recommandée</div>
          </div>
          <div className="kpi kpi-highlight">
            <div className="kpi-value">{projetsMatch}</div>
            <div className="kpi-label">Projets d'achat compatibles</div>
          </div>
        </div>

        <div className="summary-reco">
          <strong>Notre recommandation :</strong> {recommendedStrategy.argumentaire}
        </div>
      </section>

      {/* =============================================================
          SECTION 4 — Votre bien
          ============================================================= */}
      <section className="property page-break">
        <h2 className="section-title">Votre bien</h2>

        <div className="property-gallery">
          <div className="photo-main">Photo principale</div>
          <div className="photo-grid">
            <div className="photo-thumb">Séjour</div>
            <div className="photo-thumb">Cuisine</div>
            <div className="photo-thumb">Chambre</div>
          </div>
        </div>

        <div className="property-specs">
          <div className="spec-col">
            <div className="spec-row"><span>Type</span><strong>Appartement T{property.pieces}</strong></div>
            <div className="spec-row"><span>Surface</span><strong>{property.surface} m²</strong></div>
            <div className="spec-row"><span>Pièces</span><strong>{property.pieces}</strong></div>
            <div className="spec-row"><span>Chambres</span><strong>{property.chambres}</strong></div>
            <div className="spec-row"><span>Étage</span><strong>{property.etage} / 6</strong></div>
            <div className="spec-row"><span>Année</span><strong>{property.annee}</strong></div>
          </div>
          <div className="spec-col">
            <div className="spec-row">
              <span>DPE</span>
              <strong className={`dpe-badge dpe-${property.dpe}`}>{property.dpe}</strong>
            </div>
            <div className="spec-row">
              <span>GES</span>
              <strong className="dpe-badge dpe-D">D</strong>
            </div>
            <div className="spec-row"><span>Exposition</span><strong>Sud-Est</strong></div>
            <div className="spec-row"><span>Chauffage</span><strong>Individuel gaz</strong></div>
            <div className="spec-row"><span>État</span><strong>Bon état</strong></div>
            <div className="spec-row"><span>Ascenseur</span><strong>Oui</strong></div>
          </div>
        </div>

        <p className="property-desc">
          Bel appartement T{property.pieces} de {property.surface} m² traversant, situé au {property.etage}ᵉ
          étage avec ascenseur d'un immeuble des années 1970 en bon état d'entretien.
          Il dispose d'un balcon de 5,2 m² exposé Sud-Est, d'une cave et d'un parking
          extérieur. La cuisine ouverte sur le séjour lumineux offre un espace de vie
          agréable. Les menuiseries double vitrage performant et la chaudière gaz à
          condensation de 2018 permettent une consommation maîtrisée.
        </p>

        <div className="property-tags">
          <span className="pill">Balcon</span>
          <span className="pill">Ascenseur</span>
          <span className="pill">Cave</span>
          <span className="pill">Parking</span>
          <span className="pill">DPE D</span>
          <span className="pill">Métro 350m</span>
        </div>
      </section>

      {/* =============================================================
          SECTION 5 — Votre marché local (V2, factuel uniquement)
          ============================================================= */}
      <section className="market page-break">
        <h2 className="section-title">Votre marché local</h2>

        <div className="market-kpis">
          <div className="kpi">
            <div className="kpi-value">{contexteZone.market.prixM2} €/m²</div>
            <div className="kpi-label">Médiane secteur</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{contexteZone.market.evolution}</div>
            <div className="kpi-label">Évolution 12 mois</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{contexteZone.market.delai}</div>
            <div className="kpi-label">Délai moyen de vente</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{contexteZone.market.transactions}</div>
            <div className="kpi-label">Transactions 12 mois</div>
          </div>
        </div>

        <div className="market-tension">
          <strong>Tension du marché : </strong>
          <span className="tension-badge">Marché modérément tendu</span>
        </div>

        <p className="market-caption">
          Fourchette de prix observée sur la typologie T3 dans votre secteur :
          <strong> {contexteZone.market.fourchette} €/m²</strong>.
        </p>
      </section>

      {/* =============================================================
          SECTION 6 — Profils d'acquéreurs en recherche
          (5 personas, reprend Acte 2 de Step4 — interactif en web, déplié en PDF)
          ============================================================= */}
      <section className="personas page-break">
        <h2 className="section-title">Profils d'acquéreurs en recherche</h2>
        <p className="section-intro">
          <strong>{totalProjets} projets d'achat actifs</strong> dans votre périmètre matchent
          les critères de votre bien. Ils se répartissent en 5 profils-types.
        </p>

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
                  <span className="count-pill">{p.count} projets</span>
                </div>
                <div className="persona-focus-meta">
                  <span>Budget moyen <strong>{p.budget}</strong></span>
                  <span>Délai cible <strong>{p.delai}</strong></span>
                  <span>Compatibilité <strong className="compat">{p.compat}</strong></span>
                </div>
              </div>

              <div className="persona-focus-body">
                <div className="persona-needs">
                  <h4>Besoins principaux identifiés</h4>
                  <ul>
                    {p.needs.map((n, i) => (
                      <li key={i} className="need-item">
                        <span
                          className="need-bullet"
                          style={{ color: n.match ? 'var(--primary)' : '#e05252' }}
                        >
                          {n.match ? '✓' : '✗'}
                        </span>
                        <span className="need-text">
                          {n.txt}
                          <span className={`need-tag ${n.match ? '' : 'miss'}`}>
                            {n.tag}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="persona-buyers">
                  <h4>Top projets de ce profil</h4>
                  <div className="buyer-list">
                    {p.buyers.map((b) => (
                      <div key={b.rank} className="buyer-row">
                        <span className="buyer-rank">#{b.rank}</span>
                        <span className="buyer-name">{b.name}</span>
                        <span className="buyer-budget">{b.budget}</span>
                        <span className="buyer-score">{b.score}</span>
                      </div>
                    ))}
                    {p.count > p.buyers.length && (
                      <div className="buyer-more">
                        + {p.count - p.buyers.length} autre{p.count - p.buyers.length > 1 ? 's' : ''} projet{p.count - p.buyers.length > 1 ? 's' : ''} dans ce profil
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </section>

      {/* =============================================================
          SECTION 7 — Notre méthodologie
          ============================================================= */}
      <section className="methodology">
        <h2 className="section-title">Comment nous avons estimé votre bien</h2>

        <div className="pillars">
          {avisValeur.methodologie.piliers.map((p, i) => (
            <div className="pillar" key={i}>
              <div className="pillar-icon">{p.icon}</div>
              <div className="pillar-title">{p.titre}</div>
              <div className="pillar-desc">{p.desc}</div>
            </div>
          ))}
        </div>

        <p className="transparency">{avisValeur.methodologie.phraseTransparence}</p>
      </section>

      {/* =============================================================
          SECTION 7 — Comparables retenus (enrichis, avec badge fiabilité)
          ============================================================= */}
      <section className="comparables page-break">
        <h2 className="section-title">Comparables retenus</h2>

        <div className="comparables-grid">
          {selectedComps.map((c) => (
            <div className="comp-card" key={c.id}>
              <div className="comp-header">
                <span className={`comp-source comp-source-${c.source}`}>
                  {c.sourceLabel}
                </span>
                <span className="comp-date">{c.date}</span>
              </div>

              <div className="comp-title">
                {c.type} — {c.surface} m², {c.pieces} pièce{c.pieces > 1 ? 's' : ''}
              </div>
              <div className="comp-address">
                {c.adresse} · {c.distance} m
              </div>

              <div className="comp-grid">
                <div><span>Étage</span><strong>{c.etage}/{c.etageMax}</strong></div>
                <div>
                  <span>DPE</span>
                  <strong className={`dpe-badge dpe-${c.dpe}`}>{c.dpe}</strong>
                </div>
                <div><span>État</span><strong>{c.etat}</strong></div>
                <div><span>Atouts</span><strong>{c.atouts.join(', ') || '—'}</strong></div>
                <div><span>Exposition</span><strong>{c.exposition}</strong></div>
                <div><span>Année</span><strong>{c.anneeConstruction}</strong></div>
              </div>

              <div className="comp-price">
                <div>
                  <strong>{c.prix.toLocaleString('fr-FR')} €</strong>
                  <span className="comp-m2"> · {c.prixM2.toLocaleString('fr-FR')} €/m²</span>
                </div>
                <div className="comp-adjust">
                  Ajustement <strong>{c.totalAjustement}</strong> · Poids <strong>{(c.poids * 100).toFixed(0)}%</strong>
                </div>
              </div>

              <div className="comp-reliability">
                <ReliabilityBadge comparable={c} bienRef={property} size="sm" />
              </div>

              <p className="comp-comment">{c.commentairePertinence}</p>
            </div>
          ))}
        </div>

        <div className="comp-average">
          Moyenne pondérée retenue : <strong>{avisValeur.prixM2.toLocaleString('fr-FR')} €/m²</strong>
        </div>
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
              {avisValeur.pointsForts.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="arg-col arg-vigilance">
            <h3>Points de vigilance</h3>
            <ul>
              {avisValeur.pointsVigilance.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* =============================================================
          SECTION 9 — Décomposition du prix (V2, sans ajustement zone)
          ============================================================= */}
      <section className="decomposition page-break">
        <h2 className="section-title">Décomposition du prix</h2>

        <div className="cascade">
          {avisValeur.decomposition.map((d, i) => (
            <React.Fragment key={i}>
              <div className={`cascade-step ${d.final ? 'final' : ''}`}>
                <div className="step-label">{d.step}</div>
                <div className="step-value">{d.value}</div>
                {d.delta && <div className="step-delta">{d.delta}</div>}
                <div className="step-detail">{d.detail}</div>
              </div>
              {i < avisValeur.decomposition.length - 1 && (
                <span className="cascade-arrow">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* =============================================================
          SECTION 10 — Proposition commerciale (3 stratégies)
          ============================================================= */}
      <section className="strategies page-break">
        <h2 className="section-title">Notre proposition</h2>

        <div className="strat-cols">
          {avisValeur.strategies.map((s, i) => (
            <div
              key={i}
              className={`strat-col ${s.recommended ? 'recommended' : ''}`}
            >
              {s.recommended && (
                <span className="strat-badge">Notre recommandation</span>
              )}
              <div className="strat-label">{s.label}</div>
              <div className="strat-price">{s.prix.toLocaleString('fr-FR')} €</div>
              <div className="strat-m2">{s.prixM2.toLocaleString('fr-FR')} €/m²</div>
              <div className="strat-row">
                <span>Projets d'achat compatibles</span>
                <strong>
                  {(avisValeur.acquereurs || []).filter((a) => a.budget >= s.prix).length}
                </strong>
              </div>
              <div className="strat-row"><span>Délai</span><strong>{s.delai}</strong></div>
              <div className="strat-row"><span>Profil</span><strong>{s.profilCible}</strong></div>
              <div className="strat-row"><span>Risque</span><strong>{s.risque}</strong></div>
            </div>
          ))}
        </div>

        <div className="strat-reco">
          <strong>Pourquoi la stratégie {recommendedStrategy.label} ?</strong>
          <p>{recommendedStrategy.argumentaireDetaille}</p>
        </div>
      </section>

      {/* =============================================================
          SECTION 11 — Votre interlocuteur
          ============================================================= */}
      <section className="contact">
        <h2 className="section-title">Votre interlocuteur</h2>

        <div className="contact-card">
          {agent.photo && (
            <img src={agent.photo} alt={agent.nom} className="agent-photo" />
          )}
          <div className="contact-identity">
            <div className="agent-name">{agent.nom}</div>
            <div className="agent-role">{agent.fonction}</div>
            <div>{agent.telDirect}</div>
            <div>{agent.email}</div>
          </div>
          <div className="contact-agence">
            <img src={agence.logo} alt={agence.nom} className="agence-logo" />
            <div><strong>{agence.nom}</strong></div>
            <div>{agence.adresse}</div>
            <div>{agence.tel} · {agence.email}</div>
            <div>{agence.siteWeb}</div>
          </div>
        </div>
      </section>

      {/* =============================================================
          SECTION 12 — Mentions légales
          ============================================================= */}
      <footer className="legal page-break">
        <h3>Mentions légales</h3>
        <ul>
          {avisValeur.mentionsLegales.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <div className="legal-agence">
          {agence.carteT} · {agence.rcs}
          {agence.mentionsComplementaires && (
            <div>{agence.mentionsComplementaires}</div>
          )}
        </div>
      </footer>

      {/* Actions (non imprimées) */}
      {!isPrintMode && (
        <div className="actions no-print">
          <button className="btn primary" onClick={() => downloadPdf()}>
            Télécharger en PDF
          </button>
          <button className="btn secondary" onClick={() => navigate('/step/5')}>
            Retour
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Déclenche la génération PDF via l'endpoint serverless Puppeteer.
 */
async function downloadPdf() {
  try {
    const reportUrl = `${window.location.origin}/#/report?print=1`;
    const res = await fetch('/api/report-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportUrl }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Erreur de génération PDF : ${err.error || res.statusText}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avis-de-valeur-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    // En dev local l'endpoint n'existe pas : fallback impression navigateur
    console.warn('Endpoint PDF indisponible, fallback sur impression navigateur.', e);
    window.print();
  }
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
    border-bottom: 1px solid #e5e5e5;
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
    color: #949494; font-size: 14px; font-weight: 600;
  }
  .cover-meta { margin: 40px 0; font-size: 14px; color: var(--secondary); line-height: 1.8; }
  .cover-meta strong { color: var(--primary); }
  .cover-footer { margin-top: auto; padding-top: 40px; font-size: 11px; color: #949494; border-top: 1px solid #e5e5e5; width: 100%; }

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
  .summary-label { font-size: 13px; color: #949494; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .summary-price { font-size: 54px; font-weight: 700; color: var(--primary); margin: 8px 0; letter-spacing: -1px; }
  .summary-range { font-size: 15px; color: var(--secondary); }
  .summary-kpis { display: flex; justify-content: space-around; gap: 16px; margin: 24px 0; }
  .kpi { text-align: center; flex: 1; }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--secondary); }
  .kpi-label { font-size: 12px; color: #949494; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .kpi.kpi-highlight .kpi-value { color: var(--primary); }
  .summary-reco { padding: 16px 20px; background: #f7f7f7; border-left: 4px solid var(--primary); border-radius: 4px; font-size: 14px; }

  /* ====== 4. Property ====== */
  .property-gallery { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 24px; height: 280px; }
  .photo-main { background: linear-gradient(135deg, #e5e5e5, #c5c5c5); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: 600; font-size: 13px; }
  .photo-grid { display: grid; grid-template-rows: repeat(3, 1fr); gap: 12px; }
  .photo-thumb { background: linear-gradient(135deg, #e5e5e5, #d0d0d0); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-weight: 500; font-size: 12px; }
  .property-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 20px; }
  .spec-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .spec-row span { color: #949494; }
  .spec-row strong { color: var(--secondary); }
  .property-desc { font-size: 14px; line-height: 1.7; color: var(--secondary); margin: 16px 0; }
  .property-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-block; background: var(--primary)15; color: var(--primary); border: 1px solid var(--primary)40; border-radius: 14px; padding: 3px 12px; font-size: 12px; font-weight: 600; }

  /* DPE badge */
  .dpe-badge { display: inline-block; min-width: 20px; padding: 2px 6px; border-radius: 4px; color: #fff; font-weight: 700; text-align: center; }
  .dpe-A { background: #319c3a; }
  .dpe-B { background: #67b045; }
  .dpe-C { background: #cadb2c; color: #393939; }
  .dpe-D { background: #f5e638; color: #393939; }
  .dpe-E { background: #f1a025; }
  .dpe-F { background: #e86a2e; }
  .dpe-G { background: #d63024; }

  /* ====== 5. Market ====== */
  .market-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .market-tension { margin: 16px 0; font-size: 14px; }
  .tension-badge { display: inline-block; background: var(--primary)15; color: var(--primary); border: 1px solid var(--primary)40; border-radius: 6px; padding: 4px 12px; font-weight: 600; font-size: 13px; }
  .market-caption { font-size: 13px; color: var(--secondary); }

  /* ====== 6. Personas acquéreurs ====== */
  .section-intro { font-size: 14px; color: var(--secondary); margin: 0 0 20px; line-height: 1.6; }
  .personas-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
  .persona-card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 18px 10px; background: #fff; text-align: center; cursor: pointer; transition: all 0.18s; position: relative; }
  .persona-card:hover { border-color: var(--primary)60; background: var(--primary)05; }
  .persona-card.active { border: 1px solid var(--primary); background: var(--primary)15; }
  .persona-card.active::after { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid var(--primary); }
  .persona-count { font-size: 28px; font-weight: 700; color: var(--secondary); line-height: 1; }
  .persona-card.active .persona-count { color: var(--primary); }
  .persona-name { font-size: 12px; font-weight: 700; color: var(--secondary); margin-top: 8px; }
  .persona-sub { font-size: 10px; color: #949494; margin-top: 2px; line-height: 1.3; }

  .persona-focus { border: 1px solid var(--primary)40; border-radius: 10px; background: linear-gradient(180deg, var(--primary)0a 0%, #fff 60%); padding: 20px 22px; margin-bottom: 16px; }
  .persona-focus-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--primary)25; margin-bottom: 14px; flex-wrap: wrap; gap: 12px; }
  .persona-focus-title { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: var(--secondary); }
  .persona-focus-title .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
  .count-pill { background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
  .persona-focus-meta { display: flex; gap: 16px; font-size: 11px; color: #949494; flex-wrap: wrap; }
  .persona-focus-meta strong { color: var(--secondary); }
  .persona-focus-meta .compat { color: var(--primary); }

  .persona-focus-body { display: grid; grid-template-columns: 1.3fr 1fr; gap: 22px; }
  .persona-needs h4, .persona-buyers h4 { font-size: 11px; font-weight: 700; color: #949494; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px; }
  .persona-needs ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .need-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--secondary); line-height: 1.5; }
  .need-bullet { font-weight: 700; margin-top: 2px; flex-shrink: 0; }
  .need-text { display: inline; }
  .need-tag { display: inline-block; font-size: 10px; background: var(--primary)15; color: var(--primary); padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-weight: 600; vertical-align: middle; }
  .need-tag.miss { background: #fdecec; color: #e05252; }

  .buyer-list { display: flex; flex-direction: column; gap: 5px; }
  .buyer-row { display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; padding: 7px 10px; background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 11px; }
  .buyer-rank { font-weight: 700; color: #949494; font-size: 10px; min-width: 16px; }
  .buyer-name { color: var(--secondary); font-weight: 600; }
  .buyer-budget { color: #949494; font-size: 10px; }
  .buyer-score { font-weight: 700; color: var(--primary); font-size: 12px; }
  .buyer-more { font-size: 11px; color: #949494; padding: 6px 10px; font-style: italic; }

  /* ====== 7. Methodology ====== */
  .pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
  .pillar { text-align: center; padding: 20px 14px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fafafa; }
  .pillar-icon { font-size: 32px; margin-bottom: 8px; }
  .pillar-title { font-weight: 700; color: var(--primary); font-size: 14px; margin-bottom: 6px; }
  .pillar-desc { font-size: 12px; color: var(--secondary); line-height: 1.5; }
  .transparency { text-align: center; font-style: italic; color: var(--primary); font-weight: 600; margin: 16px 0 0; font-size: 14px; }

  /* ====== 7. Comparables ====== */
  .comparables-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .comp-card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px; background: #fff; }
  .comp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .comp-source { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .comp-source-DVF { background: #e8f4fd; color: #1976d2; }
  .comp-source-IDEERI { background: var(--primary)15; color: var(--primary); }
  .comp-source-EN_COURS { background: #fff3e0; color: #e8a838; }
  .comp-date { font-size: 12px; color: #949494; }
  .comp-title { font-size: 15px; font-weight: 700; color: var(--secondary); margin-bottom: 4px; }
  .comp-address { font-size: 13px; color: #949494; margin-bottom: 12px; }
  .comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; margin-bottom: 12px; font-size: 12px; }
  .comp-grid > div { display: flex; flex-direction: column; }
  .comp-grid span { color: #949494; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .comp-grid strong { color: var(--secondary); font-size: 13px; }
  .comp-price { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-top: 1px solid #f0f0f0; font-size: 14px; }
  .comp-price strong { color: var(--secondary); }
  .comp-m2 { color: #949494; font-size: 13px; }
  .comp-adjust { font-size: 12px; color: #949494; }
  .comp-adjust strong { color: var(--secondary); }
  .comp-reliability { margin: 8px 0; }
  .comp-comment { font-size: 12px; color: var(--secondary); font-style: italic; margin: 8px 0 0; padding: 8px 12px; background: #fafafa; border-radius: 4px; }
  .comp-average { margin-top: 20px; padding: 12px 20px; background: var(--primary)15; border-radius: 8px; text-align: right; font-size: 14px; color: var(--secondary); }
  .comp-average strong { color: var(--primary); font-size: 16px; }

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

  /* ====== 9. Decomposition (V2 : 4 étapes) ====== */
  .cascade { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
  .cascade-step { flex: 1 1 0; min-width: 140px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 14px; text-align: center; }
  .cascade-step.final { background: var(--primary)15; border-color: var(--primary); font-weight: 600; }
  .cascade-step.final .step-value { color: var(--primary); font-size: 20px; }
  .step-label { font-size: 11px; color: #949494; text-transform: uppercase; letter-spacing: 0.5px; }
  .step-value { font-size: 16px; font-weight: 700; color: var(--secondary); margin: 4px 0; }
  .step-delta { font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 4px; }
  .step-detail { font-size: 11px; color: #949494; line-height: 1.4; }
  .cascade-arrow { font-size: 20px; color: #c0c0c0; display: flex; align-items: center; }

  /* ====== 10. Strategies ====== */
  .strat-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
  .strat-col { border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px 16px; text-align: center; background: #fff; position: relative; }
  .strat-col.recommended { border: 2px solid var(--primary); background: var(--primary)0a; transform: translateY(-8px); box-shadow: 0 8px 24px var(--primary)30; }
  .strat-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 12px; white-space: nowrap; }
  .strat-label { font-size: 13px; color: #949494; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .strat-price { font-size: 26px; font-weight: 700; color: var(--secondary); margin: 4px 0; }
  .strat-col.recommended .strat-price { color: var(--primary); }
  .strat-m2 { font-size: 13px; color: #949494; margin-bottom: 16px; }
  .strat-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-top: 1px solid #f0f0f0; font-size: 12px; text-align: left; }
  .strat-row span { color: #949494; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
  .strat-row strong { color: var(--secondary); font-size: 12px; font-weight: 600; line-height: 1.4; }
  .strat-reco { padding: 20px 24px; background: var(--primary)0a; border-left: 4px solid var(--primary); border-radius: 6px; }
  .strat-reco strong { color: var(--primary); font-size: 14px; }
  .strat-reco p { margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: var(--secondary); }

  /* ====== 11. Contact ====== */
  .contact-card { display: grid; grid-template-columns: auto 1fr 1fr; gap: 24px; align-items: start; padding: 20px; border: 1px solid #e5e5e5; border-radius: 10px; }
  .agent-photo { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; }
  .contact-identity { font-size: 14px; line-height: 1.7; }
  .agent-name { font-size: 17px; font-weight: 700; color: var(--primary); }
  .agent-role { font-size: 13px; color: #949494; margin-bottom: 8px; }
  .contact-agence { font-size: 13px; line-height: 1.7; color: var(--secondary); }
  .contact-agence strong { color: var(--primary); }
  .agence-logo { max-width: 120px; max-height: 50px; margin-bottom: 8px; }

  /* ====== 12. Legal ====== */
  .legal { font-size: 11px; color: #6b6b6b; }
  .legal h3 { color: var(--secondary); text-transform: uppercase; letter-spacing: 1px; font-size: 12px; margin: 0 0 12px; }
  .legal ul { padding-left: 18px; margin: 0 0 16px; }
  .legal li { margin-bottom: 6px; line-height: 1.6; }
  .legal-agence { padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #949494; line-height: 1.6; }

  /* ====== Actions (UI-only) ====== */
  .actions { text-align: center; padding: 32px; background: #fff; border-top: 1px solid #e5e5e5; }
  .btn { display: inline-block; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; margin: 0 6px; }
  .btn.primary { background: var(--primary); color: #fff; }
  .btn.secondary { background: #fff; color: var(--primary); border: 2px solid var(--primary); }

  /* ====== Print media ====== */
  @media print {
    body { margin: 0; padding: 0; background: #fff !important; }
    .report-root { max-width: none; background: #fff; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    .report-root section, .report-root footer { padding: 24px 32px; }
    .strat-col.recommended { transform: none; box-shadow: none; }
  }
`;
