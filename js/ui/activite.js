// Écran E-03 "Détail d'une activité" (F-13) : résumé, FC moyenne et max, puissance moyenne si présente,
// dénivelé, charge, zones de temps si présentes, tours ou intervalles si présents.

import { lireDetailEnCache, rafraichirDetail } from '../api/activites.js';
import { estPerime, repartitionZones } from '../logique/activites.js';
import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterDateHeure, formaterEntier,
} from '../logique/format.js';
import { sport } from '../logique/sports.js';
import { bandeauHorsLigne, messageErreurApi, pastilleSport, stat, squelette } from './composants.js';

const enteteRetour = `<div class="entete"><a class="icone-bouton" href="#/activites" aria-label="Retour">←</a>
  <span class="titre-petit">Activité</span><span class="espace-bouton"></span></div>`;

// Valeur suivie de son unité, ou null si absente.
const avecUnite = (v, unite) => (v === null || v === undefined ? null : `${formaterEntier(v)} ${unite}`);

// Barres de temps par zone (F-13) ; rien si les zones sont absentes.
function blocZones(titre, temps) {
  const lignes = repartitionZones(temps);
  if (!lignes.length) return '';
  return `<div class="carte"><h2>${titre}</h2>
    ${lignes.map((l) => `<div class="zone"><span class="zone-nom">${l.zone}</span>
      <span class="zone-barre"><span class="zone-remplie zone-${l.zone}" data-pct="${l.pct}"></span></span>
      <span class="zone-temps">${formaterDuree(l.secs)}</span><span class="zone-pct doux">${l.pct} %</span></div>`).join('')}
  </div>`;
}

// Tableau des tours ou intervalles (F-13) ; rien s'il n'y en a pas.
function blocIntervalles(intervalles, sportCode) {
  if (!intervalles.length) return '';
  const avecPuissance = intervalles.some((i) => i.puissance_moy_w);
  return `<div class="carte"><h2>Tours et intervalles</h2>
    <div class="tableau-defilant"><table class="intervalles">
      <thead><tr><th>#</th><th>Durée</th><th>Distance</th><th>${sportCode === 'VELO' ? 'Vitesse' : 'Allure'}</th><th>FC moy</th>${avecPuissance ? '<th>Puiss.</th>' : ''}</tr></thead>
      <tbody>${intervalles.map((i, n) => `<tr class="${i.type === 'RECOVERY' ? 'recup' : ''}">
        <td>${echapperHtml(i.libelle ?? String(n + 1))}</td>
        <td>${formaterDuree(i.duree_s) ?? '-'}</td>
        <td>${formaterDistance(i.distance_m, sportCode) ?? '-'}</td>
        <td>${formaterVitesse(sportCode, i.distance_m, i.duree_s) ?? '-'}</td>
        <td>${i.fc_moy ?? '-'}</td>${avecPuissance ? `<td>${i.puissance_moy_w ?? '-'}</td>` : ''}</tr>`).join('')}</tbody>
    </table></div></div>`;
}

function rendreDetail({ activite: a, intervalles }) {
  const vitesse = formaterVitesse(a.sport, a.distance_m, a.duree_s);
  return `
    <div class="carte hero">
      <div class="carte-activite-tete">${pastilleSport(a.sport)}
        <div class="carte-activite-titre"><strong>${echapperHtml(a.titre)}</strong>
          <span class="doux">${echapperHtml(sport(a.sport).libelle)} · ${echapperHtml(formaterDateHeure(a.date, a.heure))}</span></div></div>
      <div class="resume">
        ${stat('Durée', formaterDuree(a.duree_s))}
        ${stat('Distance', formaterDistance(a.distance_m, a.sport))}
        ${stat(a.sport === 'VELO' ? 'Vitesse moy.' : 'Allure moy.', vitesse)}
      </div>
    </div>
    <div class="carte"><div class="stats grille-stats">
      ${stat('FC moyenne', avecUnite(a.fc_moy, 'bpm'))}
      ${stat('FC max', avecUnite(a.fc_max, 'bpm'))}
      ${stat('Puissance moy.', avecUnite(a.puissance_moy_w, 'W'))}
      ${stat('Dénivelé +', avecUnite(a.denivele_m, 'm'))}
      ${stat('Charge', formaterEntier(a.charge))}
    </div></div>
    ${blocZones('Temps par zone de FC', a.zones_fc)}
    ${blocZones('Temps par zone de puissance', a.zones_puissance)}
    ${blocZones("Temps par zone d'allure", a.zones_allure)}
    ${blocIntervalles(intervalles, a.sport)}`;
}

// Largeur des barres de zones (CSP : pas de style inline dans le HTML, mais element.style est permis).
function appliquerBarres(conteneur) {
  conteneur.querySelectorAll('.zone-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
}

export async function afficherActivite(conteneur, segments) {
  const id = decodeURIComponent(segments[1] ?? '');
  const zone = () => conteneur.querySelector('#detail');
  conteneur.innerHTML = `${enteteRetour}<div id="etat"></div><div id="detail"></div>`;
  // Retour à l'écran précédent (fil, agenda ou accueil) ; sans historique, retour au fil.
  conteneur.querySelector('.entete a').addEventListener('click', (ev) => {
    if (history.length > 1) { ev.preventDefault(); history.back(); }
  });

  // 5.5 : cache d'abord, puis Intervals.icu si le cache a plus de 5 min.
  const cache = await lireDetailEnCache(id);
  if (cache) { zone().innerHTML = rendreDetail(cache); appliquerBarres(conteneur); }
  else zone().innerHTML = squelette() + squelette(); // ENF-22 : chargement
  if (cache && !estPerime(cache.charge_le)) return;

  try {
    const frais = await rafraichirDetail(id);
    if (!conteneur.contains(zone())) return; // écran quitté entre-temps
    zone().innerHTML = rendreDetail(frais);
    appliquerBarres(conteneur);
  } catch (e) {
    if (!zone()) return;
    if (cache && e.type !== 'IDENTIFIANTS') {
      conteneur.querySelector('#etat').innerHTML = bandeauHorsLigne(cache.charge_le); // ENF-06
    } else {
      zone().innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
      zone().querySelector('#reessayer').addEventListener('click', () => afficherActivite(conteneur, segments));
    }
  }
}
