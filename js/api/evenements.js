// Séances prévues (événements du calendrier Intervals.icu) : lecture (F-20, F-25, F-30) et écriture (F-40 à F-46).
// Endpoints vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET    /api/v1/athlete/{id}/events{format}       (format vide = JSON ; oldest, newest inclus, category, fields) -> Event[]
//   GET    /api/v1/athlete/{id}/events/{eventId}                                                                -> Event
//   POST   /api/v1/athlete/{id}/events               (upsertOnUid obligatoire ; corps EventEx)                   -> Event
//   PUT    /api/v1/athlete/{id}/events/{eventId}     (corps EventEx)                                             -> Event
//   DELETE /api/v1/athlete/{id}/events/{eventId}
// La séance structurée part dans "description", au format natif Intervals.icu (voir logique/seance.js).

import { requeteAuthentifiee } from './client.js';
import { supprimerCachePrefixe } from '../cache/stockage.js';
import { sportDepuisType, sport } from '../logique/sports.js';
import { blocsVersTexte, texteVersBlocs, sportVersType } from '../logique/seance.js';

export const CHAMPS_EVENEMENTS = [
  'id', 'start_date_local', 'category', 'type', 'name', 'description', 'moving_time', 'time_target', 'distance', 'distance_target',
];

const ou = (v) => (v === undefined ? null : v);

// Une note est une séance de repos si son titre commence par "Repos" (F-46) ; les autres notes ne sont pas affichées.
const estRepos = (brut) => brut.category === 'NOTE' && /^repos/i.test(brut.name ?? '');
export function estAffichable(brut) {
  return brut.category === 'WORKOUT' || estRepos(brut);
}

// Event (Intervals.icu) -> objet interne SeancePrevue (9.2) ; les blocs sont relus si le texte vient de l'appli.
export function convertirSeancePrevue(brut) {
  const code = estRepos(brut) ? 'REPOS' : sportDepuisType(brut.type);
  return {
    id: String(brut.id),
    date: (brut.start_date_local ?? '').slice(0, 10),
    sport: code,
    titre: brut.name || sport(code).libelle,
    duree_s: ou(brut.moving_time ?? brut.time_target),
    distance_m: ou(brut.distance ?? brut.distance_target),
    description: brut.description || null,
    blocs: code === 'REPOS' ? null : texteVersBlocs(brut.description),
  };
}

// Séance de l'appli -> corps EventEx pour la création ou la modification (F-40, F-42, F-46).
// Séance structurée : seul le texte de séance est envoyé ; Intervals.icu en déduit la durée.
export function versEvenement(s) {
  const base = { start_date_local: `${s.date}T00:00:00` };
  if (s.sport === 'REPOS') return { category: 'NOTE', ...base, name: s.titre || 'Repos', description: s.description ?? '' };
  const corps = { category: 'WORKOUT', ...base, type: sportVersType(s.sport), name: s.titre };
  if (s.blocs?.length) {
    corps.description = blocsVersTexte(s.blocs, s.sport);
    return corps;
  }
  corps.description = s.description ?? '';
  if (s.duree_s) corps.moving_time = s.duree_s;
  if (s.distance_m) corps.distance = s.distance_m;
  return corps;
}

// Séances prévues et repos entre deux jours inclus.
export async function chargerSeancesPrevues(debut, fin) {
  const bruts = await requeteAuthentifiee('/athlete/0/events', {
    oldest: debut, newest: fin, category: 'WORKOUT,NOTE', fields: CHAMPS_EVENEMENTS.join(','),
  });
  return bruts.filter(estAffichable).map(convertirSeancePrevue);
}

// Après une écriture, le tableau de bord et l'agenda doivent être rechargés.
async function invaliderCaches() {
  await supprimerCachePrefixe('tableau');
  await supprimerCachePrefixe('agenda:');
}

const chemin = (id) => `/athlete/0/events/${encodeURIComponent(id)}`;

// Une séance prévue (F-43, F-45).
export async function lireSeance(id) {
  return convertirSeancePrevue(await requeteAuthentifiee(chemin(id)));
}

// Création (F-40, F-46) ; renvoie la séance créée.
export async function creerSeance(s) {
  const brut = await requeteAuthentifiee('/athlete/0/events', { upsertOnUid: 'false' }, { methode: 'POST', corps: versEvenement(s) });
  await invaliderCaches();
  return convertirSeancePrevue(brut);
}

// Modification (F-43).
export async function modifierSeance(id, s) {
  const brut = await requeteAuthentifiee(chemin(id), null, { methode: 'PUT', corps: versEvenement(s) });
  await invaliderCaches();
  return convertirSeancePrevue(brut);
}

// Déplacement vers une autre date (F-44) : seule la date est envoyée.
export async function deplacerSeance(id, date) {
  const brut = await requeteAuthentifiee(chemin(id), null, { methode: 'PUT', corps: { start_date_local: `${date}T00:00:00` } });
  await invaliderCaches();
  return convertirSeancePrevue(brut);
}

// Suppression (F-43).
export async function supprimerSeance(id) {
  await requeteAuthentifiee(chemin(id), null, { methode: 'DELETE' });
  await invaliderCaches();
}
