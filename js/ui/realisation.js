// Écran E-03 "Détails du réalisé" (F-21, F-22, F-23, F-24, C-11, C-12, C-14).
// Enregistrement automatique (ENF-16) ; l'allure est affichée, jamais stockée (4.4).

import { lire, ecrire, supprimer } from '../db/database.js';
import {
  validerRealisation, normaliserRealisation, calculerAllure, lireDuree, formaterDuree, lireDistance,
  formaterDistanceSaisie,
} from '../regles/validation.js';
import {
  SPORTS, STATUTS, MOTIFS, ZONES_DOULEUR, LIBELLES_RPE, MESSAGES, formaterMessage, jourISO, echapperHtml,
} from './commun.js';

// Texte -> nombre ; vide -> undefined ; illisible -> NaN (refusé ensuite par la validation, M-02).
function lireNombre(texte) {
  const t = texte.trim().replace(',', '.');
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// Affiche le formulaire ; segments[1] = 'nouvelle' (séance non prévue) ou l'id de la réalisation.
export async function afficherRealisation(conteneur, contexte, segments, params) {
  const nouvelle = segments[1] === 'nouvelle';
  let r = nouvelle
    ? { athlete_id: contexte.athleteId, date: params.date || jourISO(), statut: 'FAITE', source: 'MANUEL' }
    : await lire('realisations', segments[1]);

  if (!r) {
    conteneur.innerHTML = '<h1>Réalisation introuvable</h1><a class="bouton" href="#/aujourdhui">Retour</a>';
    return;
  }

  const seance = r.seance_prevue_id ? await lire('seances_prevues', r.seance_prevue_id) : null;
  const prevue = Boolean(r.seance_prevue_id);
  const titre = seance ? echapperHtml(seance.titre) : 'Séance non prévue';

  conteneur.innerHTML = `
    <h1>Réalisé : ${titre}</h1>
    <form novalidate>
      <div class="champ ${prevue ? 'masque' : ''}"><span class="etiquette">Sport</span>
        <div class="groupe" data-champ="sport">${SPORTS.filter((s) => s.code !== 'REPOS')
          .map((s) => `<button type="button" data-sport="${s.code}"><span aria-hidden="true">${s.icone}</span> ${s.libelle}</button>`).join('')}</div></div>
      <div class="champ ${prevue ? '' : 'masque'}"><span class="etiquette">Statut</span>
        <div class="groupe" data-champ="statut">${STATUTS.map((s) => `<button type="button" data-statut="${s.code}">${s.libelle}</button>`).join('')}</div></div>
      <div class="champ si-sautee"><span class="etiquette">Motif</span>
        <div class="groupe" data-champ="motif">${MOTIFS.map((m) => `<button type="button" data-motif="${m.code}">${m.libelle}</button>`).join('')}</div></div>
      <div class="champ hors-sautee"><label for="duree">Durée (h:mm)</label>
        <input id="duree" data-champ="duree_s" inputmode="decimal" placeholder="1:00" value="${r.duree_s ? formaterDuree(r.duree_s) : ''}"></div>
      <div class="champ hors-sautee"><label for="distance">Distance (<span id="unite"></span>)</label>
        <input id="distance" data-champ="distance_m" inputmode="decimal" value="${r.distance_m ? formaterDistanceSaisie(r.distance_m, r.sport) : ''}">
        <div class="aide" id="allure"></div></div>
      <div class="champ hors-sautee"><label for="fc">FC moyenne (bpm)</label>
        <input id="fc" data-champ="fc_moy" inputmode="numeric" value="${r.fc_moy ?? ''}"></div>
      <div class="champ hors-sautee si-velo"><label for="puissance">Puissance moyenne (W)</label>
        <input id="puissance" data-champ="puissance_moy_w" inputmode="numeric" value="${r.puissance_moy_w ?? ''}"></div>
      <div class="champ hors-sautee"><span class="etiquette">RPE (effort perçu)</span>
        <div class="grille-rpe" data-champ="rpe">${Object.entries(LIBELLES_RPE)
          .map(([n, l]) => `<button type="button" data-rpe="${n}"><strong>${n}</strong> ${l}</button>`).join('')}</div></div>
      <div class="champ hors-sautee"><label for="douleur">Douleur</label>
        <select id="douleur" data-champ="douleur"><option value="">Aucune</option>
          ${ZONES_DOULEUR.map((z) => `<option ${r.douleur?.zone === z ? 'selected' : ''}>${z}</option>`).join('')}</select>
        <div class="groupe" id="intensites">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-intensite="${i}">${i}</button>`).join('')}</div>
        <div class="aide" id="aide-intensite">Intensité de 1 (légère) à 5 (forte)</div></div>
      <div class="champ"><label for="commentaire">Commentaire</label>
        <textarea id="commentaire">${echapperHtml(r.commentaire ?? '')}</textarea></div>
      <div class="pied-formulaire">
        <button type="button" id="retour">Retour</button>
        <button type="button" id="effacer" class="danger ${nouvelle ? 'masque' : ''}">${prevue ? 'Effacer le statut' : 'Supprimer'}</button>
      </div>
    </form>`;

  const form = conteneur.querySelector('form');
  const $ = (sel) => form.querySelector(sel);
  const etat = {
    sport: r.sport,
    statut: r.statut,
    motif: r.motif,
    rpe: r.rpe,
    intensite: r.douleur?.intensite ?? null,
  };
  const touches = new Set(nouvelle ? [] : ['tout']); // erreurs montrées seulement pour les champs touchés

  // Mise à jour visuelle : boutons choisis, champs masqués, unité, allure.
  function rafraichir() {
    form.querySelectorAll('[data-sport]').forEach((b) => b.classList.toggle('choisi', b.dataset.sport === etat.sport));
    form.querySelectorAll('[data-statut]').forEach((b) => b.classList.toggle('choisi', b.dataset.statut === etat.statut));
    form.querySelectorAll('[data-motif]').forEach((b) => b.classList.toggle('choisi', b.dataset.motif === etat.motif));
    form.querySelectorAll('[data-rpe]').forEach((b) => b.classList.toggle('choisi', Number(b.dataset.rpe) === etat.rpe));
    form.querySelectorAll('[data-intensite]').forEach((b) => b.classList.toggle('choisi', Number(b.dataset.intensite) === etat.intensite));
    const sautee = etat.statut === 'SAUTEE';
    form.querySelectorAll('.si-sautee').forEach((e) => e.classList.toggle('masque', !sautee));
    form.querySelectorAll('.hors-sautee').forEach((e) => e.classList.toggle('masque', sautee));
    form.querySelectorAll('.si-velo').forEach((e) => e.classList.toggle('masque', sautee || etat.sport !== 'VELO'));
    const avecDouleur = Boolean($('#douleur').value);
    $('#intensites').classList.toggle('masque', !avecDouleur);
    $('#aide-intensite').classList.toggle('masque', !avecDouleur);
    $('#unite').textContent = etat.sport === 'NATATION' ? 'm' : 'km';
    const { r: lu } = lireFormulaire();
    const allure = calculerAllure(lu.sport, lu.duree_s, lu.distance_m);
    $('#allure').textContent = allure ? `Allure : ${allure}` : '';
  }

  // Lit le formulaire et renvoie la réalisation nettoyée (règle 4.5.2).
  function lireFormulaire() {
    const texteDuree = $('#duree').value.trim();
    const texteDistance = $('#distance').value.trim();
    const brut = {
      ...r,
      sport: etat.sport,
      statut: etat.statut,
      motif: etat.motif,
      rpe: etat.rpe,
      duree_s: texteDuree ? (lireDuree(texteDuree) ?? NaN) : undefined,
      distance_m: texteDistance ? (lireDistance(texteDistance, etat.sport) ?? NaN) : undefined,
      fc_moy: lireNombre($('#fc').value),
      puissance_moy_w: lireNombre($('#puissance').value),
      douleur: $('#douleur').value ? { zone: $('#douleur').value, intensite: etat.intensite } : undefined,
      commentaire: $('#commentaire').value.trim(),
    };
    // Les champs vidés disparaissent de l'enregistrement
    for (const cle of ['motif', 'rpe', 'duree_s', 'distance_m', 'fc_moy', 'puissance_moy_w', 'douleur', 'commentaire']) {
      if (brut[cle] === undefined) delete brut[cle];
    }
    return { r: normaliserRealisation(brut) };
  }

  // Affiche les erreurs des champs touchés (C-14).
  function afficherErreurs(erreurs) {
    form.querySelectorAll('.erreur').forEach((e) => e.remove());
    form.querySelectorAll('.invalide').forEach((e) => e.classList.remove('invalide'));
    for (const [champ, erreur] of Object.entries(erreurs)) {
      if (!touches.has('tout') && !touches.has(champ)) continue;
      const el = form.querySelector(`[data-champ="${champ}"]`);
      if (!el) continue;
      el.classList.add('invalide');
      el.insertAdjacentHTML('afterend', `<div class="erreur" role="alert">${echapperHtml(formaterMessage(erreur))}</div>`);
    }
  }

  // Enregistre si tout est valide ; une séance non prévue n'est créée qu'avec sport, durée et RPE (C-12).
  async function faireEnregistrer() {
    const { r: lu } = lireFormulaire();
    const { ok, erreurs } = validerRealisation(lu);
    afficherErreurs(erreurs);
    if (!ok) return;
    r = await ecrire('realisations', lu);
    if (nouvelle && location.hash.startsWith('#/realisation/nouvelle')) {
      history.replaceState(null, '', `#/realisation/${r.id}`);
      $('#effacer').classList.remove('masque');
    }
  }

  let file = Promise.resolve();
  let minuterie = null;
  function enregistrer() {
    clearTimeout(minuterie);
    file = file.then(faireEnregistrer).catch((e) => console.error(e));
    return file;
  }
  function planifier() {
    clearTimeout(minuterie);
    minuterie = setTimeout(enregistrer, 500);
  }

  form.addEventListener('input', () => { rafraichir(); planifier(); });
  form.addEventListener('change', (ev) => {
    if (ev.target.dataset.champ) touches.add(ev.target.dataset.champ);
    rafraichir();
    enregistrer();
  });
  form.addEventListener('focusout', (ev) => {
    if (ev.target.dataset.champ) touches.add(ev.target.dataset.champ);
    if (ev.target.matches('input, textarea, select')) enregistrer();
  });
  form.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.sport) { etat.sport = d.sport; touches.add('sport'); }
    else if (d.statut) { etat.statut = d.statut; touches.add('statut'); }
    else if (d.motif) { etat.motif = d.motif; touches.add('motif'); }
    else if (d.rpe) { etat.rpe = Number(d.rpe); touches.add('rpe'); }
    else if (d.intensite) { etat.intensite = Number(d.intensite); touches.add('douleur'); }
    else return;
    rafraichir();
    enregistrer();
  });
  $('#retour').addEventListener('click', async () => {
    await enregistrer();
    location.hash = `#/aujourdhui?date=${r.date}`;
  });
  // C-11 : "Effacer le statut" supprime la réalisation après confirmation M-04.
  $('#effacer').addEventListener('click', async () => {
    if (!r.id || !confirm(MESSAGES['M-04'])) return;
    clearTimeout(minuterie);
    await file;
    await supprimer('realisations', r.id);
    location.hash = `#/aujourdhui?date=${r.date}`;
  });

  if (!etat.sport && seance) etat.sport = seance.sport;
  rafraichir();
}
