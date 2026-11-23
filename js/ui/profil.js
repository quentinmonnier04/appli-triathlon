// Écran E-06 "Profil" (F-50 à F-54) : en-tête, totaux de l'année, totaux par sport, seuils et zones.
// Affiché depuis le cache, puis mis à jour depuis Intervals.icu si le cache a plus de 5 min (5.5, ENF-11).

import { lireProfilEnCache, rafraichirProfil } from '../api/profil.js';
import { lireMontre } from '../api/session.js';
import { estPerime } from '../logique/activites.js';
import { totauxAnnee, totauxParSport, seuilsAffichables, zonesDuSport } from '../logique/profil.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDistance, formaterDureeLongue, formaterEntier, formaterKm } from '../logique/format.js';
import { bandeauHorsLigne, messageErreurApi, pastilleSport, squelette, stat } from './composants.js';

// F-50 : nom et montre.
function enTete(nom, montre) {
  return `<div class="carte hero profil-tete">
    <div class="avatar" aria-hidden="true">${echapperHtml((nom || '?').trim().charAt(0).toUpperCase())}</div>
    <div class="carte-activite-titre"><strong class="profil-nom">${echapperHtml(nom || 'Athlète')}</strong>
      <span class="doux"><span aria-hidden="true">⌚</span> ${echapperHtml(montre)}</span></div></div>`;
}

// L8 : accès à l'objectif et au plan d'entraînement (F-80 à F-87).
function lienObjectif() {
  return `<a class="carte carte-lien" href="#/objectif"><div class="etiquette-carte">Objectif et plan</div>
    <span class="lien-fleche" aria-hidden="true">→</span><p class="doux">Ta course, ta semaine type et ta progression.</p></a>`;
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
    return '<div class="carte"><div class="etiquette-carte">Seuils</div><p class="doux">Aucun seuil renseigné sur Intervals.icu.</p></div>';
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

function rendreProfil(p, montre) {
  return `${enTete(p.nom, montre)}${lienObjectif()}${carteTotaux(p)}${carteParSport(p.activites)}${carteSeuils(p.reglages)}${carteZones(p.reglages)}`;
}

// Largeur des barres (CSP : pas de style inline dans le HTML ; element.style est permis).
function appliquerBarres(zone) {
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
}

export async function afficherProfil(conteneur) {
  conteneur.innerHTML = `
    <div class="entete"><span class="titre-petit">Profil</span>
      <span class="actions-entete">
        <button type="button" class="icone-bouton" id="rafraichir" aria-label="Rafraîchir">⟳</button>
        <a class="icone-bouton" href="#/reglages" aria-label="Réglages">⚙️</a></span></div>
    <div id="etat"></div>
    <div id="profil"></div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#profil');
  const montre = await lireMontre();
  let profil = null;

  function afficher(p) {
    zone.innerHTML = rendreProfil(p, montre);
    appliquerBarres(zone);
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
