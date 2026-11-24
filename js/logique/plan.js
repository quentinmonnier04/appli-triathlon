// Plan à surcharge progressive jusqu'à un objectif (F-82, F-83, F-84). Fonctions pures : réglages, surcharge
// mixte des séances, volumes, séances d'une semaine du plan, bornes d'écriture. Le calcul des semaines par blocs
// est dans logique/blocs.js (D-22) ; l'ancien calcul à semaine type unique est gardé dans tests/reference/.

import { lundiDe, ajouterJours } from './dates.js';

// Réglages par défaut, communs à tous les blocs (F-82, conception 2026-11-24 section 5.3) ; plafond_h null = sans plafond.
export const REGLAGES_PAR_DEFAUT = { hausse: 8, coupure: 70, affutage: [70, 50], plafond_h: null };

// Réglages de l'ancienne semaine type unique (lecture de l'ancien format et migration, F-88) :
// semaines de hausse par bloc ; debut null = lundi suivant ; objectifDebut : objectif de la date enregistrée (revue I-4).
export const REGLAGES_ANCIENS_PAR_DEFAUT = { ...REGLAGES_PAR_DEFAUT, semainesHausse: 3, debut: null, objectifDebut: null };

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

const entierEntre = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Contrôle des réglages saisis (F-82). Renvoie { champ: message } ; vide si tout est correct.
export function validerReglages(r) {
  const erreurs = {};
  if (!entierEntre(r.hausse, 0, 30)) erreurs.hausse = 'Hausse : entre 0 et 30 points par semaine.';
  if (!entierEntre(r.coupure, 30, 100)) erreurs.coupure = 'Coupure : entre 30 et 100 %.';
  if (!Array.isArray(r.affutage) || r.affutage.length > 4 || !r.affutage.every((n) => entierEntre(n, 20, 100))) {
    erreurs.affutage = "Affûtage : jusqu'à 4 niveaux entre 20 et 100 %, par exemple 70, 50.";
  }
  if (r.plafond_h !== null && r.plafond_h !== undefined && !(typeof r.plafond_h === 'number' && r.plafond_h >= 1 && r.plafond_h <= 40)) {
    erreurs.plafond_h = 'Plafond : entre 1 et 40 heures par semaine, ou vide.';
  }
  return erreurs;
}

// --- Surcharge des séances (F-83) : règle mixte, conception L8 section 5.4 ---

// Durée surchargée : à la minute, aux 5 minutes au-delà d'une heure ; au moins 1 minute.
function arrondirDuree(s) {
  const pas = s > 3600 ? 300 : 60;
  return Math.max(60, Math.round(s / pas) * pas);
}

// Distance surchargée : aux 100 m en natation, aux 500 m ailleurs ; au moins une unité.
function arrondirDistance(m, sportCode) {
  const pas = sportCode === 'NATATION' ? 100 : 500;
  return Math.max(pas, Math.round(m / pas) * pas);
}

// Étape continue : la durée (ou la distance) est multipliée par k ; la zone ne change pas.
function surchargerEtape(e, k, sportCode) {
  if (!e) return e;
  if (e.distance_m) return { ...e, distance_m: arrondirDistance(e.distance_m * k, sportCode) };
  if (e.duree_s) return { ...e, duree_s: arrondirDuree(e.duree_s * k) };
  return { ...e };
}

// Séance surchargée à "pct" % : blocs continus en durée ou distance, répétitions en nombre (au moins 1),
// zones et cibles inchangées, repos recopié. À 100 %, copie exacte de la séance type.
export function surchargerSeance(seance, pct) {
  const copie = structuredClone(seance);
  if (pct === 100 || seance.sport === 'REPOS') return copie;
  const k = pct / 100;
  if (copie.blocs?.length) {
    copie.blocs = copie.blocs.map((b) => (b.type === 'REPETITIONS'
      ? { ...b, repetitions: Math.max(1, Math.round(b.repetitions * k)) }
      : { ...b, etape: surchargerEtape(b.etape, k, seance.sport) }));
    return copie;
  }
  if (copie.duree_s) copie.duree_s = arrondirDuree(copie.duree_s * k);
  if (copie.distance_m) copie.distance_m = arrondirDistance(copie.distance_m * k, seance.sport);
  return copie;
}

// --- Volumes (F-84) ---

// Durée d'une étape : sa durée, ou sa distance divisée par l'allure seuil du sport (m/s) ; 0 si inconnue.
function dureeEtape(e, allure) {
  if (!e) return 0;
  if (e.duree_s) return e.duree_s;
  if (e.distance_m && allure > 0) return e.distance_m / allure;
  return 0;
}

// Volume d'une séance en secondes ; allures = { CAP: m/s, NATATION: m/s, VELO: m/s }.
export function volumeSeance_s(seance, allures = {}) {
  if (seance.sport === 'REPOS') return 0;
  const allure = allures[seance.sport];
  if (seance.blocs?.length) {
    return Math.round(seance.blocs.reduce((t, b) => t + (b.type === 'REPETITIONS'
      ? b.repetitions * (dureeEtape(b.effort, allure) + dureeEtape(b.recup, allure))
      : dureeEtape(b.etape, allure)), 0));
  }
  return Math.round(dureeEtape(seance, allure));
}

export function volumeSemaine_s(seances, allures = {}) {
  return seances.reduce((t, s) => t + volumeSeance_s(s, allures), 0);
}

// Vrai si une étape en distance n'a pas pu être convertie en durée (pas d'allure seuil pour ce sport).
export function distanceSansAllure(seances, allures = {}) {
  const sansDuree = (e) => Boolean(e && !e.duree_s && e.distance_m);
  return seances.some((s) => {
    if (s.sport === 'REPOS' || allures[s.sport] > 0) return false;
    if (s.blocs?.length) return s.blocs.some((b) => (b.type === 'REPETITIONS' ? sansDuree(b.effort) || sansDuree(b.recup) : sansDuree(b.etape)));
    return sansDuree(s);
  });
}

// --- Génération du plan (F-83, F-84, F-85) ---

// Étiquette invisible (external_id) des séances d'un plan : elle permet de les retrouver sans toucher
// aux séances programmées à la main (F-86, F-87).
export function prefixePlan(objectifId) {
  return `plan-${objectifId}-`;
}

export function externalId(objectifId, numero, date, index) {
  return `${prefixePlan(objectifId)}s${numero}-${date}-${index}`;
}

// Séances d'une semaine du plan (F-83, F-85) : chaque séance de la grille (jour 1 = lundi ... 7 = dimanche)
// devient une séance datée, surchargée à "pct" %, titrée "{titre} S{n}" (sauf repos), avec son external_id ;
// aucune séance le jour de la course ni après. Ordre : jour, puis heure (sans heure en premier), puis ordre de la grille.
export function seancesDeLaSemaine(grille, lundi, pct, numero, dateCourse, objectifId) {
  const cle = (s) => s.heure ?? '';
  return grille.map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.jour - b.s.jour || (cle(a.s) < cle(b.s) ? -1 : cle(a.s) > cle(b.s) ? 1 : 0) || a.i - b.i)
    .map(({ s }) => ({ type: s, date: ajouterJours(lundi, s.jour - 1) }))
    .filter(({ date }) => date < dateCourse)
    .map(({ type, date }, index) => {
      const { id, jour, emplacement, ...seance } = surchargerSeance(type, pct);
      return {
        ...seance,
        date,
        titre: type.sport === 'REPOS' ? type.titre : `${type.titre} S${numero}`,
        external_id: externalId(objectifId, numero, date, index),
      };
    });
}

// Contrôle de l'objectif (F-80) : nom, date à venir (au plus tôt aujourd'hui), sport proposé.
export function validerObjectif(o, aujourdhui) {
  const erreurs = {};
  if (!String(o.nom ?? '').trim()) erreurs.nom = 'Donne un nom à ta course.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date ?? '') || o.date < aujourdhui) erreurs.date = 'Choisis une date à venir.';
  if (!['ENCHAINEMENT', 'CAP', 'VELO', 'NATATION'].includes(o.sport)) erreurs.sport = 'Choisis un sport.';
  return erreurs;
}

// Lundi de la semaine suivante : début par défaut du plan et première semaine régénérée (F-82, F-86).
export function lundiSuivant(jour) {
  return ajouterJours(lundiDe(jour), 7);
}

// Formulaire des réglages (textes saisis) -> réglages ; une saisie invalide donne NaN, refusé par validerReglages.
// Affûtage : niveaux séparés par des virgules ("70, 50") ; plafond en heures, virgule acceptée ; vide = aucun.
export function lireReglagesSaisis(champs) {
  const entier = (t) => (/^\d+$/.test(String(t ?? '').trim()) ? Number(String(t).trim()) : NaN);
  const affutage = String(champs.affutage ?? '').split(/[,;/]/).map((t) => t.trim()).filter(Boolean).map(entier);
  const plafond = String(champs.plafond ?? '').trim().replace(',', '.');
  return {
    hausse: entier(champs.hausse),
    coupure: entier(champs.coupure),
    affutage,
    plafond_h: !plafond ? null : /^\d+(\.\d+)?$/.test(plafond) ? Number(plafond) : NaN,
  };
}

// Bornes d'écriture du plan (F-85 à F-87, revue I-1 et I-2) :
// - creation : première date des séances envoyées (début du plan, jamais avant le lundi suivant) ;
// - regeneration : les séances du plan sont remplacées à partir du lundi suivant, quel que soit le début
//   (un début reculé ne laisse pas de séances orphelines) ; la semaine en cours n'est pas touchée ;
// - suppression : supprimer le plan ou l'objectif retire toutes les séances futures du plan, dès demain.
export function bornesPlan(aujourdhui, debut) {
  const regeneration = lundiSuivant(aujourdhui);
  return {
    creation: debut > regeneration ? debut : regeneration,
    regeneration,
    suppression: ajouterJours(aujourdhui, 1),
  };
}

// Date de début du plan pour cet objectif (revue I-4) : la date enregistrée ne vaut que pour l'objectif
// avec lequel elle a été enregistrée ; sinon, début par défaut.
export function debutEffectif(reglages, objectifId, defaut) {
  return reglages.debut && reglages.objectifDebut === objectifId ? reglages.debut : defaut;
}
