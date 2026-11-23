// Données wellness d'Intervals.icu : forme CTL, ATL (F-23) et bilan du jour (F-62).
// Endpoints vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{id}/wellness{ext}     (ext vide = JSON ; oldest, newest inclus, fields) -> Wellness[]
//   GET /api/v1/athlete/{id}/wellness/{date}   (jour local ISO-8601)                           -> Wellness
//   PUT /api/v1/athlete/{id}/wellness/{date}   (corps Wellness)                                -> Wellness
// Champs : id (la date locale), ctl, atl, fatigue, sleepQuality, soreness, weight (kg), comments.
// Le TSB n'est pas fourni : TSB = CTL - ATL (glossaire).

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache } from '../cache/stockage.js';
import { calculerTsb } from '../logique/forme.js';

// Valeurs entières, comme sur Intervals.icu : le TSB affiché vaut exactement CTL - ATL.
const arrondi = (v) => (v === null || v === undefined ? null : Math.round(v));
const ou = (v) => (v === undefined ? null : v);

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

// Wellness (Intervals.icu) -> objet interne Bilan (9.2) ; une réponse vide donne un bilan vide.
export function convertirBilan(brut, date) {
  const b = brut ?? {};
  return {
    date: b.id || date,
    fatigue: ou(b.fatigue),
    sommeil: ou(b.sleepQuality),
    douleur: ou(b.soreness),
    poids_kg: ou(b.weight),
    commentaire: b.comments || '',
  };
}

// Bilan -> corps Wellness (F-62). Tous les champs du formulaire sont envoyés : une valeur retirée est effacée.
export function versWellness(bilan) {
  return {
    id: bilan.date,
    fatigue: bilan.fatigue ?? null,
    sleepQuality: bilan.sommeil ?? null,
    soreness: bilan.douleur ?? null,
    weight: bilan.poids_kg ?? null,
    comments: bilan.commentaire ?? '',
  };
}

const cle = (date) => `bilan:${date}`;

// Bilan en cache : { bilan, charge_le } ou null.
export async function lireBilanEnCache(date) {
  const cache = await lireCache(cle(date));
  return cache ? { bilan: cache.donnees, charge_le: cache.charge_le } : null;
}

// Bilan d'un jour lu dans Intervals.icu ; un jour sans données (réponse vide ou 404) donne un bilan vide.
export async function rafraichirBilan(date) {
  let brut;
  try {
    brut = await requeteAuthentifiee(`/athlete/0/wellness/${encodeURIComponent(date)}`);
  } catch (e) {
    if (e.statut !== 404) throw e;
    brut = null;
  }
  const bilan = convertirBilan(brut, date);
  await ecrireCache(cle(date), bilan);
  return { bilan, charge_le: (await lireCache(cle(date))).charge_le };
}

// Enregistre le bilan du jour dans les données wellness d'Intervals.icu (F-62) ; renvoie le bilan à jour.
export async function enregistrerBilan(bilan) {
  const brut = await requeteAuthentifiee(`/athlete/0/wellness/${encodeURIComponent(bilan.date)}`, null, {
    methode: 'PUT', corps: versWellness(bilan),
  });
  const enregistre = convertirBilan(brut, bilan.date);
  await ecrireCache(cle(bilan.date), enregistre);
  return enregistre;
}
