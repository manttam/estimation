/**
 * Mise en forme de la synthèse Géorisques pour l'affichage.
 *
 * Séparé du client réseau (utils/georisquesClient) : ici aucune requête, on
 * traduit seulement une synthèse en lignes « libellé / valeur / niveau »,
 * `level` valant 'ok' | 'warn' | 'bad'.
 */

/**
 * Construit les lignes « Risques » depuis une synthèse Géorisques.
 * Renvoie [] si aucune donnée exploitable — l'appelant masque alors la fiche
 * plutôt que d'afficher des tirets.
 */
export function itemsRisques(r) {
  if (!r) return [];
  const items = [];

  if (r.sismique && r.sismique.niveau) {
    const z = parseInt(r.sismique.zone, 10);
    items.push({
      label: 'Sismicité',
      value: r.sismique.zone ? `Zone ${r.sismique.zone} — ${r.sismique.niveau}` : r.sismique.niveau,
      level: z >= 4 ? 'bad' : z === 3 ? 'warn' : 'ok',
    });
  }
  if (r.radon && r.radon.potentiel) {
    items.push({
      label: 'Radon',
      value: r.radon.potentiel,
      level: r.radon.potentiel === 'Élevé' ? 'bad' : r.radon.potentiel === 'Moyen' ? 'warn' : 'ok',
    });
  }
  if (r.argile && r.argile.niveau) {
    const niv = String(r.argile.niveau).toLowerCase();
    items.push({
      label: 'Retrait-gonflement des argiles',
      value: r.argile.niveau,
      level: /fort|élev/.test(niv) ? 'bad' : /moy/.test(niv) ? 'warn' : 'ok',
    });
  }
  if (r.inondation) {
    items.push({
      label: 'Inondation (PPRI)',
      value: r.inondation.present ? r.inondation.niveau || 'Présent' : 'Aucun',
      level: r.inondation.present ? 'warn' : 'ok',
    });
  }
  if (r.mouvement) {
    items.push({
      label: 'Mouvements de terrain (500 m)',
      value: r.mouvement.present ? `${r.mouvement.count} signalé${r.mouvement.count > 1 ? 's' : ''}` : 'Aucun',
      level: r.mouvement.present ? 'warn' : 'ok',
    });
  }
  if (r.basias) {
    items.push({
      label: 'Sites industriels (500 m)',
      value: r.basias.present ? `${r.basias.count} signalé${r.basias.count > 1 ? 's' : ''}` : 'Aucun',
      level: r.basias.present ? 'warn' : 'ok',
    });
  }
  return items;
}

