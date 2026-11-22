// Activités réalisées (F-10, F-13, F-14, ENF-06, ENF-11, ENF-25).
// Endpoints et champs vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{id}/activities  (oldest obligatoire, newest, limit, fields) -> Activity[] du plus récent au plus ancien
//   GET /api/v1/activity/{id}                                                     -> Activity
//   GET /api/v1/activity/{id}/intervals                                           -> IntervalsDTO (icu_intervals)
// L'identifiant athlète "0" désigne le propriétaire de la clé (5.4).

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache } from '../cache/stockage.js';
import { sportDepuisType, sport } from '../logique/sports.js';
import { fusionnerActivites } from '../logique/activites.js';

// Nombre d'activités par page du fil (F-10).
export const TAILLE_PAGE = 20;

// Champs demandés pour le fil : uniquement ceux des cartes (ENF-11).
export const CHAMPS_FIL = [
  'id', 'start_date_local', 'type', 'name', 'moving_time', 'elapsed_time', 'distance', 'icu_distance',
  'total_elevation_gain', 'icu_training_load',
];

// Valeur ou null (les réponses avec "fields" omettent les champs nuls).
const ou = (v) => (v === undefined ? null : v);

// Activity (Intervals.icu) -> objet interne Activite (9.2).
// Durée : temps en mouvement, sinon temps total. Distance : distance, sinon distance calculée par Intervals.icu.
export function convertirActivite(brut) {
  const debut = brut.start_date_local ?? '';
  const code = sportDepuisType(brut.type);
  return {
    id: brut.id,
    date: debut.slice(0, 10),
    heure: debut.slice(11, 16) || null,
    sport: code,
    titre: brut.name || sport(code).libelle,
    duree_s: ou(brut.moving_time ?? brut.elapsed_time),
    distance_m: ou(brut.distance ?? brut.icu_distance),
    denivele_m: ou(brut.total_elevation_gain),
    fc_moy: ou(brut.average_heartrate),
    fc_max: ou(brut.max_heartrate),
    puissance_moy_w: ou(brut.icu_average_watts),
    charge: ou(brut.icu_training_load),
    rpe: ou(brut.icu_rpe),
    ressenti: ou(brut.feel),
    zones_fc: ou(brut.icu_hr_zone_times),
    zones_puissance: ou(brut.icu_zone_times),
    zones_allure: ou(brut.pace_zone_times),
    nb_tours: ou(brut.icu_lap_count),
  };
}

// Interval (Intervals.icu) -> tour ou intervalle interne (F-13).
export function convertirIntervalle(brut) {
  return {
    libelle: brut.label || null,
    type: ou(brut.type),
    duree_s: ou(brut.moving_time ?? brut.elapsed_time),
    distance_m: ou(brut.distance),
    fc_moy: ou(brut.average_heartrate),
    fc_max: ou(brut.max_heartrate),
    puissance_moy_w: ou(brut.average_watts),
  };
}

// Une page du fil : les TAILLE_PAGE activités commencées au plus tard à "jusqua" (date-heure locale).
async function chargerPage(jusqua = null) {
  const params = { oldest: '2000-01-01', limit: String(TAILLE_PAGE), fields: CHAMPS_FIL.join(',') };
  if (jusqua) params.newest = jusqua;
  const bruts = await requeteAuthentifiee('/athlete/0/activities', params);
  return bruts.map(convertirActivite);
}

// Toutes les activités depuis un jour donné jusqu'à maintenant (tableau de bord, F-21, F-22, F-24, F-25).
export async function chargerActivitesDepuis(debut) {
  const bruts = await requeteAuthentifiee('/athlete/0/activities', { oldest: debut, fields: CHAMPS_FIL.join(',') });
  return bruts.map(convertirActivite);
}

// Activités entre deux jours inclus (agenda, F-30 à F-35) ; "newest" est une date-heure locale.
export async function chargerActivitesEntre(debut, fin) {
  const bruts = await requeteAuthentifiee('/athlete/0/activities', {
    oldest: debut, newest: `${fin}T23:59:59`, fields: CHAMPS_FIL.join(','),
  });
  return bruts.map(convertirActivite);
}

// Dernière activité, quelle que soit sa date (F-21), ou null.
export async function chargerDerniereActivite() {
  const [derniere] = await chargerPage();
  return derniere ?? null;
}

// Fil en cache (5.5) : { activites, fin, charge_le } ou null.
export async function lireFilEnCache() {
  const cache = await lireCache('fil');
  return cache ? { ...cache.donnees, charge_le: cache.charge_le } : null;
}

// Recharge la première page du fil depuis Intervals.icu (F-10, F-14) et remplace le cache.
export async function rafraichirFil() {
  const activites = await chargerPage();
  const donnees = { activites, fin: activites.length < TAILLE_PAGE };
  await ecrireCache('fil', donnees);
  return { ...donnees, charge_le: (await lireCache('fil')).charge_le };
}

// Charge la page suivante (F-10, chargement progressif) et l'ajoute au cache.
// La borne inclut la minute de la dernière activité : les doublons sont retirés par la fusion.
export async function chargerSuite(fil) {
  const derniere = fil.activites[fil.activites.length - 1];
  const page = await chargerPage(`${derniere.date}T${derniere.heure ?? '00:00'}:59`);
  const activites = fusionnerActivites(fil.activites, page);
  const nouvelles = activites.length - fil.activites.length;
  const donnees = { activites, fin: page.length < TAILLE_PAGE || nouvelles === 0 };
  await ecrireCache('fil', donnees, fil.charge_le);
  return { ...donnees, charge_le: fil.charge_le };
}

// Détail en cache (5.5) : { activite, intervalles, charge_le } ou null.
export async function lireDetailEnCache(id) {
  const cache = await lireCache(`activite:${id}`);
  return cache ? { ...cache.donnees, charge_le: cache.charge_le } : null;
}

// Détail d'une activité et ses tours ou intervalles (F-13). Sans intervalles, la liste est vide.
export async function rafraichirDetail(id) {
  const chemin = `/activity/${encodeURIComponent(id)}`;
  const [brut, intervalles] = await Promise.all([
    requeteAuthentifiee(chemin),
    requeteAuthentifiee(`${chemin}/intervals`).then((r) => r.icu_intervals ?? []).catch(() => []),
  ]);
  const donnees = { activite: convertirActivite(brut), intervalles: intervalles.map(convertirIntervalle) };
  await ecrireCache(`activite:${id}`, donnees);
  return { ...donnees, charge_le: (await lireCache(`activite:${id}`)).charge_le };
}
