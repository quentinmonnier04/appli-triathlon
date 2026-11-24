// Session Intervals.icu : identifiants, connexion, déconnexion (F-01 à F-04, ENF-13, ENF-14).
// L'affichage passe par ce module ; il ne reçoit jamais la clé enregistrée.

import { initialiserStockage, lireReglages, ecrireReglages, toutEffacer, viderCache } from '../cache/stockage.js';
import { testerConnexion, memoriserAthlete } from './athlete.js';
import { normaliserTheme } from '../logique/theme.js';

// Prépare le stockage au démarrage (4.2).
export async function demarrerSession() {
  await initialiserStockage();
}

// Vrai si un identifiant et une clé sont enregistrés (F-04).
export async function estConnecte() {
  const { athleteId, cle } = await lireReglages();
  return Boolean(athleteId && cle);
}

// Ce que l'écran Réglages peut afficher : l'identifiant, et seulement le fait qu'une clé existe (ENF-13).
export async function lireIdentifiantsAffichables() {
  const { athleteId, cle } = await lireReglages();
  return { athleteId: athleteId ?? '', cleEnregistree: Boolean(cle) };
}

// Nom de la montre affiché sur le profil (F-50), réglable dans Réglages ; stocké sur l'appareil (4.2).
export const MONTRE_PAR_DEFAUT = 'Suunto 9 Baro';

export async function lireMontre() {
  const { montre } = await lireReglages();
  return montre || MONTRE_PAR_DEFAUT;
}

export async function enregistrerMontre(texte) {
  await ecrireReglages({ montre: String(texte ?? '').trim() || MONTRE_PAR_DEFAUT });
}

// Thème d'affichage (ENF-16) : "auto", "clair" ou "sombre", stocké sur l'appareil (4.2).
export async function lireTheme() {
  const { theme } = await lireReglages();
  return normaliserTheme(theme);
}

export async function enregistrerTheme(theme) {
  await ecrireReglages({ theme: normaliserTheme(theme) });
}

// "Tester la connexion" (F-01, F-02) : une clé vide reprend la clé déjà enregistrée.
// Les identifiants ne sont enregistrés que si Intervals.icu les accepte. Renvoie l'Athlete.
export async function connecter(athleteId, cleSaisie) {
  const { cle: cleEnregistree } = await lireReglages();
  const cle = cleSaisie || cleEnregistree;
  const athlete = await testerConnexion(athleteId, cle);
  await ecrireReglages({ athleteId, cle });
  await viderCache(); // un autre compte ne doit pas hériter du cache précédent (ENF-08)
  await memoriserAthlete(athlete);
  return athlete;
}

// "Se déconnecter" (F-03, ENF-14) : identifiants et cache effacés de l'appareil.
export async function seDeconnecter() {
  await toutEffacer();
}
