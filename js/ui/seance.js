// Écran E-02 "Séance prévue" : création, modification, suppression (F-10, F-11, F-13).
// Enregistrement automatique (C-04, ENF-16) ; contrôles par regles/validation.js (C-14).

import { lire, ecrire, prochainOrdre, supprimerSeancePrevue } from '../db/database.js';
import {
  BORNES, validerSeancePrevue, lireDuree, formaterDuree, lireDureeCourte, formaterDureeCourte,
  lireDistance, formaterDistanceSaisie,
} from '../regles/validation.js';
import { SPORTS, TYPES, MESSAGES, formaterMessage, jourISO, echapperHtml } from './commun.js';

// Erreur M-02 utilisée quand une saisie est illisible (ex. "1:75").
function erreurIllisible(cle) {
  const b = BORNES[cle];
  return { code: 'M-02', champ: b.libelle, min: b.minAff, max: b.maxAff };
}

// HTML d'une ligne de bloc (F-11).
function ligneBloc(b = {}) {
  const zones = ['', 1, 2, 3, 4, 5].map((z) => `<option value="${z}" ${String(b.zone ?? '') === String(z) ? 'selected' : ''}>${z ? 'Z' + z : 'Zone'}</option>`).join('');
  return `<div class="bloc">
    <div><label>Répétitions</label><input inputmode="numeric" data-b="repetitions" value="${b.repetitions ?? 1}"></div>
    <div><label>Zone</label><select data-b="zone">${zones}</select></div>
    <div><label>Durée (m:ss)</label><input inputmode="decimal" data-b="duree" value="${b.duree_s ? formaterDureeCourte(b.duree_s) : ''}"></div>
    <div><label>ou distance (m)</label><input inputmode="numeric" data-b="distance" value="${b.distance_m ?? ''}"></div>
    <div><label>Récup (m:ss)</label><input inputmode="decimal" data-b="recup" value="${b.recup_s ? formaterDureeCourte(b.recup_s) : ''}"></div>
    <button type="button" class="supprimer-bloc danger">Retirer ce bloc</button>
  </div>`;
}

// Affiche le formulaire ; segments[1] = 'nouvelle' ou l'id de la séance.
export async function afficherSeance(conteneur, contexte, segments, params) {
  const nouvelle = segments[1] === 'nouvelle';
  let seance = nouvelle
    ? { athlete_id: contexte.athleteId, date: params.date || jourISO(), sport: 'CAP', type: 'ENDURANCE', titre: '', cle: false }
    : await lire('seances_prevues', segments[1]);

  if (!seance) {
    conteneur.innerHTML = '<h1>Séance introuvable</h1><a class="bouton" href="#/aujourdhui">Retour</a>';
    return;
  }

  const blocsInitiaux = seance.segments?.[0]?.blocs ?? [];
  conteneur.innerHTML = `
    <h1>${nouvelle ? 'Nouvelle séance prévue' : 'Séance prévue'}</h1>
    <form novalidate>
      <div class="champ"><label for="date">Date</label><input type="date" id="date" data-champ="date" value="${seance.date}"></div>
      <div class="champ"><span class="etiquette">Sport</span><div class="groupe" id="sports">
        ${SPORTS.map((s) => `<button type="button" data-sport="${s.code}"><span aria-hidden="true">${s.icone}</span> ${s.libelle}</button>`).join('')}
      </div></div>
      <div class="champ hors-repos"><label for="type">Type</label><select id="type">
        ${TYPES.map((t) => `<option value="${t.code}" ${seance.type === t.code ? 'selected' : ''}>${t.libelle}</option>`).join('')}
      </select></div>
      <div class="champ"><label for="titre">Titre</label><input type="text" id="titre" data-champ="titre" maxlength="60" value="${echapperHtml(seance.titre)}"></div>
      <div class="champ hors-repos"><label for="duree">Durée (h:mm)</label>
        <input id="duree" data-champ="duree_s" inputmode="decimal" placeholder="1:30" value="${seance.duree_s ? formaterDuree(seance.duree_s) : ''}"></div>
      <div class="champ hors-repos"><label for="distance">Distance (<span id="unite"></span>)</label>
        <input id="distance" data-champ="distance_m" inputmode="decimal" value="${seance.distance_m ? formaterDistanceSaisie(seance.distance_m, seance.sport) : ''}"></div>
      <div class="champ hors-repos"><span class="etiquette">Zone cible</span><div class="groupe" id="zones">
        ${['', 1, 2, 3, 4, 5].map((z) => `<button type="button" data-zone="${z}">${z ? 'Z' + z : 'Aucune'}</button>`).join('')}
      </div></div>
      <label class="case"><input type="checkbox" id="cle" ${seance.cle ? 'checked' : ''}> Séance clé</label>
      <div class="champ hors-repos"><span class="etiquette">Blocs</span><div id="blocs">${blocsInitiaux.map(ligneBloc).join('')}</div>
        <button type="button" id="ajouter-bloc">+ Ajouter un bloc</button></div>
      <div class="champ"><label for="description">Description</label><textarea id="description">${echapperHtml(seance.description ?? '')}</textarea></div>
      <div class="pied-formulaire">
        <button type="button" id="retour">Retour</button>
        <button type="button" id="supprimer" class="danger ${nouvelle ? 'masque' : ''}">Supprimer</button>
      </div>
    </form>`;

  const form = conteneur.querySelector('form');
  const $ = (sel) => form.querySelector(sel);
  let sportCourant = seance.sport;
  let zoneCourante = seance.zone_cible ?? '';
  let titreTouche = !nouvelle;

  // Mise à jour visuelle : sport et zone choisis, champs masqués pour le repos (C-05), unité de distance.
  function rafraichir() {
    form.querySelectorAll('[data-sport]').forEach((b) => b.classList.toggle('choisi', b.dataset.sport === sportCourant));
    form.querySelectorAll('[data-zone]').forEach((b) => b.classList.toggle('choisi', b.dataset.zone === String(zoneCourante)));
    form.querySelectorAll('.hors-repos').forEach((e) => e.classList.toggle('masque', sportCourant === 'REPOS'));
    $('#unite').textContent = sportCourant === 'NATATION' ? 'm' : 'km';
  }

  // Lit le formulaire : renvoie la séance à enregistrer et les erreurs de saisie illisible.
  function lireFormulaire() {
    const erreurs = {};
    const s = {
      ...seance,
      date: $('#date').value || seance.date,
      sport: sportCourant,
      titre: $('#titre').value.trim(),
      cle: $('#cle').checked,
      description: $('#description').value.trim(),
    };
    if (!s.description) delete s.description;
    if (sportCourant === 'REPOS') {
      // C-05, F-13 : le repos n'a ni type, ni durée, ni distance, ni zone, ni blocs
      s.type = 'RECUP';
      s.segments = [];
      delete s.duree_s; delete s.distance_m; delete s.zone_cible;
      return { s, erreurs };
    }
    s.type = $('#type').value;
    const texteDuree = $('#duree').value.trim();
    s.duree_s = texteDuree ? lireDuree(texteDuree) : undefined;
    if (texteDuree && s.duree_s === null) erreurs.duree_s = erreurIllisible('duree');
    const texteDistance = $('#distance').value.trim();
    s.distance_m = texteDistance ? lireDistance(texteDistance, sportCourant) : undefined;
    if (texteDistance && s.distance_m === null) erreurs.distance_m = erreurIllisible('distance');
    for (const cle of ['duree_s', 'distance_m']) if (s[cle] === undefined || s[cle] === null) delete s[cle];
    if (zoneCourante) s.zone_cible = Number(zoneCourante); else delete s.zone_cible;

    const blocs = [...form.querySelectorAll('.bloc')].map((ligne, i) => {
      const val = (n) => ligne.querySelector(`[data-b="${n}"]`).value.trim();
      const b = { repetitions: val('repetitions') === '' ? 1 : Number(val('repetitions')) };
      if (Number.isNaN(b.repetitions)) erreurs[`blocs.${i}.repetitions`] = erreurIllisible('repetitions');
      if (val('distance')) {
        b.distance_m = lireDistance(val('distance'), 'NATATION'); // distance des blocs toujours en m
        if (b.distance_m === null) erreurs[`blocs.${i}.distance_m`] = erreurIllisible('distance');
      } else if (val('duree')) {
        b.duree_s = lireDureeCourte(val('duree'));
        if (b.duree_s === null) erreurs[`blocs.${i}.duree_s`] = erreurIllisible('duree');
      }
      if (val('zone')) b.zone = Number(val('zone'));
      if (val('recup')) {
        b.recup_s = lireDureeCourte(val('recup'));
        if (b.recup_s === null) erreurs[`blocs.${i}.recup_s`] = erreurIllisible('duree');
      }
      return b;
    });
    s.segments = blocs.length ? [{ ordre: 1, sport: sportCourant, blocs }] : []; // D-05 : un seul segment
    return { s, erreurs };
  }

  // Affiche les erreurs sous les champs concernés (C-14).
  function afficherErreurs(erreurs) {
    form.querySelectorAll('.erreur').forEach((e) => e.remove());
    form.querySelectorAll('.invalide').forEach((e) => e.classList.remove('invalide'));
    form.querySelectorAll('.bloc').forEach((ligne, i) => {
      for (const [n, cle] of [['repetitions', 'repetitions'], ['distance', 'distance_m'], ['duree', 'duree_s'], ['recup', 'recup_s']]) {
        ligne.querySelector(`[data-b="${n}"]`).dataset.champ = `blocs.${i}.${cle}`;
      }
    });
    for (const [champ, erreur] of Object.entries(erreurs)) {
      const el = form.querySelector(`[data-champ="${champ}"]`);
      if (!el) continue;
      el.classList.add('invalide');
      el.insertAdjacentHTML('afterend', `<div class="erreur" role="alert">${echapperHtml(formaterMessage(erreur))}</div>`);
    }
  }

  // Enregistre si tout est valide ; rien n'est créé tant que le titre est vide (C-04).
  async function faireEnregistrer() {
    const { s, erreurs } = lireFormulaire();
    const resultat = validerSeancePrevue(s);
    const toutes = { ...resultat.erreurs, ...erreurs };
    const affichees = { ...toutes };
    if (!titreTouche && toutes.titre?.code === 'M-01') delete affichees.titre;
    afficherErreurs(affichees);
    if (Object.keys(toutes).length) return;
    if (!s.id) s.ordre = await prochainOrdre(contexte.athleteId, s.date); // C-03
    seance = await ecrire('seances_prevues', s);
    if (nouvelle && location.hash.startsWith('#/seance/nouvelle')) {
      history.replaceState(null, '', `#/seance/${seance.id}`);
      $('#supprimer').classList.remove('masque');
    }
  }

  // Enregistrements en file pour éviter deux créations simultanées.
  let file = Promise.resolve();
  let minuterie = null;
  function enregistrer() {
    clearTimeout(minuterie);
    file = file.then(faireEnregistrer).catch((e) => console.error(e));
    return file;
  }
  function planifier() {
    clearTimeout(minuterie);
    minuterie = setTimeout(enregistrer, 500); // C-04 : 0,5 s après la dernière frappe
  }

  form.addEventListener('input', planifier);
  form.addEventListener('change', enregistrer);
  form.addEventListener('focusout', (ev) => {
    if (ev.target.id === 'titre') titreTouche = true;
    if (ev.target.matches('input, textarea, select')) enregistrer();
  });
  form.addEventListener('click', (ev) => {
    const bouton = ev.target.closest('button');
    if (!bouton) return;
    if (bouton.dataset.sport) { sportCourant = bouton.dataset.sport; rafraichir(); enregistrer(); }
    if (bouton.dataset.zone !== undefined) { zoneCourante = bouton.dataset.zone; rafraichir(); enregistrer(); }
    if (bouton.classList.contains('supprimer-bloc')) { bouton.closest('.bloc').remove(); enregistrer(); }
  });
  $('#ajouter-bloc').addEventListener('click', () => $('#blocs').insertAdjacentHTML('beforeend', ligneBloc()));
  $('#retour').addEventListener('click', async () => {
    await enregistrer();
    location.hash = `#/aujourdhui?date=${seance.date}`;
  });
  // C-13 : suppression après confirmation M-03 ; la réalisation éventuelle est conservée.
  $('#supprimer').addEventListener('click', async () => {
    if (!seance.id || !confirm(MESSAGES['M-03'])) return;
    clearTimeout(minuterie);
    await file;
    await supprimerSeancePrevue(seance.id);
    location.hash = `#/aujourdhui?date=${seance.date}`;
  });

  rafraichir();
  if (nouvelle) $('#titre').focus();
}
