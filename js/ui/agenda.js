// Écran E-04 "Agenda" : vues mois (F-30), semaine (F-31) et 30 jours (F-35), prévu en contour et réalisé
// en plein (F-32), totaux de la période (F-33), détail d'un jour (F-34). Cache d'abord (5.5, ENF-06, ENF-11).

import { lirePeriodeEnCache, rafraichirPeriode } from '../api/agenda.js';
import { VUES, periodeAgenda, deplacerPeriode, libellePeriode, elementsParJour } from '../logique/agenda.js';
import { totauxPeriode } from '../logique/totaux.js';
import { estPerime } from '../logique/activites.js';
import { grilleMois, jourISO, ajouterJours } from '../logique/dates.js';
import { sport } from '../logique/sports.js';
import {
  echapperHtml, formaterDateHeure, formaterDistance, formaterDureeLongue, formaterEntier,
} from '../logique/format.js';
import {
  bandeauHorsLigne, carteActivite, carteSeancePrevue, messageErreurApi, squelette, stat, boutonIcone,
} from './composants.js';
import { icone } from './icones.js';

// date = période affichée ; jour = jour choisi dans la vue mois (F-34), facultatif.
const lien = (vue, date, jour = null) => `#/agenda?vue=${vue}&date=${date}${jour ? `&jour=${jour}` : ''}`;

// F-33 : totaux du réalisé sur la période affichée.
function blocTotaux(activites) {
  const t = totauxPeriode(activites);
  return `<div class="carte"><div class="stats totaux-agenda">
    ${stat('Durée', formaterDureeLongue(t.duree_s))}
    ${stat('Distance', formaterDistance(t.distance_m, 'VELO') ?? '0,00 km')}
    ${stat('Dénivelé +', `${formaterEntier(t.denivele_m)} m`)}
    ${stat('Activités', String(t.nombre))}
  </div></div>`;
}

// Prévu puis réalisé d'un jour (F-31, F-34) ; activités cliquables vers leur détail.
function contenuJour(elements) {
  if (!elements || (!elements.prevues.length && !elements.activites.length)) return '<p class="doux jour-vide">Rien ce jour-là.</p>';
  return elements.prevues.map(carteSeancePrevue).join('') + elements.activites.map((a) => carteActivite(a)).join('');
}

// F-30 : grille du mois ; points pleins = activités, cercles = séances prévues (F-32).
function vueMois(date, parJour, jourChoisi, aujourdhui) {
  const cases = grilleMois(date).flat().map((d) => {
    if (!d) return '<span class="case-agenda vide"></span>';
    const e = parJour[d] ?? { prevues: [], activites: [] };
    const marques = e.activites.slice(0, 3).map((a) => `<span class="point sport-${a.sport}"></span>`).join('')
      + e.prevues.slice(0, 2).map((p) => `<span class="cercle sport-${p.sport}"></span>`).join('');
    const libelle = [`${Number(d.slice(8, 10))}`,
      e.activites.length ? `${e.activites.length} réalisée(s) : ${e.activites.map((a) => sport(a.sport).libelle).join(', ')}` : '',
      e.prevues.length ? `${e.prevues.length} prévue(s)` : ''].filter(Boolean).join(', ');
    return `<button type="button" class="case-agenda${d === aujourdhui ? ' aujourdhui' : ''}${d === jourChoisi ? ' choisi' : ''}"
      data-jour="${d}" aria-label="${echapperHtml(libelle)}" aria-pressed="${d === jourChoisi}">
      <span class="mini-numero">${Number(d.slice(8, 10))}</span><span class="marques">${marques}</span></button>`;
  }).join('');
  return `<div class="grille-agenda" role="group" aria-label="Jours du mois">
    ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j) => `<span class="mini-entete" aria-hidden="true">${j}</span>`).join('')}${cases}</div>
    <div class="legende"><span class="legende-plein">Réalisé</span><span class="legende-contour">Prévu</span></div>`;
}

// F-31 / F-35 : liste jour par jour. En semaine, tous les jours ; sur 30 jours, seulement les jours occupés.
function vueListe(debut, fin, parJour, aujourdhui, tousLesJours) {
  const jours = [];
  for (let d = debut; d <= fin; d = ajouterJours(d, 1)) if (tousLesJours || parJour[d]) jours.push(d);
  if (!jours.length) return '<p class="doux jour-vide">Rien sur cette période.</p>';
  return jours.map((d) => `<section class="jour-agenda">
    <h2 class="titre-jour${d === aujourdhui ? ' aujourdhui' : ''}">${echapperHtml(formaterDateHeure(d, null))}${d === aujourdhui ? ' · aujourd\'hui' : ''}</h2>
    ${contenuJour(parJour[d])}
    ${tousLesJours ? `<a class="lien-action lien-programmer" href="#/seance/nouvelle?date=${d}">${icone('plus', 18)} Programmer</a>` : ''}</section>`).join('');
}

export async function afficherAgenda(conteneur, segments, params = {}) {
  const aujourdhui = jourISO();
  const vue = VUES.some((v) => v.code === params.vue) ? params.vue : 'mois';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : aujourdhui;
  const { debut, fin } = periodeAgenda(vue, date);
  const contientAujourdhui = aujourdhui >= debut && aujourdhui <= fin;
  // Mois : jour choisi = paramètre "jour" s'il est dans le mois, sinon aujourd'hui s'il y est.
  const jourDemande = /^\d{4}-\d{2}-\d{2}$/.test(params.jour ?? '') && params.jour >= debut && params.jour <= fin ? params.jour : null;
  let jourChoisi = vue === 'mois' ? (jourDemande ?? (contientAujourdhui ? aujourdhui : null)) : null;

  conteneur.innerHTML = `
    <div class="entete"><h1 class="titre-ecran">Agenda</h1>
      ${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}</div>
    <nav class="onglets-vue" aria-label="Vue de l'agenda">
      ${VUES.map((v) => `<a href="${lien(v.code, date)}" class="${v.code === vue ? 'actif' : ''}" ${v.code === vue ? 'aria-current="page"' : ''}>${v.libelle}</a>`).join('')}
    </nav>
    <div class="navigation-periode">
      ${boutonIcone('precedent', 'Période précédente', { href: lien(vue, deplacerPeriode(vue, date, -1)) })}
      <span class="libelle-periode">${echapperHtml(libellePeriode(vue, debut, fin))}</span>
      ${boutonIcone('suivant', 'Période suivante', { href: lien(vue, deplacerPeriode(vue, date, 1)) })}
    </div>
    ${contientAujourdhui ? '' : `<div class="retour-aujourdhui"><a class="bouton" href="${lien(vue, aujourdhui)}">Revenir à aujourd'hui</a></div>`}
    <div id="etat"></div>
    <div id="totaux"></div>
    <div id="contenu"></div>
    <div id="jour"></div>`;

  const $ = (sel) => conteneur.querySelector(sel);
  const contenu = $('#contenu');
  let donnees = null;

  // F-34 : liste du jour choisi sous la grille du mois.
  function afficherJour() {
    if (vue !== 'mois' || !donnees) return;
    const parJour = elementsParJour(donnees.activites, donnees.prevues);
    $('#jour').innerHTML = jourChoisi
      ? `<h2 class="titre-jour">${echapperHtml(formaterDateHeure(jourChoisi, null))}</h2>${contenuJour(parJour[jourChoisi])}
        <a class="bouton bouton-programmer" href="#/seance/nouvelle?date=${jourChoisi}">${icone('plus', 18)} Programmer ce jour</a>`
      : '';
  }

  function afficher() {
    const parJour = elementsParJour(donnees.activites, donnees.prevues);
    $('#totaux').innerHTML = blocTotaux(donnees.activites);
    contenu.innerHTML = vue === 'mois'
      ? vueMois(date, parJour, jourChoisi, aujourdhui)
      : vueListe(debut, fin, parJour, aujourdhui, vue === 'semaine');
    afficherJour();
  }

  async function rafraichir() {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      const frais = await rafraichirPeriode(debut, fin);
      if (!conteneur.contains(contenu)) return; // écran quitté entre-temps
      donnees = frais;
      $('#etat').innerHTML = '';
      afficher();
    } catch (e) {
      if (!conteneur.contains(contenu)) return;
      if (donnees && e.type !== 'IDENTIFIANTS') {
        $('#etat').innerHTML = bandeauHorsLigne(donnees.charge_le); // ENF-06
      } else {
        $('#etat').innerHTML = messageErreurApi(e); // ENF-22
        if (!donnees) contenu.innerHTML = '<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>';
        $('#reessayer')?.addEventListener('click', () => { contenu.innerHTML = squelette(); rafraichir(); });
      }
    } finally {
      bouton?.classList.remove('tourne');
    }
  }

  // Toucher un jour du mois (F-34) : l'adresse garde le jour choisi sans recharger l'écran.
  contenu.addEventListener('click', (ev) => {
    const caseJour = ev.target.closest('[data-jour]');
    if (!caseJour) return;
    jourChoisi = caseJour.dataset.jour;
    history.replaceState(null, '', lien('mois', date, jourChoisi));
    contenu.querySelectorAll('.case-agenda.choisi').forEach((c) => { c.classList.remove('choisi'); c.setAttribute('aria-pressed', 'false'); });
    caseJour.classList.add('choisi');
    caseJour.setAttribute('aria-pressed', 'true');
    afficherJour();
  });
  $('#rafraichir').addEventListener('click', rafraichir);

  donnees = await lirePeriodeEnCache(debut, fin);
  if (donnees) afficher();
  else contenu.innerHTML = squelette() + squelette(); // ENF-22 : chargement
  if (!donnees || estPerime(donnees.charge_le)) await rafraichir();
}
