// Composants d'affichage partagés (ENF-22). Produisent du HTML ; aucun calcul métier.

import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterDateCourte, formaterHorodatage, formaterEntier, decouperUnite, formaterJourMois,
} from '../logique/format.js';
import { formaterDureeSaisie } from '../logique/seance.js';
import { MESSAGES, formaterMessage } from '../logique/messages.js';
import { sport } from '../logique/sports.js';
import { barresSeance, rectanglesGraphique } from '../logique/graphique-seance.js';
import { icone, iconeSport } from './icones.js';

// Message d'état : type 'succes', 'erreur' ou 'info' ; le texte est échappé.
export function message(type, texte, lienHtml = '') {
  return `<div class="message ${type}" role="${type === 'erreur' ? 'alert' : 'status'}">
    <span class="message-icone">${icone(type)}</span><span>${echapperHtml(texte)}${lienHtml ? ' ' + lienHtml : ''}</span></div>`;
}

// Message correspondant à une ErreurApi (5.4, 9.5) : M-02 pour les identifiants, M-07 sinon.
// lienReglages : ajoute le lien vers Réglages (inutile quand on y est déjà).
export function messageErreurApi(erreur, { lienReglages = true } = {}) {
  // Préparation illisible, pas encore migrée ou changée ailleurs (L8, revue finale) : message propre à l'erreur.
  if (['ILLISIBLE', 'MIGRATION', 'CHANGEE'].includes(erreur?.type)) return message('erreur', erreur.message);
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

// Icône du sport dans sa couleur (ENF-18, ENF-19 : couleur + icône), avec le nom du sport pour les lecteurs d'écran.
export function pastilleSport(code) {
  const s = sport(code);
  return `<span class="pastille sport-${s.code}" role="img" aria-label="${echapperHtml(s.libelle)}">${iconeSport(s.code)}</span>`;
}

// Bouton ou lien rond d'action de l'en-tête (retour, rafraîchir, réglages...) avec une icône SVG.
export function boutonIcone(nom, libelle, { href = null, id = null, classe = '' } = {}) {
  const attributs = `class="icone-bouton${classe ? ' ' + classe : ''}"${id ? ` id="${id}"` : ''} aria-label="${echapperHtml(libelle)}"`;
  return href ? `<a ${attributs} href="${href}">${icone(nom, 22)}</a>` : `<button type="button" ${attributs}>${icone(nom, 22)}</button>`;
}

// Petite flèche des cartes cliquables.
export function flecheLien() {
  return `<span class="lien-fleche">${icone('fleche', 20)}</span>`;
}

// Chiffre en grand suivi de son unité en petit (design E) ; rien si la valeur est absente.
// libelle : texte lu par les lecteurs d'écran avant la valeur (ex. "Distance").
function chiffre(libelle, texte, classe = 'chiffre') {
  const v = decouperUnite(texte);
  if (!v) return '';
  return `<span class="${classe}"><span class="lecteur">${echapperHtml(libelle)} : </span>${echapperHtml(v.valeur)}${v.unite ? `<span class="unite"> ${echapperHtml(v.unite)}</span>` : ''}</span>`;
}

// Une statistique : petite étiquette et valeur ; rien si la valeur est absente.
export function stat(etiquette, valeur) {
  if (valeur === null || valeur === undefined) return '';
  return `<div class="stat"><span class="stat-valeur">${echapperHtml(valeur)}</span><span class="stat-etiquette">${echapperHtml(etiquette)}</span></div>`;
}

// Carte d'une séance prévue, dessinée en contour pour la distinguer du réalisé (F-32) ; elle ouvre la modification (F-43).
export function carteSeancePrevue(s) {
  if (s.objectif) return carteObjectif(s);
  const details = [formaterDuree(s.duree_s), formaterDistance(s.distance_m, s.sport)].filter(Boolean).join(' · ');
  const sp = sport(s.sport);
  return `<a class="carte carte-prevue sport-${sp.code}" href="#/seance/${encodeURIComponent(s.id)}">
    <div class="carte-activite-tete"><span class="pastille pastille-contour sport-${sp.code}" role="img" aria-label="${echapperHtml(sp.libelle)}">${iconeSport(sp.code)}</span>
      <div class="carte-activite-titre"><strong>${echapperHtml(s.titre)}</strong>
        <span class="doux">Prévu · ${s.heure ? `${echapperHtml(s.heure)} · ` : ''}${echapperHtml(sp.libelle)}${details ? ' · ' + echapperHtml(details) : ''}</span></div></div>
    ${s.description ? `<p class="description-seance">${echapperHtml(s.description)}</p>` : ''}</a>`;
}

// Carte de la course objectif dans l'agenda (F-80) : elle ouvre l'écran Objectif.
function carteObjectif(s) {
  const sp = sport(s.sport);
  return `<a class="carte carte-prevue carte-objectif" href="#/objectif">
    <div class="carte-activite-tete"><span class="pastille pastille-objectif" role="img" aria-label="Objectif">${icone('drapeau')}</span>
      <div class="carte-activite-titre"><strong>${echapperHtml(s.titre)}</strong>
        <span class="doux">Objectif · ${echapperHtml(s.sport === 'ENCHAINEMENT' ? 'Triathlon' : sp.libelle)}</span></div></div></a>`;
}

// Carte d'une activité (F-11, design E) : sport en majuscules dans sa couleur avec son icône, titre, date et heure à droite,
// chiffres clés en grand (distance, durée), vitesse ou allure et charge en second.
// apercu : place réservée pour l'aperçu du tracé GPS (F-71), remplie par ui/carte.js.
// grille : variante de l'accueil (F-21) avec les chiffres en colonnes et leur libellé dessous ; prefixeDate : ex. "Dernière activité".
export function carteActivite(a, { apercu = false, grille = false, prefixeDate = '' } = {}) {
  const sp = sport(a.sport);
  const vitesse = formaterVitesse(a.sport, a.distance_m, a.duree_s);
  const libelleVitesse = a.sport === 'VELO' ? 'Vitesse' : 'Allure';
  const charge = formaterEntier(a.charge);
  // Variante de l'accueil : date courte jj/mm, pour laisser la place au sport et au titre.
  const date = grille ? formaterJourMois(a.date) : formaterDateCourte(a.date, a.heure);
  const tete = `<div class="carte-tete"><span class="sport-titre">${iconeSport(sp.code)}<span class="sport-titre-texte">${echapperHtml(sp.libelle)} · ${echapperHtml(a.titre)}</span></span>
      <span class="carte-date">${prefixeDate ? `${echapperHtml(prefixeDate)} · ` : ''}${echapperHtml(date)}</span></div>`;
  let corps;
  if (grille) {
    const colonnes = [
      [formaterDistance(a.distance_m, a.sport), 'Distance'],
      [formaterDureeSaisie(a.duree_s) || null, 'Durée'],
      [vitesse, libelleVitesse],
      [charge, 'Charge'],
    ].filter(([v]) => v).map(([v, l]) => {
      const d = decouperUnite(v);
      return `<div class="chiffre-colonne"><span class="chiffre">${echapperHtml(d.valeur)}</span><span class="chiffre-libelle">${echapperHtml(d.unite || l.toLowerCase())}</span></div>`;
    });
    corps = `<div class="chiffres-grille colonnes-${colonnes.length}">${colonnes.join('')}</div>`;
  } else {
    corps = `<div class="chiffres">
      ${chiffre('Distance', formaterDistance(a.distance_m, a.sport))}
      ${chiffre('Durée', formaterDuree(a.duree_s))}
      ${chiffre(libelleVitesse, vitesse, 'chiffre-second')}
      ${charge !== null ? `<span class="chiffre-second"><span class="lecteur">Charge : </span>${charge}<span class="unite"> charge</span></span>` : ''}</div>`;
  }
  return `<a class="carte carte-activite sport-${sp.code}" href="#/activite/${encodeURIComponent(a.id)}">
    ${tete}${corps}${apercu && a.a_gps ? `<span class="apercu-trace sport-${sp.code}" data-apercu="${echapperHtml(a.id)}"></span>` : ''}</a>`;
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
      const v = bouton.dataset.valeur;
      surChangement(champ, choisi ? (/^\d+$/.test(v) ? Number(v) : v) : null); // valeur numérique ou code (ex. sport)
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

// Graphique des blocs d'une séance (F-41, F-84, F-20) : une barre par étape, largeur = durée, hauteur et
// couleur = zone ; barre en pointillés = durée estimée (étape en distance sans allure seuil). '' si rien à dessiner.
export function graphiqueSeance(seance, allures = {}, { compact = false } = {}) {
  const largeur = 300;
  const hauteur = compact ? 40 : 80;
  const barres = barresSeance(seance, allures);
  const rectangles = rectanglesGraphique(barres, largeur, hauteur);
  if (!rectangles.length) return '';
  return `<svg class="graphique-seance${compact ? ' compact' : ''}" viewBox="0 0 ${largeur} ${hauteur}" preserveAspectRatio="none"
    role="img" aria-label="Profil de la séance, ${formaterDuree(barres.total_s)}">
    ${rectangles.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.largeur}" height="${r.hauteur}" class="${r.classe}"></rect>`).join('')}</svg>`;
}

// --- Mode lecture et modification des formulaires (D-27) ---
// Après un enregistrement, un formulaire passe en lecture : champs figés, boutons masqués, un petit crayon seul.
// Le crayon ouvre la modification : Enregistrer les modifications (actif seulement après un changement et en ligne),
// Supprimer et les autres actions, Annuler. Structure attendue dans le formulaire :
//   <fieldset class="champs-formulaire"> : les champs ; [data-crayon] : le crayon (ou option crayon) ;
//   [data-enregistrer] : le bouton d'enregistrement ; [data-annuler] : facultatif ; .action-edition : actions masquées en lecture.

// Bouton crayon, à placer dans le formulaire (coin haut droit d'une carte) ou dans l'en-tête de l'écran.
export function boutonCrayon(libelle = 'Modifier') {
  return `<button type="button" class="icone-bouton bouton-crayon" data-crayon aria-label="${echapperHtml(libelle)}">${icone('crayon', 20)}</button>`;
}

// Bouton Annuler du mode modification (absent pour un nouvel élément : rien à retrouver).
export function boutonAnnuler() {
  return '<button type="button" class="bouton action-edition" data-annuler>Annuler</button>';
}

// lecture : état de départ (true pour un élément déjà enregistré) ; nouveau : élément pas encore enregistré
// (Enregistrer actif sans changement) ; crayon : bouton hors du formulaire ; surAnnuler : réaffiche les valeurs enregistrées ;
// reseau : false pour un réglage gardé sur l'appareil (enregistrable hors ligne).
// Renvoie { passer(enLecture), estModifie() }.
export function brancherEdition(form, { lecture = true, nouveau = false, crayon = null, surAnnuler = null, reseau = true } = {}) {
  const champs = form.querySelector('fieldset.champs-formulaire');
  const boutonModifier = crayon ?? form.querySelector('[data-crayon]');
  const enregistrer = form.querySelector('[data-enregistrer]');
  let modifie = false;
  const enLecture = () => form.classList.contains('en-lecture');
  function maj() {
    if (!form.isConnected) {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
      return;
    }
    if (enregistrer) enregistrer.disabled = (reseau && !navigator.onLine) || (!nouveau && !modifie); // ENF-07
  }
  function passer(versLecture) {
    // En lecture, un champ vide (heure, description...) est masqué.
    form.querySelectorAll('.champ').forEach((c) => {
      const saisies = c.querySelectorAll('input, textarea, select');
      c.classList.toggle('champ-vide', versLecture && saisies.length > 0 && [...saisies].every((x) => !x.value.trim()));
    });
    form.classList.toggle('en-lecture', versLecture);
    if (champs) champs.disabled = versLecture;
    if (boutonModifier) boutonModifier.hidden = !versLecture;
    modifie = false;
    maj();
  }
  const marquer = () => { if (!enLecture()) { modifie = true; maj(); } };
  form.addEventListener('input', marquer);
  form.addEventListener('change', marquer);
  champs?.addEventListener('click', (ev) => { if (ev.target.closest('button')) marquer(); });
  boutonModifier?.addEventListener('click', () => passer(false));
  form.querySelector('[data-annuler]')?.addEventListener('click', () => (surAnnuler ? surAnnuler() : passer(true)));
  window.addEventListener('online', maj);
  window.addEventListener('offline', maj);
  passer(lecture);
  return { passer, estModifie: () => modifie };
}
