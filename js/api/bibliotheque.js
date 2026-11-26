// Bibliothèque de séances types d'Intervals.icu (F-47).
// Endpoint vérifié dans la spécification OpenAPI : GET /api/v1/athlete/{id}/workouts -> Workout[]
// Champs : id, name, type, description, moving_time, distance.

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache } from '../cache/stockage.js';
import { estPerime } from '../logique/activites.js';
import { sportDepuisType, sport } from '../logique/sports.js';
import { texteVersBlocs } from '../logique/seance.js';

const ou = (v) => (v === undefined ? null : v);

// Workout (Intervals.icu) -> modèle interne, prêt à préremplir le formulaire de séance.
export function convertirModele(brut) {
  const code = sportDepuisType(brut.type);
  return {
    id: String(brut.id),
    titre: brut.name || sport(code).libelle,
    sport: code,
    description: brut.description || null,
    duree_s: ou(brut.moving_time),
    distance_m: ou(brut.distance),
    blocs: texteVersBlocs(brut.description),
  };
}

// Modèles proposés (F-47) : toutes les séances de la bibliothèque, y compris Mes séances (conception 2026-11-24,
// section 6), sauf les repos et les séances retirées de Mes séances (D-27).
export function estModeleAffichable(brut) {
  const tags = brut.tags ?? [];
  return !tags.includes('repos') && !tags.includes('retiree');
}

// Modèles de la bibliothèque, depuis le cache s'il a moins de 5 min (ENF-11).
export async function listerModeles({ forcer = false } = {}) {
  const cache = await lireCache('bibliotheque');
  if (cache && !forcer && !estPerime(cache.charge_le)) return cache.donnees;
  const modeles = (await requeteAuthentifiee('/athlete/0/workouts')).filter(estModeleAffichable).map(convertirModele);
  await ecrireCache('bibliotheque', modeles);
  return modeles;
}
