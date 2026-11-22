// Séances prévues (événements du calendrier Intervals.icu) : lecture (F-20, F-25). Écriture en L4.
// Endpoint vérifié dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{id}/events{format}  (format vide = JSON ; oldest, newest inclus, category, fields) -> Event[]
// Champs : id, start_date_local, category, type, name, description, moving_time, time_target, distance, distance_target.

import { requeteAuthentifiee } from './client.js';
import { sportDepuisType, sport } from '../logique/sports.js';

export const CHAMPS_EVENEMENTS = [
  'id', 'start_date_local', 'category', 'type', 'name', 'description', 'moving_time', 'time_target', 'distance', 'distance_target',
];

const ou = (v) => (v === undefined ? null : v);

// Event (Intervals.icu) -> objet interne SeancePrevue (9.2). Les blocs n'existent que pour les séances construites dans l'appli (L4).
export function convertirSeancePrevue(brut) {
  const code = sportDepuisType(brut.type);
  return {
    id: String(brut.id),
    date: (brut.start_date_local ?? '').slice(0, 10),
    sport: code,
    titre: brut.name || sport(code).libelle,
    duree_s: ou(brut.moving_time ?? brut.time_target),
    distance_m: ou(brut.distance ?? brut.distance_target),
    description: brut.description || null,
    blocs: null,
  };
}

// Séances prévues (catégorie WORKOUT) entre deux jours inclus.
export async function chargerSeancesPrevues(debut, fin) {
  const bruts = await requeteAuthentifiee('/athlete/0/events', {
    oldest: debut, newest: fin, category: 'WORKOUT', fields: CHAMPS_EVENEMENTS.join(','),
  });
  return bruts.map(convertirSeancePrevue);
}
