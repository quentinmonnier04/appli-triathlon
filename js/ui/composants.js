// Composants d'affichage partagés (ENF-22). Produisent du HTML ; aucun calcul métier.

import { echapperHtml } from '../logique/format.js';
import { MESSAGES } from '../logique/messages.js';

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
