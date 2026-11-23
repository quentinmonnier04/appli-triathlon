// Écran E-02 "Activités" : fil du plus récent au plus ancien (F-10, F-11), filtre par sport (F-12),
// tirer vers le bas pour rafraîchir (F-14), consultation hors ligne depuis le cache (ENF-06, 5.5),
// aperçu du tracé GPS sur chaque carte (F-71).

import { lireFilEnCache, rafraichirFil, chargerSuite } from '../api/activites.js';
import { filtrerParSport, estPerime } from '../logique/activites.js';
import { SPORTS } from '../logique/sports.js';
import { MESSAGES } from '../logique/messages.js';
import { echapperHtml } from '../logique/format.js';
import { carteActivite, bandeauHorsLigne, message, messageErreurApi, squelette } from './composants.js';
import { remplirApercus } from './carte.js';

// Filtre choisi, conservé pendant la session.
let filtreCourant = null;

// Distance de tirage (px) qui déclenche le rafraîchissement (F-14).
const SEUIL_TIRAGE = 70;

export async function afficherActivites(conteneur) {
  let fil = null;
  let horsLigne = false;
  let enCours = false;

  conteneur.innerHTML = `<div class="ecran-activites">
    <div class="entete"><span class="titre-petit">Activités</span>
      <button type="button" class="icone-bouton" id="rafraichir" aria-label="Rafraîchir">⟳</button></div>
    <div id="tirage" class="tirage" aria-hidden="true">Relâche pour rafraîchir</div>
    <div class="filtres" role="group" aria-label="Filtrer par sport">
      <button type="button" class="filtre" data-sport="">Tous</button>
      ${SPORTS.filter((s) => s.code !== 'REPOS').map((s) => `<button type="button" class="filtre" data-sport="${s.code}"><span aria-hidden="true">${s.icone}</span> ${echapperHtml(s.libelle)}</button>`).join('')}
    </div>
    <div id="etat"></div>
    <section id="liste" aria-live="polite"></section>
    <div id="bas"></div>
    <div id="sentinelle" class="sentinelle"></div></div>`;
  // Écouteurs tactiles posés sur l'écran lui-même (et non sur <main>, réutilisé par les autres écrans).
  const ecran = conteneur.querySelector('.ecran-activites');

  const $ = (sel) => conteneur.querySelector(sel);
  const liste = $('#liste');
  const etat = $('#etat');
  const bas = $('#bas');
  const sentinelle = $('#sentinelle');

  // Affiche la liste filtrée et l'état (hors ligne, vide, fin de liste).
  function rendre() {
    conteneur.querySelectorAll('.filtre').forEach((b) => b.classList.toggle('actif', (b.dataset.sport || null) === filtreCourant));
    etat.innerHTML = horsLigne && fil ? bandeauHorsLigne(fil.charge_le) : '';
    if (!fil) return;
    const visibles = filtrerParSport(fil.activites, filtreCourant);
    if (!fil.activites.length) {
      liste.innerHTML = message('info', MESSAGES['M-08']); // ENF-22 : état vide
    } else if (!visibles.length && fil.fin) {
      liste.innerHTML = message('info', 'Aucune activité de ce sport.');
    } else {
      liste.innerHTML = visibles.map((a) => carteActivite(a, { apercu: true })).join('');
      remplirApercus(liste); // F-71 : aperçus des tracés GPS
    }
    bas.innerHTML = fil.fin && fil.activites.length ? '<p class="fin-liste doux">Fin de la liste</p>' : '';
    // Relance l'observation : si la sentinelle est encore visible, la page suivante se charge.
    observateur.unobserve(sentinelle);
    if (!fil.fin && !horsLigne) observateur.observe(sentinelle);
  }

  // Recharge la première page (5.5) ; en cas d'échec, garde le cache avec la mention hors ligne (ENF-06).
  async function rafraichir() {
    if (enCours) return;
    enCours = true;
    $('#rafraichir').classList.add('tourne');
    try {
      fil = await rafraichirFil();
      horsLigne = false;
      rendre();
    } catch (e) {
      if (fil) {
        horsLigne = e.type === 'RESEAU' || e.type === 'SERVEUR';
        rendre();
        if (e.type === 'IDENTIFIANTS') etat.innerHTML = messageErreurApi(e);
      } else {
        // ENF-22 : erreur réseau ou d'identifiants sans données en cache
        liste.innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
        $('#reessayer').addEventListener('click', rafraichir);
      }
    } finally {
      enCours = false;
      $('#rafraichir')?.classList.remove('tourne');
    }
  }

  // Page suivante (F-10, chargement progressif en descendant).
  async function suite() {
    if (enCours || !fil || fil.fin || horsLigne) return;
    enCours = true;
    bas.innerHTML = '<div class="squelette"></div><div class="squelette"></div>';
    try {
      fil = await chargerSuite(fil);
      enCours = false;
      rendre();
    } catch (e) {
      enCours = false;
      observateur.unobserve(sentinelle);
      bas.innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="suite">Réessayer</button></div>`;
      $('#suite').addEventListener('click', () => { observateur.observe(sentinelle); suite(); });
    }
  }

  const observateur = new IntersectionObserver((entrees) => {
    if (!conteneur.contains(sentinelle)) { observateur.disconnect(); return; } // écran quitté
    if (entrees.some((e) => e.isIntersecting)) suite();
  }, { rootMargin: '400px' });

  // Filtre par sport (F-12).
  conteneur.querySelector('.filtres').addEventListener('click', (ev) => {
    const b = ev.target.closest('.filtre');
    if (!b) return;
    filtreCourant = b.dataset.sport || null;
    rendre();
  });
  $('#rafraichir').addEventListener('click', rafraichir);

  // Tirer vers le bas pour rafraîchir (F-14), seulement quand la page est tout en haut.
  const tirage = $('#tirage');
  let departY = null;
  let ecart = 0;
  ecran.addEventListener('touchstart', (ev) => {
    departY = window.scrollY <= 0 ? ev.touches[0].clientY : null;
    ecart = 0;
  }, { passive: true });
  ecran.addEventListener('touchmove', (ev) => {
    if (departY === null) return;
    ecart = Math.max(0, ev.touches[0].clientY - departY);
    tirage.style.height = `${Math.min(ecart, SEUIL_TIRAGE * 1.3) * 0.6}px`;
    tirage.classList.toggle('pret', ecart > SEUIL_TIRAGE);
  }, { passive: true });
  ecran.addEventListener('touchend', () => {
    if (departY === null) return;
    tirage.style.height = '0px';
    tirage.classList.remove('pret');
    if (ecart > SEUIL_TIRAGE) rafraichir();
    departY = null;
  });

  // 5.5 : cache affiché tout de suite, puis appel à l'API s'il a plus de 5 min (ENF-11).
  fil = await lireFilEnCache();
  if (fil) rendre();
  else liste.innerHTML = squelette() + squelette(); // ENF-22 : chargement
  if (!fil || estPerime(fil.charge_le)) await rafraichir();
}
