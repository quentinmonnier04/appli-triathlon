// Logique de l'agenda (F-30 à F-35, ENF-20 : semaine du lundi au dimanche). Fonctions pures.

import { ajouterJours, lundiDe, debutMois, joursDansMois, libelleMois } from './dates.js';

// Vues de l'agenda (9.1) : mois (F-30), semaine (F-31), 30 jours glissants (F-35).
export const VUES = [
  { code: 'mois', libelle: 'Mois' },
  { code: 'semaine', libelle: 'Semaine' },
  { code: '30j', libelle: '30 jours' },
];

// Premier et dernier jour affichés pour une vue autour d'une date (vue inconnue = mois).
export function periodeAgenda(vue, date) {
  if (vue === 'semaine') {
    const debut = lundiDe(date);
    return { debut, fin: ajouterJours(debut, 6) };
  }
  if (vue === '30j') return { debut: ajouterJours(date, -29), fin: date };
  const debut = debutMois(date);
  return { debut, fin: ajouterJours(debut, joursDansMois(date) - 1) };
}

// Date de référence de la période précédente (sens = -1) ou suivante (sens = 1).
export function deplacerPeriode(vue, date, sens) {
  if (vue === 'semaine') return ajouterJours(date, 7 * sens);
  if (vue === '30j') return ajouterJours(date, 30 * sens);
  const [a, m] = date.split('-').map(Number);
  const mois = new Date(a, m - 1 + sens, 1);
  return `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, '0')}-01`;
}

const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "novembre 2026" pour un mois ; "16/11 au 22/11/2026" sinon (année répétée si elle change).
export function libellePeriode(vue, debut, fin) {
  if (vue === 'mois') return libelleMois(debut);
  const annee = debut.slice(0, 4) === fin.slice(0, 4) ? '' : `/${debut.slice(0, 4)}`;
  return `${jjmm(debut)}${annee} au ${jjmm(fin)}/${fin.slice(0, 4)}`;
}

// Séances prévues et activités regroupées par jour ; activités du jour par heure croissante (F-31, F-34).
export function elementsParJour(activites, prevues) {
  const parJour = {};
  const jour = (d) => (parJour[d] ??= { prevues: [], activites: [] });
  for (const p of prevues) jour(p.date).prevues.push(p);
  for (const a of activites) jour(a.date).activites.push(a);
  for (const j of Object.values(parJour)) j.activites.sort((x, y) => ((x.heure ?? '') < (y.heure ?? '') ? -1 : 1));
  return parJour;
}
