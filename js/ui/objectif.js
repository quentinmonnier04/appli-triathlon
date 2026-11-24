// Écran E-09 "Objectif" (L8) : objectif (F-80), Mes séances et blocs (F-81, F-88, ui/blocs.js), réglages de
// progression (F-82), aperçu du plan semaine par semaine (F-83, F-84), envoi (F-85), régénération (F-86) et
// suppression (F-87). Écriture en ligne seulement (ENF-07). Route : #/objectif?bloc=N (bloc affiché).

import { lireObjectif, enregistrerObjectif, supprimerObjectif, SPORTS_OBJECTIF } from '../api/objectif.js';
import { lirePreparation, modifierPreparation } from '../api/preparation.js';
import { envoyerPlan, supprimerPlan } from '../api/plan.js';
import { lireAlluresSeuil } from '../api/profil.js';
import {
  validerReglages, validerObjectif, lireReglagesSaisis, lundiSuivant, plafondParDefaut, bornesPlan,
  volumeSeance_s, volumeSemaine_s, distanceSansAllure,
} from '../logique/plan.js';
import { genererPlanBlocs, grilleDuBloc, blocsVides, migrerAncienFormat } from '../logique/blocs.js';
import { jourISO, ajouterJours } from '../logique/dates.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDureeLongue } from '../logique/format.js';
import {
  message, messageErreurApi, squelette, pastilleSport, groupeChoix, brancherChoix, surveillerReseau, graphiqueSeance, boutonIcone,
} from './composants.js';
import { icone, iconeSport } from './icones.js';
import { sectionMesSeances, sectionBlocs, brancherGrille, brancherBlocs } from './blocs.js';

const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const libelleSport = (code) => (code === 'ENCHAINEMENT' ? 'Triathlon' : sport(code).libelle);

// Message à afficher après le prochain rendu (succès d'une écriture).
let messageEnAttente = '';

// --- Sections ---

function sectionObjectif(o) {
  const v = o ?? { nom: '', date: '', sport: 'ENCHAINEMENT' };
  const options = SPORTS_OBJECTIF.map((c) => ({ valeur: c, libelle: libelleSport(c), icone: iconeSport(c, 18) }));
  return `<form class="carte" id="form-objectif" novalidate><h2 class="titre-icone">${icone('drapeau', 18)} Objectif</h2>
    <div class="champ"><label for="nom-objectif">Course</label>
      <input id="nom-objectif" maxlength="80" value="${echapperHtml(v.nom)}" placeholder="Ex. Triathlon d'Annecy"></div>
    <div class="champ"><label for="date-objectif">Date</label><input type="date" id="date-objectif" value="${echapperHtml(v.date)}"></div>
    ${groupeChoix('sport-objectif', 'Sport', options, v.sport)}
    <div class="erreurs" id="erreurs-objectif" aria-live="polite"></div>
    <div class="pile"><button type="submit" class="bouton principal ecriture">${o ? "Enregistrer l'objectif" : "Définir l'objectif"}</button>
      ${o ? '<button type="button" class="bouton danger ecriture" id="supprimer-objectif">Supprimer l\'objectif</button>' : ''}</div>
  </form>`;
}

// F-82 : réglages communs à tous les blocs (la durée de chaque bloc remplace les semaines de hausse ; le début
// du plan est calculé à rebours depuis la course, conception 5.3 et 5.4).
function sectionReglages(r, volumeBase_s) {
  const champ = (id, libelle, valeur, aide = '', type = 'text') => `<div class="champ"><label for="${id}">${libelle}</label>
    <input id="${id}" type="${type}" inputmode="${type === 'date' ? '' : 'decimal'}" value="${echapperHtml(valeur)}">${aide ? `<div class="aide">${aide}</div>` : ''}</div>`;
  return `<form class="carte" id="form-reglages" novalidate><h2>Progression</h2>
    <div class="deux-colonnes">
      ${champ('hausse', 'Hausse par semaine (points)', r.hausse)}
      ${champ('coupure', 'Semaine de coupure (%)', r.coupure, 'De la semaine précédente.')}
      ${champ('affutage', 'Affûtage (%)', r.affutage.join(', '), 'Une valeur par semaine, ex. 70, 50.')}
      ${champ('plafond', 'Plafond (h par semaine)', r.plafond_h ? String(r.plafond_h).replace('.', ',') : '', `Proposé : ${plafondParDefaut(volumeBase_s)} h. Vide = sans plafond.`)}
    </div>
    <div class="erreurs" id="erreurs-reglages" aria-live="polite"></div>
    <button type="submit" class="bouton ecriture">Enregistrer les réglages</button></form>`;
}

function sectionApercu(plan, apartirDe, avertissements, allures) {
  const max = Math.max(...plan.map((s) => s.pct), 1);
  const aEnvoyer = plan.flatMap((s) => s.seances).filter((s) => s.date >= apartirDe).length;
  return `<div class="carte"><h2>Aperçu du plan</h2>
    ${avertissements.map((a) => message('info', a)).join('')}
    <div class="liste-semaines">${plan.map((s, i) => `<details class="semaine-plan type-${s.type.toLowerCase()}${i && plan[i - 1].nomBloc !== s.nomBloc ? ' debut-bloc' : ''}${s.lundi < apartirDe && ajouterJours(s.lundi, 6) < apartirDe ? ' passee' : ''}">
      <summary><span class="semaine-num">S${s.numero}</span>
        <span class="semaine-corps"><span class="semaine-texte"><span>${jjmm(s.lundi)} au ${jjmm(ajouterJours(s.lundi, 6))} · ${echapperHtml(s.nomBloc)}${s.type === 'COUPURE' ? ' · Coupure' : ''}</span>
          <span><strong>${s.pct} %</strong> <span class="doux">${formaterDureeLongue(s.volume_s)}</span></span></span>
          <span class="barre-progression"><span class="barre-remplie barre-plan" data-pct="${Math.round((s.pct / max) * 100)}"></span></span></span></summary>
      <ul class="seances-semaine">${s.seances.length ? s.seances.map((x) => `<li>${pastilleSport(x.sport)}<span>${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][(new Date(`${x.date}T12:00:00`).getDay() + 6) % 7]} ${jjmm(x.date)}</span>
        <span class="seance-type-titre">${echapperHtml(x.titre)}</span><span class="doux">${x.sport === 'REPOS' ? '' : formaterDureeLongue(volumeSeance_s(x, allures))}</span>
        ${graphiqueSeance(x, allures, { compact: true })}</li>`).join('')
    : '<li class="doux">Aucune séance</li>'}</ul></details>`).join('')}</div>
    <div class="carte-interieure">
      <p class="doux">Les séances du plan à partir du ${jjmm(apartirDe)} seront remplacées, y compris si tu les as modifiées sur Intervals.icu. Tes autres séances ne sont pas touchées.</p>
      <div id="progression-envoi" aria-live="polite"></div>
      <div class="pile"><button type="button" class="bouton principal ecriture" id="envoyer" ${aEnvoyer ? '' : 'disabled'}>Envoyer ${aEnvoyer} séance${aEnvoyer > 1 ? 's' : ''} dans Intervals.icu</button>
        <button type="button" class="bouton danger ecriture" id="supprimer-plan">Supprimer le plan à venir</button></div>
    </div></div>`;
}

// --- Écran ---

// Préparation affichée : migrée en mémoire si elle est encore à l'ancien format (conception 5.8).
function preparationAffichee(preparation, objectif, aujourdhui) {
  if (!preparation.ancienFormat) return preparation;
  const migree = migrerAncienFormat({ seances: preparation.seances, reglagesAnciens: preparation.ancienFormat.reglages, objectif, aujourdhui });
  return { ...preparation, ...migree };
}

export async function afficherObjectif(conteneur, segments = [], params = {}) {
  conteneur.innerHTML = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/accueil' })}
    <span class="titre-petit">Objectif et plan</span><span class="espace-bouton"></span></div>
    <div id="ecran-objectif">${squelette()}${squelette()}</div>`;
  const zone = conteneur.querySelector('#ecran-objectif');
  conteneur.querySelector('.entete a').addEventListener('click', (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });

  let objectif;
  let lue;
  let allures;
  try {
    [objectif, lue, allures] = await Promise.all([lireObjectif(), lirePreparation(), lireAlluresSeuil()]);
  } catch (e) {
    if (!zone.isConnected) return;
    zone.innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
    zone.querySelector('#reessayer').addEventListener('click', () => afficherObjectif(conteneur, segments, params));
    return;
  }
  if (!zone.isConnected) return;
  const aujourdhui = jourISO();

  // Migration de l'ancienne semaine type (conception 5.8) : écrite une fois, en ligne ; hors ligne, seulement affichée.
  if (lue.ancienFormat && navigator.onLine) {
    try {
      await modifierPreparation((p) => (p.ancienFormat
        ? migrerAncienFormat({ seances: p.seances, reglagesAnciens: p.ancienFormat.reglages, objectif, aujourdhui })
        : { reglages: p.reglages, blocs: p.blocs }));
      lue = await lirePreparation();
    } catch { /* la préparation migrée reste affichée ; la migration sera retentée */ }
    if (!zone.isConnected) return;
  }
  const preparation = preparationAffichee(lue, objectif, aujourdhui);
  const blocs = preparation.blocs ?? [];
  const indexBloc = Math.min(Math.max(0, /^\d+$/.test(params.bloc ?? '') ? Number(params.bloc) : 0), Math.max(0, blocs.length - 1));
  const grilles = blocs.map((b) => grilleDuBloc(b, preparation.seances));
  const volumeBase = grilles.length ? volumeSemaine_s(grilles[0], allures) : 0;
  const lundiProchain = lundiSuivant(aujourdhui);

  // Aperçu du plan (F-84) et bornes d'écriture (F-85 à F-87).
  let apercu = '';
  let plan = [];
  let bornes = bornesPlan(aujourdhui, lundiProchain);
  const vides = blocsVides(blocs, preparation.seances, allures);
  const infoApercu = (texte) => `<div class="carte"><h2>Aperçu du plan</h2>${message('info', texte)}</div>`;
  if (preparation.illisible) apercu = infoApercu("La préparation enregistrée sur Intervals.icu est illisible. Rien n'a été modifié.");
  else if (!objectif) apercu = infoApercu("Définis d'abord ton objectif.");
  else if (!blocs.length) apercu = infoApercu('Ajoute au moins un bloc à ta préparation.');
  else if (vides.length) apercu = infoApercu(vides.map((i) => `Le bloc ${blocs[i].nom} est vide.`).join(' ')); // texte, pas du HTML : message() échappe
  else {
    plan = genererPlanBlocs({ seances: preparation.seances, blocs, reglages: preparation.reglages, dateCourse: objectif.date, allures, objectifId: objectif.id });
    const debut = plan[0]?.lundi ?? lundiProchain;
    bornes = bornesPlan(aujourdhui, debut);
    const avertissements = [];
    if (debut > lundiProchain) avertissements.push(`Le plan commence le ${jjmm(debut)}.`);
    if (distanceSansAllure(grilles.flat(), allures)) avertissements.push("Certaines étapes en distance n'ont pas d'allure seuil sur ton profil : elles ne comptent pas dans le volume ni dans le plafond.");
    apercu = sectionApercu(plan, bornes.creation, avertissements, allures);
  }

  const sectionsPreparation = preparation.illisible
    ? `<div class="carte"><h2>Blocs</h2>${message('erreur', "La préparation enregistrée sur Intervals.icu est illisible. Rien n'a été modifié.")}</div>`
    : `${sectionMesSeances(preparation.seances, blocs, allures)}${sectionBlocs({ ...preparation, blocs }, allures, indexBloc)}${sectionReglages(preparation.reglages, volumeBase)}`;
  zone.innerHTML = `<div id="hors-ligne-objectif"></div>${messageEnAttente}${sectionObjectif(objectif)}${sectionsPreparation}${apercu}`;
  messageEnAttente = '';
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
  brancherGrille(zone);
  const $ = (sel) => zone.querySelector(sel);
  surveillerReseau(zone, $('#hors-ligne-objectif'), [...zone.querySelectorAll('.ecriture')].filter((b) => !b.disabled)); // ENF-07

  // Recharge l'écran après une écriture, avec un message de succès ; garde le bloc affiché.
  const recharger = (texte, bloc = indexBloc) => {
    messageEnAttente = message('succes', texte);
    if (location.hash === `#/objectif?bloc=${bloc}`) afficherObjectif(conteneur, segments, { bloc: String(bloc) });
    else location.hash = `#/objectif?bloc=${bloc}`;
  };
  const echec = (cible, e) => {
    const zoneErreur = $(cible);
    if (zoneErreur) zoneErreur.innerHTML = e?.type === 'ILLISIBLE' ? message('erreur', e.message) : messageErreurApi(e);
  };
  if (!preparation.illisible) brancherBlocs(zone, { blocs, indexBloc, recharger, echec });

  // F-80 : objectif.
  let sportObjectif = objectif?.sport ?? 'ENCHAINEMENT';
  brancherChoix($('#form-objectif'), (champ, valeur) => { sportObjectif = valeur; });
  $('#form-objectif').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const o = { ...(objectif ?? {}), id: objectif?.id, nom: $('#nom-objectif').value.trim(), date: $('#date-objectif').value, sport: sportObjectif };
    const erreurs = validerObjectif(o, aujourdhui);
    if (Object.keys(erreurs).length) { $('#erreurs-objectif').innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
    try {
      await enregistrerObjectif(o);
      recharger('Objectif enregistré dans Intervals.icu.');
    } catch (e) { echec('#erreurs-objectif', e); }
  });
  $('#supprimer-objectif')?.addEventListener('click', async () => {
    if (!confirm("Supprimer l'objectif ? Les séances à venir du plan seront aussi supprimées de ton calendrier Intervals.icu.")) return;
    try {
      await supprimerPlan(objectif.id, bornes.suppression);
      await supprimerObjectif(objectif.id);
      recharger('Objectif et plan à venir supprimés.');
    } catch (e) { echec('#erreurs-objectif', e); }
  });

  // F-82 : réglages de progression, communs à tous les blocs.
  $('#form-reglages')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const champs = Object.fromEntries(['hausse', 'coupure', 'affutage', 'plafond'].map((k) => [k, $(`#${k}`).value]));
    const r = lireReglagesSaisis(champs);
    const erreurs = validerReglages(r);
    if (Object.keys(erreurs).length) { $('#erreurs-reglages').innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
    try {
      await modifierPreparation((p) => ({ reglages: r, blocs: p.blocs ?? [] }));
      recharger("Réglages enregistrés. Vérifie l'aperçu puis renvoie le plan pour l'appliquer.");
    } catch (e) { echec('#erreurs-reglages', e); }
  });

  // F-85, F-86 : envoi ou régénération, toujours après confirmation (D-21 ; la date de début n'est plus
  // enregistrée, l'appli ne sait pas si le plan a déjà été envoyé) ; F-87 : suppression des séances à venir.
  $('#envoyer')?.addEventListener('click', async (ev) => {
    if (!confirm(`Envoyer le plan ? Les séances du plan déjà présentes à partir du ${jjmm(bornes.regeneration)} seront remplacées ; tes autres séances ne sont pas touchées.`)) return;
    const bouton = ev.currentTarget;
    bouton.disabled = true;
    const zoneProgres = $('#progression-envoi');
    try {
      const n = await envoyerPlan(plan, objectif.id, bornes, (fait, total) => {
        zoneProgres.textContent = `Envoi en cours : ${fait} / ${total}...`; // ENF-10
      });
      recharger(`${n} séance${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''} dans Intervals.icu. Elles partiront sur ta montre comme d'habitude.`);
    } catch (e) {
      zoneProgres.innerHTML = e.type === 'ETIQUETTE'
        ? message('erreur', "Envoi arrêté : Intervals.icu n'a pas gardé l'étiquette des séances du plan, l'appli ne pourrait pas les remplacer ensuite. Une seule séance a été créée ; supprime-la sur le site.")
        : `${messageErreurApi(e)}<p class="doux">Renvoie le plan : les séances déjà créées seront remplacées.</p>`;
      bouton.disabled = !navigator.onLine;
    }
  });
  $('#supprimer-plan')?.addEventListener('click', async () => {
    if (!confirm(`Supprimer les séances du plan à partir du ${jjmm(bornes.suppression)} ? Les séances passées restent.`)) return;
    try {
      const n = await supprimerPlan(objectif.id, bornes.suppression);
      recharger(`${n} séance${n > 1 ? 's' : ''} du plan supprimée${n > 1 ? 's' : ''}.`);
    } catch (e) { echec('#progression-envoi', e); }
  });
}
