// Préparation par blocs (F-83, F-84, F-88) : chaque bloc a sa grille de la semaine ; le volume continue de
// monter de bloc en bloc (conception 2026-11-24, section 5.3). Fonctions pures.
// Les pourcentages sont ceux du volume de la grille du bloc 1 (100 % = la grille du bloc 1 telle quelle).

import { lundiDe, ajouterJours } from './dates.js';
import { volumeSemaine_s, seancesDeLaSemaine } from './plan.js';

// Séances de la grille d'un bloc, dans l'ordre des emplacements, avec le jour et l'heure de l'emplacement ;
// un emplacement dont la séance n'existe plus (supprimée sur le site) est ignoré (revue 1).
export function grilleDuBloc(bloc, seances) {
  const parId = new Map(seances.map((s) => [String(s.id), s]));
  return (bloc.emplacements ?? [])
    .filter((e) => parId.has(String(e.seanceId)))
    .map((e) => ({ ...parId.get(String(e.seanceId)), jour: e.jour, heure: e.heure ?? null }));
}

// Index des blocs dont la grille n'a aucun volume (vide, repos seuls, séances sans durée) : le plan ne peut
// pas les mettre à l'échelle (revue 2).
export function blocsVides(blocs, seances, allures = {}) {
  return blocs.map((b, i) => (volumeSemaine_s(grilleDuBloc(b, seances), allures) > 0 ? null : i)).filter((i) => i !== null);
}

// Coefficients des semaines : [{ numero, type, bloc, pct, pctSeances }].
// - dans un bloc : +hausse points par semaine, plafonnés ; dernière semaine en coupure, sauf pour le dernier
//   bloc (ou selon bloc.coupure quand il est fixé, cas de la migration) ;
// - bloc suivant : repart du niveau de la dernière semaine de hausse ;
// - affûtage : grille du dernier bloc, niveaux de l'affûtage appliqués à la dernière semaine de hausse ;
// - dernière semaine : semaine de course.
// pctSeances : pourcentage à appliquer aux séances de la grille de la semaine (mise à l'échelle du bloc).
export function coefficientsBlocs(blocs, volumes_s, reglages) {
  const base = volumes_s[0];
  const pctMax = reglages.plafond_h && base > 0 ? Math.round(((reglages.plafond_h * 3600) / base) * 100) : Infinity;
  const dernier = blocs.length - 1;
  const semaines = [];
  let depart = 100;
  let derniereHausse = 100;
  blocs.forEach((bloc, i) => {
    const avecCoupure = bloc.coupure ?? i < dernier;
    for (let j = 0; j < bloc.semaines; j += 1) {
      if (avecCoupure && j === bloc.semaines - 1 && semaines.length) {
        semaines.push({ type: 'COUPURE', bloc: i, pct: Math.round((semaines.at(-1).pct * reglages.coupure) / 100) });
      } else {
        derniereHausse = Math.min(depart + j * reglages.hausse, pctMax);
        semaines.push({ type: 'HAUSSE', bloc: i, pct: derniereHausse });
      }
    }
    depart = derniereHausse;
  });
  for (const niveau of reglages.affutage ?? []) {
    semaines.push({ type: 'AFFUTAGE', bloc: dernier, pct: Math.round((derniereHausse * niveau) / 100) });
  }
  if (semaines.length) semaines.at(-1).type = 'COURSE';
  return semaines.map((s, i) => ({ numero: i + 1, ...s, pctSeances: (s.pct * base) / volumes_s[s.bloc] }));
}

// Lundi de la première semaine d'un plan de "nbSemaines" semaines finissant par la semaine de la course.
export function debutDesBlocs(dateCourse, nbSemaines) {
  return ajouterJours(lundiDe(dateCourse), -7 * (nbSemaines - 1));
}

const NOMS_AFFUTAGE = { AFFUTAGE: 'Affûtage', COURSE: 'Course' };

// Plan complet : [{ numero, type, pct, bloc, nomBloc, lundi, seances, volume_s }], calé à rebours depuis la
// course (conception 5.4). Les blocs doivent avoir un volume (voir blocsVides).
export function genererPlanBlocs({ seances, blocs, reglages, dateCourse, allures = {}, objectifId }) {
  const grilles = blocs.map((b) => grilleDuBloc(b, seances));
  const volumes = grilles.map((g) => volumeSemaine_s(g, allures));
  const coefficients = coefficientsBlocs(blocs, volumes, reglages);
  const debut = debutDesBlocs(dateCourse, coefficients.length);
  return coefficients.map(({ pctSeances, ...c }, i) => {
    const lundi = ajouterJours(debut, 7 * i);
    const liste = seancesDeLaSemaine(grilles[c.bloc], lundi, pctSeances, c.numero, dateCourse, objectifId);
    const nomBloc = c.type === 'HAUSSE' || c.type === 'COUPURE' ? blocs[c.bloc].nom : NOMS_AFFUTAGE[c.type];
    return { ...c, nomBloc, lundi, seances: liste, volume_s: volumeSemaine_s(liste, allures) };
  });
}
