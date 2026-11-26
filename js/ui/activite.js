// Écran E-03 "Détail d'une activité" (F-13) : résumé, FC moyenne et max, puissance moyenne si présente,
// dénivelé, charge, zones de temps si présentes, tours ou intervalles si présents.
// L6 : saisie du RPE, du ressenti et d'un commentaire, enregistrés dans Intervals.icu (F-60, F-61, ENF-07).
// L7 : carte du parcours pour une activité GPS (F-70).

import { lireDetailEnCache, rafraichirDetail, enregistrerRessenti } from '../api/activites.js';
import { estPerime, repartitionZones } from '../logique/activites.js';
import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterDateHeure, formaterEntier,
} from '../logique/format.js';
import { sport } from '../logique/sports.js';
import { ECHELLE_RPE, RESSENTIS, libelleEchelle, validerRessenti } from '../logique/ressenti.js';
import {
  bandeauHorsLigne, messageErreurApi, stat, squelette, message, groupeChoix, brancherChoix, surveillerReseau, boutonIcone,
  boutonCrayon, boutonAnnuler, brancherEdition,
} from './composants.js';

// Un ressenti déjà noté s'ouvre en lecture, avec le crayon (D-27).
const estNote = (s) => s.rpe !== null && s.rpe !== undefined || (s.ressenti !== null && s.ressenti !== undefined) || Boolean(s.commentaire);
import { iconeSport } from './icones.js';
import { afficherCarteParcours } from './carte.js';

const enteteRetour = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/activites' })}
  <span class="titre-petit">Activité</span><span class="espace-bouton"></span></div>`;

// Valeur suivie de son unité, ou null si absente.
const avecUnite = (v, unite) => (v === null || v === undefined ? null : `${formaterEntier(v)} ${unite}`);

// Barres de temps par zone (F-13) ; rien si les zones sont absentes.
function blocZones(titre, temps) {
  const lignes = repartitionZones(temps);
  if (!lignes.length) return '';
  return `<div class="carte"><h2>${titre}</h2>
    ${lignes.map((l) => `<div class="zone"><span class="zone-nom">${echapperHtml(l.zone)}</span>
      <span class="zone-barre"><span class="zone-remplie zone-${echapperHtml(l.zone)}" data-pct="${l.pct}"></span></span>
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
        <td>${echapperHtml(i.fc_moy ?? '-')}</td>${avecPuissance ? `<td>${echapperHtml(i.puissance_moy_w ?? '-')}</td>` : ''}</tr>`).join('')}</tbody>
    </table></div></div>`;
}

// Haut du détail : résumé (F-13).
function rendreHaut({ activite: a }) {
  const vitesse = formaterVitesse(a.sport, a.distance_m, a.duree_s);
  return `
    <div class="carte hero sport-${sport(a.sport).code}">
      <span class="sport-titre">${iconeSport(a.sport)}<span class="sport-titre-texte">${echapperHtml(sport(a.sport).libelle)}</span></span>
      <h1 class="titre-activite">${echapperHtml(a.titre)}</h1>
      <span class="doux">${echapperHtml(formaterDateHeure(a.date, a.heure))}</span>
      <div class="resume">
        ${stat('Durée', formaterDuree(a.duree_s))}
        ${stat('Distance', formaterDistance(a.distance_m, a.sport))}
        ${stat(a.sport === 'VELO' ? 'Vitesse moy.' : 'Allure moy.', vitesse)}
      </div>
    </div>`;
}

// Bas du détail : FC, puissance, dénivelé, charge, zones, tours (F-13).
function rendreBas({ activite: a, intervalles }) {
  return `
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

// Formulaire de ressenti (F-60, F-61), prérempli avec les valeurs d'Intervals.icu.
function rendreRessenti(saisie) {
  return `<form class="carte" id="form-ressenti" novalidate><h2>Mon ressenti</h2>${boutonCrayon('Modifier le ressenti')}
    <fieldset class="champs-formulaire">
    ${groupeChoix('rpe', 'Effort perçu (RPE)', ECHELLE_RPE, saisie.rpe, { court: true })}
    ${groupeChoix('ressenti', 'Ressenti', RESSENTIS, saisie.ressenti)}
    <div class="champ"><label for="commentaire">Commentaire</label>
      <textarea id="commentaire" rows="3" maxlength="2000" placeholder="Comment s'est passée la séance ?">${echapperHtml(saisie.commentaire)}</textarea></div>
    </fieldset>
    <div id="hors-ligne-ressenti"></div>
    <div id="resultat-ressenti" aria-live="polite"></div>
    <div class="pile"><button type="submit" class="bouton principal" id="enregistrer-ressenti" data-enregistrer>${estNote(saisie) ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
      ${estNote(saisie) ? boutonAnnuler() : ''}</div>
  </form>`;
}

// Largeur des barres de zones (CSP : pas de style inline dans le HTML, mais element.style est permis).
function appliquerBarres(conteneur) {
  conteneur.querySelectorAll('.zone-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
}

export async function afficherActivite(conteneur, segments) {
  const id = decodeURIComponent(segments[1] ?? '');
  const zone = () => conteneur.querySelector('#detail');
  conteneur.innerHTML = `${enteteRetour}<div id="etat"></div><div id="detail"></div><div id="parcours"></div><div id="ressenti"></div><div id="detail-bas"></div>`;
  // Retour à l'écran précédent (fil, agenda ou accueil) ; sans historique, retour au fil.
  conteneur.querySelector('.entete a').addEventListener('click', (ev) => {
    if (history.length > 1) { ev.preventDefault(); history.back(); }
  });

  // Saisie du ressenti (F-60, F-61) : elle n'est pas écrasée par un rechargement si l'utilisateur l'a modifiée.
  let saisie = null;
  let modifiee = false;

  function afficherRessenti(a, resultatHtml = '') {
    saisie = { rpe: a.rpe, ressenti: a.ressenti, commentaire: a.commentaire ?? '' };
    modifiee = false;
    const zoneRessenti = conteneur.querySelector('#ressenti');
    zoneRessenti.innerHTML = rendreRessenti(saisie);
    const form = zoneRessenti.querySelector('form');
    const aideRpe = () => { form.querySelector('#aide-rpe').textContent = libelleEchelle(ECHELLE_RPE, saisie.rpe) ?? ''; };
    aideRpe();
    form.querySelector('#resultat-ressenti').innerHTML = resultatHtml;
    brancherChoix(form, (champ, valeur) => { saisie[champ] = valeur; modifiee = true; aideRpe(); });
    form.querySelector('#commentaire').addEventListener('input', () => { modifiee = true; });
    const bouton = form.querySelector('#enregistrer-ressenti');
    const libelle = bouton.textContent;
    brancherEdition(form, { lecture: estNote(saisie), nouveau: !estNote(saisie), surAnnuler: () => afficherRessenti(a) }); // D-27
    surveillerReseau(form, form.querySelector('#hors-ligne-ressenti'), []); // ENF-07

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      saisie.commentaire = form.querySelector('#commentaire').value.trim();
      const erreurs = validerRessenti(saisie);
      const resultat = form.querySelector('#resultat-ressenti');
      if (Object.keys(erreurs).length) { resultat.innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
      bouton.disabled = true;
      bouton.textContent = 'Enregistrement...'; // ENF-10 : retour visuel immédiat
      try {
        const a2 = await enregistrerRessenti(id, saisie);
        if (!form.isConnected) return;
        afficherRessenti(a2, message('succes', 'Ressenti enregistré.'));
      } catch (e) {
        if (!form.isConnected) return;
        resultat.innerHTML = messageErreurApi(e); // la saisie reste dans le formulaire (ENF-07)
        bouton.disabled = !navigator.onLine;
        bouton.textContent = libelle;
      }
    });
  }

  // F-70 : carte du parcours, créée une seule fois (elle n'est pas redessinée au rechargement des données).
  let carteDemandee = false;
  function afficherParcours(a) {
    if (carteDemandee || !a.a_gps) return;
    carteDemandee = true;
    const zoneParcours = conteneur.querySelector('#parcours');
    zoneParcours.innerHTML = '<div class="carte carte-parcours"><div class="carte-leaflet" role="region" aria-label="Carte du parcours"></div></div>';
    afficherCarteParcours(zoneParcours.querySelector('.carte-leaflet'), id, a.sport)
      .then((affichee) => { if (!affichee) zoneParcours.innerHTML = ''; })
      .catch(() => {
        // Hors ligne sans tracé en cache, ou Leaflet indisponible : message discret à la place de la carte.
        zoneParcours.innerHTML = `<div class="carte"><p class="doux">Carte du parcours indisponible pour le moment.</p></div>`;
        carteDemandee = false;
      });
  }

  function afficherDetail(d) {
    zone().innerHTML = rendreHaut(d);
    afficherParcours(d.activite);
    conteneur.querySelector('#detail-bas').innerHTML = rendreBas(d);
    appliquerBarres(conteneur);
    if (!modifiee) afficherRessenti(d.activite);
  }

  // 5.5 : cache d'abord, puis Intervals.icu si le cache a plus de 5 min.
  const cache = await lireDetailEnCache(id);
  if (cache) afficherDetail(cache);
  else zone().innerHTML = squelette() + squelette(); // ENF-22 : chargement
  if (cache && !estPerime(cache.charge_le)) return;

  try {
    const frais = await rafraichirDetail(id);
    if (!conteneur.contains(zone())) return; // écran quitté entre-temps
    afficherDetail(frais);
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
