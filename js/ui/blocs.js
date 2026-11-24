// Écran E-09, sections "Mes séances" et "Blocs" (F-81, F-88) : bibliothèque de séances, onglets des blocs,
// nom et durée du bloc, grille de la semaine du bloc (5 h à 23 h, positions calculées par logique/grille.js).
// Une case vide ouvre #/placer, une séance placée ouvre #/emplacement. Écriture en ligne seulement (ENF-07).

import { modifierPreparation } from '../api/preparation.js';
import { volumeSeance_s, volumeSemaine_s } from '../logique/plan.js';
import {
  grilleDuBloc, utilisationsSeance, ajouterBloc, dupliquerBloc, supprimerBloc, modifierBloc, validerBlocs,
} from '../logique/blocs.js';
import { GRILLE, dispositionSemaine, heureDepuisPosition } from '../logique/grille.js';
import { echapperHtml, formaterDureeLongue } from '../logique/format.js';
import { message, pastilleSport } from './composants.js';
import { icone, iconeSport } from './icones.js';

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// F-81 : liste de la bibliothèque, avec le nombre de blocs qui utilisent chaque séance.
export function sectionMesSeances(seances, blocs, allures) {
  const lignes = seances.map((s) => {
    const n = utilisationsSeance(blocs ?? [], s.id);
    return `<li><a class="ligne-seance" href="#/seance-type/${encodeURIComponent(s.id)}">${pastilleSport(s.sport)}
      <span class="seance-type-titre">${echapperHtml(s.titre)}</span>
      <span class="doux">${s.sport === 'REPOS' ? '' : echapperHtml(formaterDureeLongue(volumeSeance_s(s, allures)))}${n ? ` · ${n} bloc${n > 1 ? 's' : ''}` : ''}</span></a></li>`;
  }).join('');
  return `<div class="carte"><h2>Mes séances</h2>
    ${seances.length ? `<ul class="liste-seances" id="mes-seances">${lignes}</ul>` : '<p class="doux">Aucune séance pour l\'instant.</p>'}
    <a class="bouton" id="nouvelle-seance-bib" href="#/seance-type/nouvelle">${icone('plus', 18)} Nouvelle séance</a></div>`;
}

// Grille de la semaine d'un bloc : un lien par séance placée, un bouton + par jour (sans heure).
function grilleBloc(grille, indexBloc, allures) {
  const { blocs, sansHeure } = dispositionSemaine(grille, allures);
  const heures = Array.from({ length: GRILLE.heureFin - GRILLE.heureDebut }, (_, i) => GRILLE.heureDebut + i);
  const jours = JOURS.map((nom, i) => ({ nom, jour: i + 1 }));
  const lien = (x, contenu, classe) => `<a class="${classe} sport-${x.sport}" href="#/emplacement?bloc=${indexBloc}&n=${x.emplacement}"
    aria-label="${echapperHtml(`${JOURS[x.jour - 1]} ${x.heure ?? ''} ${x.titre}`)}" title="${echapperHtml(x.titre)}">${contenu}</a>`;
  return `<div class="grille">
      <div class="grille-ligne grille-entete"><span></span>${jours.map((j) => `<span>${echapperHtml(j.nom.slice(0, 3))}</span>`).join('')}</div>
      <div class="grille-ligne grille-sans-heure"><span class="grille-libelle">Sans heure</span>
        ${jours.map((j) => `<div class="grille-cellule">${sansHeure.filter((x) => x.jour === j.jour)
    .map((x) => lien(x, iconeSport(x.sport, 18), 'grille-puce')).join('')}
          <a class="grille-ajout" href="#/placer?bloc=${indexBloc}&jour=${j.jour}" aria-label="Ajouter une séance sans heure le ${echapperHtml(j.nom.toLowerCase())}">${icone('plus', 18)}</a></div>`).join('')}</div>
      <div class="grille-defilement"><div class="grille-corps" data-hauteur="${(GRILLE.heureFin - GRILLE.heureDebut) * GRILLE.pxParHeure}" data-bloc="${indexBloc}">
        <div class="grille-heures" aria-hidden="true">${heures.map((h) => `<span data-haut="${(h - GRILLE.heureDebut) * GRILLE.pxParHeure}">${h} h</span>`).join('')}</div>
        ${jours.map((j) => `<div class="grille-jour" data-jour="${j.jour}">${blocs.filter((b) => b.jour === j.jour).map((b) => lien(b.seance,
    `<span class="grille-bloc-visuel" data-decalage="${b.haut_px - b.toucher_haut_px}" data-hauteur-visuel="${b.hauteur_px}">
      ${iconeSport(b.seance.sport, 16)}<span class="grille-bloc-heure">${echapperHtml(b.seance.heure)}</span></span>`, 'grille-bloc')
    .replace('<a ', `<a data-haut="${b.toucher_haut_px}" data-hauteur="${b.toucher_hauteur_px}" data-colonne="${b.colonne}" data-nb="${b.nbColonnes}" `)).join('')}</div>`).join('')}
      </div></div>
    </div>`;
}

// F-88 : onglets des blocs, bloc affiché (nom, semaines, dupliquer, supprimer) et sa grille.
export function sectionBlocs(preparation, allures, indexBloc) {
  const { blocs, seances } = preparation;
  const onglets = `<nav class="onglets-vue onglets-blocs" aria-label="Blocs de la préparation">
    ${blocs.map((b, i) => `<a href="#/objectif?bloc=${i}" class="${i === indexBloc ? 'actif' : ''}" ${i === indexBloc ? 'aria-current="page"' : ''}>${echapperHtml(b.nom)}</a>`).join('')}
    <button type="button" class="ecriture" id="ajouter-bloc" aria-label="Ajouter un bloc">${icone('plus', 18)}</button></nav>`;
  if (!blocs.length) {
    return `<div class="carte"><h2>Blocs</h2>${onglets}<p class="doux">Ajoute un premier bloc, puis place tes séances dans sa semaine.</p></div>`;
  }
  const bloc = blocs[indexBloc];
  const grille = grilleDuBloc(bloc, seances);
  return `<div class="carte"><h2>Blocs</h2>${onglets}
    <form id="form-bloc" novalidate>
      <div class="deux-colonnes">
        <div class="champ"><label for="nom-bloc">Nom du bloc</label><input id="nom-bloc" maxlength="40" value="${echapperHtml(bloc.nom)}"></div>
        <div class="champ"><label for="semaines-bloc">Semaines</label><input id="semaines-bloc" inputmode="numeric" value="${echapperHtml(bloc.semaines)}"></div>
      </div>
      <div class="erreurs" id="erreurs-bloc" aria-live="polite"></div>
      <div class="actions-bloc">
        <button type="submit" class="bouton ecriture">Enregistrer</button>
        <button type="button" class="bouton ecriture" id="dupliquer-bloc">Dupliquer</button>
        <button type="button" class="bouton danger ecriture" id="supprimer-bloc">Supprimer</button>
      </div>
    </form>
    <p class="doux">Volume de la semaine : <strong>${echapperHtml(formaterDureeLongue(volumeSemaine_s(grille, allures)))}</strong>.
      Touche une case vide pour placer une séance à cette heure. Le plan ajuste le volume du bloc pour qu'il continue de monter.</p>
    ${grilleBloc(grille, indexBloc, allures)}</div>`;
}

// Positions de la grille (CSP : pas de style dans le HTML, element.style est permis) et toucher d'une case vide.
export function brancherGrille(zone) {
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
      if (ev.target !== colonne) return; // une séance a été touchée
      const y = ev.clientY - colonne.getBoundingClientRect().top;
      location.hash = `#/placer?bloc=${corps.dataset.bloc}&jour=${colonne.dataset.jour}&heure=${heureDepuisPosition(y)}`;
    });
  });
  // La journée commence affichée à 6 h.
  zone.querySelector('.grille-defilement').scrollTop = (6 - GRILLE.heureDebut) * GRILLE.pxParHeure;
}

// Boutons de la section Blocs. recharger(texte, indexBloc) réaffiche l'écran ; echec(cible, e) affiche l'erreur.
export function brancherBlocs(zone, { blocs, indexBloc, recharger, echec }) {
  const $ = (sel) => zone.querySelector(sel);
  const ecrire = async (transformer, texte, index, cible) => {
    try {
      await modifierPreparation((p) => ({ reglages: p.reglages, blocs: transformer(p.blocs ?? []) }));
      recharger(texte, index);
    } catch (e) { echec(cible, e); }
  };
  $('#ajouter-bloc')?.addEventListener('click', () => ecrire((b) => ajouterBloc(b, `Bloc ${b.length + 1}`), 'Bloc ajouté.', blocs.length, '#erreurs-bloc'));
  if (!blocs.length) return;
  $('#form-bloc').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const semaines = /^\d+$/.test($('#semaines-bloc').value.trim()) ? Number($('#semaines-bloc').value.trim()) : NaN;
    const modifie = modifierBloc(blocs, indexBloc, { nom: $('#nom-bloc').value.trim(), semaines });
    const erreurs = validerBlocs(modifie);
    if (Object.keys(erreurs).length) { $('#erreurs-bloc').innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
    ecrire((b) => modifierBloc(b, indexBloc, { nom: modifie[indexBloc].nom, semaines }), 'Bloc enregistré.', indexBloc, '#erreurs-bloc');
  });
  $('#dupliquer-bloc').addEventListener('click', () => ecrire((b) => dupliquerBloc(b, indexBloc), 'Bloc dupliqué : modifie sa semaine pour le rendre plus spécifique.', indexBloc + 1, '#erreurs-bloc'));
  $('#supprimer-bloc').addEventListener('click', () => {
    if (!confirm(`Supprimer le bloc "${blocs[indexBloc].nom}" ? Ses séances restent dans Mes séances.`)) return; // texte, pas du HTML
    ecrire((b) => supprimerBloc(b, indexBloc), 'Bloc supprimé.', Math.max(0, indexBloc - 1), '#erreurs-bloc');
  });
}
