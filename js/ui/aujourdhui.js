// Écran E-01 "Aujourd'hui" (F-20, F-21, F-23, C-02, C-19, D-04).
// Affichage seulement : les données viennent de db/, les textes de commun.js.

import { listerParJour, realisationDeSeance, creerRealisationUnique } from '../db/database.js';
import { validerRealisation, normaliserRealisation, lireDuree, formaterDuree, BORNES } from '../regles/validation.js';
import {
  jourISO, decalerJour, formaterDateLongue, sport, texteBloc, texteInfos, texteStatut, echapperHtml,
  LIBELLES_RPE, MOTIFS, formaterMessage,
} from './commun.js';
import { bandeauRappel } from './sauvegarde.js';

// --- Feuille du bas pour la saisie rapide (C-06 à C-10) ---

// Ouvre une feuille modale en bas de l'écran ; renvoie l'élément de la feuille.
function ouvrirFeuille(contenu) {
  fermerFeuille();
  document.body.insertAdjacentHTML('beforeend',
    `<div class="voile" id="voile"><div class="feuille" role="dialog" aria-modal="true">${contenu}
      <div class="pied-formulaire"><button type="button" data-fermer>Annuler</button></div></div></div>`);
  const voile = document.getElementById('voile');
  voile.addEventListener('click', (ev) => {
    if (ev.target === voile || ev.target.closest('[data-fermer]')) fermerFeuille();
  });
  return voile.querySelector('.feuille');
}

function fermerFeuille() {
  document.getElementById('voile')?.remove();
}

// Boutons RPE 1 à 10 avec libellés (C-06).
function boutonsRpe() {
  return `<div class="grille-rpe">${Object.entries(LIBELLES_RPE)
    .map(([n, l]) => `<button type="button" data-rpe="${n}"><strong>${n}</strong> ${l}</button>`).join('')}</div>`;
}

// Champ durée réalisée (C-08, C-09).
function champDuree(valeur) {
  return `<div class="champ"><label for="duree-rapide">Durée (h:mm)</label>
    <input id="duree-rapide" inputmode="decimal" placeholder="1:00" value="${valeur ? formaterDuree(valeur) : ''}"></div>`;
}

// Crée la réalisation après contrôle ; renvoie les erreurs ou null (règles 4.5.1, 4.5.2, C-14).
async function creerRealisation(contexte, seance, champs) {
  const r = normaliserRealisation({
    athlete_id: contexte.athleteId,
    seance_prevue_id: seance.id,
    date: seance.date,
    sport: seance.sport,
    source: 'MANUEL',
    ...champs,
  });
  const { ok, erreurs } = validerRealisation(r);
  if (!ok) return erreurs;
  await creerRealisationUnique(r);
  return null;
}

// Ouvre la feuille correspondant au bouton touché, puis réaffiche l'écran après création.
function saisieRapide(action, seance, contexte, reafficher) {
  const titre = `<h2>${echapperHtml(seance.titre)}</h2>`;
  let feuille;
  let rpeChoisi = null;

  // Désactive les boutons (double toucher), crée, ou affiche les erreurs et réactive.
  async function valider(champs) {
    feuille.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const erreurs = await creerRealisation(contexte, seance, champs);
    if (!erreurs) {
      fermerFeuille();
      await reafficher();
      return;
    }
    feuille.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    feuille.querySelectorAll('.erreur').forEach((e) => e.remove());
    const message = Object.values(erreurs).map((e) => echapperHtml(formaterMessage(e))).join(' ');
    feuille.querySelector('.zone-erreur').innerHTML = `<div class="erreur" role="alert">${message}</div>`;
    feuille.querySelector('#duree-rapide')?.classList.toggle('invalide', Boolean(erreurs.duree_s));
  }

  // Lit la durée saisie ; une saisie illisible devient une erreur M-02.
  function dureeSaisie() {
    const texte = feuille.querySelector('#duree-rapide').value.trim();
    if (!texte) return undefined;
    return lireDuree(texte) ?? -1;
  }

  if (action === 'SAUTEE') {
    // C-10 : un toucher sur un motif crée la réalisation SAUTEE
    feuille = ouvrirFeuille(`${titre}<p>Pourquoi ?</p><div class="ligne-sauvegarde">
      ${MOTIFS.map((m) => `<button type="button" data-motif="${m.code}">${m.libelle}</button>`).join('')}</div>
      <div class="zone-erreur"></div>`);
    feuille.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-motif]');
      if (b) valider({ statut: 'SAUTEE', motif: b.dataset.motif });
    });
    return;
  }

  const direct = action === 'FAITE' && seance.duree_s; // C-07 : 2 actions
  const avecDuree = !direct; // C-08 (Faite sans durée prévue) et C-09 (Partielle)
  feuille = ouvrirFeuille(`${titre}<p>${action === 'FAITE' ? 'Séance faite' : 'Séance partielle'} : quel effort (RPE) ?</p>
    ${avecDuree ? champDuree(action === 'PARTIELLE' ? seance.duree_s : null) : ''}
    ${boutonsRpe()}
    <div class="zone-erreur"></div>
    ${avecDuree ? '<div class="pied-formulaire"><button type="button" class="principal" id="valider">Valider</button></div>' : ''}`);
  feuille.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-rpe]');
    if (b) {
      rpeChoisi = Number(b.dataset.rpe);
      if (direct) {
        valider({ statut: 'FAITE', rpe: rpeChoisi, duree_s: seance.duree_s, distance_m: seance.distance_m });
        return;
      }
      feuille.querySelectorAll('[data-rpe]').forEach((x) => x.classList.toggle('choisi', x === b));
    }
    if (ev.target.closest('#valider')) {
      const duree = dureeSaisie();
      if (duree === -1) {
        const d = BORNES.duree;
        feuille.querySelector('.zone-erreur').innerHTML = `<div class="erreur" role="alert">${echapperHtml(formaterMessage({ code: 'M-02', champ: d.libelle, min: d.minAff, max: d.maxAff }))}</div>`;
        feuille.querySelector('#duree-rapide').classList.add('invalide');
        return;
      }
      const champs = { statut: action, rpe: rpeChoisi ?? undefined, duree_s: duree };
      if (action === 'FAITE') champs.distance_m = seance.distance_m;
      valider(champs);
    }
  });
}

// Carte d'une séance prévue (9.1) ; realisation = sa réalisation éventuelle.
function carteSeance(s, realisation) {
  const sp = sport(s.sport);
  const blocs = s.segments?.[0]?.blocs ?? [];
  let bas = '';
  if (realisation) {
    bas = `<div class="statut-ligne"><span class="badge ${realisation.statut}">${echapperHtml(texteStatut(realisation))}</span>`
      + `<a class="bouton" href="#/realisation/${realisation.id}">Modifier</a></div>`;
  } else if (s.sport !== 'REPOS') {
    // D-10 : pas de boutons de statut pour le repos
    bas = `<div class="actions">
      <button type="button" data-action="FAITE" data-id="${s.id}">✅ Faite</button>
      <button type="button" data-action="PARTIELLE" data-id="${s.id}">◐ Partielle</button>
      <button type="button" data-action="SAUTEE" data-id="${s.id}">✖ Sautée</button>
    </div>`;
  }
  return `<article class="carte cliquable sport-${s.sport}" data-seance="${s.id}">
    <div class="carte-titre"><span class="icone" aria-hidden="true">${sp.icone}</span>
      <span>${echapperHtml(s.titre)}</span>${s.cle ? '<span class="badge cle">★ Clé</span>' : ''}</div>
    <div class="carte-infos">${sp.libelle}${texteInfos(s) ? ' · ' + echapperHtml(texteInfos(s)) : ''}</div>
    ${blocs.length ? `<details><summary>${blocs.length} bloc${blocs.length > 1 ? 's' : ''}</summary>
      <ul>${blocs.map((b) => `<li>${echapperHtml(texteBloc(b))}</li>`).join('')}</ul></details>` : ''}
    ${s.description ? `<div class="carte-infos">${echapperHtml(s.description)}</div>` : ''}
    ${bas}
  </article>`;
}

// Carte d'une séance non prévue (réalisation sans seance_prevue_id, F-22).
function carteNonPrevue(r) {
  const sp = sport(r.sport);
  return `<article class="carte sport-${r.sport}">
    <div class="carte-titre"><span class="icone" aria-hidden="true">${sp.icone}</span><span>${sp.libelle} (non prévue)</span></div>
    <div class="carte-infos">${echapperHtml(texteInfos(r))}</div>
    <div class="statut-ligne"><span class="badge ${r.statut}">${echapperHtml(texteStatut(r))}</span>
      <a class="bouton" href="#/realisation/${r.id}">Modifier</a></div>
  </article>`;
}

// Affiche les séances du jour demandé (params.date) ou d'aujourd'hui.
export async function afficherAujourdhui(conteneur, contexte, segments, params) {
  const date = params.date || jourISO();
  const seances = await listerParJour('seances_prevues', contexte.athleteId, date);
  const [realsSeances, realsJour] = await Promise.all([
    Promise.all(seances.map((s) => realisationDeSeance(s.id))),
    listerParJour('realisations', contexte.athleteId, date),
  ]);
  const nonPrevues = realsJour.filter((r) => !r.seance_prevue_id);
  const estAujourdhui = date === jourISO();

  let liste = seances.map((s, i) => carteSeance(s, realsSeances[i])).join('');
  if (nonPrevues.length) liste += '<h2>Séances non prévues</h2>' + nonPrevues.map(carteNonPrevue).join('');
  if (!seances.length && !nonPrevues.length) liste = '<p class="vide">Aucune séance prévue.</p>'; // C-02

  conteneur.innerHTML = `
    <div id="rappel"></div>
    <div class="entete-jour">
      <a class="bouton" href="#/aujourdhui?date=${decalerJour(date, -1)}" aria-label="Jour précédent">◀</a>
      <h1>${formaterDateLongue(date)}</h1>
      <a class="bouton" href="#/aujourdhui?date=${decalerJour(date, 1)}" aria-label="Jour suivant">▶</a>
    </div>
    ${estAujourdhui ? '' : '<div class="retour-jour"><a class="bouton lien" href="#/aujourdhui">Aujourd\'hui</a></div>'}
    <section id="seances">${liste}</section>
    <div class="barre-actions"><div>
      <a class="bouton principal" href="#/seance/nouvelle?date=${date}">+ Séance prévue</a>
      <a class="bouton" href="#/realisation/nouvelle?date=${date}">+ Séance non prévue</a>
    </div></div>`;

  // C-15 : bandeau de rappel de sauvegarde (M-05)
  conteneur.querySelector('#rappel').innerHTML = await bandeauRappel(contexte);

  // Boutons Faite / Partielle / Sautée (C-06 à C-10) ; toucher la carte ouvre E-02 (9.1).
  const parId = new Map(seances.map((s) => [s.id, s]));
  conteneur.querySelector('#seances').addEventListener('click', (ev) => {
    const bouton = ev.target.closest('button[data-action]');
    if (bouton) {
      saisieRapide(bouton.dataset.action, parId.get(bouton.dataset.id), contexte,
        () => afficherAujourdhui(conteneur, contexte, segments, params));
      return;
    }
    if (ev.target.closest('button, a, summary, details ul')) return;
    const carte = ev.target.closest('[data-seance]');
    if (carte) location.hash = `#/seance/${carte.dataset.seance}`;
  });
}
