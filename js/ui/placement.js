// Placement des séances dans un bloc (F-88, conception 2026-11-24 section 5.2) :
// - #/placer?bloc=N&jour=J&heure=hh:mm : choisir une séance de Mes séances pour cette case, ou en créer une ;
// - #/emplacement?bloc=N&n=K : changer le jour ou l'heure d'une séance dans ce bloc, la retirer du bloc.
// Paramètres de l'adresse vérifiés avant usage (D-21). Écriture en ligne seulement (ENF-07).

import { lirePreparation, modifierPreparation } from '../api/preparation.js';
import { lireAlluresSeuil } from '../api/profil.js';
import { ajouterEmplacement, modifierEmplacement, retirerEmplacement, verifierPosition } from '../logique/blocs.js';
import { volumeSeance_s } from '../logique/plan.js';
import { echapperHtml, formaterDureeLongue } from '../logique/format.js';
import {
  message, messageErreurApi, squelette, pastilleSport, surveillerReseau, boutonIcone, graphiqueSeance, boutonCrayon, boutonAnnuler, brancherEdition,
} from './composants.js';
import { JOURS } from './blocs.js';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const entier = (v, min, max) => (/^\d+$/.test(String(v ?? '')) && Number(v) >= min && Number(v) <= max ? Number(v) : null);

// Préparation lue et bloc demandé ; null (et retour à l'écran Objectif) si le bloc n'existe pas.
async function chargerBloc(conteneur, titre, params) {
  conteneur.innerHTML = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/objectif' })}
    <span class="titre-petit">${echapperHtml(titre)}</span><span class="espace-bouton"></span></div><div id="zone-placement">${squelette()}</div>`;
  const zone = conteneur.querySelector('#zone-placement');
  let preparation;
  let allures;
  try {
    [preparation, allures] = await Promise.all([lirePreparation(), lireAlluresSeuil()]);
  } catch (e) {
    zone.innerHTML = messageErreurApi(e);
    return null;
  }
  const indexBloc = entier(params.bloc, 0, (preparation.blocs?.length ?? 0) - 1);
  if (indexBloc === null) {
    location.hash = '#/objectif';
    return null;
  }
  return { zone, preparation, allures, indexBloc, bloc: preparation.blocs[indexBloc] };
}

async function ecrire(zone, transformer, indexBloc) {
  try {
    await modifierPreparation((p) => ({ reglages: p.reglages, blocs: transformer(p.blocs ?? []) }));
    location.hash = `#/objectif?bloc=${indexBloc}`;
  } catch (e) {
    zone.querySelector('#resultat').innerHTML = messageErreurApi(e);
  }
}

// #/placer : liste de Mes séances ; toucher une séance la place à ce jour et à cette heure.
export async function afficherPlacer(conteneur, segments, params = {}) {
  const charge = await chargerBloc(conteneur, 'Placer une séance', params);
  if (!charge || !conteneur.isConnected) return;
  const { zone, preparation, allures, indexBloc, bloc } = charge;
  const jour = entier(params.jour, 1, 7) ?? 1;
  const heure = HEURE.test(params.heure ?? '') ? params.heure : null;
  const quand = `${JOURS[jour - 1]}${heure ? ` à ${heure}` : ', sans heure'}`;
  const choix = preparation.seances.filter((s) => !s.retiree); // D-27
  const nouvelle = `#/seance-type/nouvelle?bloc=${indexBloc}&jour=${jour}${heure ? `&heure=${heure}` : ''}`;
  zone.innerHTML = `<div id="hors-ligne-placement"></div>
    <div class="carte"><h2>${echapperHtml(bloc.nom)} · ${echapperHtml(quand)}</h2>
      <a class="bouton principal" id="nouvelle-seance" href="${nouvelle}">Nouvelle séance</a>
      ${choix.length ? `<p class="doux">Ou choisis une séance de Mes séances :</p>
      <ul class="liste-seances">${choix.map((s) => `<li><button type="button" class="ligne-seance choix-seance ecriture" data-id="${echapperHtml(s.id)}">
        ${pastilleSport(s.sport)}<span class="seance-type-titre">${echapperHtml(s.titre)}</span>
        <span class="doux">${s.sport === 'REPOS' ? '' : echapperHtml(formaterDureeLongue(volumeSeance_s(s, allures)))}</span>
        ${graphiqueSeance(s, allures, { compact: true })}</button></li>`).join('')}</ul>` : ''}
      <div id="resultat" aria-live="polite"></div></div>`;
  zone.querySelectorAll('.choix-seance').forEach((b) => b.addEventListener('click', () => {
    b.disabled = true;
    ecrire(zone, (blocs) => {
      verifierPosition(blocs, indexBloc, bloc.nom); // revue finale I-2
      return ajouterEmplacement(blocs, indexBloc, { seanceId: b.dataset.id, jour, heure });
    }, indexBloc);
  }));
  surveillerReseau(zone, zone.querySelector('#hors-ligne-placement'), [...zone.querySelectorAll('.ecriture')]);
}

// #/emplacement : jour et heure de la séance dans ce bloc, modifier la séance, la retirer du bloc.
export async function afficherEmplacement(conteneur, segments, params = {}) {
  const charge = await chargerBloc(conteneur, 'Séance du bloc', params);
  if (!charge || !conteneur.isConnected) return;
  const { zone, preparation, allures, indexBloc, bloc } = charge;
  const n = entier(params.n, 0, bloc.emplacements.length - 1);
  if (n === null) { location.hash = `#/objectif?bloc=${indexBloc}`; return; }
  const e = bloc.emplacements[n];
  const seance = preparation.seances.find((s) => String(s.id) === String(e.seanceId));
  zone.innerHTML = `<div id="hors-ligne-placement"></div>
    <form class="carte" id="form-emplacement" novalidate><h2>${echapperHtml(bloc.nom)}</h2>${boutonCrayon('Modifier dans ce bloc')}
      ${seance ? `<div class="carte-activite-tete">${pastilleSport(seance.sport)}<strong>${echapperHtml(seance.titre)}</strong></div>
        ${graphiqueSeance(seance, allures)}`
    : message('info', "Cette séance n'existe plus dans ta bibliothèque. Retire-la de ce bloc.")}
        <fieldset class="champs-formulaire"><div class="deux-colonnes">
          <div class="champ"><label for="jour-emplacement">Jour</label><select id="jour-emplacement">
            ${JOURS.map((j, i) => `<option value="${i + 1}" ${e.jour === i + 1 ? 'selected' : ''}>${echapperHtml(j)}</option>`).join('')}</select></div>
          <div class="champ"><label for="heure-emplacement">Heure (facultatif)</label>
            <input type="time" id="heure-emplacement" value="${echapperHtml(e.heure ?? '')}"></div>
        </div></fieldset>
        <div id="resultat" aria-live="polite"></div>
        <div class="pile">
          <button type="submit" class="bouton principal" id="enregistrer-emplacement" data-enregistrer>Enregistrer dans ce bloc</button>
          ${seance ? `<a class="bouton action-edition" id="modifier-seance" href="#/seance-type/${encodeURIComponent(seance.id)}?bloc=${indexBloc}&n=${n}">Modifier la séance</a>` : ''}
          <button type="button" class="bouton danger ecriture action-edition" id="retirer-emplacement">Retirer de ce bloc</button>
          ${boutonAnnuler()}
        </div>
      </form>`;
  const $ = (sel) => zone.querySelector(sel);
  // D-27 : en lecture avec le crayon ; Annuler remet le jour et l'heure enregistrés.
  const edition = brancherEdition($('#form-emplacement'), {
    lecture: Boolean(seance), // séance disparue : modification ouverte pour pouvoir la retirer
    surAnnuler: () => { $('#jour-emplacement').value = String(e.jour); $('#heure-emplacement').value = e.heure ?? ''; edition.passer(true); },
  });
  $('#form-emplacement').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const jour = entier($('#jour-emplacement').value, 1, 7);
    const heure = $('#heure-emplacement').value || null;
    if (jour === null || (heure !== null && !HEURE.test(heure))) { $('#resultat').innerHTML = message('erreur', 'Heure attendue au format hh:mm.'); return; }
    ecrire(zone, (blocs) => {
      verifierPosition(blocs, indexBloc, bloc.nom, n, e.seanceId); // revue finale I-2
      return modifierEmplacement(blocs, indexBloc, n, { jour, heure });
    }, indexBloc);
  });
  $('#retirer-emplacement').addEventListener('click', () => {
    if (!confirm('Retirer cette séance de ce bloc ? Elle reste dans Mes séances.')) return;
    ecrire(zone, (blocs) => {
      verifierPosition(blocs, indexBloc, bloc.nom, n, e.seanceId); // revue finale I-2
      return retirerEmplacement(blocs, indexBloc, n);
    }, indexBloc);
  });
  surveillerReseau(zone, $('#hors-ligne-placement'), [...zone.querySelectorAll('.ecriture')]);
}
