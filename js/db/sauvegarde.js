// Export / import de la sauvegarde JSON et suppression totale (F-36, ENF-17, ENF-18, ENF-23).

import { SCHEMA_VERSION, STORES, verifierSauvegarde } from '../regles/validation.js';
import { lire, ecrire, listerTout, remplacerTout, viderTout } from './database.js';
import { initialiser } from './migrations.js';

// Construit la sauvegarde au format 9.6.
// derniere_sauvegarde est mise à jour AVANT la lecture : le fichier et la base restent identiques (ENF-18).
export async function exporterDonnees() {
  const maintenant = new Date().toISOString();
  const meta = await lire('meta', 'meta');
  await ecrire('meta', { ...meta, derniere_sauvegarde: maintenant });
  const donnees = {};
  for (const store of STORES) donnees[store] = await listerTout(store);
  return { app: 'triathlon-app', schema_version: SCHEMA_VERSION, date_export: maintenant, donnees };
}

// Remplace toutes les données par celles de la sauvegarde ; false sans rien écrire si le format est invalide (C-17).
export async function importerDonnees(objet) {
  if (!verifierSauvegarde(objet)) return false;
  await remplacerTout(objet.donnees);
  return true;
}

// Nombre de jours depuis la dernière sauvegarde ; null si jamais (ENF-17).
export async function joursDepuisSauvegarde() {
  const meta = await lire('meta', 'meta');
  if (!meta?.derniere_sauvegarde) return null;
  return Math.floor((Date.now() - Date.parse(meta.derniere_sauvegarde)) / 86400000);
}

// Date de la dernière sauvegarde (ISO) ou null.
export async function derniereSauvegarde() {
  return (await lire('meta', 'meta'))?.derniere_sauvegarde ?? null;
}

// Vrai s'il existe au moins une séance prévue ou une réalisation (C-15).
export async function aDesDonnees() {
  const [seances, reals] = await Promise.all([listerTout('seances_prevues'), listerTout('realisations')]);
  return seances.length > 0 || reals.length > 0;
}

// Vide la base puis recrée l'état du premier lancement (C-18, ENF-23).
export async function toutSupprimer() {
  await viderTout();
  return initialiser();
}
