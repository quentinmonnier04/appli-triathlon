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
import { echapperHtml, formaterDureeLongue, formaterDuree, formaterDistance, formaterVitesse, decouperUnite } from '../logique/format.js';
import {
  FORMATS_COURSE, segmentsDeLaCourse, lireObjectifsSaisis, tempsTotal, tempsDepuisAllure, lireTempsCourse,
} from '../logique/objectifs-course.js';
import {
  message, messageErreurApi, squelette, pastilleSport, groupeChoix, brancherChoix, surveillerReseau, graphiqueSeance, boutonIcone,
  boutonCrayon, boutonAnnuler, brancherEdition,
} from './composants.js';
import { icone, iconeSport } from './icones.js';
import { sectionBlocs, brancherGrille, brancherBlocs } from './blocs.js';

const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const libelleSport = (code) => (code === 'ENCHAINEMENT' ? 'Triathlon' : sport(code).libelle);

// Message à afficher après le prochain rendu (succès d'une écriture).
let messageEnAttente = '';

// --- Sections ---

// --- F-89 : objectifs de course par discipline et transitions ---

const LIBELLES_SEGMENT = { NATATION: 'Natation', T1: 'T1', VELO: 'Vélo', T2: 'T2', CAP: 'Course' };
const FORMATS = [['', 'Choisir'], ['XS', 'XS'], ['S', 'S'], ['M', 'M'], ['70.3', '70.3'], ['IRONMAN', 'Ironman'], ['PERSO', 'Personnalisé']];
const estTransition = (seg) => seg === 'T1' || seg === 'T2';
// Distance affichée dans le champ : mètres en natation, kilomètres ailleurs (virgule décimale).
const distanceSaisie = (seg, m) => (m ? (seg === 'NATATION' ? String(m) : String(m / 1000).replace('.', ',')) : '');
// Allure affichée dans le champ, sans unité : "4:27", "2:00", "34,3".
const allureSaisie = (seg, m, s) => decouperUnite(formaterVitesse(seg, m, s))?.valeur ?? '';
const UNITES = { NATATION: 'min/100 m', VELO: 'km/h', CAP: 'min/km' };

// Tableau des objectifs enregistrés et temps total visé (conception 5.6).
// F-89, D-29 : récapitulatif par discipline et transitions, avec le total visé. Il remplace les champs en lecture
// (ils montraient la même chose) ; les champs de saisie n'apparaissent qu'avec le crayon.
function tableauObjectifs(o) {
  if (!o?.objectifs) return '';
  const total = tempsTotal(o.objectifs, o.sport);
  const lignes = segmentsDeLaCourse(o.sport).map((seg) => {
    const x = o.objectifs.segments[seg];
    if (!x) return '';
    return `<tr><th scope="row">${echapperHtml(LIBELLES_SEGMENT[seg])}</th><td>${x.distance_m ? echapperHtml(formaterDistance(x.distance_m, seg)) : ''}</td>
      <td>${echapperHtml(formaterDuree(x.temps_s))}</td><td>${estTransition(seg) ? '' : echapperHtml(formaterVitesse(seg, x.distance_m, x.temps_s) ?? '')}</td></tr>`;
  }).join('');
  return `<div class="objectifs-course">${total !== null ? `<p class="total-vise">Total visé : <strong>${echapperHtml(formaterDuree(total))}</strong></p>` : ''}
    <div class="tableau-defilant"><table class="intervalles"><tbody>${lignes}</tbody></table></div></div>`;
}

// Champs de saisie : format (triathlon), puis distance, temps et allure par discipline ; temps seul pour T1 et T2.
function champsObjectifs(sportCourse, objectifs) {
  const triathlon = sportCourse === 'ENCHAINEMENT';
  const format = triathlon ? (objectifs?.format ?? '') : '';
  const lignes = segmentsDeLaCourse(sportCourse).map((seg) => {
    const x = objectifs?.segments?.[seg] ?? {};
    const distance = x.distance_m ?? (FORMATS_COURSE[format]?.[seg] ?? null);
    const champ = (nom, libelle, valeur, aide = '') => `<div class="champ"><label for="${seg}-${nom}">${echapperHtml(libelle)}</label>
      <input id="${seg}-${nom}" data-segment="${seg}" data-champ="${nom}" inputmode="decimal" value="${echapperHtml(valeur)}" placeholder="${echapperHtml(aide)}"></div>`;
    if (estTransition(seg)) return `<fieldset class="segment-course"><legend>${echapperHtml(LIBELLES_SEGMENT[seg])}</legend>${champ('temps', 'Temps', x.temps_s ? formaterDuree(x.temps_s) : '', 'm:ss')}</fieldset>`;
    return `<fieldset class="segment-course"><legend>${echapperHtml(LIBELLES_SEGMENT[seg])}</legend><div class="trois-colonnes">
      ${champ('distance', seg === 'NATATION' ? 'Distance (m)' : 'Distance (km)', distanceSaisie(seg, distance))}
      ${champ('temps', 'Temps', x.temps_s ? formaterDuree(x.temps_s) : '', 'h:mm:ss')}
      ${champ('allure', `Allure (${UNITES[seg]})`, x.temps_s ? allureSaisie(seg, distance, x.temps_s) : '')}</div></fieldset>`;
  }).join('');
  return `${triathlon ? `<div class="champ"><label for="format-course">Format</label><select id="format-course">
    ${FORMATS.map(([v, l]) => `<option value="${v}" ${v === format ? 'selected' : ''}>${echapperHtml(l)}</option>`).join('')}</select></div>` : ''}${lignes}`;
}

// Recalcul en direct : temps saisi -> allure, allure saisie -> temps ; format -> distances (sauf Personnalisé).
function brancherObjectifs(zone) {
  const champ = (seg, nom) => zone.querySelector(`#${seg}-${nom}`);
  const distance = (seg) => {
    const t = String(champ(seg, 'distance')?.value ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    return Math.round(seg === 'NATATION' ? Number(t) : Number(t) * 1000);
  };
  zone.querySelectorAll('[data-segment]').forEach((input) => input.addEventListener('change', () => {
    const seg = input.dataset.segment;
    if (estTransition(seg)) return;
    const d = distance(seg);
    if (input.dataset.champ === 'allure') {
      const t = tempsDepuisAllure(seg, d, input.value);
      if (t !== null) champ(seg, 'temps').value = formaterDuree(t);
    } else {
      const t = lireTempsCourse(champ(seg, 'temps').value);
      if (t !== null && d) champ(seg, 'allure').value = allureSaisie(seg, d, t);
    }
  }));
  zone.querySelector('#format-course')?.addEventListener('change', (ev) => {
    const distances = FORMATS_COURSE[ev.target.value];
    if (!distances) return;
    for (const [seg, m] of Object.entries(distances)) if (champ(seg, 'distance')) champ(seg, 'distance').value = distanceSaisie(seg, m);
  });
}

// Textes du formulaire pour lireObjectifsSaisis.
function champsSaisis(zone) {
  const champs = { format: zone.querySelector('#format-course')?.value ?? '' };
  zone.querySelectorAll('[data-segment]').forEach((i) => { champs[`${i.dataset.segment}.${i.dataset.champ}`] = i.value; });
  return champs;
}

function sectionObjectif(o) {
  const v = o ?? { nom: '', date: '', sport: 'ENCHAINEMENT' };
  const options = SPORTS_OBJECTIF.map((c) => ({ valeur: c, libelle: libelleSport(c), icone: iconeSport(c, 18) }));
  return `<form class="carte" id="form-objectif" novalidate><h2 class="titre-icone">${icone('drapeau', 18)} Objectif</h2>${o ? boutonCrayon("Modifier l'objectif") : ''}
    ${tableauObjectifs(o)}
    <fieldset class="champs-formulaire">
    <div class="champ"><label for="nom-objectif">Course</label>
      <input id="nom-objectif" maxlength="80" value="${echapperHtml(v.nom)}" placeholder="Ex. Triathlon d'Annecy"></div>
    <div class="champ"><label for="date-objectif">Date</label><input type="date" id="date-objectif" value="${echapperHtml(v.date)}"></div>
    ${groupeChoix('sport-objectif', 'Sport', options, v.sport)}
    <div class="${o?.objectifs ? 'seulement-edition' : ''}"><h3 class="sous-titre">Mes objectifs pour la course</h3>
    <div id="champs-objectifs">${champsObjectifs(v.sport, v.objectifs)}</div></div>
    </fieldset>
    <div class="erreurs" id="erreurs-objectif" aria-live="polite"></div>
    <div class="pile"><button type="submit" class="bouton principal" data-enregistrer>${o ? 'Enregistrer les modifications' : "Définir l'objectif"}</button>
      ${o ? `<button type="button" class="bouton danger ecriture action-edition" id="supprimer-objectif">Supprimer l'objectif</button>${boutonAnnuler()}` : ''}</div>
  </form>`;
}

// F-82 : réglages communs à tous les blocs (la durée de chaque bloc remplace les semaines de hausse ; le début
// du plan est calculé à rebours depuis la course, conception 5.3 et 5.4).
function sectionReglages(r, volumeBase_s) {
  const champ = (id, libelle, valeur, aide = '', type = 'text') => `<div class="champ"><label for="${id}">${libelle}</label>
    <input id="${id}" type="${type}" inputmode="${type === 'date' ? '' : 'decimal'}" value="${echapperHtml(valeur)}">${aide ? `<div class="aide">${aide}</div>` : ''}</div>`;
  return `<form class="carte" id="form-reglages" novalidate><h2>Progression</h2>${boutonCrayon('Modifier la progression')}
    <fieldset class="champs-formulaire"><div class="deux-colonnes">
      ${champ('hausse', 'Hausse par semaine (points)', r.hausse)}
      ${champ('coupure', 'Semaine de coupure (%)', r.coupure, 'De la semaine précédente.')}
      ${champ('affutage', 'Affûtage (%)', r.affutage.join(', '), 'Une valeur par semaine, ex. 70, 50.')}
      ${champ('plafond', 'Plafond (h par semaine)', r.plafond_h ? String(r.plafond_h).replace('.', ',') : '', `Proposé : ${plafondParDefaut(volumeBase_s)} h. Vide = sans plafond.`)}
    </div></fieldset>
    <div class="erreurs" id="erreurs-reglages" aria-live="polite"></div>
    <div class="pile"><button type="submit" class="bouton principal" data-enregistrer>Enregistrer les modifications</button>${boutonAnnuler()}</div></form>`;
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
      <p class="doux">Les séances du plan à partir du ${jjmm(apartirDe)} seront remplacées, y compris si tu les as modifiées à la main. Tes autres séances ne sont pas touchées.</p>
      <div id="progression-envoi" aria-live="polite"></div>
      <div class="pile"><button type="button" class="bouton principal ecriture" id="envoyer" ${aEnvoyer ? '' : 'disabled'}>Envoyer ${aEnvoyer} séance${aEnvoyer > 1 ? 's' : ''} dans mon calendrier</button>
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
  // D-28 : le retour mène toujours à l'accueil (l'historique peut contenir l'éditeur et les écrans du bloc).

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
  // Tant qu'elle n'est pas écrite, aucune autre écriture n'est acceptée (revue finale I-1) et l'échec est signalé.
  let echecMigration = '';
  if (lue.ancienFormat && navigator.onLine) {
    try {
      await modifierPreparation((p) => (p.ancienFormat
        ? migrerAncienFormat({ seances: p.seances, reglagesAnciens: p.ancienFormat.reglages, objectif, aujourdhui })
        : { reglages: p.reglages, blocs: p.blocs }), { migration: true });
      lue = await lirePreparation();
    } catch (e) {
      echecMigration = message('erreur', "La conversion de ta semaine type en blocs n'a pas abouti. Rien n'a été modifié ; rouvre l'écran pour réessayer.");
    }
    if (!zone.isConnected) return;
  }
  if (lue.ancienFormat && !echecMigration) echecMigration = message('info', "Ta semaine type sera convertie en blocs à la prochaine ouverture de l'écran avec du réseau.");
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
  if (preparation.illisible) apercu = infoApercu("La préparation enregistrée est illisible. Rien n'a été modifié.");
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
    ? `<div class="carte"><h2>Blocs</h2>${message('erreur', "La préparation enregistrée est illisible. Rien n'a été modifié.")}</div>`
    : `${sectionBlocs({ ...preparation, blocs }, allures, indexBloc)}${sectionReglages(preparation.reglages, volumeBase)}`;
  zone.innerHTML = `<div id="hors-ligne-objectif"></div>${messageEnAttente}${echecMigration}${sectionObjectif(objectif)}${sectionsPreparation}${apercu}`;
  messageEnAttente = '';
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
  brancherGrille(zone);
  const $ = (sel) => zone.querySelector(sel);
  surveillerReseau(zone, $('#hors-ligne-objectif'), [...zone.querySelectorAll('.ecriture')].filter((b) => !b.disabled)); // ENF-07
  // D-27 : formulaires en lecture avec le crayon ; Annuler réaffiche l'écran avec les valeurs enregistrées.
  const reafficher = () => afficherObjectif(conteneur, segments, { bloc: String(indexBloc) });
  brancherEdition($('#form-objectif'), { lecture: Boolean(objectif), nouveau: !objectif, surAnnuler: reafficher });
  if ($('#form-reglages')) brancherEdition($('#form-reglages'), { surAnnuler: reafficher });
  if ($('#form-bloc')) brancherEdition($('#form-bloc'), { surAnnuler: reafficher });

  // Recharge l'écran après une écriture, avec un message de succès ; garde le bloc affiché.
  const recharger = (texte, bloc = indexBloc) => {
    messageEnAttente = message('succes', texte);
    if (location.hash === `#/objectif?bloc=${bloc}`) afficherObjectif(conteneur, segments, { bloc: String(bloc) });
    else location.hash = `#/objectif?bloc=${bloc}`;
  };
  const echec = (cible, e) => {
    const zoneErreur = $(cible);
    if (zoneErreur) zoneErreur.innerHTML = messageErreurApi(e);
  };
  if (!preparation.illisible) brancherBlocs(zone, { blocs, indexBloc, recharger, echec });

  // F-80 : objectif.
  let sportObjectif = objectif?.sport ?? 'ENCHAINEMENT';
  brancherChoix($('#form-objectif'), (champ, valeur) => {
    sportObjectif = valeur;
    if (!valeur) return; // choix retiré : validerObjectif le signalera
    $('#champs-objectifs').innerHTML = champsObjectifs(sportObjectif, sportObjectif === objectif?.sport ? objectif.objectifs : null); // F-89
    brancherObjectifs($('#champs-objectifs'));
  });
  brancherObjectifs($('#champs-objectifs'));
  $('#form-objectif').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const o = { ...(objectif ?? {}), id: objectif?.id, nom: $('#nom-objectif').value.trim(), date: $('#date-objectif').value, sport: sportObjectif };
    const saisis = lireObjectifsSaisis(champsSaisis($('#champs-objectifs')), sportObjectif); // F-89
    o.objectifs = saisis.objectifs;
    const erreurs = { ...validerObjectif(o, aujourdhui), ...saisis.erreurs };
    if (Object.keys(erreurs).length) { $('#erreurs-objectif').innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
    try {
      await enregistrerObjectif(o);
      recharger('Objectif enregistré.');
    } catch (e) { echec('#erreurs-objectif', e); }
  });
  $('#supprimer-objectif')?.addEventListener('click', async () => {
    if (!confirm("Supprimer l'objectif ? Les séances à venir du plan seront aussi supprimées de ton calendrier.")) return;
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
      recharger(`${n} séance${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''} dans ton calendrier. Elles partiront sur ta montre comme d'habitude.`);
    } catch (e) {
      zoneProgres.innerHTML = e.type === 'ETIQUETTE'
        ? message('erreur', "Envoi arrêté : l'étiquette des séances du plan n'a pas été gardée, l'appli ne pourrait pas les remplacer ensuite. Une seule séance a été créée ; supprime-la depuis l'agenda.")
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
