// Données de l'agenda (F-30 à F-35) : activités réalisées et séances prévues d'une période, mises en cache
// par période (5.5, ENF-11). Endpoints déjà vérifiés : voir api/activites.js et api/evenements.js.

import { lireCache, ecrireCache } from '../cache/stockage.js';
import { chargerActivitesEntre } from './activites.js';
import { chargerSeancesPrevues } from './evenements.js';

const cle = (debut, fin) => `agenda:${debut}:${fin}`;

// Période en cache : { activites, prevues, charge_le } ou null.
export async function lirePeriodeEnCache(debut, fin) {
  const cache = await lireCache(cle(debut, fin));
  return cache ? { ...cache.donnees, charge_le: cache.charge_le } : null;
}

// Recharge une période depuis Intervals.icu et remplace son cache.
export async function rafraichirPeriode(debut, fin) {
  const [activites, prevues] = await Promise.all([chargerActivitesEntre(debut, fin), chargerSeancesPrevues(debut, fin)]);
  await ecrireCache(cle(debut, fin), { activites, prevues });
  return { activites, prevues, charge_le: (await lireCache(cle(debut, fin))).charge_le };
}
