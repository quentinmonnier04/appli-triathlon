// Grille hebdomadaire du planificateur (F-81) : position des séances types dans un agenda du lundi au dimanche.
// Fonctions pures. Une séance occupe sa colonne de jour, de son heure à son heure plus sa durée.

import { volumeSeance_s } from './plan.js';

// Grille de 5 h à 23 h ; 1 h = 48 px ; un bloc fait au moins 24 px de haut (conception, « Mes choix »).
export const GRILLE = { heureDebut: 5, heureFin: 23, pxParHeure: 48, hauteurMin: 24 };

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Disposition de la semaine : { blocs: [{ seance, jour, haut_px, hauteur_px, colonne, nbColonnes }], sansHeure }.
// Repos et séances sans heure vont dans "sansHeure". Durée = volume de la séance, 1 h si inconnue.
// Des séances qui se chevauchent un même jour (même par chaîne) se partagent la largeur de la colonne.
export function dispositionSemaine(seances, allures = {}) {
  const { heureDebut, heureFin, pxParHeure, hauteurMin } = GRILLE;
  const bas = (heureFin - heureDebut) * pxParHeure;
  const sansHeure = seances.filter((s) => !s.heure || s.sport === 'REPOS');
  const placees = seances
    .filter((s) => s.heure && s.sport !== 'REPOS')
    .map((s) => {
      const debut = minutes(s.heure);
      return { seance: s, jour: s.jour, debut, fin: debut + (volumeSeance_s(s, allures) || 3600) / 60 };
    })
    .sort((a, b) => a.jour - b.jour || a.debut - b.debut);

  // Groupes de séances qui se chevauchent, jour par jour ; colonnes attribuées dans l'ordre des heures.
  const blocs = [];
  let groupe = [];
  let finGroupe = -1;
  const fermer = () => {
    const nbColonnes = Math.max(1, ...groupe.map((b) => b.colonne + 1));
    for (const b of groupe) blocs.push({ ...b, nbColonnes });
    groupe = [];
  };
  for (const p of placees) {
    if (groupe.length && (p.jour !== groupe[0].jour || p.debut >= finGroupe)) fermer();
    const finsColonnes = [];
    for (const b of groupe) finsColonnes[b.colonne] = Math.max(finsColonnes[b.colonne] ?? 0, b.fin);
    let colonne = finsColonnes.findIndex((f) => f <= p.debut);
    if (colonne === -1) colonne = finsColonnes.length;
    groupe.push({ ...p, colonne });
    finGroupe = groupe.length === 1 ? p.fin : Math.max(finGroupe, p.fin);
  }
  if (groupe.length) fermer();

  return {
    blocs: blocs.map(({ seance, jour, debut, fin, colonne, nbColonnes }) => {
      const haut = Math.max(0, ((debut - heureDebut * 60) / 60) * pxParHeure);
      const basBloc = Math.min(bas, ((fin - heureDebut * 60) / 60) * pxParHeure);
      const hauteur = Math.max(hauteurMin, Math.round(basBloc - haut));
      return { seance, jour, haut_px: Math.round(Math.min(haut, bas - hauteurMin)), hauteur_px: hauteur, colonne, nbColonnes };
    }),
    sansHeure,
  };
}

// Heure pleine de la case touchée à "y" pixels du haut de la grille (création d'une séance, F-81).
export function heureDepuisPosition(y_px) {
  const { heureDebut, heureFin, pxParHeure } = GRILLE;
  const h = Math.min(heureFin - 1, Math.max(heureDebut, heureDebut + Math.floor(y_px / pxParHeure)));
  return `${String(h).padStart(2, '0')}:00`;
}
