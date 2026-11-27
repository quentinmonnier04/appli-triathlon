// Écran E-06 "Profil" (F-50 à F-54) : en-tête, totaux de l'année, totaux par sport, seuils et zones.
// Affiché depuis le cache, puis mis à jour depuis Intervals.icu si le cache a plus de 5 min (5.5, ENF-11).

import { lireProfilEnCache, rafraichirProfil, enregistrerReglagesSport } from '../api/profil.js';
import { lireMontre } from '../api/session.js';
import { estPerime } from '../logique/activites.js';
import { totauxAnnee, totauxParSport, seuilsAffichables, zonesDuSport, champsSeuils, lireSeuilsSaisis } from '../logique/profil.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDistance, formaterDureeLongue, formaterEntier, formaterKm } from '../logique/format.js';
import {
  bandeauHorsLigne, messageErreurApi, pastilleSport, squelette, stat, boutonIcone, flecheLien, message,
  boutonCrayon, boutonAnnuler, brancherEdition, surveillerReseau,
} from './composants.js';
import { icone } from './icones.js';

// F-50 : nom et montre.
function enTete(nom, montre) {
  return `<div class="carte hero profil-tete">
    <div class="avatar" aria-hidden="true">${echapperHtml((nom || '?').trim().charAt(0).toUpperCase())}</div>
    <div class="carte-activite-titre"><strong class="profil-nom">${echapperHtml(nom || 'Athlète')}</strong>
      <span class="doux montre">${icone('montre', 18)} ${echapperHtml(montre)}</span></div></div>`;
}

// L8 : accès à l'objectif et au plan d'entraînement (F-80 à F-87).
function lienObjectif() {
  return `<a class="carte carte-lien" href="#/objectif"><div class="etiquette-carte">Objectif et plan</div>
    ${flecheLien()}<p class="doux">Ta course, ta semaine type et ta progression.</p></a>`;
}

// Lot LP : records par sport (E-12).
function lienPerformances() {
  return `<a class="carte carte-lien" href="#/performances"><div class="etiquette-carte">Performances</div>
    ${flecheLien()}<p class="doux">Tes records par sport : puissance, course et natation.</p></a>`;
}

// Lot LC2 : matériel et usure (E-13).
function lienMateriel() {
  return `<a class="carte carte-lien" href="#/materiel"><div class="etiquette-carte">Matériel</div>
    ${flecheLien()}<p class="doux">Vélo, chaussures et pièces : kilomètres et usure.</p></a>`;
}

// F-88 : banque de séances (Mes séances), D-24.
function lienMesSeances() {
  return `<a class="carte carte-lien" href="#/seances"><div class="etiquette-carte">Mes séances</div>
    ${flecheLien()}<p class="doux">Ta banque de séances types, par sport et par type.</p></a>`;
}

// F-51 : totaux depuis le 1er janvier.
function carteTotaux(p) {
  const t = totauxAnnee(p.activites);
  return `<div class="carte"><div class="etiquette-carte">Depuis le 1er janvier ${echapperHtml(p.annee)}</div>
    <div class="stats grille-totaux">
      ${stat('Activités', formaterEntier(t.nombre))}
      ${stat('Distance', formaterKm(t.distance_m))}
      ${stat('Durée', formaterDureeLongue(t.duree_s))}
      ${stat('Jours actifs', formaterEntier(t.jours_actifs))}
    </div></div>`;
}

// F-52 : totaux par sport, avec une barre de proportion (part de la durée totale).
function carteParSport(activites) {
  const lignes = totauxParSport(activites);
  if (!lignes.length) {
    return '<div class="carte"><div class="etiquette-carte">Par sport</div><p class="doux">Aucune activité cette année.</p></div>';
  }
  return `<div class="carte"><div class="etiquette-carte">Par sport</div>
    ${lignes.map((l) => {
    const distance = formaterDistance(l.distance_m, l.sport);
    return `<div class="ligne-semaine">${pastilleSport(l.sport)}
      <div class="ligne-semaine-corps">
        <div class="ligne-semaine-texte"><span>${echapperHtml(sport(l.sport).libelle)} <span class="doux">${l.pct} %</span></span>
          <span><strong>${formaterDureeLongue(l.duree_s)}</strong></span></div>
        <span class="barre-progression sport-${l.sport}"><span class="barre-remplie" data-pct="${l.pct}"></span></span>
        <div class="doux petit-texte">${l.nombre} activité${l.nombre > 1 ? 's' : ''}${distance ? ' · ' + echapperHtml(distance) : ''}</div>
      </div></div>`;
  }).join('')}</div>`;
}

// F-53 : seuils par sport.
function carteSeuils(reglages) {
  const blocs = reglages.map((r) => ({ r, seuils: seuilsAffichables(r) })).filter((b) => b.seuils.length);
  if (!blocs.length) {
    return '<div class="carte"><div class="etiquette-carte">Seuils</div><p class="doux">Aucun seuil renseigné.</p></div>';
  }
  return `<div class="carte"><div class="etiquette-carte">Seuils</div>
    ${blocs.map(({ r, seuils }) => `<div class="bloc-sport">
      <div class="carte-activite-tete">${pastilleSport(r.sport)}<strong>${echapperHtml(sport(r.sport).libelle)}</strong></div>
      <div class="stats">${seuils.map((s) => stat(s.etiquette, s.valeur)).join('')}</div></div>`).join('')}</div>`;
}

// F-54 : zones par sport, repliées par défaut.
function carteZones(reglages) {
  const blocs = reglages.map((r) => ({ r, familles: zonesDuSport(r) })).filter((b) => b.familles.length);
  if (!blocs.length) return '';
  return `<div class="carte"><div class="etiquette-carte">Zones</div>
    ${blocs.map(({ r, familles }) => familles.map((f) => `<details class="zones-sport">
      <summary>${pastilleSport(r.sport)}<span>${echapperHtml(sport(r.sport).libelle)} : ${echapperHtml(f.titre.toLowerCase())}</span></summary>
      <ul class="liste-zones">${f.zones.map((z) => `<li><span class="zone-nom">${echapperHtml(z.nom)}</span><span>${echapperHtml(z.texte)}</span></li>`).join('')}</ul>
    </details>`).join('')).join('')}</div>`;
}

// F-124 : seuils et zones d'un sport, modifiables avec le crayon et enregistrés dans Intervals.icu (D-42).
// Champs proposés selon le sport ; les zones (listes de nombres) restent dans la modification.
const CHAMPS_PAR_SPORT = {
  VELO: ['ftp', 'fc_seuil', 'fc_max', 'zones_puissance', 'zones_fc'],
  CAP: ['allure', 'fc_seuil', 'fc_max', 'ftp', 'zones_allure', 'zones_fc', 'zones_puissance'],
  NATATION: ['allure', 'fc_seuil', 'fc_max', 'zones_allure'],
};
function libellesChamps(code) {
  return {
    ftp: 'FTP (W)', fc_seuil: 'FC seuil (bpm)', fc_max: 'FC max (bpm)',
    allure: code === 'NATATION' ? 'CSS (min/100 m)' : 'Allure seuil (min/km)',
    zones_puissance: 'Zones de puissance (% de la FTP)', zones_fc: 'Zones de FC (bpm, borne haute)',
    zones_allure: "Zones d'allure (% de l'allure seuil)",
  };
}
function formulaireSeuils(r) {
  if (r.id === null || r.id === undefined) return '';
  const champs = champsSeuils(r);
  const libelles = libellesChamps(r.sport);
  const liste = CHAMPS_PAR_SPORT[r.sport] ?? ['fc_seuil', 'fc_max', 'zones_fc'];
  return `<form class="carte" data-reglage="${echapperHtml(r.id)}" data-sport="${echapperHtml(r.sport)}" novalidate>
    <h2 class="titre-icone">${pastilleSport(r.sport)} Seuils · ${echapperHtml(sport(r.sport).libelle)}</h2>${boutonCrayon('Modifier les seuils')}
    <fieldset class="champs-formulaire"><div class="deux-colonnes">
      ${liste.filter((c) => !c.startsWith('zones')).map((c) => `<div class="champ"><label for="${c}-${echapperHtml(r.sport)}">${libelles[c]}</label>
        <input id="${c}-${echapperHtml(r.sport)}" data-champ-seuil="${c}" inputmode="${c === 'allure' ? 'text' : 'numeric'}" value="${echapperHtml(champs[c])}"></div>`).join('')}
    </div>
    <div class="seulement-edition">${liste.filter((c) => c.startsWith('zones')).map((c) => `<div class="champ"><label for="${c}-${echapperHtml(r.sport)}">${libelles[c]}</label>
      <input id="${c}-${echapperHtml(r.sport)}" data-champ-seuil="${c}" inputmode="decimal" value="${echapperHtml(champs[c])}"></div>`).join('')}</div>
    </fieldset>
    <div class="erreurs" aria-live="polite"></div>
    <div class="pile action-edition"><button type="submit" class="bouton principal" data-enregistrer>Enregistrer les modifications</button>${boutonAnnuler()}</div>
  </form>`;
}
function cartesSeuils(reglages) {
  const formulaires = reglages.map(formulaireSeuils).join('');
  return formulaires || carteSeuils(reglages);
}

function rendreProfil(p, montre) {
  return `${enTete(p.nom, montre)}${lienObjectif()}${lienPerformances()}${lienMateriel()}${lienMesSeances()}${carteTotaux(p)}${carteParSport(p.activites)}${cartesSeuils(p.reglages)}${carteZones(p.reglages)}`;
}

// Largeur des barres (CSP : pas de style inline dans le HTML ; element.style est permis).
function appliquerBarres(zone) {
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
}

export async function afficherProfil(conteneur) {
  conteneur.innerHTML = `
    <div class="entete"><h1 class="titre-ecran">Profil</h1>
      <span class="actions-entete">
        ${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}
        ${boutonIcone('reglages', 'Réglages', { href: '#/reglages' })}</span></div>
    <div id="etat"></div>
    <div id="profil"></div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#profil');
  const montre = await lireMontre();
  let profil = null;

  function afficher(p) {
    zone.innerHTML = rendreProfil(p, montre);
    appliquerBarres(zone);
    brancherSeuils();
  }

  // F-124 : chaque formulaire de seuils en lecture avec le crayon ; Annuler réaffiche le profil (D-27).
  function brancherSeuils() {
    zone.querySelectorAll('form[data-reglage]').forEach((form) => {
      brancherEdition(form, { surAnnuler: () => afficher(profil) });
      surveillerReseau(form, form.querySelector('.erreurs'), []); // ENF-07
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const champs = Object.fromEntries([...form.querySelectorAll('[data-champ-seuil]')].map((i) => [i.dataset.champSeuil, i.value]));
        const { corps, erreurs } = lireSeuilsSaisis(champs, form.dataset.sport);
        const zoneErreurs = form.querySelector('.erreurs');
        if (Object.keys(erreurs).length) { zoneErreurs.innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
        const bouton = form.querySelector('[data-enregistrer]');
        bouton.disabled = true;
        bouton.textContent = 'Enregistrement...'; // ENF-10
        try {
          await enregistrerReglagesSport(form.dataset.reglage, corps);
          await rafraichir();
        } catch (e) {
          zoneErreurs.innerHTML = messageErreurApi(e);
          bouton.disabled = false;
          bouton.textContent = 'Enregistrer les modifications';
        }
      });
    });
  }

  async function rafraichir() {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      const frais = await rafraichirProfil();
      if (!conteneur.contains(zone)) return; // écran quitté entre-temps
      profil = frais;
      $('#etat').innerHTML = '';
      afficher(profil);
    } catch (e) {
      if (!conteneur.contains(zone)) return;
      if (profil && e.type !== 'IDENTIFIANTS') {
        $('#etat').innerHTML = bandeauHorsLigne(profil.charge_le); // ENF-06
      } else {
        $('#etat').innerHTML = messageErreurApi(e); // ENF-22 : M-02 ou M-07
        if (!profil) zone.innerHTML = '<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>';
        $('#reessayer')?.addEventListener('click', () => { zone.innerHTML = squelette(); rafraichir(); });
      }
    } finally {
      bouton?.classList.remove('tourne');
    }
  }

  $('#rafraichir').addEventListener('click', rafraichir);

  // 5.5 : cache affiché immédiatement, puis mise à jour si besoin.
  profil = await lireProfilEnCache();
  if (profil) afficher(profil);
  else zone.innerHTML = squelette() + squelette() + squelette(); // ENF-22 : chargement
  if (!profil || estPerime(profil.charge_le)) await rafraichir();
}
