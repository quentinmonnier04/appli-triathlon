// Forme (CTL, ATL) lue dans les données wellness d'Intervals.icu (F-23). Le bien-être arrive en L6.
// Endpoint vérifié dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{id}/wellness{ext}  (ext vide = JSON ; oldest, newest inclus, fields) -> Wellness[]
// Champs : id (la date locale), ctl, atl. Le TSB n'est pas fourni : TSB = CTL - ATL (glossaire).

import { requeteAuthentifiee } from './client.js';
import { calculerTsb } from '../logique/forme.js';

// Valeurs entières, comme sur Intervals.icu : le TSB affiché vaut exactement CTL - ATL.
const arrondi = (v) => (v === null || v === undefined ? null : Math.round(v));

// Wellness (Intervals.icu) -> objet interne Forme (9.2).
export function convertirForme(brut) {
  const ctl = arrondi(brut.ctl);
  const atl = arrondi(brut.atl);
  return { date: brut.id, ctl, atl, tsb: calculerTsb(ctl, atl) };
}

// Formes quotidiennes entre deux jours inclus.
export async function chargerFormes(debut, fin) {
  const bruts = await requeteAuthentifiee('/athlete/0/wellness', { oldest: debut, newest: fin, fields: 'id,ctl,atl' });
  return bruts.map(convertirForme);
}
