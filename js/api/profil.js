// Données du profil (F-50 à F-54) : nom, réglages par sport (seuils et zones), activités de l'année.
// Endpoint vérifié dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{athleteId}/sport-settings -> SportSettings[]
//   Champs : types, ftp, lthr, max_hr, threshold_pace (m/s), power_zones (% FTP), power_zone_names,
//            hr_zones (bpm), hr_zone_names, pace_zones (% allure seuil), pace_zone_names.
// Activités de l'année : voir api/activites.js (champs limités, ENF-11).

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache, supprimerCachePrefixe } from '../cache/stockage.js';
import { chargerActivitesEntre } from './activites.js';
import { lireAthlete } from './athlete.js';
import { sportDepuisType } from '../logique/sports.js';
import { reglagesTries } from '../logique/profil.js';
import { jourISO } from '../logique/dates.js';

const ou = (v) => (v === undefined ? null : v);

// SportSettings (Intervals.icu) -> réglages internes d'un sport (seuils et zones de l'objet Athlete, 9.2).
export function convertirReglagesSport(brut) {
  return {
    id: brut.id ?? null, // pour modifier les réglages du sport (F-124)
    sport: sportDepuisType((brut.types ?? [])[0]),
    ftp_w: ou(brut.ftp),
    fc_seuil: ou(brut.lthr),
    fc_max: ou(brut.max_hr),
    allure_seuil_ms: ou(brut.threshold_pace),
    zones_puissance: ou(brut.power_zones),
    noms_puissance: ou(brut.power_zone_names),
    zones_fc: ou(brut.hr_zones),
    noms_fc: ou(brut.hr_zone_names),
    zones_allure: ou(brut.pace_zones),
    noms_allure: ou(brut.pace_zone_names),
  };
}

// Profil en cache : { annee, nom, reglages, activites, charge_le } ou null.
export async function lireProfilEnCache() {
  const cache = await lireCache('profil');
  return cache ? { ...cache.donnees, charge_le: cache.charge_le } : null;
}

// Recharge le profil depuis Intervals.icu et remplace le cache.
export async function rafraichirProfil() {
  const jour = jourISO();
  const annee = jour.slice(0, 4);
  const [bruts, activites, athlete] = await Promise.all([
    requeteAuthentifiee('/athlete/0/sport-settings'),
    chargerActivitesEntre(`${annee}-01-01`, jour),
    lireAthlete(),
  ]);
  const donnees = { annee, nom: athlete.nom, reglages: reglagesTries((bruts ?? []).map(convertirReglagesSport)), activites };
  await ecrireCache('profil', donnees);
  return { ...donnees, charge_le: (await lireCache('profil')).charge_le };
}

// Allures seuil du profil en cache (m/s par sport), pour convertir les étapes en distance en durée
// (volume du plan F-84, graphique des séances F-41) ; {} si le profil n'a jamais été chargé.
export async function lireAlluresSeuil() {
  const profil = await lireProfilEnCache().catch(() => null);
  const allures = {};
  for (const r of profil?.reglages ?? []) if (r.allure_seuil_ms > 0) allures[r.sport] = r.allure_seuil_ms;
  return allures;
}

// Réglages d'un sport (seuils, bornes et noms des zones), pour les zones d'une activité (F-103, D-31) :
// lus dans le profil en cache, sinon demandés à Intervals.icu (GET /athlete/{id}/sport-settings). null si absents.
export async function lireReglagesSport(code) {
  const profil = await lireProfilEnCache().catch(() => null);
  let reglages = profil?.reglages;
  if (!reglages) {
    try {
      reglages = ((await requeteAuthentifiee('/athlete/0/sport-settings')) ?? []).map(convertirReglagesSport);
    } catch {
      return null; // hors ligne : zones affichées sans noms
    }
  }
  return reglages.find((r) => r.sport === code) ?? null;
}

// F-124 : enregistre des seuils ou des zones modifiés dans l'appli. Les réglages complets du sport sont relus puis
// renvoyés avec les seuls champs modifiés (PUT /api/v1/athlete/{id}/sport-settings/{id}, corps SportSettings), pour ne
// rien effacer d'autre. Le profil en cache est vidé (rechargé ensuite).
export async function enregistrerReglagesSport(id, modifications) {
  const chemin = `/athlete/0/sport-settings/${encodeURIComponent(id)}`;
  const actuels = await requeteAuthentifiee(chemin);
  const brut = await requeteAuthentifiee(chemin, null, { methode: 'PUT', corps: { ...actuels, ...modifications } });
  await supprimerCachePrefixe('profil');
  return convertirReglagesSport(brut ?? { ...actuels, ...modifications });
}
