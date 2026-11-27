// Activités réalisées (F-10, F-13, F-14, ENF-06, ENF-11, ENF-25).
// Endpoints et champs vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{id}/activities  (oldest obligatoire, newest, limit, fields) -> Activity[] du plus récent au plus ancien
//   GET /api/v1/activity/{id}                                                     -> Activity
//   GET /api/v1/activity/{id}/intervals                                           -> IntervalsDTO (icu_intervals)
//   PUT /api/v1/activity/{id}   (corps Activity, champs icu_rpe, feel, description)  -> Activity  (L6)
//   GET /api/v1/activity/{id}/map                                                 -> MapData (latlngs, bounds)  (L7)
// Une activité a un tracé GPS si son champ stream_types contient "latlng" (L7).
// L'identifiant athlète "0" désigne le propriétaire de la clé (5.4).

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache, supprimerCachePrefixe } from '../cache/stockage.js';
import { sportDepuisType, sport } from '../logique/sports.js';
import { fusionnerActivites, estPerime as estPerimeLocal } from '../logique/activites.js';
import { effortsAChercher, barresHistogramme } from '../logique/analyse.js';
import { courbeDeLActivite } from '../logique/performances.js';
import { decouperSegments, alleger } from '../logique/carte.js';

// Nombre d'activités par page du fil (F-10).
export const TAILLE_PAGE = 20;

// Champs demandés pour le fil : uniquement ceux des cartes (ENF-11), plus le RPE pour le rappel (F-63)
// et la liste des flux de données pour savoir si l'activité a un tracé GPS (F-71).
export const CHAMPS_FIL = [
  'id', 'start_date_local', 'type', 'name', 'moving_time', 'elapsed_time', 'distance', 'icu_distance',
  'total_elevation_gain', 'icu_training_load', 'icu_rpe', 'stream_types',
];

// Nombre de points gardés : carte du détail (F-70) et aperçu du fil (F-71).
export const POINTS_CARTE = 3000;
export const POINTS_APERCU = 150;

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
    commentaire: brut.description || null,
    a_gps: Array.isArray(brut.stream_types) && brut.stream_types.includes('latlng'),
    zones_fc: ou(brut.icu_hr_zone_times),
    zones_puissance: ou(brut.icu_zone_times),
    zones_allure: ou(brut.pace_zone_times),
    nb_tours: ou(brut.icu_lap_count),
    // Lot LA (F-100, F-101, F-103, D-31) : champs vérifiés dans la spécification OpenAPI (schéma Activity).
    intensite: ou(brut.icu_intensity),
    np_w: ou(brut.icu_weighted_avg_watts),
    variabilite: ou(brut.icu_variability_index),
    cadence_moy: ou(brut.average_cadence),
    travail_j: ou(brut.icu_joules),
    calories: ou(brut.calories),
    poids_kg: ou(brut.icu_weight), // poids du jour de l'activité, pour les W/kg (F-105)
    parcours_id: ou(brut.route_id), // parcours reconnu par Intervals.icu (F-106)
    materiel_id: brut.gear?.id ? String(brut.gear.id) : null, // matériel de la séance (F-127)
    // Lot LC3 (F-129) : seuils et bornes des zones de la séance (schéma Activity), pour l'analyse calculée par l'appli.
    seuils: { ftp: ou(brut.icu_ftp), fc_seuil: ou(brut.lthr), vitesse_seuil: ou(brut.threshold_pace) },
    bornes_zones: { puissance: ou(brut.icu_power_zones), fc: ou(brut.icu_hr_zones), allure: ou(brut.pace_zones) },
    flux: Array.isArray(brut.stream_types) ? brut.stream_types : [],
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
    // Lot LA (F-102, D-31) : champs du schéma Interval de la spécification OpenAPI.
    cadence_moy: ou(brut.average_cadence),
    vitesse_ms: ou(brut.average_speed),
    pente_pct: ou(brut.average_gradient),
    intensite: ou(brut.intensity),
    zone: ou(brut.zone),
    debut_i: ou(brut.start_index),
    fin_i: ou(brut.end_index),
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

// Saisie du ressenti -> corps Activity (F-60, F-61) : RPE (icu_rpe), ressenti (feel), commentaire (description).
export function versRessenti(s) {
  return { icu_rpe: s.rpe ?? null, feel: s.ressenti ?? null, description: s.commentaire ?? '' };
}

// Enregistre le RPE, le ressenti et le commentaire dans Intervals.icu (F-60, F-61) ; renvoie l'activité à jour.
// Le détail en cache est mis à jour ; le fil, le tableau de bord et l'agenda seront rechargés (rappel F-63).
export async function enregistrerRessenti(id, saisie) {
  const brut = await requeteAuthentifiee(`/activity/${encodeURIComponent(id)}`, null, { methode: 'PUT', corps: versRessenti(saisie) });
  const activite = convertirActivite(brut);
  const cache = await lireCache(`activite:${id}`);
  if (cache) await ecrireCache(`activite:${id}`, { ...cache.donnees, activite }, cache.charge_le);
  await supprimerCachePrefixe('fil');
  await supprimerCachePrefixe('tableau');
  await supprimerCachePrefixe('agenda:');
  return activite;
}

// MapData (Intervals.icu) -> tracé interne : segments de points [lat, lng], allégés pour la carte (F-70).
export function convertirTrace(brut) {
  return { segments: alleger(decouperSegments(brut?.latlngs), POINTS_CARTE) };
}

// Tracé GPS d'une activité (F-70, F-71). Un tracé ne change pas : une fois en cache, il n'est jamais
// redemandé à Intervals.icu (ENF-11). Renvoie { segments } (liste vide si pas de position).
export async function lireTrace(id) {
  const cle = `trace:${id}`;
  const cache = await lireCache(cle);
  if (cache) return cache.donnees;
  const trace = convertirTrace(await requeteAuthentifiee(`/activity/${encodeURIComponent(id)}/map`));
  await ecrireCache(cle, trace);
  return trace;
}

// Aperçu du tracé pour le fil (F-71) : version très allégée du tracé.
export async function lireApercuTrace(id) {
  const { segments } = await lireTrace(id);
  return { segments: alleger(segments, POINTS_APERCU) };
}

// --- Flux d'une activité (lot LA, F-101, D-31) ---
// GET /api/v1/activity/{id}/streams (spécification OpenAPI : paramètre "types", réponse ActivityStream[] avec "type"
// et "data"). Seuls les flux annoncés par l'activité elle-même (stream_types) sont demandés, sauf la position (carte).
// Unités relevées sur le forum officiel, à confirmer en recette réelle : time (s), distance (m), altitude (m),
// velocity_smooth (m/s), watts (W), heartrate (bpm), cadence (/min).
export const FLUX_GRAPHIQUES = ['time', 'distance', 'watts', 'heartrate', 'cadence', 'velocity_smooth', 'altitude'];

// ActivityStream[] -> { nomDuFlux: [nombres] } ; les flux vides ou non numériques sont ignorés.
export function convertirFlux(bruts) {
  const flux = {};
  for (const f of bruts ?? []) {
    if (!f || !FLUX_GRAPHIQUES.includes(f.type) || !Array.isArray(f.data) || f.allNull) continue;
    flux[f.type] = f.data.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  }
  return flux;
}

// Flux demandés à Intervals.icu pour une activité : ceux qu'elle annonce et que les graphiques savent lire.
export function fluxADemander(streamTypes) {
  return FLUX_GRAPHIQUES.filter((t) => (streamTypes ?? []).includes(t));
}

// Flux d'une activité, chargés seulement à l'ouverture de l'onglet Graphiques et gardés en cache (ENF-09, ENF-11).
// Une activité terminée ne change pas : le cache n'expire pas (vidé à la déconnexion ou au changement de format).
export async function lireFlux(id, streamTypes) {
  const cle = `flux:${id}`;
  const cache = await lireCache(cle);
  if (cache) return cache.donnees;
  const types = fluxADemander(streamTypes);
  if (!types.length) return {};
  // Extension ".json" : le forum officiel indique que {ext} doit contenir au moins un caractère pour ce chemin.
  const bruts = await requeteAuthentifiee(`/activity/${encodeURIComponent(id)}/streams.json`, { types: types.join(',') });
  const flux = convertirFlux(bruts);
  await ecrireCache(cle, flux);
  return flux;
}

// --- Meilleurs efforts d'une activité (lot LA, F-105, D-33) ---
// GET /api/v1/activity/{id}/best-efforts (spécification OpenAPI : "stream" obligatoire, "duration" en secondes ou
// "distance" en mètres, "count") -> BestEfforts { efforts: Effort[] } ; Effort : start_index, end_index, average
// (moyenne du flux sur l'effort), duration (s), distance (m). Une recherche par durée ou distance, count = 1.
export function convertirEffort(recherche, brut) {
  const e = brut?.efforts?.[0];
  if (!e || !Number.isFinite(e.average)) return null;
  return {
    cle: recherche.cle,
    duree: recherche.duree ?? null,
    distance: recherche.distance ?? null,
    moyenne: e.average,
    duree_s: ou(e.duration),
    distance_m: ou(e.distance),
    debut_i: ou(e.start_index),
    fin_i: ou(e.end_index),
  };
}

// Meilleurs efforts, chargés à l'ouverture de l'onglet et gardés en cache sans expiration (activité terminée).
// Trois requêtes à la fois au plus (ENF-11) ; une recherche sans résultat est simplement absente.
export async function lireMeilleursEfforts(id, activite) {
  const cle = `efforts:${id}`;
  const cache = await lireCache(cle);
  if (cache) return cache.donnees;
  const recherches = effortsAChercher(activite);
  const resultats = [];
  for (let i = 0; i < recherches.length; i += 3) {
    const lot = recherches.slice(i, i + 3);
    const reponses = await Promise.all(lot.map((r) => {
      const params = { stream: r.stream, count: '1', ...(r.duree ? { duration: String(r.duree) } : { distance: String(r.distance) }) };
      return requeteAuthentifiee(`/activity/${encodeURIComponent(id)}/best-efforts`, params).catch((e) => {
        if (e.type === 'IDENTIFIANTS' || e.type === 'RESEAU') throw e;
        return null; // flux absent ou recherche impossible : effort ignoré
      });
    }));
    lot.forEach((r, k) => { const e = convertirEffort(r, reponses[k]); if (e) resultats.push(e); });
  }
  if (resultats.length) await ecrireCache(cle, resultats); // un résultat vide n'est pas gardé : nouvel essai la prochaine fois
  return resultats;
}

// Meilleurs temps de la séance sur des distances (course, natation ; F-105, D-34) :
// GET /api/v1/activity/{id}/pace-curve.json -> PaceCurve (spécification : "distance" en m, "values" entiers = temps en s,
// "start_index" et "end_index" alignés). Gardée en cache sans expiration si elle contient des points.
export async function lireCourbeAllure(id) {
  const cle = `allure:${id}`;
  const cache = await lireCache(cle);
  if (cache) return cache.donnees;
  const brut = await requeteAuthentifiee(`/activity/${encodeURIComponent(id)}/pace-curve.json`);
  const courbe = {
    distance: Array.isArray(brut?.distance) ? brut.distance : [],
    values: Array.isArray(brut?.values) ? brut.values : [],
    start_index: Array.isArray(brut?.start_index) ? brut.start_index : [],
    end_index: Array.isArray(brut?.end_index) ? brut.end_index : [],
  };
  if (courbe.distance.length) await ecrireCache(cle, courbe);
  return courbe;
}

// --- Courbe, histogrammes et même parcours (lot LA, F-104 à F-106, D-37) ---
// Endpoints et champs vérifiés dans la spécification OpenAPI :
//   GET /athlete/{id}/activity-power-curves{ext} (oldest, newest obligatoires, type) -> { secs, curves: [{ id, watts }] }
//   GET /activity/{id}/power-histogram (bucketSize "Watts per bucket", 25 par défaut) -> Bucket[] (start, secs, movingSecs)
//   GET /activity/{id}/hr-histogram (bucketSize "Beats per bucket", 5 par défaut) -> Bucket[]
//   GET /athlete/{id}/activities-around (activity_id obligatoire, route_id, limit) -> Activity[]
// (pace-histogram n'a pas d'unité documentée pour "start" : non utilisé.)

const TYPES_COURBE = { VELO: 'Ride', CAP: 'Run' };

// Courbe de puissance de la séance : la réponse du jour de l'activité, dans laquelle on prend la courbe de cette activité.
export async function lireCourbePuissance(activite) {
  const cle = `cp:${activite.id}`;
  const cache = await lireCache(cle);
  if (cache) return cache.donnees;
  const brut = await requeteAuthentifiee('/athlete/0/activity-power-curves.json', {
    oldest: activite.date, newest: activite.date, type: TYPES_COURBE[activite.sport] ?? 'Ride',
  });
  const courbe = courbeDeLActivite(brut, activite.id);
  if (courbe.length) await ecrireCache(cle, courbe);
  return courbe;
}

// Histogramme de puissance ("puissance", tranches de 25 W) ou de FC ("fc", tranches de 5 bpm).
export const TRANCHES_HISTOGRAMME = { puissance: 25, fc: 5 };
export async function lireHistogramme(id, sorte) {
  const cle = `histo-${sorte}:${id}`;
  const cache = await lireCache(cle);
  if (cache) return cache.donnees;
  const chemin = sorte === 'puissance' ? 'power-histogram' : 'hr-histogram';
  const buckets = await requeteAuthentifiee(`/activity/${encodeURIComponent(id)}/${chemin}`, { bucketSize: String(TRANCHES_HISTOGRAMME[sorte]) });
  const barres = barresHistogramme(buckets, TRANCHES_HISTOGRAMME[sorte]);
  if (barres.length) await ecrireCache(cle, barres);
  return barres;
}

// Activités sur le même parcours (F-106), les plus proches dans le temps d'abord ; [] sans parcours reconnu.
export async function lireMemeParcours(activite, limite = 10) {
  if (!activite.parcours_id) return [];
  const cle = `parcours:${activite.id}`;
  const cache = await lireCache(cle);
  if (cache && !estPerimeLocal(cache.charge_le)) return cache.donnees;
  const bruts = await requeteAuthentifiee('/athlete/0/activities-around', {
    activity_id: String(activite.id), route_id: String(activite.parcours_id), limit: String(limite),
  });
  // Les activités venant de Strava arrivent vides (description de l'endpoint) : ignorées.
  const activites = (bruts ?? []).filter((b) => b?.start_date_local).map(convertirActivite);
  await ecrireCache(cle, activites);
  return activites;
}
