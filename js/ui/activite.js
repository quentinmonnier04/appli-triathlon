// Écran E-03 "Détail d'une activité" (F-13), organisé en onglets (lot LA, D-31) : Résumé (F-100, avec la carte F-70
// et le ressenti F-60, F-61), Graphiques (F-101), Zones (F-103), Intervalles (F-102). Onglet dans l'adresse
// (#/activite/{id}?onglet=graphiques, valeur contrôlée). Les flux ne sont chargés qu'à l'ouverture de Graphiques.
// L6 : saisie du RPE, du ressenti et d'un commentaire, enregistrés dans Intervals.icu (F-60, F-61, ENF-07).
// L7 : carte du parcours pour une activité GPS (F-70).

import { lireDetailEnCache, rafraichirDetail, enregistrerRessenti, lireFlux, fluxADemander } from '../api/activites.js';
import { lireReglagesSport } from '../api/profil.js';
import { estPerime } from '../logique/activites.js';
import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterDateHeure,
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
import {
  ONGLETS, rendreOnglets, rendreResume, famillesZones, rendreZones, rendreIntervalles, afficherChronologie,
} from './analyse.js';

const enteteRetour = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/activites' })}
  <span class="titre-petit">Activité</span><span class="espace-bouton"></span></div>`;

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

export async function afficherActivite(conteneur, segments, params = {}) {
  const id = decodeURIComponent(segments[1] ?? '');
  const zone = () => conteneur.querySelector('#detail');
  // Onglet de l'adresse, contrôlé (D-21) ; chaque onglet a son panneau, masqué ou affiché (la carte et le ressenti
  // ne sont pas recréés en changeant d'onglet).
  let onglet = ONGLETS.some((o) => o.code === params.onglet) ? params.onglet : 'resume';
  conteneur.innerHTML = `${enteteRetour}<div id="etat"></div><div id="detail"></div><div id="onglets"></div>
    <div class="panneau" data-panneau="resume"><div id="resume"></div><div id="parcours"></div><div id="ressenti"></div></div>
    <div class="panneau" data-panneau="graphiques" hidden></div>
    <div class="panneau" data-panneau="zones" hidden></div>
    <div class="panneau" data-panneau="intervalles" hidden></div>`;
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

  // --- Onglets (lot LA) ---
  let detail = null;
  let filtre = 'travail'; // F-102 : intervalles de travail par défaut
  let choisi = null; // intervalle mis en évidence sur la chronologie
  let axe = 'temps';
  let chronoAffichee = false;
  let reglagesSport;
  const panneau = (code) => conteneur.querySelector(`[data-panneau="${code}"]`);

  function ongletsDisponibles(d) {
    const a = d.activite;
    const dispo = ['resume'];
    if (fluxADemander(a.flux).some((f) => f !== 'time' && f !== 'distance')) dispo.push('graphiques');
    if ([a.zones_fc, a.zones_puissance, a.zones_allure].some((z) => Array.isArray(z) && z.length)) dispo.push('zones');
    if (d.intervalles.length) dispo.push('intervalles');
    return dispo;
  }

  function changerOnglet(code) {
    onglet = code;
    history.replaceState(null, '', `#/activite/${encodeURIComponent(id)}${code === 'resume' ? '' : `?onglet=${code}`}`);
    conteneur.querySelectorAll('.onglets-activite [data-onglet]').forEach((b) => {
      const actif = b.dataset.onglet === code;
      b.classList.toggle('actif', actif);
      if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    conteneur.querySelectorAll('.panneau').forEach((p) => { p.hidden = p.dataset.panneau !== code; });
    remplirOnglet();
  }

  // Remplit l'onglet affiché ; les flux (Graphiques) ne sont demandés qu'ici (ENF-09, ENF-11).
  async function remplirOnglet() {
    if (!detail) return;
    const a = detail.activite;
    if (onglet === 'zones') {
      if (reglagesSport === undefined) {
        panneau('zones').innerHTML = squelette();
        reglagesSport = await lireReglagesSport(a.sport);
        if (!conteneur.isConnected) return;
      }
      panneau('zones').innerHTML = rendreZones(famillesZones(a, reglagesSport));
      panneau('zones').querySelectorAll('.zone-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
    } else if (onglet === 'intervalles') {
      afficherIntervalles();
    } else if (onglet === 'graphiques' && !chronoAffichee) {
      await afficherGraphiques();
    }
  }

  function afficherIntervalles() {
    const p = panneau('intervalles');
    p.innerHTML = rendreIntervalles(detail.intervalles, detail.activite.sport, filtre, choisi);
    p.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.filtre; afficherIntervalles(); }));
    p.querySelectorAll('[data-intervalle]').forEach((ligne) => {
      const ouvrir = () => { choisi = Number(ligne.dataset.intervalle); chronoAffichee = false; changerOnglet('graphiques'); };
      ligne.addEventListener('click', ouvrir);
      ligne.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ouvrir(); } });
    });
  }

  async function afficherGraphiques() {
    const p = panneau('graphiques');
    const a = detail.activite;
    p.innerHTML = `<div class="carte">${squelette()}</div>`;
    try {
      const flux = await lireFlux(id, a.flux);
      if (!conteneur.isConnected || onglet !== 'graphiques') return;
      chronoAffichee = true;
      afficherChronologie(p, flux, { sportCode: a.sport, intervalles: detail.intervalles, choisi, axe, surAxe: (x) => { axe = x; } });
    } catch (e) {
      p.innerHTML = messageErreurApi(e); // hors ligne sans flux en cache
    }
  }

  function afficherDetail(d) {
    detail = d;
    zone().innerHTML = rendreHaut(d);
    conteneur.querySelector('#resume').innerHTML = rendreResume(d.activite);
    afficherParcours(d.activite);
    if (!modifiee) afficherRessenti(d.activite);
    const dispo = ongletsDisponibles(d);
    if (!dispo.includes(onglet)) onglet = 'resume';
    conteneur.querySelector('#onglets').innerHTML = dispo.length > 1 ? rendreOnglets(dispo, onglet) : '';
    conteneur.querySelectorAll('.onglets-activite [data-onglet]').forEach((b) => b.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (b.dataset.onglet === 'graphiques' && onglet !== 'graphiques') chronoAffichee = chronoAffichee && choisi === null;
      changerOnglet(b.dataset.onglet);
    }));
    changerOnglet(onglet);
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
