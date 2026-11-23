// Plan à surcharge progressive jusqu'à un objectif (F-82, F-83, F-84). Fonctions pures.
// Modèle par blocs (conception L8, section 5.3) : dans un bloc, le volume monte de façon linéaire,
// puis vient une semaine de coupure ; le bloc suivant repart du volume de la semaine d'avant la coupure ;
// l'affûtage termine le plan ; un plafond en heures limite les semaines de hausse.
// Les volumes sont en pourcentage de la semaine type (100 % = la semaine type telle quelle).

import { lundiDe, ajouterJours } from './dates.js';

// Réglages par défaut (conception L8, section 6) ; plafond_h null = sans plafond ; debut null = lundi suivant.
export const REGLAGES_PAR_DEFAUT = { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: null, debut: null };

// Plafond proposé : 1,5 fois le volume de la semaine type, arrondi à l'heure supérieure, au moins 1 h.
export function plafondParDefaut(volumeBase_s) {
  return Math.max(1, Math.ceil((1.5 * (volumeBase_s ?? 0)) / 3600));
}

// Lundis du plan : du lundi de la semaine de "debut" au lundi de la semaine de la course, inclus.
export function lundisDuPlan(debut, dateCourse) {
  const lundis = [];
  const dernier = lundiDe(dateCourse);
  for (let l = lundiDe(debut); l <= dernier; l = ajouterJours(l, 7)) lundis.push(l);
  return lundis;
}

// Coefficient de chaque semaine : [{ numero, type: HAUSSE | COUPURE | AFFUTAGE | COURSE, pct }].
export function coefficientsPlan(nbSemaines, reglages, volumeBase_s) {
  const r = { ...REGLAGES_PAR_DEFAUT, ...reglages };
  const nbAffutage = Math.min(r.affutage.length, nbSemaines);
  const pctMax = r.plafond_h && volumeBase_s > 0 ? Math.round(((r.plafond_h * 3600) / volumeBase_s) * 100) : Infinity;
  const semaines = [];
  let depart = 100;
  let derniereHausse = null;
  let rang = 0; // rang de la semaine dans le bloc
  while (semaines.length < nbSemaines - nbAffutage) {
    if (rang < r.semainesHausse) {
      derniereHausse = Math.min(depart + rang * r.hausse, pctMax);
      semaines.push({ type: 'HAUSSE', pct: derniereHausse });
      rang += 1;
    } else {
      semaines.push({ type: 'COUPURE', pct: Math.round((semaines.at(-1).pct * r.coupure) / 100) });
      depart = derniereHausse; // reprise au volume de la semaine d'avant la coupure
      rang = 0;
    }
  }
  const reference = derniereHausse ?? 100;
  // Plan plus court que l'affûtage : on garde les derniers niveaux, les plus proches de la course.
  for (const niveau of nbAffutage ? r.affutage.slice(-nbAffutage) : []) {
    semaines.push({ type: 'AFFUTAGE', pct: Math.round((reference * niveau) / 100) });
  }
  if (semaines.length) semaines.at(-1).type = 'COURSE';
  return semaines.map((s, i) => ({ numero: i + 1, ...s }));
}

const entierEntre = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Contrôle des réglages saisis (F-82). Renvoie { champ: message } ; vide si tout est correct.
export function validerReglages(r) {
  const erreurs = {};
  if (!entierEntre(r.hausse, 0, 30)) erreurs.hausse = 'Hausse : entre 0 et 30 points par semaine.';
  if (!entierEntre(r.semainesHausse, 1, 8)) erreurs.semainesHausse = 'Semaines de hausse par bloc : entre 1 et 8.';
  if (!entierEntre(r.coupure, 30, 100)) erreurs.coupure = 'Coupure : entre 30 et 100 %.';
  if (!Array.isArray(r.affutage) || r.affutage.length > 4 || !r.affutage.every((n) => entierEntre(n, 20, 100))) {
    erreurs.affutage = "Affûtage : jusqu'à 4 niveaux entre 20 et 100 %, par exemple 70, 50.";
  }
  if (r.plafond_h !== null && r.plafond_h !== undefined && !(typeof r.plafond_h === 'number' && r.plafond_h >= 1 && r.plafond_h <= 40)) {
    erreurs.plafond_h = 'Plafond : entre 1 et 40 heures par semaine, ou vide.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.debut ?? '')) erreurs.debut = 'Choisis une date de début.';
  return erreurs;
}
