// Démarrage de l'application et routeur par ancre (5.5, ENF-07).
// Routes : #/aujourdhui, #/seance/..., #/realisation/..., #/sauvegarde

import { lireRoute } from './ui/commun.js';
import { initialiser } from './db/migrations.js';
import { afficherAujourdhui } from './ui/aujourdhui.js';
import { afficherSeance } from './ui/seance.js';

const conteneur = document.getElementById('app');

// Contexte partagé par les écrans (athlète courant, etc.).
const contexte = {};

// Table des écrans : segment de route -> fonction d'affichage.
const ROUTES = {
  aujourdhui: afficherAujourdhui,
  seance: afficherSeance,
  sauvegarde: async (c) => { c.innerHTML = '<h1>Sauvegarde</h1>'; },
};

// Affiche l'écran correspondant à l'ancre courante.
async function afficherRoute() {
  const { segments, params } = lireRoute(location.hash);
  const ecran = ROUTES[segments[0]];
  if (!ecran) {
    location.replace('#/aujourdhui');
    return;
  }
  // Onglet actif surligné ; seance et realisation dépendent de l'onglet Aujourd'hui.
  const onglet = segments[0] === 'sauvegarde' ? 'sauvegarde' : 'aujourdhui';
  document.querySelectorAll('#onglets a').forEach((a) => {
    a.classList.toggle('actif', a.dataset.onglet === onglet);
  });
  await ecran(conteneur, contexte, segments, params);
  window.scrollTo(0, 0);
}

// Bandeau "Nouvelle version disponible" (5.6, mise à jour de l'application).
function proposerMiseAJour(travailleur) {
  const zone = document.getElementById('maj');
  zone.innerHTML = '<div class="bandeau"><span>Nouvelle version disponible</span>'
    + '<button type="button" class="principal">Recharger</button></div>';
  zone.querySelector('button').addEventListener('click', () => travailleur.postMessage('ACTIVER'));
}

// Enregistrement du service worker (ENF-05).
function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) proposerMiseAJour(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nouveau = reg.installing;
      nouveau.addEventListener('statechange', () => {
        if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposerMiseAJour(nouveau);
      });
    });
  });
  let rechargement = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargement) return;
    rechargement = true;
    location.reload();
  });
}

async function demarrer() {
  enregistrerServiceWorker();
  // Ouverture de la base, migration éventuelle, premier lancement (5.6, C-01)
  Object.assign(contexte, await initialiser());
  window.addEventListener('hashchange', afficherRoute);
  await afficherRoute();
}

demarrer();
