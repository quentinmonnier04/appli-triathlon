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

// Carte d'une séance prévue, dessinée en contour pour la distinguer du réalisé (F-32).
export function carteSeancePrevue(s) {
  const details = [formaterDuree(s.duree_s), formaterDistance(s.distance_m, s.sport)].filter(Boolean).join(' · ');
  const sp = sport(s.sport);
  return `<div class="carte carte-prevue sport-${sp.code}">
    <div class="carte-activite-tete"><span class="pastille pastille-contour sport-${sp.code}" role="img" aria-label="${echapperHtml(sp.libelle)}">${sp.icone}</span>
      <div class="carte-activite-titre"><strong>${echapperHtml(s.titre)}</strong>
        <span class="doux">Prévu · ${echapperHtml(sp.libelle)}${details ? ' · ' + echapperHtml(details) : ''}</span></div></div>
    ${s.description ? `<p class="description-seance">${echapperHtml(s.description)}</p>` : ''}</div>`;
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
