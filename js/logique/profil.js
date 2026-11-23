// Profil (F-51 à F-54) : totaux de l'année, totaux par sport, seuils et zones. Fonctions pures.
// Unités reçues d'Intervals.icu (vérifiées sur le forum officiel) : threshold_pace en m/s,
// power_zones en % de la FTP, pace_zones en % de l'allure seuil, hr_zones en bpm (borne haute de chaque zone).

import { SPORTS } from './sports.js';
import { formaterEntier, formaterVitesse } from './format.js';

// Totaux depuis le début de l'année (F-51) : nombre d'activités, distance, durée, jours actifs.
export function totauxAnnee(activites) {
  const somme = (champ) => activites.reduce((s, a) => s + (a[champ] ?? 0), 0);
  return {
    nombre: activites.length,
    distance_m: somme('distance_m'),
    duree_s: somme('duree_s'),
    jours_actifs: new Set(activites.map((a) => a.date)).size,
  };
}

// Totaux par sport (F-52), du plus pratiqué au moins pratiqué (en durée), avec la part de la durée totale en %.
export function totauxParSport(activites) {
  const total = activites.reduce((s, a) => s + (a.duree_s ?? 0), 0);
  const parSport = new Map();
  for (const a of activites) {
    const t = parSport.get(a.sport) ?? { sport: a.sport, nombre: 0, duree_s: 0, distance_m: 0 };
    t.nombre += 1;
    t.duree_s += a.duree_s ?? 0;
    t.distance_m += a.distance_m ?? 0;
    parSport.set(a.sport, t);
  }
  return [...parSport.values()]
    .map((t) => ({ ...t, pct: total ? Math.round((t.duree_s / total) * 100) : 0 }))
    .sort((x, y) => y.duree_s - x.duree_s || y.nombre - x.nombre);
}

// Réglages par sport (F-53, F-54) : un seul par sport (le premier reçu), dans l'ordre de 9.3.
export function reglagesTries(reglages) {
  const ordre = SPORTS.map((s) => s.code);
  const vus = new Set();
  return reglages
    .filter((r) => (vus.has(r.sport) ? false : vus.add(r.sport)))
    .sort((x, y) => ordre.indexOf(x.sport) - ordre.indexOf(y.sport));
}

// Allure à partir d'une vitesse en m/s : min/100 m en natation, min/km sinon.
export function allureDepuisVitesse(vitesse_ms, sportCode) {
  if (!(vitesse_ms > 0)) return null;
  const unite = sportCode === 'NATATION' ? 100 : 1000;
  return formaterVitesse(sportCode === 'NATATION' ? 'NATATION' : 'CAP', unite, unite / vitesse_ms);
}

// Seuils affichables d'un sport (F-53) : [{ etiquette, valeur }], seuls les seuils renseignés.
export function seuilsAffichables(r) {
  const seuils = [];
  if (r.ftp_w > 0) seuils.push({ etiquette: 'FTP', valeur: `${formaterEntier(r.ftp_w)} W` });
  if (r.fc_seuil > 0) seuils.push({ etiquette: 'FC seuil', valeur: `${formaterEntier(r.fc_seuil)} bpm` });
  if (r.fc_max > 0) seuils.push({ etiquette: 'FC max', valeur: `${formaterEntier(r.fc_max)} bpm` });
  const allure = allureDepuisVitesse(r.allure_seuil_ms, r.sport);
  if (allure) seuils.push({ etiquette: r.sport === 'NATATION' ? 'CSS' : 'Allure seuil', valeur: allure });
  return seuils;
}

const nomZone = (noms, i) => (noms?.[i] ? noms[i] : `Z${i + 1}`);
// Une borne de 999 % ou plus signifie "sans limite" (dernière zone).
const ouverte = (pct) => pct >= 999;

// Zones de puissance (F-54) : bornes en % de la FTP converties en watts.
export function zonesPuissance(ftp, pcts, noms) {
  if (!(ftp > 0) || !pcts?.length) return [];
  const w = (pct) => formaterEntier((ftp * pct) / 100);
  return pcts.map((pct, i) => {
    const bas = i ? pcts[i - 1] : 0;
    let texte;
    if (!i) texte = `jusqu'à ${w(pct)} W`;
    else if (ouverte(pct)) texte = `plus de ${w(bas)} W`;
    else texte = `${w(bas)}-${w(pct)} W`;
    return { nom: nomZone(noms, i), texte };
  });
}

// Zones de FC (F-54) : bornes hautes en bpm.
export function zonesFc(bornes, noms) {
  if (!bornes?.length) return [];
  return bornes.map((haut, i) => ({
    nom: nomZone(noms, i),
    texte: i ? `${bornes[i - 1] + 1}-${haut} bpm` : `jusqu'à ${haut} bpm`,
  }));
}

// Zones d'allure (F-54) : bornes en % de la vitesse au seuil ; une zone va de l'allure la plus lente à la plus rapide.
export function zonesAllure(seuil_ms, pcts, noms, sportCode) {
  if (!(seuil_ms > 0) || !pcts?.length) return [];
  const allure = (pct) => allureDepuisVitesse((seuil_ms * pct) / 100, sportCode);
  return pcts.map((pct, i) => {
    let texte;
    if (!i) texte = `plus lent que ${allure(pct)}`;
    else if (ouverte(pct)) texte = `plus rapide que ${allure(pcts[i - 1])}`;
    else texte = `${allure(pcts[i - 1])} à ${allure(pct)}`;
    return { nom: nomZone(noms, i), texte };
  });
}

// Toutes les zones d'un sport (F-54) : [{ titre, zones }], seulement les familles renseignées.
export function zonesDuSport(r) {
  return [
    { titre: 'Puissance', zones: zonesPuissance(r.ftp_w, r.zones_puissance, r.noms_puissance) },
    { titre: 'Fréquence cardiaque', zones: zonesFc(r.zones_fc, r.noms_fc) },
    { titre: 'Allure', zones: zonesAllure(r.allure_seuil_ms, r.zones_allure, r.noms_allure, r.sport) },
  ].filter((f) => f.zones.length);
}
