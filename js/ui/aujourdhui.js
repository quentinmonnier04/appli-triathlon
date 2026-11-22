// Écran E-01 "Aujourd'hui" (F-20, F-21, F-23, C-02, C-19, D-04).
// Affichage seulement : les données viennent de db/, les textes de commun.js.

import { listerParJour, realisationDeSeance } from '../db/database.js';
import {
  jourISO, decalerJour, formaterDateLongue, sport, texteBloc, texteInfos, texteStatut, echapperHtml,
} from './commun.js';

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

  // Toucher la carte (hors boutons et liens) ouvre E-02 (9.1).
  conteneur.querySelector('#seances').addEventListener('click', (ev) => {
    if (ev.target.closest('button, a, summary, details ul')) return;
    const carte = ev.target.closest('[data-seance]');
    if (carte) location.hash = `#/seance/${carte.dataset.seance}`;
  });
}
