// Composants d'affichage partagés (ENF-22). Produisent du HTML ; aucun calcul métier.

import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterDateHeure, formaterHorodatage, formaterEntier,
} from '../logique/format.js';
import { MESSAGES, formaterMessage } from '../logique/messages.js';
import { sport } from '../logique/sports.js';

// Message d'état : type 'succes', 'erreur' ou 'info' ; le texte est échappé.
export function message(type, texte, lienHtml = '') {
  const icone = { succes: '✅', erreur: '⚠️', info: 'ℹ️' }[type];
  return `<div class="message ${type}" role="${type === 'erreur' ? 'alert' : 'status'}">
    <span aria-hidden="true">${icone}</span><span>${echapperHtml(texte)}${lienHtml ? ' ' + lienHtml : ''}</span></div>`;
}

// Message correspondant à une ErreurApi (5.4, 9.5) : M-02 pour les identifiants, M-07 sinon.
// lienReglages : ajoute le lien vers Réglages (inutile quand on y est déjà).
export function messageErreurApi(erreur, { lienReglages = true } = {}) {
  if (erreur?.type === 'IDENTIFIANTS') {
    return message('erreur', MESSAGES['M-02'], lienReglages ? '<a href="#/reglages">Ouvrir les réglages</a>' : '');
  }
  return message('erreur', MESSAGES['M-07']);
}

// Squelette de chargement (ENF-22).
export function squelette() {
  return '<div class="carte" aria-busy="true" aria-label="Chargement"><div class="squelette grand"></div><div class="squelette"></div><div class="squelette"></div></div>';
}

// Bandeau hors ligne avec la date des données affichées (ENF-06, M-03).
export function bandeauHorsLigne(chargeLe) {
  return message('info', formaterMessage('M-03', formaterHorodatage(chargeLe)));
}

// Pastille ronde à la couleur du sport, avec son icône (ENF-18, ENF-19 : couleur + icône).
export function pastilleSport(code) {
  const s = sport(code);
  return `<span class="pastille sport-${s.code}" role="img" aria-label="${echapperHtml(s.libelle)}">${s.icone}</span>`;
}

// Une statistique : petite étiquette et valeur ; rien si la valeur est absente.
export function stat(etiquette, valeur) {
  if (valeur === null || valeur === undefined) return '';
  return `<div class="stat"><span class="stat-valeur">${echapperHtml(valeur)}</span><span class="stat-etiquette">${echapperHtml(etiquette)}</span></div>`;
}

// Carte d'une séance prévue, dessinée en contour pour la distinguer du réalisé (F-32) ; elle ouvre la modification (F-43).
export function carteSeancePrevue(s) {
  const details = [formaterDuree(s.duree_s), formaterDistance(s.distance_m, s.sport)].filter(Boolean).join(' · ');
  const sp = sport(s.sport);
  return `<a class="carte carte-prevue sport-${sp.code}" href="#/seance/${encodeURIComponent(s.id)}">
    <div class="carte-activite-tete"><span class="pastille pastille-contour sport-${sp.code}" role="img" aria-label="${echapperHtml(sp.libelle)}">${sp.icone}</span>
      <div class="carte-activite-titre"><strong>${echapperHtml(s.titre)}</strong>
        <span class="doux">Prévu · ${echapperHtml(sp.libelle)}${details ? ' · ' + echapperHtml(details) : ''}</span></div></div>
    ${s.description ? `<p class="description-seance">${echapperHtml(s.description)}</p>` : ''}</a>`;
}

// Carte d'une activité dans le fil (F-11) : sport, titre, date et heure, distance, durée, vitesse ou allure, charge.
export function carteActivite(a) {
  const vitesse = formaterVitesse(a.sport, a.distance_m, a.duree_s);
  return `<a class="carte carte-activite" href="#/activite/${encodeURIComponent(a.id)}">
    <div class="carte-activite-tete">${pastilleSport(a.sport)}
      <div class="carte-activite-titre"><strong>${echapperHtml(a.titre)}</strong>
        <span class="doux">${echapperHtml(formaterDateHeure(a.date, a.heure))}</span></div>
      ${a.charge !== null && a.charge !== undefined ? `<span class="badge-charge" title="Charge">${formaterEntier(a.charge)}<small>charge</small></span>` : ''}</div>
    <div class="stats stats-carte">
      ${stat('Distance', formaterDistance(a.distance_m, a.sport))}
      ${stat('Durée', formaterDuree(a.duree_s))}
      ${stat(a.sport === 'VELO' ? 'Vitesse' : 'Allure', vitesse)}
    </div></a>`;
}

// Groupe de boutons à choix unique (F-60, F-62) : options [{ valeur, libelle, icone? }].
// "court" : affiche la valeur au lieu du libellé (grille du RPE), le libellé passe en info-bulle.
export function groupeChoix(champ, etiquette, options, valeur, { court = false } = {}) {
  return `<div class="champ"><span class="etiquette-champ" id="etiquette-${champ}">${echapperHtml(etiquette)}</span>
    <div class="choix-groupe${court ? ' choix-court' : ''}${options.length === 4 ? ' choix-quatre' : ''}" role="radiogroup" aria-labelledby="etiquette-${champ}">
      ${options.map((o) => `<button type="button" class="filtre" role="radio" aria-checked="${o.valeur === valeur}"
        data-champ="${champ}" data-valeur="${o.valeur}"${court ? ` title="${echapperHtml(o.libelle)}" aria-label="${o.valeur} : ${echapperHtml(o.libelle)}"` : ''}>
        ${o.icone ? `<span aria-hidden="true">${o.icone}</span> ` : ''}${court ? o.valeur : echapperHtml(o.libelle)}</button>`).join('')}
    </div><div class="aide" id="aide-${champ}"></div></div>`;
}

// Branche les groupes de choix d'un formulaire : un appui choisit, un second appui retire le choix.
// surChangement(champ, valeur ou null) est appelé à chaque changement.
export function brancherChoix(racine, surChangement) {
  racine.querySelectorAll('[role="radio"][data-champ]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      const champ = bouton.dataset.champ;
      const choisi = bouton.getAttribute('aria-checked') !== 'true';
      racine.querySelectorAll(`[data-champ="${champ}"]`).forEach((b) => b.setAttribute('aria-checked', 'false'));
      bouton.setAttribute('aria-checked', String(choisi));
      surChangement(champ, choisi ? Number(bouton.dataset.valeur) : null);
    });
  });
}

// ENF-07 : sans réseau, les boutons d'écriture sont désactivés avec le message M-04.
// Les écouteurs se retirent d'eux-mêmes quand le formulaire quitte la page.
export function surveillerReseau(formulaire, zoneMessage, boutons) {
  function maj() {
    if (!formulaire.isConnected) {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
      return;
    }
    const enLigne = navigator.onLine;
    zoneMessage.innerHTML = enLigne ? '' : message('info', MESSAGES['M-04']);
    boutons.forEach((b) => { b.disabled = !enLigne; });
  }
  window.addEventListener('online', maj);
  window.addEventListener('offline', maj);
  maj();
}
