// Écran E-05 "Programmer une séance" : création (F-40), séance structurée par blocs (F-41) envoyée sous forme
// de texte Intervals.icu (F-42), modification et suppression (F-43), déplacement (F-44), duplication (F-45),
// repos (F-46), bibliothèque Intervals.icu (F-47). Écriture en ligne seulement (ENF-07, D-05).
// Routes : #/seance/nouvelle?date=...&depuis=...  et  #/seance/{id}
// L8 : le même éditeur sert aux séances de la semaine type (F-81) : #/seance-type/nouvelle?jour=N&heure=hh:mm et #/seance-type/{id}.
// Heure facultative pour toutes les séances (F-40, F-81).

import { lireSeance, creerSeance, modifierSeance, deplacerSeance, supprimerSeance } from '../api/evenements.js';
import { listerModeles } from '../api/bibliotheque.js';
import {
  lirePreparation, modifierPreparation, lireSeanceBibliotheque, enregistrerSeanceBibliotheque, supprimerSeanceBibliotheque,
} from '../api/preparation.js';
import { ajouterEmplacement, utilisationsSeance } from '../logique/blocs.js';
import {
  TYPES_BLOC, CIBLES, cibleParDefaut, blocsVersTexte, dureeTotaleBlocs, validerSeance, modeleParDefaut,
  lireDureeSaisie, lireDureeEtape, formaterDureeSaisie, formaterDureeEtape,
} from '../logique/seance.js';
import { SPORTS, sport } from '../logique/sports.js';
import { jourISO, dateParametre } from '../logique/dates.js';
import { MESSAGES } from '../logique/messages.js';
import { echapperHtml, formaterDureeLongue } from '../logique/format.js';
import { message, messageErreurApi, squelette, graphiqueSeance, boutonIcone } from './composants.js';
import { icone, iconeSport } from './icones.js';
import { lireAlluresSeuil } from '../api/profil.js';
import { typesProposes, libelleType } from '../logique/types-seance.js';

// Jours de la semaine type (1 = lundi, ENF-20).

// Sports programmables (types reconnus par Intervals.icu) et repos (note du calendrier).
const SPORTS_PROGRAMMABLES = ['NATATION', 'VELO', 'CAP', 'RENFO', 'AUTRE', 'REPOS'];

// Nouvelle étape vide, en durée par défaut.
const etapeVide = (zone = null) => ({ duree_s: null, distance_m: null, zone, mode: 'duree' });

function nouveauBloc(type, sportCode) {
  const cible = cibleParDefaut(sportCode);
  if (type === 'REPETITIONS') return { type, cible, repetitions: 5, effort: etapeVide(4), recup: etapeVide(1) };
  return { type, cible, etape: etapeVide({ ECHAUFFEMENT: 2, CONTINU: 3, RETOUR_CALME: 1 }[type]) };
}

// Mode d'affichage d'une étape (durée ou distance), déduit des valeurs si besoin.
const modeEtape = (e) => e.mode ?? (e.distance_m ? 'distance' : 'duree');

// Copie des blocs sans les informations propres au formulaire (mode).
function blocsPropres(blocs) {
  const propre = (e) => (e ? { ...(modeEtape(e) === 'distance' ? { distance_m: e.distance_m } : { duree_s: e.duree_s }), zone: e.zone } : null);
  return blocs.map((b) => (b.type === 'REPETITIONS'
    ? { type: b.type, cible: b.cible, repetitions: b.repetitions, effort: propre(b.effort), recup: b.recup ? propre(b.recup) : null }
    : { type: b.type, cible: b.cible, etape: propre(b.etape) }));
}

// --- Rendu des blocs (F-41) ---

function champsEtape(e, chemin, libelle) {
  const mode = modeEtape(e);
  return `<div class="etape"><div class="etape-tete"><span class="etape-libelle">${libelle}</span>
      <div class="bascule" role="group" aria-label="Durée ou distance">
        <button type="button" class="${mode === 'duree' ? 'actif' : ''}" data-mode="${chemin}" data-valeur="duree">Durée</button>
        <button type="button" class="${mode === 'distance' ? 'actif' : ''}" data-mode="${chemin}" data-valeur="distance">Distance</button>
      </div></div>
    <div class="etape-champs">
      ${mode === 'duree'
    ? `<label>Durée (m:ss)<input inputmode="numeric" data-champ="${chemin}.duree_s" value="${formaterDureeEtape(e.duree_s)}" placeholder="4:00"></label>`
    : `<label>Distance (m)<input inputmode="numeric" data-champ="${chemin}.distance_m" value="${e.distance_m ?? ''}" placeholder="400"></label>`}
      <label>Zone<select data-champ="${chemin}.zone">
        <option value="">Aucune</option>${[1, 2, 3, 4, 5].map((z) => `<option value="${z}" ${e.zone === z ? 'selected' : ''}>Z${z}</option>`).join('')}
      </select></label>
    </div></div>`;
}

function rendreBloc(b, i) {
  const titre = TYPES_BLOC.find((t) => t.code === b.type).libelle;
  const cible = `<label class="cible">Cible<select data-champ="blocs.${i}.cible">
    ${CIBLES.map((c) => `<option value="${c.code}" ${b.cible === c.code ? 'selected' : ''}>${echapperHtml(c.libelle)}</option>`).join('')}</select></label>`;
  let corps;
  if (b.type === 'REPETITIONS') {
    corps = `<label class="repetitions">Nombre de répétitions<input inputmode="numeric" data-champ="blocs.${i}.repetitions" value="${b.repetitions ?? ''}"></label>
      ${champsEtape(b.effort, `blocs.${i}.effort`, 'Effort')}
      ${b.recup ? champsEtape(b.recup, `blocs.${i}.recup`, 'Récupération') : ''}
      <button type="button" class="lien-action" data-recup="${i}">${b.recup ? 'Retirer la récupération' : '+ Ajouter une récupération'}</button>`;
  } else {
    corps = champsEtape(b.etape, `blocs.${i}.etape`, titre);
  }
  return `<div class="carte bloc" data-bloc="${i}">
    <div class="bloc-tete"><strong>${titre}</strong>
      <button type="button" class="icone-bouton petit" data-retirer="${i}" aria-label="Retirer ce bloc">${icone('fermer', 18)}</button></div>
    ${cible}${corps}<div class="erreur-bloc" data-erreur="blocs.${i}"></div></div>`;
}

export async function afficherProgrammer(conteneur, segments, params = {}) {
  const modeType = segments[0] === 'seance-type'; // séance de la bibliothèque Mes séances (F-81, F-88)
  const id = segments[1] && segments[1] !== 'nouvelle' ? decodeURIComponent(segments[1]) : null;
  // Mes séances ouvert depuis le Profil (D-24) : l'éditeur y revient ; valeur contrôlée (D-21).
  const ecranType = modeType && params.retour === 'seances' ? '#/seances' : '#/objectif';
  const retour = modeType ? ecranType : '#/agenda';
  const titreEcran = modeType ? (id ? 'Mes séances' : 'Nouvelle séance') : (id ? 'Modifier la séance' : 'Programmer');
  conteneur.innerHTML = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: retour })}
    <span class="titre-petit">${titreEcran}</span><span class="espace-bouton"></span></div>${squelette()}`;
  conteneur.querySelector('.entete a').addEventListener('click', (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });

  // État du formulaire : nouvelle séance, copie (F-45) ou séance existante (F-43).
  // La date de l'adresse est contrôlée avant d'être insérée dans la page (D-21).
  let etat = { date: dateParametre(params.date, jourISO()), sport: 'CAP', titre: '', duree_s: null, distance_m: null, description: '', blocs: [] };
  // Mes séances (F-88) : une séance n'a ni jour ni heure ; créée depuis une case d'un bloc, elle y est placée
  // (#/seance-type/nouvelle?bloc=N&jour=J&heure=hh:mm, paramètres vérifiés, D-21).
  const heureValide = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h ?? '');
  const placement = modeType && !id && /^\d+$/.test(params.bloc ?? '')
    ? { bloc: Number(params.bloc), jour: Math.min(7, Math.max(1, Number(params.jour) || 1)), heure: heureValide(params.heure) ? params.heure : null }
    : null;
  etat.heure = !modeType && heureValide(params.heure) ? params.heure : null;
  let utilisations = 0;
  let structuree = false;
  let banque = []; // Mes séances : types libres déjà utilisés, proposés dans l'éditeur (D-25)
  try {
    if (modeType) banque = (await lirePreparation()).seances ?? [];
    const source = id ?? (modeType ? null : params.depuis);
    if (source) {
      const s = modeType ? await lireSeanceBibliotheque(source) : await lireSeance(source);
      if (modeType) {
        utilisations = utilisationsSeance((await lirePreparation()).blocs ?? [], source);
        banque = banque.filter((x) => x.id !== source);
        delete s.jour;
        s.heure = null;
      }
      etat = { ...etat, ...s, date: id ? s.date : etat.date, blocs: s.blocs ?? [], description: s.blocs ? '' : (s.description ?? '') };
      structuree = Boolean(s.blocs?.length);
    }
  } catch (e) {
    conteneur.querySelector('.carte')?.remove();
    conteneur.insertAdjacentHTML('beforeend', messageErreurApi(e));
    return;
  }
  if (!conteneur.isConnected) return;

  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: retour })}
      <span class="titre-petit">${titreEcran}</span><span class="espace-bouton"></span></div>
    <div id="hors-ligne"></div>
    <form id="formulaire" novalidate>
      <div class="carte">
        <div class="champ"><span class="etiquette-champ">Sport</span>
          <div class="choix-sport" role="group" aria-label="Sport">
            ${SPORTS_PROGRAMMABLES.map((c) => `<button type="button" class="filtre filtre-sport sport-${c}" data-sport="${c}">${iconeSport(c, 18)} ${echapperHtml(sport(c).libelle)}</button>`).join('')}
          </div></div>
        ${modeType
    ? (utilisations > 1 ? message('info', `Utilisée dans ${utilisations} blocs : la modification s'applique partout.`) : '')
    : `<div class="champ"><label for="date">Date</label><input type="date" id="date" value="${echapperHtml(etat.date)}" required></div>
        <div class="champ"><label for="heure">Heure (facultatif)</label><input type="time" id="heure" value="${echapperHtml(etat.heure ?? '')}"></div>`}
        <div class="champ"><label for="titre">Titre</label><input id="titre" maxlength="80" value="${echapperHtml(etat.titre)}" placeholder="Ex. Fractionné 6 x 800 m"></div>
        ${modeType ? '<div class="champ" id="zone-type"></div>' : ''}
        <div id="zone-bibliotheque"></div>
      </div>
      <div id="zone-contenu"></div>
      <div id="resultat" aria-live="polite"></div>
      <div class="pile">
        <button type="submit" class="bouton principal" id="enregistrer">${libelleEnregistrer()}</button>
        ${modeType && id ? '<button type="button" class="bouton danger" id="supprimer">Supprimer de Mes séances</button>' : ''}
        ${id && !modeType ? `<button type="button" class="bouton" id="deplacer">Déplacer vers...</button>
          <div id="zone-deplacer" class="carte masque"><div class="champ"><label for="nouvelle-date">Nouvelle date</label>
            <input type="date" id="nouvelle-date" value="${echapperHtml(etat.date)}"></div>
            <button type="button" class="bouton principal" id="valider-deplacement">Déplacer</button></div>
          <a class="bouton" href="#/seance/nouvelle?depuis=${encodeURIComponent(id)}">Dupliquer</a>
          <button type="button" class="bouton danger" id="supprimer">Supprimer</button>` : ''}
      </div>
    </form>`;

  const $ = (sel) => conteneur.querySelector(sel);
  const form = $('#formulaire');
  const allures = await lireAlluresSeuil(); // étapes en distance du graphique (F-41)
  function libelleEnregistrer() {
    if (modeType) return placement ? 'Enregistrer et placer dans le bloc' : 'Enregistrer dans Mes séances';
    return id ? 'Enregistrer les modifications' : 'Enregistrer dans Intervals.icu';
  }
  conteneur.querySelector('.entete a').addEventListener('click', (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });

  // ENF-07 : sans réseau, les boutons d'écriture sont désactivés avec le message M-04.
  function majReseau() {
    if (!conteneur.contains(form)) { // écran quitté : on retire les écouteurs
      window.removeEventListener('online', majReseau);
      window.removeEventListener('offline', majReseau);
      return;
    }
    const enLigne = navigator.onLine;
    $('#hors-ligne').innerHTML = enLigne ? '' : message('info', MESSAGES['M-04']);
    form.querySelectorAll('#enregistrer, #deplacer, #valider-deplacement, #supprimer').forEach((b) => { b.disabled = !enLigne; });
  }
  window.addEventListener('online', majReseau);
  window.addEventListener('offline', majReseau);

  // D-25 : type de la séance de la banque (liste fixe du sport, types libres déjà utilisés, ou texte libre).
  function rendreType() {
    const zone = $('#zone-type');
    if (!zone) return;
    if (etat.sport === 'REPOS') { zone.innerHTML = ''; return; }
    zone.innerHTML = `<span class="etiquette-champ" id="etiquette-type">Type de séance</span>
      <div class="choix-groupe" role="group" aria-labelledby="etiquette-type">
        ${typesProposes(etat.sport, banque).map((t) => `<button type="button" class="filtre" data-type-seance="${echapperHtml(t)}">${echapperHtml(t)}</button>`).join('')}
      </div>
      <input id="type-seance" maxlength="30" value="${echapperHtml(etat.type_seance ?? '')}" placeholder="Ou écris ton propre type" aria-labelledby="etiquette-type">`;
    majChoixType();
  }
  function majChoixType() {
    const choisi = libelleType($('#type-seance')?.value);
    form.querySelectorAll('[data-type-seance]').forEach((b) => {
      const actif = b.dataset.typeSeance === choisi;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', String(actif));
    });
  }

  // Contenu selon le sport et le mode : repos (F-46), séance simple (F-40) ou structurée (F-41).
  function rendreContenu() {
    form.querySelectorAll('[data-sport]').forEach((b) => b.classList.toggle('actif', b.dataset.sport === etat.sport));
    rendreType();
    const zone = $('#zone-contenu');
    $('#zone-bibliotheque').innerHTML = etat.sport === 'REPOS' ? ''
      : '<button type="button" class="lien-action" id="ouvrir-bibliotheque">Choisir dans ma bibliothèque Intervals.icu</button><div id="bibliotheque"></div>';
    if (etat.sport === 'REPOS') {
      zone.innerHTML = `<div class="carte"><p class="doux">Une note "Repos" sera ajoutée à ton calendrier Intervals.icu.</p>
        <div class="champ"><label for="description">Note (facultatif)</label><textarea id="description" rows="3">${echapperHtml(etat.description)}</textarea></div></div>`;
      return;
    }
    const bascule = `<div class="bascule large" role="group" aria-label="Type de séance">
      <button type="button" class="${structuree ? '' : 'actif'}" data-structure="non">Simple</button>
      <button type="button" class="${structuree ? 'actif' : ''}" data-structure="oui">Structurée</button></div>`;
    if (!structuree) {
      zone.innerHTML = `${bascule}<div class="carte">
        <div class="deux-colonnes">
          <div class="champ"><label for="duree">Durée (h:mm)</label><input id="duree" inputmode="numeric" value="${formaterDureeSaisie(etat.duree_s)}" placeholder="1:00"></div>
          <div class="champ"><label for="distance">Distance (${etat.sport === 'NATATION' ? 'm' : 'km'})</label>
            <input id="distance" inputmode="decimal" value="${etat.distance_m ? (etat.sport === 'NATATION' ? etat.distance_m : String(etat.distance_m / 1000).replace('.', ',')) : ''}"></div>
        </div>
        <div class="champ"><label for="description">Description</label><textarea id="description" rows="5" placeholder="Contenu de la séance">${echapperHtml(etat.description)}</textarea>
          <div class="aide">Un texte au format Intervals.icu (lignes du type "- 10m Z2") part aussi structuré sur la montre.</div></div>
      </div>`;
      return;
    }
    zone.innerHTML = `${bascule}
      ${etat.blocs.map(rendreBloc).join('')}
      <div class="ajout-blocs">${TYPES_BLOC.map((t) => `<button type="button" class="bouton" data-ajouter="${t.code}">${icone('plus', 18)} ${echapperHtml(t.libelle)}</button>`).join('')}</div>
      <div class="carte"><div class="etiquette-carte">Aperçu envoyé à Intervals.icu</div>
        <div id="graphique"></div>
        <pre class="apercu" id="apercu"></pre><p class="doux" id="duree-estimee"></p></div>`;
    majApercu();
  }

  // F-42 : texte de séance exactement tel qu'il sera envoyé.
  function majApercu() {
    if (!$('#apercu')) return;
    const blocs = blocsPropres(etat.blocs);
    $('#apercu').textContent = blocs.length ? blocsVersTexte(blocs, etat.sport) : 'Ajoute des blocs.';
    $('#graphique').innerHTML = graphiqueSeance({ sport: etat.sport, blocs }, allures); // F-41 : mis à jour en direct
    const total = dureeTotaleBlocs(blocs);
    $('#duree-estimee').textContent = total ? `Durée estimée : ${formaterDureeLongue(total)} (hors étapes en distance)` : '';
  }

  // Met à jour l'état depuis un champ de bloc (data-champ = "blocs.0.effort.duree_s").
  function lireChampBloc(el) {
    const parties = el.dataset.champ.split('.');
    const cle = parties.pop();
    const cible = parties.reduce((o, p) => o[p], etat);
    const v = el.value.trim();
    if (cle === 'duree_s') cible.duree_s = v ? lireDureeEtape(v) : null;
    else if (cle === 'distance_m') cible.distance_m = v && /^\d+$/.test(v) ? Number(v) : null;
    else if (cle === 'zone') cible.zone = v ? Number(v) : null;
    else if (cle === 'repetitions') cible.repetitions = /^\d+$/.test(v) ? Number(v) : null;
    else if (cle === 'cible') cible.cible = v;
  }

  // Lit les champs simples (titre, date, durée, distance, description) dans l'état.
  function lireChampsSimples() {
    etat.titre = $('#titre').value.trim();
    if ($('#type-seance')) etat.type_seance = libelleType($('#type-seance').value);
    if ($('#date')) etat.date = $('#date').value;
    etat.heure = $('#heure')?.value || null;
    if ($('#description')) etat.description = $('#description').value;
    if ($('#duree')) etat.duree_s = $('#duree').value.trim() ? lireDureeSaisie($('#duree').value) ?? -1 : null;
    if ($('#distance')) {
      const t = $('#distance').value.trim().replace(',', '.');
      etat.distance_m = !t ? null : /^\d+(\.\d+)?$/.test(t) ? Math.round(Number(t) * (etat.sport === 'NATATION' ? 1 : 1000)) : -1;
    }
  }

  form.addEventListener('input', (ev) => {
    if (ev.target.id === 'type-seance') majChoixType();
    if (ev.target.dataset.champ) { lireChampBloc(ev.target); majApercu(); }
  });
  form.addEventListener('change', (ev) => {
    if (ev.target.dataset.champ) { lireChampBloc(ev.target); majApercu(); }
  });
  form.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.type === 'submit') return;
    const d = b.dataset;
    if (d.sport) {
      lireChampsSimples();
      const ancien = etat.sport;
      etat.sport = d.sport;
      // La cible par défaut suit le sport tant que les blocs n'ont pas été personnalisés.
      if (cibleParDefaut(ancien) !== cibleParDefaut(etat.sport)) etat.blocs.forEach((bl) => { if (bl.cible === cibleParDefaut(ancien)) bl.cible = cibleParDefaut(etat.sport); });
      if (etat.sport === 'REPOS' && !etat.titre) { etat.titre = 'Repos'; $('#titre').value = 'Repos'; }
      rendreContenu();
    } else if (d.structure) {
      lireChampsSimples();
      structuree = d.structure === 'oui';
      if (structuree && !etat.blocs.length) etat.blocs = modeleParDefaut(etat.sport);
      rendreContenu();
    } else if (d.ajouter) {
      etat.blocs.push(nouveauBloc(d.ajouter, etat.sport));
      rendreContenu();
    } else if (d.retirer !== undefined) {
      etat.blocs.splice(Number(d.retirer), 1);
      rendreContenu();
    } else if (d.recup !== undefined) {
      const bloc = etat.blocs[Number(d.recup)];
      bloc.recup = bloc.recup ? null : etapeVide(1);
      rendreContenu();
    } else if (d.mode) {
      const e = d.mode.split('.').reduce((o, p) => o[p], etat);
      e.mode = d.valeur;
      if (d.valeur === 'duree') e.distance_m = null; else e.duree_s = null;
      rendreContenu();
    } else if (d.typeSeance) {
      const champ = $('#type-seance');
      champ.value = libelleType(champ.value) === d.typeSeance ? '' : d.typeSeance; // un 2e appui retire le type
      etat.type_seance = libelleType(champ.value);
      majChoixType();
    } else if (b.id === 'ouvrir-bibliotheque') {
      await ouvrirBibliotheque();
    } else if (d.modele) {
      utiliserModele(d.modele);
    }
  });

  // F-47 : modèles de la bibliothèque Intervals.icu.
  let modeles = [];
  async function ouvrirBibliotheque() {
    const zone = $('#bibliotheque');
    zone.innerHTML = '<div class="squelette"></div>';
    try {
      modeles = await listerModeles();
      const liste = modeles.filter((m) => m.sport === etat.sport);
      const autres = modeles.filter((m) => m.sport !== etat.sport);
      zone.innerHTML = modeles.length
        ? `<div class="liste-modeles">${[...liste, ...autres].map((m) => `<button type="button" class="modele" data-modele="${echapperHtml(m.id)}">
            <span class="sport-${sport(m.sport).code} modele-icone">${iconeSport(m.sport, 18)}</span><span>${echapperHtml(m.titre)}</span></button>`).join('')}</div>`
        : '<p class="doux">Ta bibliothèque Intervals.icu est vide.</p>';
    } catch (e) {
      zone.innerHTML = messageErreurApi(e);
    }
  }

  function utiliserModele(idModele) {
    const m = modeles.find((x) => x.id === idModele);
    if (!m) return;
    etat = { ...etat, sport: SPORTS_PROGRAMMABLES.includes(m.sport) ? m.sport : 'AUTRE', titre: m.titre, duree_s: m.duree_s, distance_m: m.distance_m,
      description: m.blocs ? '' : (m.description ?? ''), blocs: m.blocs ?? [] };
    structuree = Boolean(m.blocs?.length);
    $('#titre').value = etat.titre;
    rendreContenu();
  }

  // Affiche les erreurs de validation près des champs.
  function afficherErreurs(erreurs) {
    form.querySelectorAll('.erreur-champ').forEach((e) => e.remove());
    form.querySelectorAll('.invalide').forEach((e) => e.classList.remove('invalide'));
    form.querySelectorAll('[data-erreur]').forEach((e) => { e.textContent = ''; });
    for (const [champ, texte] of Object.entries(erreurs)) {
      const zoneBloc = form.querySelector(`[data-erreur="${champ}"]`);
      if (zoneBloc) { zoneBloc.textContent = texte; continue; }
      const input = form.querySelector(`#${champ}`);
      if (input) {
        input.classList.add('invalide');
        input.insertAdjacentHTML('afterend', `<div class="erreur-champ" role="alert">${echapperHtml(texte)}</div>`);
      }
    }
  }

  // Envoi (F-40, F-43) ; en cas d'échec, le formulaire reste rempli (ENF-07 : rien n'est perdu en silence).
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    lireChampsSimples();
    const seance = { ...etat, blocs: structuree && etat.sport !== 'REPOS' ? blocsPropres(etat.blocs) : [] };
    const erreurs = validerSeance(seance);
    if (modeType) delete erreurs.date; // une séance type a un jour, pas de date
    if (etat.duree_s === -1) erreurs.duree = 'Durée attendue en h:mm, par exemple 1:15.';
    if (etat.distance_m === -1) erreurs.distance = 'Distance invalide.';
    if (structuree && etat.sport !== 'REPOS' && !seance.blocs.length) erreurs.titre = erreurs.titre ?? 'Ajoute au moins un bloc.';
    afficherErreurs(erreurs);
    if (Object.keys(erreurs).length) { $('#resultat').innerHTML = message('erreur', 'Corrige les champs signalés.'); return; }
    const bouton = $('#enregistrer');
    bouton.disabled = true;
    bouton.textContent = 'Enregistrement...';
    try {
      if (modeType) {
        const enregistree = await enregistrerSeanceBibliotheque({ ...seance, id });
        if (placement) {
          await modifierPreparation((p) => ({
            reglages: p.reglages,
            blocs: p.blocs?.[placement.bloc]
              ? ajouterEmplacement(p.blocs, placement.bloc, { seanceId: enregistree.id, jour: placement.jour, heure: placement.heure })
              : p.blocs ?? [],
          }));
        }
        location.hash = placement ? `#/objectif?bloc=${placement.bloc}` : ecranType;
        return;
      }
      const enregistree = id ? await modifierSeance(id, seance) : await creerSeance(seance);
      location.hash = `#/agenda?vue=semaine&date=${enregistree.date || seance.date}`;
    } catch (e) {
      $('#resultat').innerHTML = messageErreurApi(e);
      bouton.disabled = !navigator.onLine;
      bouton.textContent = libelleEnregistrer();
    }
  });

  if (id && modeType) {
    // F-88 : supprimer une séance de Mes séances (elle est retirée de tous les blocs, conception 5.1).
    $('#supprimer').addEventListener('click', async () => {
      const blocs = utilisations ? ` Elle sera retirée de ${utilisations} bloc${utilisations > 1 ? 's' : ''}.` : '';
      if (!confirm(`Supprimer cette séance de Mes séances ?${blocs}`)) return;
      try {
        await supprimerSeanceBibliotheque(id);
        location.hash = ecranType;
      } catch (e) {
        $('#resultat').innerHTML = messageErreurApi(e);
      }
    });
  } else if (id) {
    // F-44 : déplacer vers une autre date.
    $('#deplacer').addEventListener('click', () => $('#zone-deplacer').classList.toggle('masque'));
    $('#valider-deplacement').addEventListener('click', async () => {
      const date = $('#nouvelle-date').value;
      if (!date) return;
      try {
        await deplacerSeance(id, date, etat.heure); // F-44 : même heure
        location.hash = `#/agenda?vue=semaine&date=${date}`;
      } catch (e) {
        $('#resultat').innerHTML = messageErreurApi(e);
      }
    });
    // F-43 : suppression après confirmation M-05.
    $('#supprimer').addEventListener('click', async () => {
      if (!confirm(MESSAGES['M-05'])) return;
      try {
        await supprimerSeance(id);
        location.hash = `#/agenda?vue=semaine&date=${etat.date}`;
      } catch (e) {
        $('#resultat').innerHTML = messageErreurApi(e);
      }
    });
  }

  rendreContenu();
  majReseau();
}
