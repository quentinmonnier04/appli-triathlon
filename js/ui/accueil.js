// Écran E-01 "Tableau de bord" (F-20 à F-25, rappel du RPE F-63, accès au bilan F-62) : affiché depuis le cache en moins d'une seconde,
// puis mis à jour depuis Intervals.icu si le cache a plus de 5 min (ENF-09, ENF-11, 5.5).

import { lireTableauEnCache, rafraichirTableau } from '../api/tableau.js';
import { lireAthlete } from '../api/athlete.js';
import { lireObjectif } from '../api/objectif.js';
import { tempsTotal } from '../logique/objectifs-course.js';
import { lireAlluresSeuil } from '../api/profil.js';
import { estPerime } from '../logique/activites.js';
import { comparaisonMois, sportsParJour, volumeSemaine, totauxSemaine } from '../logique/totaux.js';
import { phraseForme, positionJauge } from '../logique/forme.js';
import { activitesSansRpe } from '../logique/ressenti.js';
import { cheminCourbe, progression } from '../logique/graphique.js';
import {
  grilleMois, libelleMois, lundiDe, memeJourMoisPrecedent, joursEntre, jourISO, numeroSemaine, libelleJourCourt,
} from '../logique/dates.js';
import { sport } from '../logique/sports.js';
import { formaterDureeSaisie } from '../logique/seance.js';
import {
  echapperHtml, formaterDistance, formaterDuree, formaterDureeLongue, formaterEntier, formaterDate, formaterJourMois,
} from '../logique/format.js';
import {
  bandeauHorsLigne, carteActivite, messageErreurApi, pastilleSport, squelette, graphiqueSeance, boutonIcone, flecheLien,
} from './composants.js';
import { icone, iconeSport } from './icones.js';
import { afficherCarteParcours } from './carte.js';

const LARGEUR_COURBE = 150;
const HAUTEUR_COURBE = 34;
// Segments de la jauge de forme (F-23, 9.4), de gauche à droite.
const SEGMENTS_FORME = ['Fatigue', 'En charge', 'Équilibré', 'Frais'];

// F-20 : bloc "Aujourd'hui" (design E) : fond à la couleur du sport, titre en grand et durée à droite,
// détail de la séance dessous ; "Repos" si rien n'est prévu (ouvre la semaine en cours dans l'Agenda).
function widgetSeanceDuJour(prevues, jour, allures) {
  const duJour = prevues.filter((s) => s.date === jour && !s.objectif); // la course du jour a son propre widget (F-80)
  if (!duJour.length) {
    return `<a class="aujourdhui sport-REPOS" href="#/agenda?vue=semaine&date=${jour}" aria-label="Séance du jour : repos. Ouvrir l'agenda de la semaine">
      <div class="aujourdhui-tete"><span>Aujourd'hui · Repos</span>${iconeSport('REPOS', 18)}</div>
      <div class="aujourdhui-ligne"><span class="aujourdhui-titre">Repos</span></div>
      <span class="aujourdhui-detail">Rien n'est prévu aujourd'hui.</span></a>`;
  }
  return duJour.map((s) => {
    const sp = sport(s.sport);
    const details = [s.heure, formaterDistance(s.distance_m, s.sport)].filter(Boolean).join(' · ');
    const detail = s.blocs?.length
      ? graphiqueSeance(s, allures, { compact: true })
      : (s.description ? `<p class="description-seance">${echapperHtml(s.description)}</p>` : '');
    return `<a class="aujourdhui seance-du-jour sport-${sp.code}" href="#/seance/${encodeURIComponent(s.id)}">
      <div class="aujourdhui-tete"><span>Aujourd'hui · ${echapperHtml(sp.libelle)}</span>${iconeSport(sp.code, 18)}</div>
      <div class="aujourdhui-ligne"><span class="aujourdhui-titre">${echapperHtml(s.titre)}</span>
        ${s.duree_s ? `<span class="aujourdhui-duree">${formaterDureeSaisie(s.duree_s)}</span>` : ''}</div>
      ${details ? `<span class="aujourdhui-detail">${echapperHtml(details)}</span>` : ''}${detail}</a>`;
  }).join('');
}

// F-80 : objectif et compte à rebours, ou invitation à en définir un.
function widgetObjectif(o) {
  if (!o) {
    return `<a class="carte carte-lien" href="#/objectif"><div class="etiquette-carte">Objectif</div>
      ${flecheLien()}<p class="doux">Définis ta prochaine course et ton plan d'entraînement.</p></a>`;
  }
  const j = joursEntre(jourISO(), o.date);
  const total = tempsTotal(o.objectifs, o.sport); // F-89
  return `<a class="carte carte-lien carte-objectif" href="#/objectif"><div class="etiquette-carte">Objectif</div>
    ${flecheLien()}
    <div class="objectif-ligne"><span class="pastille pastille-objectif">${icone('drapeau')}</span>
      <div class="carte-activite-titre"><strong>${echapperHtml(o.nom)}</strong>
        <span class="doux">${formaterDate(o.date)}</span></div>
      <span class="compte-rebours">${j === 0 ? "Aujourd'hui" : `J-${j}`}</span></div>
    ${total !== null ? `<p class="doux total-vise">Total visé ${echapperHtml(formaterDuree(total))}</p>` : ''}</a>`;
}

// F-63 : rappel discret pour chaque activité du jour sans RPE.
function rappelRpe(activites, jour) {
  return activitesSansRpe(activites, jour).map((a) => `<a class="rappel" href="#/activite/${encodeURIComponent(a.id)}">
    ${pastilleSport(a.sport)}<span>Note ton ressenti sur <strong>${echapperHtml(a.titre)}</strong></span>
    <span class="lien-fleche-ligne">${icone('fleche')}</span></a>`).join('');
}

// F-62 : accès au bilan du jour.
function lienBilan(jour) {
  return `<a class="carte carte-lien" href="#/bilan?date=${jour}">
    <div class="etiquette-carte">Bilan du jour</div>${flecheLien()}
    <p class="doux">Fatigue, sommeil, douleurs, poids : note ta journée.</p></a>`;
}

// F-21 : dernière activité, qui ouvre son détail ; petite carte du parcours dessous quand elle en a un (F-71, D-29).
function widgetDerniereActivite(derniere) {
  if (!derniere) return '';
  return carteActivite(derniere, { grille: true, prefixeDate: 'Dernière activité', apercu: true });
}

// F-23 : TSB en grand avec sa phrase (9.4), CTL et ATL, jauge en 4 segments avec un repère.
// Le widget ouvre l'historique de la forme (F-26), seul accès à cet écran.
function widgetForme(forme, jour) {
  if (!forme) {
    return '<div class="carte"><h2>Forme</h2><p class="doux">Pas encore de données de forme.</p></div>';
  }
  const phrase = phraseForme(forme.tsb);
  const date = forme.date === jour ? '' : ` <span class="doux">au ${formaterJourMois(forme.date)}</span>`;
  const signe = forme.tsb > 0 ? '+' : forme.tsb < 0 ? '&minus;' : '';
  return `<a class="carte carte-lien carte-forme" href="#/forme" aria-label="Forme : ouvrir l'historique">${flecheLien()}
    <div class="carte-ligne"><h2>Forme${date}</h2>
      <span class="info-droite"><abbr title="Forme de fond">CTL</abbr> ${formaterEntier(forme.ctl)} · <abbr title="Fatigue récente">ATL</abbr> ${formaterEntier(forme.atl)}</span></div>
    <div class="forme-valeur"><span class="chiffre-forme"><span class="lecteur">Fraîcheur (TSB) : </span>${signe}${formaterEntier(Math.abs(forme.tsb))}</span><span class="phrase-forme">${phrase}</span></div>
    <div class="jauge" aria-hidden="true">${SEGMENTS_FORME.map((_, i) => `<span class="jauge-segment jauge-${i + 1}"></span>`).join('')}
      <span class="jauge-repere" data-position="${positionJauge(forme.tsb)}"></span></div>
    <div class="jauge-libelles" aria-hidden="true">${SEGMENTS_FORME.map((l) => `<span>${l}</span>`).join('')}</div></a>`;
}

// F-22 : tuile Mois : durée du mois, écart avec le mois précédent à la même date, courbe du cumul.
function widgetDureeMois(activites, jour) {
  const c = comparaisonMois(activites, jour);
  const max = Math.max(c.courbeActuelle.at(-1) ?? 0, c.courbePrecedente.at(-1) ?? 0);
  const repere = memeJourMoisPrecedent(jour);
  const sens = c.ecart_s > 0 ? 'Hausse de' : c.ecart_s < 0 ? 'Baisse de' : '';
  const fleche = c.ecart_s > 0 ? '▲' : c.ecart_s < 0 ? '▼' : '=';
  const ecart = c.ecart_s === 0 ? 'Autant' : formaterDureeLongue(c.ecart_s);
  // Ouvre l'Agenda sur le mois en cours.
  return `<a class="carte carte-lien tuile" href="#/agenda?vue=mois&date=${jour}"><div class="etiquette-carte">${libelleMois(jour)}</div>${flecheLien()}
    <span class="chiffre-tuile">${formaterDureeLongue(c.actuel_s)}</span>
    <span class="tuile-ecart"><span class="lecteur">${sens} </span><span aria-hidden="true">${fleche}</span> ${ecart}
      <span class="doux">vs ${repere.slice(8, 10)}/${repere.slice(5, 7)} (${formaterDureeLongue(c.precedent_s)})</span></span>
    <svg class="courbe" viewBox="-1 -1 ${LARGEUR_COURBE + 2} ${HAUTEUR_COURBE + 2}" preserveAspectRatio="none" role="img"
      aria-label="Durée cumulée du mois (trait plein), comparée au mois précédent (pointillés)">
      <path class="courbe-precedente" d="${cheminCourbe(c.courbePrecedente, c.nbJours, max, LARGEUR_COURBE, HAUTEUR_COURBE)}"></path>
      <path class="courbe-actuelle" d="${cheminCourbe(c.courbeActuelle, c.nbJours, max, LARGEUR_COURBE, HAUTEUR_COURBE)}"></path>
    </svg></a>`;
}

// F-25 : tuile Semaine : réalisé sur prévu, puis le détail par sport.
function widgetSemaine(prevues, activites, jour) {
  const lignes = volumeSemaine(prevues, activites, lundiDe(jour));
  const t = totauxSemaine(lignes);
  // Ouvre l'Agenda sur la semaine en cours.
  return `<a class="carte carte-lien tuile" href="#/agenda?vue=semaine&date=${jour}"><div class="etiquette-carte">Semaine</div>${flecheLien()}
    <span class="chiffre-tuile">${formaterDureeSaisie(t.realise_s) || '0:00'}</span>
    <span class="doux tuile-sous">${t.prevu_s ? `sur ${formaterDureeSaisie(t.prevu_s)} prévues` : 'rien de prévu'}</span>
    ${lignes.length ? `<div class="semaine-sports">${lignes.map((l) => {
    const pct = progression(l.realise_s, l.prevu_s);
    return `<div class="ligne-semaine sport-${l.sport}">${pastilleSport(l.sport)}
        <span class="barre-progression"><span class="barre-remplie" data-pct="${pct ?? 100}"></span></span>
        <span class="ligne-semaine-texte">${formaterDureeSaisie(l.realise_s) || '0:00'}${l.prevu_s ? `<span class="doux"> / ${formaterDureeSaisie(l.prevu_s)}</span>` : ''}</span></div>`;
  }).join('')}</div>` : ''}</a>`;
}

// F-24 : mini-calendrier du mois, un point coloré par sport pratiqué chaque jour.
// Le widget entier ouvre l'Agenda sur le mois en cours (zone cliquable assez grande, ENF-17).
function widgetCalendrier(activites, jour) {
  const parJour = sportsParJour(activites);
  return `<a class="carte carte-lien" href="#/agenda?vue=mois&date=${jour}" aria-label="Ouvrir l'agenda du mois">
    <div class="etiquette-carte">${libelleMois(jour)}</div>${flecheLien()}
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

function rendreTableau(t, allures) {
  return `${rappelRpe(t.activites, t.jour)}
    ${widgetSeanceDuJour(t.prevues, t.jour, allures)}
    ${widgetDerniereActivite(t.derniere)}
    ${widgetForme(t.forme, t.jour)}
    <div class="tuiles">${widgetDureeMois(t.activites, t.jour)}${widgetSemaine(t.prevues, t.activites, t.jour)}</div>
    ${lienBilan(t.jour)}
    ${widgetCalendrier(t.activites, t.jour)}`;
}

// Largeur des barres et position du repère de forme (CSP : pas de style inline dans le HTML ; element.style est permis).
function appliquerBarres(zone) {
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
  zone.querySelectorAll('.jauge-repere').forEach((r) => { r.style.left = `${r.dataset.position}%`; });
}

export async function afficherAccueil(conteneur) {
  const jour = jourISO();
  conteneur.innerHTML = `
    <div class="entete entete-accueil">
      <div class="entete-texte"><span class="entete-date">${libelleJourCourt(jour)} · Semaine ${numeroSemaine(jour)}</span>
        <span class="entete-bonjour" id="bonjour">Bonjour</span></div>
      <span class="actions-entete">
        ${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}
        ${boutonIcone('reglages', 'Réglages', { href: '#/reglages' })}</span></div>
    <div id="etat"></div>
    <div id="objectif"></div>
    <div id="tableau"></div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#tableau');
  let tableau = null;
  // Allures seuil du profil en cache : graphique de la Séance du jour (revue I-2, F-20).
  const allures = await lireAlluresSeuil();

  // Objectif (F-80), sans bloquer l'affichage ; rien en cas d'erreur (le tableau affiche déjà l'état réseau).
  lireObjectif().then((o) => { if ($('#objectif')) $('#objectif').innerHTML = widgetObjectif(o); }).catch(() => {});

  // Nom de l'athlète (F-02), sans bloquer l'affichage.
  lireAthlete().then((a) => { if ($('#bonjour')) $('#bonjour').textContent = `Bonjour ${a.nom}`; }).catch(() => {});

  function afficher(t) {
    zone.innerHTML = rendreTableau(t, allures);
    appliquerBarres(zone);
    // F-71, D-29 : vraie carte (fond de carte) du parcours de la dernière activité, sans interaction.
    zone.querySelectorAll('.apercu-trace[data-apercu]').forEach((el) => {
      el.classList.add('carte-mini');
      afficherCarteParcours(el, el.dataset.apercu, t.derniere.sport, { fixe: true })
        .then((affichee) => { if (!affichee) el.remove(); })
        .catch(() => el.remove()); // hors ligne sans tracé en cache : pas de carte
    });
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
