// Service worker : met les fichiers de l'application en cache (hors ligne, 5.7).
// Changer VERSION à chaque modification (identique à VERSION_APP dans js/version.js).
// Les appels à Intervals.icu ne passent jamais par ce cache (données dans IndexedDB via api/).
const VERSION = 'v2.0.12';
const CACHE = `triathlon-${VERSION}`;

const FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './fonts/archivo-variable.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/version.js',
  './js/api/client.js',
  './js/api/athlete.js',
  './js/api/session.js',
  './js/api/activites.js',
  './js/api/evenements.js',
  './js/api/wellness.js',
  './js/api/tableau.js',
  './js/api/agenda.js',
  './js/api/bibliotheque.js',
  './js/api/profil.js',
  './js/api/objectif.js',
  './js/api/semaine-type.js',
  './js/api/plan.js',
  './js/cache/stockage.js',
  './js/logique/connexion.js',
  './js/logique/format.js',
  './js/logique/messages.js',
  './js/logique/sports.js',
  './js/logique/activites.js',
  './js/logique/dates.js',
  './js/logique/forme.js',
  './js/logique/totaux.js',
  './js/logique/graphique.js',
  './js/logique/agenda.js',
  './js/logique/seance.js',
  './js/logique/profil.js',
  './js/logique/ressenti.js',
  './js/logique/carte.js',
  './js/logique/plan.js',
  './js/logique/grille.js',
  './js/logique/graphique-seance.js',
  './js/ui/composants.js',
  './js/ui/icones.js',
  './js/ui/bienvenue.js',
  './js/ui/accueil.js',
  './js/ui/reglages.js',
  './js/ui/activites.js',
  './js/ui/activite.js',
  './js/ui/agenda.js',
  './js/ui/programmer.js',
  './js/ui/profil.js',
  './js/ui/bilan.js',
  './js/ui/carte.js',
  './js/ui/objectif.js',
  './lib/leaflet/leaflet.js',
  './lib/leaflet/leaflet.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FICHIERS)));
});

// Suppression des caches des versions précédentes.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Fichiers de l'application : cache d'abord. Autres origines (Intervals.icu) : non interceptées.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((reponse) => reponse || fetch(event.request)),
  );
});

// Le bandeau "Nouvelle version disponible" demande l'activation immédiate.
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVER') self.skipWaiting();
});
