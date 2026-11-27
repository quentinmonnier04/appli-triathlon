// Écran E-12 "Performances" (lot LP, D-34, D-35), ouvert depuis le Profil : un onglet par sport (Vélo, Course,
// Natation) et les records de tous les temps (F-114) : puissance par durée (F-110, F-111) en W et en W/kg côte à côte,
// temps et allure par distance (F-111, F-112). Sans date ni choix de période (D-35).
// Adresse : #/performances?sport=VELO (valeur contrôlée, D-21).

import { lirePerformances, lireEftp } from '../api/performances.js';
import { lireSourceCalculs } from '../api/charge.js';
import { resumesAJour } from '../api/efforts.js';
import { agregerRecords } from '../logique/efforts.js';
import { SPORTS_PERF as SPORTS_P, DUREES_RECORDS, DISTANCES_RECORDS, DUREES_FC } from '../logique/performances.js';
import { SPORTS_PERF, formaterWkg, resumeEftp } from '../logique/performances.js';
import { graduations } from '../logique/analyse.js';
import { joursEntre } from '../logique/dates.js';
import { libelleEffort } from '../logique/analyse.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDuree, formaterVitesse, formaterEntier, formaterDate } from '../logique/format.js';
import { bandeauHorsLigne, messageErreurApi, squelette, boutonIcone } from './composants.js';
import { iconeSport } from './icones.js';

// D-35 : records de tous les temps seulement.
const PERIODE = 'tout';
const lien = (s) => `#/performances?sport=${s}`;

function tableauPuissance(records, poids) {
  if (!records.length) return '';
  const wkg = (w, p = poids) => formaterWkg(w, p) ?? '';
  return `<div class="carte"><h2>Puissance</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Durée</th><th scope="col">W</th>${poids ? '<th scope="col">W/kg</th>' : ''}</tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(formaterEntier(r.valeur))}</td>${poids ? `<td>${echapperHtml(wkg(r.valeur, r.poids_kg ?? poids))}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
}

function tableauAllure(records, sportCode) {
  if (!records.length) return '';
  return `<div class="carte"><h2>${sportCode === 'NATATION' ? 'Natation' : 'Course'}</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Distance</th><th scope="col">Temps</th><th scope="col">Allure</th></tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(formaterDuree(r.temps_s) ?? '')}</td>
      <td>${echapperHtml(formaterVitesse(sportCode, r.distance, r.temps_s) ?? '')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// F-113 : FC maximale tenue selon la durée.
function tableauFc(records) {
  if (!records?.length) return '';
  return `<div class="carte"><h2>Fréquence cardiaque</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Durée</th><th scope="col">FC max tenue</th></tr></thead>
    <tbody>${records.map((r) => `<tr><th scope="row">${echapperHtml(libelleEffort(r))}</th><td>${echapperHtml(`${formaterEntier(r.valeur)} bpm`)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// F-115 : eFTP sur la dernière année : valeur actuelle, écart depuis un an, petite courbe.
function carteEftp(serie, sportCode, largeurDispo) {
  const r = resumeEftp(serie);
  if (!r) return '';
  const largeur = Math.max(240, Math.round(largeurDispo));
  const hauteur = 80;
  const g = graduations(Math.min(...serie.map((p) => p.eftp)), r.max, 2);
  const total = joursEntre(serie[0].date, serie[serie.length - 1].date) || 1;
  const versX = (d) => (joursEntre(serie[0].date, d) / total) * largeur;
  const versY = (v) => hauteur - 4 - ((v - g.min) / ((g.max - g.min) || 1)) * (hauteur - 8);
  const points = serie.map((p) => [Math.round(versX(p.date) * 10) / 10, Math.round(versY(p.eftp) * 10) / 10]);
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
  const signe = r.ecart > 0 ? '+' : r.ecart < 0 ? '-' : '';
  return `<div class="carte sport-${echapperHtml(sportCode)}"><h2>eFTP</h2>
    <div class="forme-valeur"><span class="chiffre-forme">${echapperHtml(formaterEntier(r.actuel))}</span><span class="phrase-forme">W</span>
      <span class="doux">${echapperHtml(`${signe}${formaterEntier(Math.abs(r.ecart))} W depuis le ${formaterDate(r.depuis)}`)}</span></div>
    <svg class="graphique-courbe" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img"
      aria-label="${echapperHtml(`eFTP sur un an : de ${r.debut} W à ${r.actuel} W, au plus haut ${r.max} W`)}">
      <path class="trace-ligne trace-seance" d="${d}"></path></svg>
    <p class="doux petit-texte">eFTP estimée au fil de tes séances.</p></div>`;
}

export async function afficherPerformances(conteneur, segments, params = {}) {
  const sportCode = SPORTS_PERF.some((s) => s.code === params.sport) ? params.sport : 'VELO';
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/profil' })}
      <span class="titre-petit">Performances</span>${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}</div>
    <nav class="onglets-vue" aria-label="Sport">
      ${SPORTS_PERF.map((s) => `<a href="${lien(s.code)}" class="sport-${s.code}${s.code === sportCode ? ' actif' : ''}"${s.code === sportCode ? ' aria-current="page"' : ''}>${iconeSport(s.code, 16)} ${echapperHtml(sport(s.code).libelle)}</a>`).join('')}
    </nav>
    <p class="doux" id="intro-records">Tes records de tous les temps.</p>
    <div id="etat"></div>
    <div id="records">${squelette()}${squelette()}</div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#records');
  let donnees = null;
  let eftp = [];

  // LC3 (F-130) : records des 12 derniers mois calculés par l'appli à partir du résumé de chaque séance.
  async function recordsAppli(forcer) {
    const sport = SPORTS_P.find((s) => s.code === sportCode);
    const r = await resumesAJour({
      forcer,
      surProgres: (fait, total) => { zone.innerHTML = `<div class="carte"><p class="doux">Calcul de tes records : ${fait} / ${total} séances...</p></div>`; },
    });
    const resumes = r.resumes.filter((x) => x.sport === sportCode);
    const records = agregerRecords(resumes, { durees: DUREES_RECORDS, dureesFc: DUREES_FC, distances: DISTANCES_RECORDS[sportCode] ?? [] });
    const poids = records.puissance.find((x) => x.poids_kg > 0)?.poids_kg ?? null;
    return {
      puissance: sport?.puissance ? records.puissance : [], allure: sport?.allure ? records.allure : [], fc: records.fc,
      poids_kg: poids, charge_le: r.charge_le, horsLigne: r.horsLigne, appli: true,
    };
  }

  function afficher() {
    const largeur = (zone.clientWidth || 340) - 32;
    $('#intro-records').textContent = donnees.appli ? 'Tes records des 12 derniers mois, calculés par l\'appli.' : 'Tes records de tous les temps.';
    const html = carteEftp(eftp, sportCode, largeur) + tableauPuissance(donnees.puissance, donnees.poids_kg)
      + tableauAllure(donnees.allure, sportCode) + tableauFc(donnees.fc);
    zone.innerHTML = html || '<div class="carte"><p class="doux">Aucun record pour ce sport.</p></div>';
    $('#etat').innerHTML = donnees.horsLigne ? bandeauHorsLigne(donnees.charge_le) : '';
  }

  async function charger(forcer = false) {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      const typeEftp = { VELO: 'Ride', CAP: 'Run' }[sportCode];
      const source = await lireSourceCalculs();
      [donnees, eftp] = await Promise.all([
        source === 'appli' ? recordsAppli(forcer) : lirePerformances(sportCode, PERIODE, { forcer }),
        typeEftp ? lireEftp(typeEftp).catch(() => []) : [],
      ]);
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
