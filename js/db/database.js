// Accès à IndexedDB (F-35). Seule couche autorisée à utiliser IndexedDB (5.3).
// Base "triathlon-app", un store par objet, index (athlete_id, date) (4.1, 9.5).

import { STORES } from '../regles/validation.js';

const NOM_BASE = 'triathlon-app';
const VERSION_BASE = 1; // version de la structure IndexedDB (distincte de schema_version)

let connexion = null;

// Transforme une requête IndexedDB en promesse.
function enPromesse(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

// Promesse résolue à la fin d'une transaction.
function finTransaction(tx) {
  return new Promise((resoudre, rejeter) => {
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error);
  });
}

// Ouvre la base et crée les stores au premier lancement (9.5).
export function ouvrirBase() {
  if (connexion) return Promise.resolve(connexion);
  const requete = indexedDB.open(NOM_BASE, VERSION_BASE);
  requete.onupgradeneeded = () => {
    const db = requete.result;
    for (const nom of STORES) {
      if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: 'id' });
    }
    const tx = requete.transaction;
    for (const nom of ['seances_prevues', 'realisations']) {
      const store = tx.objectStore(nom);
      if (!store.indexNames.contains('athlete_date')) store.createIndex('athlete_date', ['athlete_id', 'date']);
    }
    const reals = tx.objectStore('realisations');
    if (!reals.indexNames.contains('seance_prevue_id')) reals.createIndex('seance_prevue_id', 'seance_prevue_id');
  };
  return enPromesse(requete).then((db) => {
    connexion = db;
    return db;
  });
}

// Ajoute id, created_at et updated_at (4.1) ; Meta garde son id fixe et n'a pas d'horodatage.
function horodater(store, objet) {
  if (store === 'meta') return { ...objet };
  const maintenant = new Date().toISOString();
  return {
    ...objet,
    id: objet.id ?? crypto.randomUUID(),
    created_at: objet.created_at ?? maintenant,
    updated_at: maintenant,
  };
}

// Lit un enregistrement par son id.
export async function lire(store, id) {
  const db = await ouvrirBase();
  return enPromesse(db.transaction(store).objectStore(store).get(id));
}

// Crée ou remplace un enregistrement ; renvoie l'objet écrit.
export async function ecrire(store, objet) {
  const db = await ouvrirBase();
  const complet = horodater(store, objet);
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(complet);
  await finTransaction(tx);
  return complet;
}

// Supprime un enregistrement (suppression définitive en V1, 4.1).
export async function supprimer(store, id) {
  const db = await ouvrirBase();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await finTransaction(tx);
}

// Tous les enregistrements d'un store.
export async function listerTout(store) {
  const db = await ouvrirBase();
  return enPromesse(db.transaction(store).objectStore(store).getAll());
}

// Enregistrements d'un athlète pour un jour (index athlete_date) ; séances triées par ordre (F-20).
export async function listerParJour(store, athleteId, date) {
  const db = await ouvrirBase();
  const liste = await enPromesse(db.transaction(store).objectStore(store).index('athlete_date').getAll([athleteId, date]));
  if (store === 'seances_prevues') liste.sort((a, b) => a.ordre - b.ordre);
  return liste;
}

// Réalisation liée à une séance prévue (règle 4.5.1 : au plus une).
export async function realisationDeSeance(seanceId) {
  const db = await ouvrirBase();
  return enPromesse(db.transaction('realisations').objectStore('realisations').index('seance_prevue_id').get(seanceId));
}

// Ordre de la prochaine séance du jour : dernier + 1 (C-03).
export async function prochainOrdre(athleteId, date) {
  const seances = await listerParJour('seances_prevues', athleteId, date);
  return seances.reduce((max, s) => Math.max(max, s.ordre ?? 0), 0) + 1;
}

// Supprime une séance prévue et conserve sa réalisation, seance_prevue_id vidé (C-13, règle 4.5.5).
export async function supprimerSeancePrevue(id) {
  const db = await ouvrirBase();
  const tx = db.transaction(['seances_prevues', 'realisations'], 'readwrite');
  tx.objectStore('seances_prevues').delete(id);
  const reals = tx.objectStore('realisations');
  reals.index('seance_prevue_id').get(id).onsuccess = (ev) => {
    const r = ev.target.result;
    if (!r) return;
    delete r.seance_prevue_id;
    r.updated_at = new Date().toISOString();
    reals.put(r);
  };
  await finTransaction(tx);
}

// Crée une réalisation sauf s'il en existe déjà une pour la même séance (règle 4.5.1, double toucher).
// Renvoie la réalisation créée ou celle qui existait déjà.
export async function creerRealisationUnique(realisation) {
  const db = await ouvrirBase();
  const complet = horodater('realisations', realisation);
  const tx = db.transaction('realisations', 'readwrite');
  const store = tx.objectStore('realisations');
  let resultat = complet;
  if (complet.seance_prevue_id) {
    store.index('seance_prevue_id').get(complet.seance_prevue_id).onsuccess = (ev) => {
      if (ev.target.result) resultat = ev.target.result;
      else store.put(complet);
    };
  } else {
    store.put(complet);
  }
  await finTransaction(tx);
  return resultat;
}

// Vide tous les stores (ENF-23).
export async function viderTout() {
  const db = await ouvrirBase();
  const tx = db.transaction(STORES, 'readwrite');
  for (const nom of STORES) tx.objectStore(nom).clear();
  await finTransaction(tx);
}

// Remplace toutes les données en une seule transaction, sans toucher aux horodatages (F-36, ENF-18).
export async function remplacerTout(donnees) {
  const db = await ouvrirBase();
  const tx = db.transaction(STORES, 'readwrite');
  for (const nom of STORES) {
    const store = tx.objectStore(nom);
    store.clear();
    for (const objet of donnees[nom]) store.put(objet);
  }
  await finTransaction(tx);
}
