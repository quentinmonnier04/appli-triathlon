// Objectif : la course visée, enregistrée dans Intervals.icu comme événement "course A" (F-80).
// Endpoints vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET    /api/v1/athlete/{id}/events     (oldest, newest, category=RACE_A)  -> Event[]
//   POST   /api/v1/athlete/{id}/events     (upsertOnUid obligatoire)           -> Event
//   PUT    /api/v1/athlete/{id}/events/{eventId}                              -> Event
//   DELETE /api/v1/athlete/{id}/events/{eventId}
// Un seul objectif est géré : le prochain événement RACE_A à partir d'aujourd'hui.

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache, supprimerCachePrefixe } from '../cache/stockage.js';
import { estPerime } from '../logique/activites.js';
import { sportDepuisType } from '../logique/sports.js';
import { sportVersType } from '../logique/seance.js';
import { jourISO, ajouterJours } from '../logique/dates.js';

// Sports proposés pour un objectif ; ENCHAINEMENT est présenté comme "Triathlon" (type Intervals.icu Transition).
export const SPORTS_OBJECTIF = ['ENCHAINEMENT', 'CAP', 'VELO', 'NATATION'];

// Event RACE_A (Intervals.icu) -> objet interne Objectif.
export function convertirObjectif(brut) {
  return {
    id: String(brut.id),
    nom: brut.name || 'Objectif',
    date: (brut.start_date_local ?? '').slice(0, 10),
    sport: sportDepuisType(brut.type),
  };
}

// Objectif -> corps EventEx.
export function versEvenementObjectif(o) {
  return { category: 'RACE_A', start_date_local: `${o.date}T00:00:00`, name: o.nom, type: sportVersType(o.sport) };
}

// Prochain objectif, ou null ; cache de 5 min (ENF-11) sauf si "forcer" ; hors ligne, le cache fait foi.
export async function lireObjectif({ forcer = false } = {}) {
  const cache = await lireCache('objectif');
  if (cache && !forcer && !estPerime(cache.charge_le)) return cache.donnees;
  const jour = jourISO();
  let bruts;
  try {
    bruts = await requeteAuthentifiee('/athlete/0/events', {
      oldest: jour, newest: ajouterJours(jour, 730), category: 'RACE_A', fields: 'id,start_date_local,name,type,category',
    });
  } catch (e) {
    if (cache && e.type === 'RESEAU') return cache.donnees; // hors ligne : dernier objectif connu (ENF-06)
    throw e;
  }
  const objectifs = (bruts ?? []).map(convertirObjectif).sort((a, b) => (a.date < b.date ? -1 : 1));
  const objectif = objectifs[0] ?? null;
  await ecrireCache('objectif', objectif);
  return objectif;
}

// L'objectif s'affiche sur l'accueil et dans l'agenda : leurs caches sont vidés après une écriture.
async function invaliderCaches() {
  await supprimerCachePrefixe('objectif');
  await supprimerCachePrefixe('tableau');
  await supprimerCachePrefixe('agenda:');
}

// Création ou modification ; renvoie l'objectif enregistré.
export async function enregistrerObjectif(o) {
  const brut = o.id
    ? await requeteAuthentifiee(`/athlete/0/events/${encodeURIComponent(o.id)}`, null, { methode: 'PUT', corps: versEvenementObjectif(o) })
    : await requeteAuthentifiee('/athlete/0/events', { upsertOnUid: 'false' }, { methode: 'POST', corps: versEvenementObjectif(o) });
  await invaliderCaches();
  return convertirObjectif(brut);
}

export async function supprimerObjectif(id) {
  await requeteAuthentifiee(`/athlete/0/events/${encodeURIComponent(id)}`, null, { methode: 'DELETE' });
  await invaliderCaches();
}
