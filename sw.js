// Service worker : met l'application en cache pour fonctionner hors ligne (ENF-05).
// Changer VERSION à chaque mise en ligne (identique à VERSION_APP dans js/ui/commun.js).
const VERSION = 'v1.1.8';
const CACHE = `triathlon-${VERSION}`;

// Tous les fichiers de l'application (stratégie "cache d'abord").
const FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/regles/validation.js',
  './js/ui/commun.js',
  './js/db/database.js',
  './js/db/migrations.js',
  './js/ui/aujourdhui.js',
  './js/ui/seance.js',
  './js/ui/realisation.js',
  './js/db/sauvegarde.js',
  './js/ui/sauvegarde.js',
];

// Installation : copie des fichiers dans le cache de cette version.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FICHIERS)));
});

// Activation : suppression des caches des versions précédentes.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Requêtes : réponse du cache, sinon réseau.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((reponse) => reponse || fetch(event.request)),
  );
});

// Le bandeau "Nouvelle version disponible" demande l'activation immédiate.
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVER') self.skipWaiting();
});
