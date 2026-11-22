// Démarrage de l'application et routeur par ancre (5.2, 9.1).

import { demarrerSession, estConnecte } from './api/session.js';
import { afficherBienvenue } from './ui/bienvenue.js';
import { afficherAccueil } from './ui/accueil.js';
import { afficherReglages } from './ui/reglages.js';

const conteneur = document.getElementById('app');
const navigation = document.getElementById('navigation');

// Écrans livrés en L0 (9.1).
const ROUTES = {
  bienvenue: afficherBienvenue,
  accueil: afficherAccueil,
  reglages: afficherReglages,
};
// Écrans accessibles sans identifiants (F-04).
const ROUTES_PUBLIQUES = ['bienvenue', 'reglages'];

// Lit "#/route/..." et renvoie le nom de la route.
function routeCourante() {
  return location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
}

async function afficherRoute() {
  const route = routeCourante();
  const connecte = await estConnecte();
  // F-04 : sans identifiants, tout renvoie vers l'écran de bienvenue (sauf Réglages)
  if (!connecte && !ROUTES_PUBLIQUES.includes(route)) return location.replace('#/bienvenue');
  if (connecte && (route === 'bienvenue' || !ROUTES[route])) return location.replace('#/accueil');
  if (!ROUTES[route]) return location.replace('#/bienvenue');

  navigation.classList.toggle('masque', !connecte);
  navigation.querySelectorAll('a').forEach((a) => a.classList.toggle('actif', a.dataset.onglet === route));
  await ROUTES[route](conteneur);
  window.scrollTo(0, 0);
}

// Bandeau "Nouvelle version disponible" (risque 5.7).
function proposerMiseAJour(travailleur) {
  const zone = document.getElementById('maj');
  zone.innerHTML = '<div class="bandeau"><span>Nouvelle version disponible</span>'
    + '<button type="button" class="bouton principal">Recharger</button></div>';
  zone.querySelector('button').addEventListener('click', () => travailleur.postMessage('ACTIVER'));
}

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
  await demarrerSession();
  window.addEventListener('hashchange', afficherRoute);
  // Connexion ou déconnexion depuis Réglages : mise à jour de la barre de navigation.
  document.addEventListener('connexion-changee', async () => {
    navigation.classList.toggle('masque', !(await estConnecte()));
  });
  await afficherRoute();
}

demarrer();
