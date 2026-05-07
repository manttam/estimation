/**
 * Client pour la BAN (Base Adresse Nationale) - api-adresse.data.gouv.fr
 * Service public gratuit, pas de cle API requise.
 *
 * Doc: https://adresse.data.gouv.fr/api-doc/adresse
 */

const BAN_BASE = 'https://api-adresse.data.gouv.fr';

/**
 * Recherche d'adresses avec autocompletion.
 * @param {string} query - texte saisi par l'utilisateur (minimum 3 caracteres)
 * @returns {Promise<Array<{label, name, postcode, city, citycode, type, coords: [lat, lon]}>>}
 */
export async function searchAddresses(query) {
  if (!query || query.trim().length < 3) return [];

  const url = `${BAN_BASE}/search/?q=${encodeURIComponent(query)}&autocomplete=1&limit=6`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BAN HTTP ${res.status}`);
    const data = await res.json();

    return (data.features || []).map((f) => ({
      label: f.properties.label,
      name: f.properties.name,
      postcode: f.properties.postcode,
      city: f.properties.city,
      citycode: f.properties.citycode, // code INSEE de la commune
      context: f.properties.context, // ex. "75, Paris, Ile-de-France"
      type: f.properties.type, // housenumber, street, locality, municipality
      score: f.properties.score,
      coords: [f.geometry.coordinates[1], f.geometry.coordinates[0]], // [lat, lon]
    }));
  } catch (err) {
    console.error('[BAN] searchAddresses error', err);
    return [];
  }
}

/**
 * Geocodage inverse (coords -> adresse). Utile si l'utilisateur clique sur la carte.
 * @param {number} lat
 * @param {number} lon
 */
export async function reverseGeocode(lat, lon) {
  const url = `${BAN_BASE}/reverse/?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BAN HTTP ${res.status}`);
    const data = await res.json();
    const f = (data.features || [])[0];
    if (!f) return null;
    return {
      label: f.properties.label,
      postcode: f.properties.postcode,
      city: f.properties.city,
      citycode: f.properties.citycode,
      coords: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
    };
  } catch (err) {
    console.error('[BAN] reverseGeocode error', err);
    return null;
  }
}
