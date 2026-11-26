// Écran E-12 "Performances" (lot LP, D-34), ouvert depuis le Profil : un onglet par sport (Vélo, Course, Natation),
// une période (42 jours, 90 jours, cette année, tout) et le tableau des records (F-114) : puissance par durée
// (F-110, F-111) en W ou en W/kg, temps par distance (F-111, F-112), avec la date et un lien vers l'activité.
// Adresse : #/performances?sport=VELO&periode=42j (valeurs contrôlées, D-21).

import { lirePerformances } from '../api/performances.js';
import { SPORTS_PERF, PERIODES_PERF, periodeValide } from '../logique/performances.js';
import { libelleEffort } from '../logique/analyse.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDuree, formaterVitesse, formaterEntier, formaterDate } from '../logique/format.js';
import { bandeauHorsLigne, messageErreurApi, squelette, boutonIcone } from './composants.js';
import { iconeSport } from './icones.js';

const lien = (s, p) => `#/performances?sport=${s}&periode=${p}`;

function celluleActivite(r) {
  if (!r.activite_id) return '<td></td>';
  const date = r.date ? formaterDate(r.date) : 'Voir';
  return `<td><a href="#/activite/${encodeURIComponent(r.activite_id)}?onglet=top" aria-label="${echapperHtml(r.titre ?? 'Activité')} du ${echapperHtml(date)}">${echapperHtml(date)}</a></td>`;
}

function tableauPuissance(records, poids, enWkg) {
  if (!records.length) return '';
  const valeur = (w) => (enWkg && poids ? `${String(Math.round((w / poids) * 100) / 100).replace('.', ',')} W/kg` : `${formaterEntier(w)} W`);
  return `<div class="carte"><div class="carte-ligne"><h2>Puissance</h2>
      ${poids ? `<div class="bascule" role="group" aria-label="Unité">
        <button type="button" data-unite="w" class="${enWkg ? '' : 'actif'}" aria-pressed="${!enWkg}">W</button>
        <button type="button" data-unite="wkg" class="${enWkg ? 'actif' : ''}" aria-pressed="${enWkg}">W/kg</button></div>` : ''}</div>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Durée</th><th scope="col">Record</th><th scope="col">Date</th></tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(valeur(r.valeur))}</td>${celluleActivite(r)}</tr>`).join('')}</tbody></table></div></div>`;
}

function tableauAllure(records, sportCode) {
  if (!records.length) return '';
  return `<div class="carte"><h2>${sportCode === 'NATATION' ? 'Natation' : 'Course'}</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Distance</th><th scope="col">Temps</th><th scope="col">Allure</th><th scope="col">Date</th></tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(formaterDuree(r.temps_s) ?? '')}</td>
      <td>${echapperHtml(formaterVitesse(sportCode, r.distance, r.temps_s) ?? '')}</td>${celluleActivite(r)}</tr>`).join('')}</tbody></table></div></div>`;
}

export async function afficherPerformances(conteneur, segments, params = {}) {
  const sportCode = SPORTS_PERF.some((s) => s.code === params.sport) ? params.sport : 'VELO';
  const periode = periodeValide(params.periode);
  let enWkg = false;
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/profil' })}
      <span class="titre-petit">Performances</span>${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}</div>
    <nav class="onglets-vue" aria-label="Sport">
      ${SPORTS_PERF.map((s) => `<a href="${lien(s.code, periode)}" class="sport-${s.code}${s.code === sportCode ? ' actif' : ''}"${s.code === sportCode ? ' aria-current="page"' : ''}>${iconeSport(s.code, 16)} ${echapperHtml(sport(s.code).libelle)}</a>`).join('')}
    </nav>
    <nav class="onglets-vue onglets-periode" aria-label="Période">
      ${PERIODES_PERF.map((p) => `<a href="${lien(sportCode, p.code)}" class="${p.code === periode ? 'actif' : ''}"${p.code === periode ? ' aria-current="page"' : ''}>${echapperHtml(p.libelle)}</a>`).join('')}
    </nav>
    <div id="etat"></div>
    <div id="records">${squelette()}${squelette()}</div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#records');
  let donnees = null;

  function afficher() {
    const html = tableauPuissance(donnees.puissance, donnees.poids_kg, enWkg) + tableauAllure(donnees.allure, sportCode);
    zone.innerHTML = html || '<div class="carte"><p class="doux">Aucun record sur cette période.</p></div>';
    zone.querySelectorAll('[data-unite]').forEach((b) => b.addEventListener('click', () => { enWkg = b.dataset.unite === 'wkg'; afficher(); }));
    $('#etat').innerHTML = donnees.horsLigne ? bandeauHorsLigne(donnees.charge_le) : '';
  }

  async function charger(forcer = false) {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      donnees = await lirePerformances(sportCode, periode, { forcer });
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
