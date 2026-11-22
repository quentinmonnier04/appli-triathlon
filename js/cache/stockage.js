// Stockage local IndexedDB (4.2). Seule couche qui accède à IndexedDB (5.3).
// Stores : reglages (identifiants, préférences), cache (réponses converties), meta (schema_version).

const NOM_BASE = 'triathlon-app';
// Version 2 : la v1.0 utilisait une version 1 avec d'autres stores, supprimés à la mise à niveau.
const VERSION_BASE = 2;
const STORES = ['reglages', 'cache', 'meta'];
// Format du cache (4.2) : l'incrémenter vide simplement le cache.
const SCHEMA_VERSION = 1;

let connexion = null;

function enPromesse(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

function finTransaction(tx) {
  return new Promise((resoudre, rejeter) => {
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error);
  });
}

// Ouvre la base ; supprime les stores d'une ancienne version et crée ceux de la v2.0.
function ouvrir() {
  if (connexion) return Promise.resolve(connexion);
  const requete = indexedDB.open(NOM_BASE, VERSION_BASE);
  requete.onupgradeneeded = (ev) => {
    const db = requete.result;
    // Base de la v1.0 (version < 2) : tous ses stores sont supprimés, même ceux de même nom (format différent).
    if (ev.oldVersion < 2) for (const nom of [...db.objectStoreNames]) db.deleteObjectStore(nom);
    for (const nom of STORES) if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom);
  };
  return enPromesse(requete).then((db) => {
    connexion = db;
    return db;
  });
}

async function lire(store, cle) {
  const db = await ouvrir();
  return enPromesse(db.transaction(store).objectStore(store).get(cle));
}

async function ecrire(store, cle, valeur) {
  const db = await ouvrir();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(valeur, cle);
  await finTransaction(tx);
}

async function vider(stores) {
  const db = await ouvrir();
  const tx = db.transaction(stores, 'readwrite');
  for (const nom of stores) tx.objectStore(nom).clear();
  await finTransaction(tx);
}

// Au démarrage : si le format du cache a changé, on le vide (4.2, pas de migration).
export async function initialiserStockage() {
  const meta = await lire('meta', 'meta');
  if (meta?.schema_version !== SCHEMA_VERSION) {
    await vider(['cache']);
    await ecrire('meta', 'meta', { schema_version: SCHEMA_VERSION });
  }
}

// Réglages (F-01, ENF-13) : { athleteId, cle } ; la clé ne quitte jamais l'appareil.
export async function lireReglages() {
  return (await lire('reglages', 'reglages')) ?? {};
}

export async function ecrireReglages(reglages) {
  const actuels = await lireReglages();
  await ecrire('reglages', 'reglages', { ...actuels, ...reglages });
}

// Cache (5.5) : chaque entrée garde la date de chargement.
export async function lireCache(cle) {
  return (await lire('cache', cle)) ?? null;
}

export async function ecrireCache(cle, donnees) {
  await ecrire('cache', cle, { donnees, charge_le: new Date().toISOString() });
}

// "Se déconnecter" (F-03, ENF-14) : identifiants et cache effacés.
export async function toutEffacer() {
  await vider(STORES);
}
