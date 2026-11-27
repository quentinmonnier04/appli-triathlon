// Écran E-14 "Contrôle des calculs" (lot LC1 : F-122, F-123, D-42), ouvert depuis Réglages.
// Lance le calcul de la charge de chaque séance par l'appli (barre de progression la première fois), compare la charge
// et la forme de l'appli à celles d'Intervals.icu, et permet de choisir quels chiffres l'appli affiche.

import {
  chargesAJour, lireChargesEnCache, formeDesCharges, lireSourceCalculs, enregistrerSourceCalculs,
} from '../api/charge.js';
import { chargerFormes } from '../api/wellness.js';
import { resumesAJour } from '../api/efforts.js';
import { ecartsCharges, LIBELLES_METHODE } from '../logique/charge.js';
import { derniereForme } from '../logique/forme.js';
import { sport } from '../logique/sports.js';
import { jourISO, ajouterJours } from '../logique/dates.js';
import { echapperHtml, formaterDate, formaterEntier } from '../logique/format.js';
import { message, messageErreurApi, boutonIcone, pastilleSport } from './composants.js';

function carteForme(appli, intervals) {
  const ligne = (libelle, a, b) => `<tr><th scope="row">${libelle}</th><td>${echapperHtml(formaterEntier(a))}</td><td>${b === null || b === undefined ? '' : echapperHtml(formaterEntier(b))}</td></tr>`;
  return `<div class="carte"><h2>Forme aujourd'hui</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col"></th><th scope="col">Appli</th><th scope="col">Intervals.icu</th></tr></thead>
    <tbody>${ligne('CTL', appli.ctl, intervals?.ctl)}${ligne('ATL', appli.atl, intervals?.atl)}${ligne('TSB', appli.tsb, intervals?.tsb)}</tbody></table></div></div>`;
}

function carteSeances(charges) {
  const ecarts = ecartsCharges(charges);
  const recentes = [...charges].sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 25);
  return `<div class="carte"><h2>Charge des séances</h2>
    ${ecarts ? `<p class="doux">Écart moyen : <strong>${echapperHtml(formaterEntier(ecarts.ecart_moyen))} points</strong> (${echapperHtml(formaterEntier(ecarts.ecart_pct))} %) sur ${echapperHtml(formaterEntier(ecarts.nb))} séances.</p>` : ''}
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Date</th><th scope="col">Appli</th><th scope="col">Intervals.icu</th><th scope="col">Méthode</th></tr></thead>
    <tbody>${recentes.map((c) => `<tr><th scope="row"><span class="cellule-sport">${pastilleSport(c.sport)} ${echapperHtml(formaterDate(c.date))}</span></th>
      <td>${c.charge === null ? '-' : echapperHtml(formaterEntier(c.charge))}</td>
      <td>${c.charge_intervals === null ? '-' : echapperHtml(formaterEntier(c.charge_intervals))}</td>
      <td class="doux">${echapperHtml(LIBELLES_METHODE[c.methode] ?? 'Non calculée')}</td></tr>`).join('')}</tbody></table></div>
    <p class="doux petit-texte">De petits écarts sont normaux : Intervals.icu ne publie pas ses formules exactes. « Non calculée » : ni puissance, ni allure, ni FC, ni RPE avec un seuil connu.</p></div>`;
}

export async function afficherControle(conteneur) {
  let source = await lireSourceCalculs();
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/reglages' })}
      <span class="titre-petit">Calculs de l'appli</span><span class="espace-bouton"></span></div>
    <p class="doux">L'appli calcule elle-même la charge de chaque séance, ta forme, tes zones et tes records, à partir des données brutes. Compare avec Intervals.icu, puis choisis les chiffres affichés.</p>
    <div class="carte"><h2 id="titre-source">Chiffres affichés</h2>
      <div class="bascule large" role="group" aria-labelledby="titre-source">
        <button type="button" data-source="intervals">Intervals.icu</button><button type="button" data-source="appli">Appli</button></div>
      <p class="doux petit-texte" id="aide-source"></p></div>
    <div class="pile"><button type="button" class="bouton principal" id="calculer">Calculer</button></div>
    <div id="progression" class="doux" aria-live="polite"></div>
    <div id="resultats"></div>`;
  const $ = (sel) => conteneur.querySelector(sel);

  function majSource() {
    conteneur.querySelectorAll('[data-source]').forEach((b) => {
      const actif = b.dataset.source === source;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', String(actif));
    });
    $('#aide-source').textContent = source === 'appli'
      ? "Forme, bilan de la semaine, zones, meilleurs efforts et records utilisent les calculs de l'appli (records : 12 derniers mois)."
      : "L'appli affiche encore les chiffres d'Intervals.icu. Passe sur « Appli » quand les écarts te conviennent.";
  }
  conteneur.querySelectorAll('[data-source]').forEach((b) => b.addEventListener('click', async () => {
    source = b.dataset.source;
    await enregistrerSourceCalculs(source);
    majSource();
  }));
  majSource();

  async function afficherResultats(donnees) {
    const jour = jourISO();
    const appli = formeDesCharges(donnees, jour).at(-1);
    const intervals = derniereForme(await chargerFormes(ajouterJours(jour, -3), jour).catch(() => []));
    if (!conteneur.isConnected) return;
    $('#resultats').innerHTML = carteForme(appli, intervals) + carteSeances(donnees.charges);
  }

  $('#calculer').addEventListener('click', async () => {
    const bouton = $('#calculer');
    bouton.disabled = true;
    $('#progression').textContent = 'Calcul en cours...'; // ENF-10
    try {
      const donnees = await chargesAJour({
        forcer: true,
        surProgres: (fait, total) => { $('#progression').textContent = `Calcul : ${fait} / ${total} séances`; },
      });
      if (!conteneur.isConnected) return;
      // LC3 : résumés des 12 derniers mois (records) ; les séances déjà téléchargées ne le sont pas une deuxième fois.
      const resumes = await resumesAJour({
        forcer: true,
        surProgres: (fait, total) => { $('#progression').textContent = `Records : ${fait} / ${total} séances`; },
      });
      if (!conteneur.isConnected) return;
      $('#progression').innerHTML = message('succes', `${donnees.charges.length} séances calculées, records sur ${resumes.resumes.length} séances.`);
      await afficherResultats(donnees);
    } catch (e) {
      $('#progression').innerHTML = messageErreurApi(e);
    } finally {
      bouton.disabled = false;
    }
  });

  const cache = await lireChargesEnCache();
  if (cache) await afficherResultats(cache);
  else $('#progression').textContent = 'Pas encore de calcul : touche « Calculer ». La première fois, toutes les séances des 5 derniers mois sont analysées.';
}
