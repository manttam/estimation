import React from 'react';
import QrCode from './QrCode';
import iconeAppIdeeri from '../assets/ideeri-app-icon.png';
import logoIdeeriBlanc from '../assets/ideeri-texte-blanc.svg';

/**
 * BlocAppIdeeri — rappel de marque vers l'application, dans le compte rendu.
 *
 * Seul bloc du document à sortir de la couleur d'agence pour la charte
 * Ideeri (noir #1A1A1A, jaune #EBBC02) : c'est un bloc identitaire, pas une
 * visualisation. Les styles vivent dans `reportCss` (CompteRendu), injecté
 * une fois pour tout le document.
 *
 * Deux usages dans le document, avec des contenus différents : la fiche du
 * bien renvoie au relevé détaillé, le plan de commercialisation renvoie au
 * suivi de la vente. D'où les props plutôt qu'un bloc figé.
 *
 * @param {string} titre        phrase d'accroche
 * @param {string} [accent]     fragment du titre à mettre en jaune
 * @param {string} [sousTitre]  ligne secondaire
 * @param {string[]} [points]   liste courte de ce que l'app apporte
 * @param {string} [note]       phrase de bas de bloc (en jaune)
 * @param {string} lien         URL encodée dans le QR code
 */
export default function BlocAppIdeeri({ titre, accent, sousTitre, points, note, lien }) {
  /* Titre avec un fragment accentué : on découpe autour de `accent` plutôt
   * que d'injecter du HTML. */
  const rendreTitre = () => {
    if (!accent || !titre.includes(accent)) return titre;
    const [avant, ...reste] = titre.split(accent);
    return (
      <>
        {avant}
        <span className="app-renvoi-accent">{accent}</span>
        {reste.join(accent)}
      </>
    );
  };

  return (
    <div className="app-renvoi">
      {/* Icône à gauche du nom : c'est le couple que le mandant reconnaît sur
          l'écran de son téléphone. Collée au QR, elle formait un amas de deux
          carrés sans rapport. */}
      <img src={iconeAppIdeeri} alt="" aria-hidden="true" className="app-renvoi-icone-app" />

      <div className="app-renvoi-texte">
        <img src={logoIdeeriBlanc} alt="Ideeri" className="app-renvoi-logo" />

        <p className="app-renvoi-titre">{rendreTitre()}</p>
        {sousTitre && <p className="app-renvoi-sous">{sousTitre}</p>}

        {points && points.length > 0 && (
          <ul className="app-renvoi-points">
            {points.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        )}

        {note && <p className="app-renvoi-note">{note}</p>}

        <p className="app-renvoi-stores">Application disponible sur iOS et Android</p>
      </div>

      <div className="app-renvoi-aside">
        {/* QR sur pastille blanche : les lecteurs attendent des modules
            sombres sur fond clair, et un document imprimé doit scanner du
            premier coup. */}
        <div className="app-renvoi-qr">
          <QrCode value={lien} taille={76} />
        </div>
        <p className="app-renvoi-qr-legende">Scannez pour télécharger</p>
      </div>
    </div>
  );
}
