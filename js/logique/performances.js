// Courbes de performance (lots LA et LP : F-105, F-110 à F-114, D-34). Fonctions pures.
// Les courbes viennent d'Intervals.icu (spécification OpenAPI, schémas DataCurve, PowerCurve et PaceCurve) :
//   puissance et FC : "secs" (durée en s) et "values" (W ou bpm) alignés ;
//   allure : "distance" (m) et "values" (entier : temps en s pour couvrir la distance) alignés ;
//   "activity_id", "start_index", "end_index" : un élément par point (activité et morceau de séance du record).
// Ici on lit seulement les points demandés ; rien n'est recalculé.

import { ajouterJours } from './dates.js';

// Périodes de l'écran Performances (E-12) et code "curves" de l'API (description de l'endpoint :
// 42d = 42 derniers jours, all = tout, r.AAAA-MM-JJ.AAAA-MM-JJ = période).
export const PERIODES_PERF = [
  { code: '42j', libelle: '42 jours' },
  { code: '90j', libelle: '90 jours' },
  { code: 'annee', libelle: 'Cette année' },
  { code: 'tout', libelle: 'Tout' },
];

export function codeCourbe(code, jour) {
  if (code === '42j') return '42d';
  if (code === '90j') return '90d';
  if (code === 'annee') return `r.${jour.slice(0, 4)}-01-01.${jour}`;
  return 'all';
}

// Code de période de l'adresse vérifié (42 jours par défaut).
export function periodeValide(code) {
  return PERIODES_PERF.some((p) => p.code === code) ? code : '42j';
}

// Sports de l'écran Performances : type Intervals.icu des courbes, mesures proposées.
export const SPORTS_PERF = [
  { code: 'VELO', type: 'Ride', puissance: true, allure: false },
  { code: 'CAP', type: 'Run', puissance: true, allure: true },
  { code: 'NATATION', type: 'Swim', puissance: false, allure: true },
];

export const DUREES_RECORDS = [1, 5, 15, 30, 60, 300, 600, 1200, 3600, 7200];
export const DISTANCES_RECORDS = {
  CAP: [400, 1000, 5000, 10000, 21097],
  NATATION: [100, 200, 400, 1500],
};

const element = (tableau, i) => (Array.isArray(tableau) ? tableau[i] ?? null : null);

// Points d'une courbe de puissance (ou de FC) aux durées demandées : le point à cette durée exacte, sinon le premier
// point au-delà (la courbe peut sauter des durées). Durées absentes de la courbe ignorées.
export function pointsAuxDurees(courbe, durees) {
  const secs = courbe?.secs ?? [];
  const valeurs = courbe?.values ?? courbe?.watts ?? [];
  const resultat = [];
  for (const d of durees) {
    const i = secs.findIndex((s) => s >= d);
    if (i === -1 || secs[i] > d * 1.1 || !Number.isFinite(valeurs[i]) || valeurs[i] <= 0) continue;
    resultat.push({
      duree: d, valeur: valeurs[i], activite_id: element(courbe.activity_id, i),
      debut_i: element(courbe.start_index, i), fin_i: element(courbe.end_index, i),
    });
  }
  return resultat;
}

// Meilleurs temps d'une courbe d'allure aux distances demandées (à 1 % près). Un temps invraisemblable
// (moins de 50 s ou plus de 60 min au km) est écarté : il signalerait une donnée d'un autre format.
export function tempsAuxDistances(courbe, distances) {
  const ds = courbe?.distance ?? [];
  const valeurs = courbe?.values ?? [];
  const resultat = [];
  for (const cible of distances) {
    const i = ds.findIndex((m) => Math.abs(m - cible) <= cible * 0.01);
    if (i === -1) continue;
    const t = valeurs[i];
    if (!Number.isFinite(t) || t / cible < 0.05 || t / cible > 3.6) continue;
    resultat.push({
      distance: cible, temps_s: t, activite_id: element(courbe.activity_id, i),
      debut_i: element(courbe.start_index, i), fin_i: element(courbe.end_index, i),
    });
  }
  return resultat;
}

// Date (AAAA-MM-JJ) et titre de l'activité d'un record, lus dans la table "activities" renvoyée avec les courbes.
export function activiteDuRecord(activites, id) {
  const a = activites?.[id];
  if (!a) return { date: null, titre: null };
  return { date: (a.start_date_local ?? '').slice(0, 10) || null, titre: a.name || null };
}

// Premier jour d'une période (pour l'afficher) ; null pour "tout".
export function debutPeriode(code, jour) {
  if (code === '42j') return ajouterJours(jour, -41);
  if (code === '90j') return ajouterJours(jour, -89);
  if (code === 'annee') return `${jour.slice(0, 4)}-01-01`;
  return null;
}
