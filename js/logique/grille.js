// Grille hebdomadaire du planificateur (F-81) : position des séances types dans un agenda du lundi au dimanche.
// Fonctions pures. Une séance occupe sa colonne de jour, de son heure à son heure plus sa durée.

import { volumeSeance_s } from './plan.js';

// Grille de 5 h à 23 h ; 1 h = 48 px ; un bloc fait au moins 24 px de haut et sa zone de toucher au moins
// 44 px (conception, « Mes choix » ; ENF-17).
export const GRILLE = { heureDebut: 5, heureFin: 23, pxParHeure: 48, hauteurMin: 24, toucherMin: 44 };

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Disposition de la semaine : { blocs: [{ seance, jour, haut_px, hauteur_px, colonne, nbColonnes }], sansHeure }.
// Repos et séances sans heure vont dans "sansHeure". Durée = volume de la séance, 1 h si inconnue.
// La place dessinée (hauteur minimale, bornage en haut et en bas de la grille) est calculée d'abord ; des blocs
// qui se recouvrent à l'écran un même jour (même par chaîne) se partagent la largeur de la colonne (revue I-3).
export function dispositionSemaine(seances, allures = {}) {
  const { heureDebut, heureFin, pxParHeure, hauteurMin } = GRILLE;
  const bas = (heureFin - heureDebut) * pxParHeure;
  const enPx = (min) => ((min - heureDebut * 60) / 60) * pxParHeure;
  const sansHeure = seances.filter((s) => !s.heure || s.sport === 'REPOS');
  const placees = seances
    .filter((s) => s.heure && s.sport !== 'REPOS')
    .map((s) => {
      const debut = minutes(s.heure);
      const fin = debut + (volumeSeance_s(s, allures) || 3600) / 60;
      const haut = Math.round(Math.min(Math.max(0, enPx(debut)), bas - hauteurMin));
      const hauteur = Math.max(hauteurMin, Math.round(Math.min(bas, enPx(fin)) - haut));
      return { seance: s, jour: s.jour, haut_px: haut, hauteur_px: hauteur };
    })
    .sort((a, b) => a.jour - b.jour || a.haut_px - b.haut_px);

  // Groupes de blocs qui se recouvrent, jour par jour ; colonnes attribuées de haut en bas.
  const blocs = [];
  let groupe = [];
  let basGroupe = -1;
  const fermer = () => {
    const nbColonnes = Math.max(1, ...groupe.map((b) => b.colonne + 1));
    for (const b of groupe) blocs.push({ ...b, nbColonnes });
    groupe = [];
  };
  for (const p of placees) {
    if (groupe.length && (p.jour !== groupe[0].jour || p.haut_px >= basGroupe)) fermer();
    const basColonnes = [];
    for (const b of groupe) basColonnes[b.colonne] = Math.max(basColonnes[b.colonne] ?? 0, b.haut_px + b.hauteur_px);
    let colonne = basColonnes.findIndex((f) => f <= p.haut_px);
    if (colonne === -1) colonne = basColonnes.length;
    groupe.push({ ...p, colonne });
    basGroupe = groupe.length === 1 ? p.haut_px + p.hauteur_px : Math.max(basGroupe, p.haut_px + p.hauteur_px);
  }
  if (groupe.length) fermer();
  // Zone de toucher : au moins toucherMin, centrée sur le bloc, sans sortir de la grille (revue I-1).
  const avecToucher = blocs.map((b) => {
    const h = Math.max(GRILLE.toucherMin, b.hauteur_px);
    const haut = Math.min(Math.max(0, b.haut_px - (h - b.hauteur_px) / 2), bas - h);
    return { ...b, toucher_haut_px: Math.round(haut), toucher_hauteur_px: h };
  });
  return { blocs: avecToucher, sansHeure };
}

// Heure pleine de la case touchée à "y" pixels du haut de la grille (création d'une séance, F-81).
export function heureDepuisPosition(y_px) {
  const { heureDebut, heureFin, pxParHeure } = GRILLE;
  const h = Math.min(heureFin - 1, Math.max(heureDebut, heureDebut + Math.floor(y_px / pxParHeure)));
  return `${String(h).padStart(2, '0')}:00`;
}
