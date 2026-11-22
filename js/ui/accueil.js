// Écran E-01 "Tableau de bord" (F-20 à F-25) : affiché depuis le cache en moins d'une seconde,
// puis mis à jour depuis Intervals.icu si le cache a plus de 5 min (ENF-09, ENF-11, 5.5).

import { lireTableauEnCache, rafraichirTableau } from '../api/tableau.js';
import { lireAthlete } from '../api/athlete.js';
import { estPerime } from '../logique/activites.js';
import { comparaisonMois, sportsParJour, volumeSemaine } from '../logique/totaux.js';
import { phraseForme } from '../logique/forme.js';
import { cheminCourbe, progression } from '../logique/graphique.js';
import { grilleMois, libelleMois, lundiDe, memeJourMoisPrecedent } from '../logique/dates.js';
import { sport } from '../logique/sports.js';
import {
  echapperHtml, formaterDuree, formaterDistance, formaterDureeLongue, formaterEntier,
} from '../logique/format.js';
import {
  bandeauHorsLigne, carteActivite, messageErreurApi, pastilleSport, squelette,
} from './composants.js';

const LARGEUR_COURBE = 300;
const HAUTEUR_COURBE = 64;
// Couleur de la phrase de forme (F-23).
const CLASSES_FORME = { Frais: 'frais', 'Équilibré': 'equilibre', 'En charge': 'charge', 'Fatigue élevée': 'fatigue' };

// F-20 : séances prévues du jour, ou "Repos" si rien n'est prévu.
function widgetSeanceDuJour(prevues, jour) {
  const duJour = prevues.filter((s) => s.date === jour);
  if (!duJour.length) {
    return `<div class="carte"><div class="etiquette-carte">Séance du jour</div>
      <div class="carte-activite-tete">${pastilleSport('REPOS')}
        <div class="carte-activite-titre"><strong>Repos</strong><span class="doux">Rien n'est prévu aujourd'hui.</span></div></div>
      <a class="bouton" href="#/seance/nouvelle?date=${jour}">Programmer une séance</a></div>`;
  }
  return `<div class="carte"><div class="etiquette-carte">Séance du jour</div>
    ${duJour.map((s) => {
    const details = [formaterDuree(s.duree_s), formaterDistance(s.distance_m, s.sport)].filter(Boolean).join(' · ');
    return `<a class="seance-du-jour" href="#/seance/${encodeURIComponent(s.id)}"><div class="carte-activite-tete">${pastilleSport(s.sport)}
        <div class="carte-activite-titre"><strong>${echapperHtml(s.titre)}</strong>
          <span class="doux">${echapperHtml(sport(s.sport).libelle)}${details ? ' · ' + echapperHtml(details) : ''}</span></div></div>
        ${s.description ? `<p class="description-seance">${echapperHtml(s.description)}</p>` : ''}</a>`;
  }).join('')}</div>`;
}

// F-21 : dernière activité, qui ouvre son détail.
function widgetDerniereActivite(derniere) {
  if (!derniere) return '';
  return `<div class="etiquette-section">Dernière activité</div>${carteActivite(derniere)}`;
}

// F-23 : CTL, ATL, TSB du jour avec une phrase simple.
function widgetForme(forme, jour) {
  if (!forme) {
    return '<div class="carte"><div class="etiquette-carte">Forme</div><p class="doux">Pas encore de données de forme sur Intervals.icu.</p></div>';
  }
  const phrase = phraseForme(forme.tsb);
  const date = forme.date === jour ? '' : ` <span class="doux">(au ${forme.date.slice(8, 10)}/${forme.date.slice(5, 7)})</span>`;
  return `<div class="carte"><div class="etiquette-carte">Forme${date}</div>
    <div class="phrase-forme forme-${CLASSES_FORME[phrase]}">${phrase}</div>
    <div class="stats stats-carte">
      <div class="stat"><span class="stat-valeur">${formaterEntier(forme.ctl)}</span><span class="stat-etiquette">Forme (CTL)</span></div>
      <div class="stat"><span class="stat-valeur">${formaterEntier(forme.atl)}</span><span class="stat-etiquette">Fatigue (ATL)</span></div>
      <div class="stat"><span class="stat-valeur">${forme.tsb > 0 ? '+' : ''}${formaterEntier(forme.tsb)}</span><span class="stat-etiquette">Fraîcheur (TSB)</span></div>
    </div></div>`;
}

// F-22 : durée du mois, comparaison au mois précédent à la même date, courbes cumulées.
function widgetDureeMois(activites, jour) {
  const c = comparaisonMois(activites, jour);
  const max = Math.max(c.courbeActuelle.at(-1) ?? 0, c.courbePrecedente.at(-1) ?? 0);
  const repere = memeJourMoisPrecedent(jour);
  const sens = c.ecart_s > 0 ? 'hausse' : c.ecart_s < 0 ? 'baisse' : 'egal';
  const fleche = { hausse: '▲', baisse: '▼', egal: '=' }[sens];
  const ecart = c.ecart_s === 0 ? 'Autant' : `${c.ecart_s > 0 ? '+' : '-'}${formaterDureeLongue(c.ecart_s)}`;
  return `<div class="carte"><div class="etiquette-carte">Durée ce mois-ci</div>
    <div class="grand-chiffre">${formaterDureeLongue(c.actuel_s)}</div>
    <p class="comparaison ${sens}"><span aria-hidden="true">${fleche}</span> ${ecart} par rapport au ${repere.slice(8, 10)}/${repere.slice(5, 7)}
      <span class="doux">(${formaterDureeLongue(c.precedent_s)})</span></p>
    <svg class="courbe" viewBox="-2 -2 ${LARGEUR_COURBE + 4} ${HAUTEUR_COURBE + 4}" preserveAspectRatio="none" role="img"
      aria-label="Durée cumulée du mois, comparée au mois précédent">
      <path class="courbe-precedente" d="${cheminCourbe(c.courbePrecedente, c.nbJours, max, LARGEUR_COURBE, HAUTEUR_COURBE)}"></path>
      <path class="courbe-actuelle" d="${cheminCourbe(c.courbeActuelle, c.nbJours, max, LARGEUR_COURBE, HAUTEUR_COURBE)}"></path>
    </svg>
    <div class="legende"><span class="legende-actuelle">Ce mois-ci</span><span class="legende-precedente">Mois précédent</span></div></div>`;
}

// F-25 : volume prévu et réalisé par sport pour la semaine en cours.
function widgetSemaine(prevues, activites, jour) {
  const lignes = volumeSemaine(prevues, activites, lundiDe(jour));
  if (!lignes.length) {
    return '<div class="carte"><div class="etiquette-carte">Semaine en cours</div><p class="doux">Rien de prévu ni de réalisé cette semaine.</p></div>';
  }
  return `<div class="carte"><div class="etiquette-carte">Semaine en cours</div>
    ${lignes.map((l) => {
    const pct = progression(l.realise_s, l.prevu_s);
    return `<div class="ligne-semaine">${pastilleSport(l.sport)}
        <div class="ligne-semaine-corps">
          <div class="ligne-semaine-texte"><span>${echapperHtml(sport(l.sport).libelle)}</span>
            <span><strong>${formaterDureeLongue(l.realise_s)}</strong>${l.prevu_s ? ` <span class="doux">/ ${formaterDureeLongue(l.prevu_s)}</span>` : ' <span class="doux">non prévu</span>'}</span></div>
          <span class="barre-progression sport-${l.sport}"><span class="barre-remplie" data-pct="${pct ?? 100}"></span></span>
        </div></div>`;
  }).join('')}</div>`;
}

// F-24 : mini-calendrier du mois, un point coloré par sport pratiqué chaque jour.
// Le widget entier ouvre l'Agenda sur le mois en cours (zone cliquable assez grande, ENF-17).
function widgetCalendrier(activites, jour) {
  const parJour = sportsParJour(activites);
  return `<a class="carte carte-lien" href="#/agenda?vue=mois&date=${jour}" aria-label="Ouvrir l'agenda du mois">
    <div class="etiquette-carte">${libelleMois(jour)}</div><span class="lien-fleche" aria-hidden="true">→</span>
    <div class="mini-calendrier" aria-hidden="true">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j) => `<span class="mini-entete" aria-hidden="true">${j}</span>`).join('')}
      ${grilleMois(jour).flat().map((d) => {
    if (!d) return '<span class="mini-jour vide"></span>';
    const sports = parJour[d] ?? [];
    const libelle = `${Number(d.slice(8, 10))}${sports.length ? ' : ' + sports.map((s) => sport(s).libelle).join(', ') : ''}`;
    return `<span class="mini-jour${d === jour ? ' aujourdhui' : ''}" title="${echapperHtml(libelle)}">
          <span class="mini-numero">${Number(d.slice(8, 10))}</span>
          <span class="mini-points">${sports.slice(0, 3).map((s) => `<span class="point sport-${s}"></span>`).join('')}</span></span>`;
  }).join('')}
    </div></a>`;
}

function rendreTableau(t) {
  return `${widgetSeanceDuJour(t.prevues, t.jour)}
    ${widgetDerniereActivite(t.derniere)}
    ${widgetForme(t.forme, t.jour)}
    ${widgetDureeMois(t.activites, t.jour)}
    ${widgetSemaine(t.prevues, t.activites, t.jour)}
    ${widgetCalendrier(t.activites, t.jour)}`;
}

// Largeur des barres (CSP : pas de style inline dans le HTML ; element.style est permis).
function appliquerBarres(zone) {
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
}

export async function afficherAccueil(conteneur) {
  conteneur.innerHTML = `
    <div class="entete"><span class="titre-petit" id="bonjour">Bonjour</span>
      <span class="actions-entete">
        <button type="button" class="icone-bouton" id="rafraichir" aria-label="Rafraîchir">⟳</button>
        <a class="icone-bouton" href="#/reglages" aria-label="Réglages">⚙️</a></span></div>
    <div id="etat"></div>
    <div id="tableau"></div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#tableau');
  let tableau = null;

  // Nom de l'athlète (F-02), sans bloquer l'affichage.
  lireAthlete().then((a) => { if ($('#bonjour')) $('#bonjour').textContent = `Bonjour ${a.nom}`; }).catch(() => {});

  function afficher(t) {
    zone.innerHTML = rendreTableau(t);
    appliquerBarres(zone);
  }

  async function rafraichir() {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      const frais = await rafraichirTableau();
      if (!conteneur.contains(zone)) return; // écran quitté entre-temps
      tableau = frais;
      $('#etat').innerHTML = '';
      afficher(tableau);
    } catch (e) {
      if (!conteneur.contains(zone)) return;
      if (tableau && e.type !== 'IDENTIFIANTS') {
        $('#etat').innerHTML = bandeauHorsLigne(tableau.charge_le); // ENF-06
      } else {
        $('#etat').innerHTML = messageErreurApi(e); // ENF-22 : M-02 ou M-07
        if (!tableau) zone.innerHTML = '<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>';
        $('#reessayer')?.addEventListener('click', () => { zone.innerHTML = squelette(); rafraichir(); });
      }
    } finally {
      bouton?.classList.remove('tourne');
    }
  }

  $('#rafraichir').addEventListener('click', rafraichir);

  // ENF-09 : cache affiché immédiatement, puis mise à jour si besoin (5.5).
  tableau = await lireTableauEnCache();
  if (tableau) afficher(tableau);
  else zone.innerHTML = squelette() + squelette() + squelette(); // ENF-22 : chargement
  if (!tableau || estPerime(tableau.charge_le)) await rafraichir();
}
