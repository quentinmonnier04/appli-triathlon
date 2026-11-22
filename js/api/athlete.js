// Profil de l'athlète (F-02). Endpoint vérifié dans la spécification OpenAPI :
// GET /api/v1/athlete/{id} -> WithSportSettings (champs id, name, firstname, lastname).

import { requeteGet, ErreurApi } from './client.js';
import { lireReglages, ecrireCache, lireCache } from '../cache/stockage.js';

// Réponse brute -> objet interne Athlete (9.2) ; en L0 seuls l'id et le nom servent.
export function convertirAthlete(brut) {
  const nomComplet = [brut.firstname, brut.lastname].filter(Boolean).join(' ');
  return { id: brut.id, nom: brut.name || nomComplet || 'athlète' };
}

// Teste des identifiants (F-01) : l'id "0" désigne le propriétaire de la clé, l'id saisi sert de repli (5.4).
// Renvoie l'Athlete ; lève une ErreurApi sinon.
export async function testerConnexion(athleteId, cle) {
  try {
    return convertirAthlete(await requeteGet('/athlete/0', cle));
  } catch (e) {
    // 401 = clé refusée : inutile de réessayer avec l'identifiant saisi (ENF-11)
    if (!(e instanceof ErreurApi) || e.type === 'RESEAU' || e.statut === 401 || !athleteId || athleteId === '0') throw e;
    return convertirAthlete(await requeteGet(`/athlete/${encodeURIComponent(athleteId)}`, cle));
  }
}

// Athlète mis en cache après une connexion réussie (F-02).
export async function memoriserAthlete(athlete) {
  await ecrireCache('athlete', athlete);
}

// Athlète courant : cache d'abord (5.5), sinon appel à l'API avec les identifiants enregistrés.
export async function lireAthlete() {
  const cache = await lireCache('athlete');
  if (cache) return cache.donnees;
  const { athleteId, cle } = await lireReglages();
  const athlete = await testerConnexion(athleteId, cle);
  await memoriserAthlete(athlete);
  return athlete;
}
