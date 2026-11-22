// Données du tableau de bord (F-20 à F-25, ENF-09, 5.5) : un seul chargement groupé, mis en cache.
// Appels limités aux plages utiles (ENF-11) : activités depuis le début du mois précédent,
// séances prévues de la semaine en cours, forme des 7 derniers jours.

import { lireCache, ecrireCache } from '../cache/stockage.js';
import { chargerActivitesDepuis, chargerDerniereActivite } from './activites.js';
import { chargerSeancesPrevues } from './evenements.js';
import { chargerFormes } from './wellness.js';
import { jourISO, lundiDe, ajouterJours, debutMois, memeJourMoisPrecedent } from '../logique/dates.js';
import { derniereForme } from '../logique/forme.js';

// Tableau de bord en cache : { jour, activites, prevues, forme, derniere, charge_le } ou null.
export async function lireTableauEnCache() {
  const cache = await lireCache('tableau');
  return cache ? { ...cache.donnees, charge_le: cache.charge_le } : null;
}

// Recharge tout le tableau de bord depuis Intervals.icu et remplace le cache.
export async function rafraichirTableau() {
  const jour = jourISO();
  const lundi = lundiDe(jour);
  const [activites, prevues, formes] = await Promise.all([
    chargerActivitesDepuis(debutMois(memeJourMoisPrecedent(jour))),
    chargerSeancesPrevues(lundi, ajouterJours(lundi, 6)),
    chargerFormes(ajouterJours(jour, -7), jour),
  ]);
  // Dernière activité : la plus récente de la période, sinon une recherche sans limite de date.
  const derniere = activites[0] ?? (await chargerDerniereActivite());
  const donnees = { jour, activites, prevues, forme: derniereForme(formes), derniere };
  await ecrireCache('tableau', donnees);
  return { ...donnees, charge_le: (await lireCache('tableau')).charge_le };
}
