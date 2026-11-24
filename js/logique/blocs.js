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

// --- Édition des blocs (F-88) : chaque fonction renvoie une nouvelle liste, l'entrée n'est pas modifiée ---

const copier = (blocs) => structuredClone(blocs);

export function ajouterBloc(blocs, nom) {
  return [...copier(blocs), { nom, semaines: 4, emplacements: [] }];
}

// Copie placée juste après, mêmes séances : point de départ du bloc suivant (conception 5.2). La coupure forcée
// par la migration n'est pas recopiée.
export function dupliquerBloc(blocs, index) {
  const resultat = copier(blocs);
  const { coupure, ...modele } = structuredClone(blocs[index]);
  resultat.splice(index + 1, 0, { ...modele, nom: `${modele.nom} (copie)` });
  return resultat;
}

export function supprimerBloc(blocs, index) {
  return copier(blocs).filter((_, i) => i !== index);
}

export function modifierBloc(blocs, index, { nom, semaines }) {
  const resultat = copier(blocs);
  resultat[index] = { ...resultat[index], nom, semaines };
  return resultat;
}

export function ajouterEmplacement(blocs, index, emplacement) {
  const resultat = copier(blocs);
  resultat[index].emplacements.push({ seanceId: String(emplacement.seanceId), jour: emplacement.jour, heure: emplacement.heure ?? null });
  return resultat;
}

export function modifierEmplacement(blocs, index, n, { jour, heure }) {
  const resultat = copier(blocs);
  resultat[index].emplacements[n] = { ...resultat[index].emplacements[n], jour, heure: heure ?? null };
  return resultat;
}

export function retirerEmplacement(blocs, index, n) {
  const resultat = copier(blocs);
  resultat[index].emplacements.splice(n, 1);
  return resultat;
}

// Une séance supprimée de la bibliothèque disparaît de tous les blocs (conception 5.1).
export function retirerSeanceDesBlocs(blocs, seanceId) {
  return copier(blocs).map((b) => ({ ...b, emplacements: b.emplacements.filter((e) => String(e.seanceId) !== String(seanceId)) }));
}

// Nombre de blocs qui utilisent la séance (une séance placée deux fois dans un bloc compte une fois).
export function utilisationsSeance(blocs, seanceId) {
  return blocs.filter((b) => (b.emplacements ?? []).some((e) => String(e.seanceId) === String(seanceId))).length;
}

// Contrôle des blocs (F-88) : { champ: message } ; vide si tout est correct.
export function validerBlocs(blocs) {
  if (!blocs.length) return { blocs: 'Ajoute au moins un bloc.' };
  const erreurs = {};
  blocs.forEach((b, i) => {
    const nom = String(b.nom ?? '').trim();
    if (!nom || nom.length > 40) erreurs[`blocs.${i}.nom`] = 'Nom du bloc : de 1 à 40 caractères.';
    if (!Number.isInteger(b.semaines) || b.semaines < 1 || b.semaines > 20) erreurs[`blocs.${i}.semaines`] = 'Durée du bloc : de 1 à 20 semaines.';
    const valide = (e) => Number.isInteger(e.jour) && e.jour >= 1 && e.jour <= 7
      && (e.heure === null || e.heure === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(e.heure));
    if (!(b.emplacements ?? []).every(valide)) erreurs[`blocs.${i}.emplacements`] = 'Jour ou heure invalide dans le bloc.';
  });
  return erreurs;
}
