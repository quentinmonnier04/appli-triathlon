// Écran E-12 "Performances" (lot LP, D-34, D-35), ouvert depuis le Profil : un onglet par sport (Vélo, Course,
// Natation) et les records de tous les temps (F-114) : puissance par durée (F-110, F-111) en W et en W/kg côte à côte,
// temps et allure par distance (F-111, F-112). Sans date ni choix de période (D-35).
// Adresse : #/performances?sport=VELO (valeur contrôlée, D-21).

import { lirePerformances } from '../api/performances.js';
import { SPORTS_PERF } from '../logique/performances.js';
import { libelleEffort } from '../logique/analyse.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDuree, formaterVitesse, formaterEntier } from '../logique/format.js';
import { bandeauHorsLigne, messageErreurApi, squelette, boutonIcone } from './composants.js';
import { iconeSport } from './icones.js';

// D-35 : records de tous les temps seulement.
const PERIODE = 'tout';
const lien = (s) => `#/performances?sport=${s}`;

function tableauPuissance(records, poids) {
  if (!records.length) return '';
  const wkg = (w) => (poids ? String(Math.round((w / poids) * 100) / 100).replace('.', ',') : '');
  return `<div class="carte"><h2>Puissance</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Durée</th><th scope="col">W</th>${poids ? '<th scope="col">W/kg</th>' : ''}</tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(formaterEntier(r.valeur))}</td>${poids ? `<td>${echapperHtml(wkg(r.valeur))}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
}

function tableauAllure(records, sportCode) {
  if (!records.length) return '';
  return `<div class="carte"><h2>${sportCode === 'NATATION' ? 'Natation' : 'Course'}</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Distance</th><th scope="col">Temps</th><th scope="col">Allure</th></tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(formaterDuree(r.temps_s) ?? '')}</td>
      <td>${echapperHtml(formaterVitesse(sportCode, r.distance, r.temps_s) ?? '')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

export async function afficherPerformances(conteneur, segments, params = {}) {
  const sportCode = SPORTS_PERF.some((s) => s.code === params.sport) ? params.sport : 'VELO';
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/profil' })}
      <span class="titre-petit">Performances</span>${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}</div>
    <nav class="onglets-vue" aria-label="Sport">
      ${SPORTS_PERF.map((s) => `<a href="${lien(s.code)}" class="sport-${s.code}${s.code === sportCode ? ' actif' : ''}"${s.code === sportCode ? ' aria-current="page"' : ''}>${iconeSport(s.code, 16)} ${echapperHtml(sport(s.code).libelle)}</a>`).join('')}
    </nav>
    <p class="doux">Tes records de tous les temps, calculés par Intervals.icu.</p>
    <div id="etat"></div>
    <div id="records">${squelette()}${squelette()}</div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#records');
  let donnees = null;

  function afficher() {
    const html = tableauPuissance(donnees.puissance, donnees.poids_kg) + tableauAllure(donnees.allure, sportCode);
    zone.innerHTML = html || '<div class="carte"><p class="doux">Aucun record pour ce sport.</p></div>';
    $('#etat').innerHTML = donnees.horsLigne ? bandeauHorsLigne(donnees.charge_le) : '';
  }

  async function charger(forcer = false) {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      donnees = await lirePerformances(sportCode, PERIODE, { forcer });
      if (!conteneur.contains(zone)) return;
      afficher();
    } catch (e) {
      if (!conteneur.contains(zone)) return;
      zone.innerHTML = messageErreurApi(e);
    } finally {
      bouton?.classList.remove('tourne');
    }
  }
  $('#rafraichir').addEventListener('click', () => charger(true));
  await charger();
}
