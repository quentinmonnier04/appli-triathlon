// Premier lancement et évolution du format des données (C-01, ENF-19, ENF-28, D-01).

import { SCHEMA_VERSION, STORES } from '../regles/validation.js';
import { lire, ecrire, listerTout } from './database.js';

// Migrations : MIGRATIONS[n] fait passer les données de la version n-1 à n. Aucune en V1.1.
const MIGRATIONS = {};

// Copie de sécurité de toutes les données avant une migration (ENF-28).
async function copieDeSecurite() {
  const copie = {};
  for (const store of STORES) copie[store] = await listerTout(store);
  localStorage.setItem('triathlon-copie-avant-migration', JSON.stringify(copie));
}

// Création des données par défaut (C-01, D-01, 9.5).
async function premierLancement() {
  await ecrire('meta', { id: 'meta', schema_version: SCHEMA_VERSION });
  const id = crypto.randomUUID();
  await ecrire('athletes', {
    id,
    athlete_id: id, // ENF-27 : l'athlète porte aussi son athlete_id
    nom: 'Athlète',
    niveau: 'DEBUTANT',
    disponibilites: [],
    volume_max_semaine_s: 0,
    materiel: { montre_gps: false, cardio: false, capteur_puissance: false, strava: false, garmin: false },
    questionnaire_termine: false,
  });
  await ecrire('parametres', { athlete_id: id, theme: 'AUTO', rappel_sauvegarde_jours: 7 });
}

// Demande au navigateur de ne pas effacer les données (ENF-19).
async function demanderPersistance() {
  if (!navigator.storage?.persist) return;
  const resultat = await navigator.storage.persist();
  console.log('Stockage persistant :', resultat);
}

// Prépare la base au démarrage et renvoie l'athlète courant.
export async function initialiser() {
  let meta = await lire('meta', 'meta');
  if (!meta) {
    await premierLancement();
  } else if (meta.schema_version < SCHEMA_VERSION) {
    await copieDeSecurite();
    for (let v = meta.schema_version + 1; v <= SCHEMA_VERSION; v++) {
      if (MIGRATIONS[v]) await MIGRATIONS[v]();
    }
    meta = { ...meta, schema_version: SCHEMA_VERSION };
    await ecrire('meta', meta);
  }
  await demanderPersistance();
  const athletes = await listerTout('athletes');
  return { athleteId: athletes[0].id };
}
