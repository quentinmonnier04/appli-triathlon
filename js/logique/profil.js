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

// --- F-124 : modifier ses seuils et ses zones (D-42) ---

const deuxChiffres = (n) => String(n).padStart(2, '0');

// Vitesse seuil (m/s) -> allure saisie "m:ss" (par km, ou par 100 m en natation) ; '' sans valeur.
export function allureSaisieDepuisVitesse(vitesse_ms, sportCode) {
  if (!(vitesse_ms > 0)) return '';
  const secondes = Math.round((sportCode === 'NATATION' ? 100 : 1000) / vitesse_ms);
  return `${Math.floor(secondes / 60)}:${deuxChiffres(secondes % 60)}`;
}

// Valeurs des champs du formulaire d'un sport (pour le préremplir).
export function champsSeuils(r) {
  const liste = (v) => (Array.isArray(v) ? v.join(', ') : '');
  return {
    ftp: r.ftp_w > 0 ? String(r.ftp_w) : '',
    fc_seuil: r.fc_seuil > 0 ? String(r.fc_seuil) : '',
    fc_max: r.fc_max > 0 ? String(r.fc_max) : '',
    allure: allureSaisieDepuisVitesse(r.allure_seuil_ms, r.sport),
    zones_puissance: liste(r.zones_puissance),
    zones_fc: liste(r.zones_fc),
    zones_allure: liste(r.zones_allure),
  };
}

// Champs saisis -> { corps (champs SportSettings modifiés), erreurs }. Un champ vide n'est pas envoyé (valeur gardée).
// Allure "m:ss" par km (par 100 m en natation) -> threshold_pace en m/s. Zones : nombres croissants séparés par des virgules.
export function lireSeuilsSaisis(champs, sportCode) {
  const corps = {};
  const erreurs = {};
  const entier = (cle, nom, min, max, libelle) => {
    const t = String(champs[cle] ?? '').trim();
    if (!t) return;
    if (!/^\d+$/.test(t) || Number(t) < min || Number(t) > max) { erreurs[cle] = `${libelle} : entre ${min} et ${max}.`; return; }
    corps[nom] = Number(t);
  };
  entier('ftp', 'ftp', 50, 600, 'FTP');
  entier('fc_seuil', 'lthr', 80, 220, 'FC seuil');
  entier('fc_max', 'max_hr', 100, 230, 'FC max');
  const allure = String(champs.allure ?? '').trim();
  if (allure) {
    const m = allure.match(/^(\d{1,2}):([0-5]\d)$/);
    const secondes = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
    if (!secondes) erreurs.allure = 'Allure attendue en m:ss, par exemple 4:30.';
    else corps.threshold_pace = Math.round(((sportCode === 'NATATION' ? 100 : 1000) / secondes) * 10000) / 10000;
  }
  const zones = (cle, nom) => {
    const t = String(champs[cle] ?? '').trim();
    if (!t) return;
    const valeurs = t.split(/[,;\s]+/).filter(Boolean).map((v) => Number(v.replace(',', '.')));
    const croissantes = valeurs.every((v, i) => Number.isFinite(v) && v > 0 && (i === 0 || v > valeurs[i - 1]));
    if (!croissantes || valeurs.length < 2 || valeurs.length > 10) { erreurs[cle] = 'Zones : 2 à 10 nombres croissants, séparés par des virgules.'; return; }
    corps[nom] = valeurs;
  };
  zones('zones_puissance', 'power_zones');
  zones('zones_fc', 'hr_zones');
  zones('zones_allure', 'pace_zones');
  if (corps.lthr && corps.max_hr && corps.lthr >= corps.max_hr) erreurs.fc_seuil = 'La FC seuil doit être inférieure à la FC max.';
  return { corps, erreurs };
}
