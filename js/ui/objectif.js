// Écran E-09 "Objectif" (L8) : objectif (F-80), semaine type (F-81), réglages de progression (F-82),
// aperçu du plan semaine par semaine (F-83, F-84), envoi (F-85), régénération (F-86) et suppression (F-87).
// Écriture en ligne seulement (ENF-07). Route : #/objectif

import { lireObjectif, enregistrerObjectif, supprimerObjectif, SPORTS_OBJECTIF } from '../api/objectif.js';
import { lireSemaineType, enregistrerReglages } from '../api/semaine-type.js';
import { envoyerPlan, supprimerPlan } from '../api/plan.js';
import { lireAlluresSeuil } from '../api/profil.js';
import {
  genererPlan, validerReglages, validerObjectif, lireReglagesSaisis, lundiSuivant, plafondParDefaut, bornesPlan, debutEffectif,
  volumeSeance_s, volumeSemaine_s, distanceSansAllure,
} from '../logique/plan.js';
import { jourISO, ajouterJours } from '../logique/dates.js';
import { GRILLE, dispositionSemaine, heureDepuisPosition } from '../logique/grille.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDureeLongue } from '../logique/format.js';
import {
  message, messageErreurApi, squelette, pastilleSport, groupeChoix, brancherChoix, surveillerReseau, graphiqueSeance, boutonIcone,
} from './composants.js';
import { icone, iconeSport } from './icones.js';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const LIBELLES_TYPE = { HAUSSE: 'Hausse', COUPURE: 'Coupure', AFFUTAGE: 'Affûtage', COURSE: 'Course' };
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

// F-81 : semaine type en grille horaire (lundi à dimanche, 5 h à 23 h). Un bloc ouvre la séance type ;
// toucher une case vide crée une séance type à ce jour et à cette heure. Positions calculées par logique/grille.js.
function sectionSemaineType(seances, allures) {
  const { blocs, sansHeure } = dispositionSemaine(seances, allures);
  const heures = Array.from({ length: GRILLE.heureFin - GRILLE.heureDebut }, (_, i) => GRILLE.heureDebut + i);
  const jours = JOURS.map((nom, i) => ({ nom, jour: i + 1 }));
  const lienSeance = (x, contenu, classe) => `<a class="${classe} sport-${x.sport}" href="#/seance-type/${encodeURIComponent(x.id)}"
    aria-label="${echapperHtml(`${JOURS[x.jour - 1]} ${x.heure ?? ''} ${x.titre}`)}" title="${echapperHtml(x.titre)}">${contenu}</a>`;
  return `<div class="carte"><h2>Semaine type</h2>
    <p class="doux">Volume : <strong>${formaterDureeLongue(volumeSemaine_s(seances, allures))}</strong> par semaine.
      Touche une case vide pour ajouter une séance à cette heure. Elle est rangée dans ta bibliothèque Intervals.icu.</p>
    <div class="grille">
      <div class="grille-ligne grille-entete"><span></span>${jours.map((j) => `<span>${echapperHtml(j.nom.slice(0, 3))}</span>`).join('')}</div>
      <div class="grille-ligne grille-sans-heure"><span class="grille-libelle">Sans heure</span>
        ${jours.map((j) => `<div class="grille-cellule">${sansHeure.filter((x) => x.jour === j.jour)
    .map((x) => lienSeance(x, iconeSport(x.sport, 18), 'grille-puce')).join('')}
          <a class="grille-ajout" href="#/seance-type/nouvelle?jour=${j.jour}" aria-label="Ajouter une séance sans heure le ${echapperHtml(j.nom.toLowerCase())}">${icone('plus', 18)}</a></div>`).join('')}</div>
      <div class="grille-defilement"><div class="grille-corps" data-hauteur="${(GRILLE.heureFin - GRILLE.heureDebut) * GRILLE.pxParHeure}">
        <div class="grille-heures" aria-hidden="true">${heures.map((h) => `<span data-haut="${(h - GRILLE.heureDebut) * GRILLE.pxParHeure}">${h} h</span>`).join('')}</div>
        ${jours.map((j) => `<div class="grille-jour" data-jour="${j.jour}">${blocs.filter((b) => b.jour === j.jour).map((b) => lienSeance(b.seance,
    `<span class="grille-bloc-visuel" data-decalage="${b.haut_px - b.toucher_haut_px}" data-hauteur-visuel="${b.hauteur_px}">
      ${iconeSport(b.seance.sport, 16)}<span class="grille-bloc-heure">${echapperHtml(b.seance.heure)}</span></span>`, 'grille-bloc')
    .replace('<a ', `<a data-haut="${b.toucher_haut_px}" data-hauteur="${b.toucher_hauteur_px}" data-colonne="${b.colonne}" data-nb="${b.nbColonnes}" `)).join('')}</div>`).join('')}
      </div></div>
    </div></div>`;
}

// Positions de la grille (CSP : pas de style dans le HTML, element.style est permis) et toucher d'une case vide.
function brancherGrille(zone) {
  const corps = zone.querySelector('.grille-corps');
  if (!corps) return;
  corps.style.height = `${corps.dataset.hauteur}px`;
  corps.querySelectorAll('[data-haut]').forEach((el) => {
    el.style.top = `${el.dataset.haut}px`;
    if (el.dataset.hauteur) {
      el.style.height = `${el.dataset.hauteur}px`;
      el.style.left = `${(Number(el.dataset.colonne) / Number(el.dataset.nb)) * 100}%`;
      el.style.width = `${100 / Number(el.dataset.nb)}%`;
    }
  });
  // Le lien couvre la zone de toucher (44 px au moins) ; le bloc coloré garde la hauteur de la séance.
  corps.querySelectorAll('.grille-bloc-visuel').forEach((v) => {
    v.style.marginTop = `${v.dataset.decalage}px`;
    v.style.height = `${v.dataset.hauteurVisuel}px`;
  });
  corps.querySelectorAll('.grille-jour').forEach((colonne) => {
    colonne.addEventListener('click', (ev) => {
      if (ev.target !== colonne) return; // un bloc a été touché
      const y = ev.clientY - colonne.getBoundingClientRect().top;
      location.hash = `#/seance-type/nouvelle?jour=${colonne.dataset.jour}&heure=${heureDepuisPosition(y)}`;
    });
  });
  // La journée commence affichée à 6 h.
  zone.querySelector('.grille-defilement').scrollTop = (6 - GRILLE.heureDebut) * GRILLE.pxParHeure;
}

function sectionReglages(r, volumeBase_s, debutParDefaut) {
  const champ = (id, libelle, valeur, aide = '', type = 'text') => `<div class="champ"><label for="${id}">${libelle}</label>
    <input id="${id}" type="${type}" inputmode="${type === 'date' ? '' : 'decimal'}" value="${echapperHtml(valeur)}">${aide ? `<div class="aide">${aide}</div>` : ''}</div>`;
  return `<form class="carte" id="form-reglages" novalidate><h2>Progression</h2>
    <div class="deux-colonnes">
      ${champ('hausse', 'Hausse par semaine (points)', r.hausse)}
      ${champ('semainesHausse', 'Semaines de hausse par bloc', r.semainesHausse)}
      ${champ('coupure', 'Semaine de coupure (%)', r.coupure, 'De la semaine précédente.')}
      ${champ('affutage', 'Affûtage (%)', r.affutage.join(', '), 'Une valeur par semaine, ex. 70, 50.')}
      ${champ('plafond', 'Plafond (h par semaine)', r.plafond_h ? String(r.plafond_h).replace('.', ',') : '', `Proposé : ${plafondParDefaut(volumeBase_s)} h. Vide = sans plafond.`)}
      ${champ('debut', 'Début du plan', r.debut ?? debutParDefaut, '', 'date')}
    </div>
    <div class="erreurs" id="erreurs-reglages" aria-live="polite"></div>
    <button type="submit" class="bouton ecriture">Enregistrer les réglages</button></form>`;
}

function sectionApercu(plan, apartirDe, avertissements, allures) {
  const max = Math.max(...plan.map((s) => s.pct), 1);
  const aEnvoyer = plan.flatMap((s) => s.seances).filter((s) => s.date >= apartirDe).length;
  return `<div class="carte"><h2>Aperçu du plan</h2>
    ${avertissements.map((a) => message('info', a)).join('')}
    <div class="liste-semaines">${plan.map((s) => `<details class="semaine-plan type-${s.type.toLowerCase()}${s.lundi < apartirDe && ajouterJours(s.lundi, 6) < apartirDe ? ' passee' : ''}">
      <summary><span class="semaine-num">S${s.numero}</span>
        <span class="semaine-corps"><span class="semaine-texte"><span>${jjmm(s.lundi)} au ${jjmm(ajouterJours(s.lundi, 6))} · ${LIBELLES_TYPE[s.type]}</span>
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

export async function afficherObjectif(conteneur) {
  conteneur.innerHTML = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/accueil' })}
    <span class="titre-petit">Objectif et plan</span><span class="espace-bouton"></span></div>
    <div id="ecran-objectif">${squelette()}${squelette()}</div>`;
  const zone = conteneur.querySelector('#ecran-objectif');
  conteneur.querySelector('.entete a').addEventListener('click', (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });

  let objectif;
  let semaine;
  let allures;
  try {
    [objectif, semaine, allures] = await Promise.all([lireObjectif(), lireSemaineType(), lireAlluresSeuil()]);
  } catch (e) {
    if (!zone.isConnected) return;
    zone.innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
    zone.querySelector('#reessayer').addEventListener('click', () => afficherObjectif(conteneur));
    return;
  }
  if (!zone.isConnected) return;

  const aujourdhui = jourISO();
  const debutParDefaut = lundiSuivant(aujourdhui);
  // La date de début enregistrée ne vaut que pour l'objectif courant (revue I-4).
  const debutEnregistre = objectif ? debutEffectif(semaine.reglages, objectif.id, null) : null;
  const reglages = { ...semaine.reglages, debut: debutEnregistre ?? debutParDefaut, objectifDebut: objectif?.id ?? null };
  const volumeBase = volumeSemaine_s(semaine.seances, allures);
  // Bornes d'écriture (revue I-1, I-2) : création à partir du début, régénération à partir du lundi suivant,
  // suppression du plan ou de l'objectif dès demain.
  const bornes = bornesPlan(aujourdhui, reglages.debut);
  const apartirDe = bornes.creation;

  let apercu;
  if (!objectif) apercu = `<div class="carte"><h2>Aperçu du plan</h2>${message('info', "Définis d'abord ton objectif.")}</div>`;
  else if (!semaine.seances.some((s) => s.sport !== 'REPOS')) apercu = `<div class="carte"><h2>Aperçu du plan</h2>${message('info', 'Ajoute au moins une séance à ta semaine type.')}</div>`;
  let plan = [];
  if (!apercu) {
    plan = genererPlan({ semaineType: semaine.seances, reglages, dateCourse: objectif.date, allures, objectifId: objectif.id });
    const avertissements = [];
    if (!plan.length) avertissements.push('La course a lieu avant le début du plan.');
    if (distanceSansAllure(semaine.seances, allures)) avertissements.push("Certaines étapes en distance n'ont pas d'allure seuil sur ton profil : elles ne comptent pas dans le volume ni dans le plafond.");
    apercu = sectionApercu(plan, apartirDe, avertissements, allures);
  }

  zone.innerHTML = `<div id="hors-ligne-objectif"></div>${messageEnAttente}
    ${sectionObjectif(objectif)}${sectionSemaineType(semaine.seances, allures)}${sectionReglages(reglages, volumeBase, debutParDefaut)}${apercu}`;
  messageEnAttente = '';
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
  brancherGrille(zone);
  const $ = (sel) => zone.querySelector(sel);
  surveillerReseau(zone, $('#hors-ligne-objectif'), [...zone.querySelectorAll('.ecriture')].filter((b) => !b.disabled)); // ENF-07

  // Recharge l'écran après une écriture, avec un message de succès.
  const recharger = (texte) => { messageEnAttente = message('succes', texte); afficherObjectif(conteneur); };
  const echec = (cible, e) => { $(cible).innerHTML = messageErreurApi(e); };

  // F-80 : objectif.
  let sportObjectif = objectif?.sport ?? 'ENCHAINEMENT';
  brancherChoix($('#form-objectif'), (champ, valeur) => { sportObjectif = valeur; });
  $('#form-objectif').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const o = { id: objectif?.id, nom: $('#nom-objectif').value.trim(), date: $('#date-objectif').value, sport: sportObjectif };
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

  // F-82 : réglages de progression.
  $('#form-reglages').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const champs = Object.fromEntries(['hausse', 'semainesHausse', 'coupure', 'affutage', 'plafond', 'debut'].map((k) => [k, $(`#${k}`).value]));
    const r = { ...lireReglagesSaisis(champs), objectifDebut: objectif?.id ?? null };
    const erreurs = validerReglages(r);
    if (Object.keys(erreurs).length) { $('#erreurs-reglages').innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
    try {
      await enregistrerReglages(r);
      recharger("Réglages enregistrés. Vérifie l'aperçu puis renvoie le plan pour l'appliquer.");
    } catch (e) { echec('#erreurs-reglages', e); }
  });

  // F-85, F-86 : envoi ou régénération ; F-87 : suppression des séances à venir.
  $('#envoyer')?.addEventListener('click', async (ev) => {
    // D-21 : un plan déjà envoyé (date de début enregistrée) est remplacé seulement après confirmation.
    if (debutEnregistre && !confirm(`Remplacer les séances du plan à partir du ${jjmm(bornes.regeneration)} ? Celles que tu as modifiées sur Intervals.icu seront remplacées ; tes autres séances ne sont pas touchées.`)) return;
    const bouton = ev.currentTarget;
    bouton.disabled = true;
    const zoneProgres = $('#progression-envoi');
    try {
      // La date de début est enregistrée au premier envoi : la numérotation des semaines ne glisse plus (F-86).
      if (debutEnregistre !== reglages.debut) await enregistrerReglages(reglages);
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
