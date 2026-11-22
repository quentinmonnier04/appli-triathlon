// Totaux par période et par sport (F-22, F-24, F-25, ENF-24). Fonctions pures.
// Les activités et séances sont des objets internes (9.2) : date AAAA-MM-JJ, sport, duree_s.

import { ajouterJours, debutMois, memeJourMoisPrecedent, joursDansMois } from './dates.js';
import { SPORTS } from './sports.js';

// Somme des durées entre deux jours inclus ; une durée absente compte 0.
export function totalDuree(elements, debut, fin) {
  return elements.filter((e) => e.date >= debut && e.date <= fin).reduce((s, e) => s + (e.duree_s ?? 0), 0);
}

// Durée cumulée jour après jour, sur nbJours à partir de "debut".
export function cumulParJour(elements, debut, nbJours) {
  const courbe = [];
  let cumul = 0;
  for (let i = 0; i < nbJours; i++) {
    const jour = ajouterJours(debut, i);
    cumul += totalDuree(elements, jour, jour);
    courbe.push(cumul);
  }
  return courbe;
}

// Durée du mois en cours comparée au mois précédent à la même date (F-22),
// avec les courbes cumulées (mois en cours jusqu'à aujourd'hui, mois précédent en entier).
export function comparaisonMois(activites, aujourdhui) {
  const debut = debutMois(aujourdhui);
  const finPrecedent = memeJourMoisPrecedent(aujourdhui);
  const debutPrecedent = debutMois(finPrecedent);
  const actuel_s = totalDuree(activites, debut, aujourdhui);
  const precedent_s = totalDuree(activites, debutPrecedent, finPrecedent);
  return {
    actuel_s,
    precedent_s,
    ecart_s: actuel_s - precedent_s,
    courbeActuelle: cumulParJour(activites, debut, Number(aujourdhui.slice(8, 10))),
    courbePrecedente: cumulParJour(activites, debutPrecedent, joursDansMois(debutPrecedent)),
    nbJours: Math.max(joursDansMois(aujourdhui), joursDansMois(debutPrecedent)),
  };
}

// Sports pratiqués chaque jour, sans doublon, dans l'ordre d'apparition (F-24) : { 'AAAA-MM-JJ': ['VELO', ...] }.
export function sportsParJour(activites) {
  const parJour = {};
  for (const a of activites) {
    parJour[a.date] ??= [];
    if (!parJour[a.date].includes(a.sport)) parJour[a.date].push(a.sport);
  }
  return parJour;
}

// Volume prévu et réalisé par sport pour la semaine qui commence au lundi donné (F-25).
// Seuls les sports présents dans la semaine sont renvoyés, dans l'ordre de 9.3.
export function volumeSemaine(prevues, activites, lundi) {
  const dimanche = ajouterJours(lundi, 6);
  const dans = (e) => e.date >= lundi && e.date <= dimanche;
  const p = prevues.filter(dans);
  const r = activites.filter(dans);
  return SPORTS.map((s) => s.code)
    .filter((code) => p.some((e) => e.sport === code) || r.some((e) => e.sport === code))
    .map((code) => ({
      sport: code,
      prevu_s: p.filter((e) => e.sport === code).reduce((t, e) => t + (e.duree_s ?? 0), 0),
      realise_s: r.filter((e) => e.sport === code).reduce((t, e) => t + (e.duree_s ?? 0), 0),
    }));
}
