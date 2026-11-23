// Démarrage de l'application et routeur par ancre (5.2, 9.1).

import { demarrerSession, estConnecte } from './api/session.js';
import { afficherBienvenue } from './ui/bienvenue.js';
import { afficherAccueil } from './ui/accueil.js';
import { afficherReglages } from './ui/reglages.js';
import { afficherActivites } from './ui/activites.js';
import { afficherActivite } from './ui/activite.js';
import { afficherAgenda } from './ui/agenda.js';
import { afficherProgrammer } from './ui/programmer.js';
import { afficherProfil } from './ui/profil.js';
import { afficherBilan } from './ui/bilan.js';
import { afficherObjectif } from './ui/objectif.js';

const conteneur = document.getElementById('app');
const navigation = document.getElementById('navigation');

// Écrans livrés (9.1) : L0 (bienvenue, accueil, réglages), L1 (activités, détail), L3 (agenda), L4 (programmer), L5 (profil), L6 (bilan), L8 (objectif, séances de la semaine type).
const ROUTES = {
  bienvenue: afficherBienvenue,
  accueil: afficherAccueil,
  reglages: afficherReglages,
  activites: afficherActivites,
  activite: afficherActivite,
  agenda: afficherAgenda,
  seance: afficherProgrammer,
  profil: afficherProfil,
  bilan: afficherBilan,
  objectif: afficherObjectif,
  'seance-type': afficherProgrammer,
};
// Écrans accessibles sans identifiants (F-04).
const ROUTES_PUBLIQUES = ['bienvenue', 'reglages'];

// Paramètres de l'ancre (ex. #/agenda?vue=mois&date=2026-11-22 -> { vue, date }).
function parametresCourants() {
  return Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? ''));
}

// Lit "#/route/param?..." et renvoie les segments du chemin (ex. ['activite', 'i123']).
function segmentsCourants() {
  return location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
}

async function afficherRoute() {
  const segments = segmentsCourants();
  const route = segments[0] ?? '';
  const connecte = await estConnecte();
  // F-04 : sans identifiants, tout renvoie vers l'écran de bienvenue (sauf Réglages)
  if (!connecte && !ROUTES_PUBLIQUES.includes(route)) return location.replace('#/bienvenue');
  if (connecte && (route === 'bienvenue' || !ROUTES[route])) return location.replace('#/accueil');
  if (!ROUTES[route]) return location.replace('#/bienvenue');

  navigation.classList.toggle('masque', !connecte);
  // Le détail dépend de l'onglet Activités ; les Réglages s'ouvrent depuis le Profil (9.1) ; le bilan depuis l'Accueil.
  const onglet = { activite: 'activites', reglages: 'profil', bilan: 'accueil', objectif: 'accueil', 'seance-type': 'accueil' }[route] ?? route;
  navigation.querySelectorAll('a').forEach((a) => a.classList.toggle('actif', a.dataset.onglet === onglet));
  await ROUTES[route](conteneur, segments, parametresCourants());
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
