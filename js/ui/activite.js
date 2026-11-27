// Écran E-03 "Détail d'une activité" (F-13), organisé en onglets (lot LA, D-31) : Résumé (F-100, avec la carte F-70
// et le ressenti F-60, F-61), Graphiques (F-101), Zones (F-103), Intervalles (F-102). Onglet dans l'adresse
// (#/activite/{id}?onglet=graphiques, valeur contrôlée). Les flux ne sont chargés qu'à l'ouverture de Graphiques.
// L6 : saisie du RPE, du ressenti et d'un commentaire, enregistrés dans Intervals.icu (F-60, F-61, ENF-07).
// L7 : carte du parcours pour une activité GPS (F-70).

import {
  lireDetailEnCache, rafraichirDetail, enregistrerRessenti, lireFlux, fluxADemander, lireMeilleursEfforts, lireCourbeAllure,
  lireCourbePuissance, lireHistogramme, lireMemeParcours,
} from '../api/activites.js';
import { lireCourbe42Jours } from '../api/performances.js';
import { lireMateriel, choisirMaterielSeance } from '../api/materiel.js';
import { lireSourceCalculs } from '../api/charge.js';
import { lireResumesEnCache } from '../api/efforts.js';
import { analyseSeance, meilleursTemps, courbePeriode } from '../logique/efforts.js';
import { barresHistogramme } from '../logique/analyse.js';
import { ajouterJours, jourISO } from '../logique/dates.js';
import { materielsPourSport } from '../logique/materiel.js';
import { effortsAChercher, distancesAChercher } from '../logique/analyse.js';
import { tempsAuxDistances, pointsCourbe } from '../logique/performances.js';
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
  ONGLETS, rendreOnglets, rendreResume, famillesZones, rendreZones, rendreIntervalles, rendreTop, afficherChronologie,
  rendreCourbe, rendreHistogramme, rendreMemeParcours,
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
  const demande = params.onglet === 'top' ? 'courbe' : params.onglet; // ancienne adresse de l'onglet Top (D-37)
  let onglet = ONGLETS.some((o) => o.code === demande) ? demande : 'resume';
  conteneur.innerHTML = `${enteteRetour}<div id="etat"></div><div id="detail"></div><div id="onglets"></div>
    <div class="panneau" data-panneau="resume"><div id="resume"></div><div id="parcours"></div><div id="ressenti"></div><div id="materiel-seance"></div><div id="meme-parcours"></div></div>
    <div class="panneau" data-panneau="graphiques" hidden></div>
    <div class="panneau" data-panneau="zones" hidden></div>
    <div class="panneau" data-panneau="intervalles" hidden></div>
    <div class="panneau" data-panneau="courbe" hidden></div>`;
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
  // LC3 (F-129) : avec « Appli » (Réglages, Calculs de l'appli), zones, histogrammes, meilleurs efforts et courbe sont
  // calculés par l'appli à partir des flux de la séance.
  const source = await lireSourceCalculs();
  let analyse = null;
  async function analyseAppli() {
    if (analyse) return analyse;
    const a = detail.activite;
    const flux = await lireFlux(id, a.flux);
    if (reglagesSport === undefined) reglagesSport = await lireReglagesSport(a.sport);
    analyse = { ...analyseSeance(a, flux, reglagesSport), flux };
    return analyse;
  }
  let detail = null;
  let filtre = 'travail'; // F-102 : intervalles de travail par défaut
  let choisi = null; // numéro de l'intervalle choisi (ligne du tableau)
  let segment = null; // { debut_i, fin_i } mis en évidence sur la chronologie : intervalle ou meilleur effort
  let efforts = null;
  let temps = null; // meilleurs temps par distance (course, natation)
  let diagnostic = '';
  let axe = 'temps';
  let chronoAffichee = false;
  let reglagesSport;
  const panneau = (code) => conteneur.querySelector(`[data-panneau="${code}"]`);

  function ongletsDisponibles(d) {
    const a = d.activite;
    const dispo = ['resume'];
    if (fluxADemander(a.flux).some((f) => f !== 'time' && f !== 'distance')) dispo.push('graphiques');
    // Zones : temps par zone, ou histogramme de puissance ou de FC (F-104).
    if ([a.zones_fc, a.zones_puissance, a.zones_allure].some((z) => Array.isArray(z) && z.length)
      || a.flux.includes('watts') || a.flux.includes('heartrate')) dispo.push('zones');
    if (d.intervalles.length) dispo.push('intervalles');
    if (effortsAChercher(a).length || distancesAChercher(a).length) dispo.push('courbe'); // F-105 : courbe et meilleurs efforts
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
      let zonesDe = a;
      if (source === 'appli') {
        try {
          const r = await analyseAppli();
          zonesDe = { ...a, zones_puissance: r.zones_puissance, zones_fc: r.zones_fc, zones_allure: r.zones_allure };
        } catch { /* hors ligne sans flux : zones d'Intervals.icu */ }
        if (!conteneur.isConnected) return;
      }
      const familles = famillesZones(zonesDe, reglagesSport);
      panneau('zones').innerHTML = `${familles.length ? rendreZones(familles) : ''}<div id="histogrammes"></div>`;
      panneau('zones').querySelectorAll('.zone-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
      afficherHistogrammes();
    } else if (onglet === 'intervalles') {
      afficherIntervalles();
    } else if (onglet === 'courbe') {
      await afficherTop();
    } else if (onglet === 'graphiques' && !chronoAffichee) {
      await afficherGraphiques();
    }
  }

  function afficherIntervalles() {
    const p = panneau('intervalles');
    p.innerHTML = rendreIntervalles(detail.intervalles, detail.activite.sport, filtre, choisi);
    p.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.filtre; afficherIntervalles(); }));
    p.querySelectorAll('[data-intervalle]').forEach((ligne) => {
      const ouvrir = () => {
        choisi = Number(ligne.dataset.intervalle);
        const iv = detail.intervalles[choisi];
        segment = iv ? { debut_i: iv.debut_i, fin_i: iv.fin_i } : null;
        montrerSurGraphiques();
      };
      ligne.addEventListener('click', ouvrir);
      ligne.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ouvrir(); } });
    });
  }

  // Ouvre les graphiques avec le segment choisi en évidence (si l'activité a des graphiques).
  function montrerSurGraphiques() {
    chronoAffichee = false;
    if (conteneur.querySelector('.onglets-activite [data-onglet="graphiques"]')) changerOnglet('graphiques');
  }

  // F-104 : histogrammes de puissance et de FC, demandés à l'ouverture de l'onglet Zones (une fois).
  let histogrammes = null;
  async function afficherHistogrammes() {
    const a = detail.activite;
    if (!histogrammes) {
      const sortes = [a.flux.includes('watts') && 'puissance', a.flux.includes('heartrate') && 'fc'].filter(Boolean);
      if (source === 'appli') {
        const r = await analyseAppli().catch(() => null);
        histogrammes = r ? [['puissance', barresHistogramme(r.histo_puissance, 25)], ['fc', barresHistogramme(r.histo_fc, 5)]] : [];
      } else {
        histogrammes = await Promise.all(sortes.map((s) => lireHistogramme(id, s).then((b) => [s, b]).catch(() => [s, []])));
      }
      if (!conteneur.isConnected) return;
    }
    const zoneH = conteneur.querySelector('#histogrammes');
    if (!zoneH) return;
    const largeur = (zoneH.clientWidth || 340) - 32;
    zoneH.innerHTML = histogrammes.map(([s, b]) => rendreHistogramme(b, s, largeur)).join('');
  }

  // F-127 : matériel de la séance (vélos pour le vélo, chaussures pour la course), enregistré dès qu'on le choisit.
  let materielCharge = false;
  async function afficherMaterielSeance(a) {
    if (materielCharge || !['VELO', 'CAP'].includes(a.sport)) return;
    materielCharge = true;
    let choix;
    try {
      choix = materielsPourSport((await lireMateriel()).arbre, a.sport);
    } catch { materielCharge = false; return; }
    const z = conteneur.querySelector('#materiel-seance');
    if (!z || !choix.length) return;
    z.innerHTML = `<div class="carte"><div class="champ"><label for="choix-materiel">Matériel</label>
      <select id="choix-materiel" class="ecriture"><option value="">Aucun</option>${choix.map((m) => `<option value="${echapperHtml(m.id)}"${m.id === a.materiel_id ? ' selected' : ''}>${echapperHtml(m.nom)}</option>`).join('')}</select></div>
      <div id="resultat-materiel" aria-live="polite"></div></div>`;
    const select = z.querySelector('#choix-materiel');
    surveillerReseau(z, z.querySelector('#resultat-materiel'), [select]); // ENF-07
    select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        await choisirMaterielSeance(id, select.value || null);
        z.querySelector('#resultat-materiel').innerHTML = message('succes', 'Matériel enregistré.');
      } catch (e) {
        z.querySelector('#resultat-materiel').innerHTML = messageErreurApi(e);
      } finally { select.disabled = !navigator.onLine; }
    });
  }

  // F-106 : activités sur le même parcours, sous le résumé (si Intervals.icu a reconnu un parcours).
  let parcoursCharge = false;
  async function afficherMemeParcours(a) {
    if (parcoursCharge || !a.parcours_id) return;
    parcoursCharge = true;
    try {
      const autres = await lireMemeParcours(a);
      const z = conteneur.querySelector('#meme-parcours');
      if (z) z.innerHTML = rendreMemeParcours(autres);
    } catch { parcoursCharge = false; }
  }

  // F-105 : courbe de la séance comparée aux 42 derniers jours et meilleurs efforts, demandés à l'ouverture de l'onglet.
  let courbeHtml = '';
  async function afficherTop() {
    const p = panneau('courbe');
    const a = detail.activite;
    if (!efforts) {
      p.innerHTML = `<div class="carte">${squelette()}</div>`;
      const distances = distancesAChercher(a);
      if (source === 'appli') {
        // LC3 : meilleurs efforts, temps par distance et courbe calculés par l'appli ; 42 jours tirés des résumés
        // des séances (calculés depuis Performances ou Calculs de l'appli).
        try {
          const r = await analyseAppli();
          efforts = r.puissance.map((e) => ({ cle: `w${e.duree}`, duree: e.duree, moyenne: e.valeur, debut_i: e.debut_i, fin_i: e.fin_i }));
          temps = r.flux.distance && r.flux.time ? meilleursTemps(r.flux.distance, r.flux.time, distances) : [];
          const puissance = r.courbe_puissance.length > 0;
          const depuis = ajouterJours(jourISO(), -41);
          const resumes = (await lireResumesEnCache()).filter((x) => x.sport === a.sport && x.date >= depuis);
          courbeHtml = rendreCourbe(puissance ? r.courbe_puissance : r.courbe_allure, courbePeriode(resumes, puissance ? 'puissance' : 'allure'),
            puissance ? 'puissance' : 'allure', a.sport, (p.clientWidth || 340) - 32);
          if (!efforts.length && !temps.length) diagnostic = `flux de la séance : ${Object.keys(r.flux).join(', ') || 'aucun'}`;
        } catch (err) {
          p.innerHTML = messageErreurApi(err);
          return;
        }
      } else try {
        // Puissance par best-efforts ; temps par distance lus dans la courbe d'allure de la séance (une requête).
        const [e, courbe] = await Promise.all([
          lireMeilleursEfforts(id, a),
          distances.length ? lireCourbeAllure(id).catch((err) => { diagnostic = `courbe d'allure : ${err.type ?? 'erreur'}${err.statut ? ` ${err.statut}` : ''}`; return null; }) : null,
        ]);
        efforts = e;
        temps = courbe ? tempsAuxDistances(courbe, distances) : [];
        // Courbe : puissance si la séance en a, sinon allure ; comparée à la courbe des 42 derniers jours du sport.
        const largeur = (p.clientWidth || 340) - 32;
        const puissance = a.flux.includes('watts');
        const [seance, periode] = await Promise.all([
          puissance ? lireCourbePuissance(a).catch(() => []) : Promise.resolve(courbe ? pointsCourbe(courbe, 'allure') : []),
          lireCourbe42Jours(a.sport, puissance ? 'puissance' : 'allure').catch(() => []),
        ]);
        courbeHtml = rendreCourbe(seance, periode, puissance ? 'puissance' : 'allure', a.sport, largeur);
        if (courbe && !temps.length) diagnostic = `courbe d'allure reçue avec ${courbe.distance.length} points, aucun sur ${distances.join(', ')} m`;
        if (!diagnostic && !efforts.length && !temps.length) diagnostic = `flux de la séance : ${(a.flux ?? []).join(', ') || 'aucun'}`;
      } catch (err) {
        p.innerHTML = messageErreurApi(err);
        return;
      }
      if (!conteneur.isConnected || onglet !== 'courbe') return;
    }
    p.innerHTML = courbeHtml + rendreTop(efforts, temps, a, diagnostic);
    p.querySelectorAll('[data-effort]').forEach((ligne) => {
      const ouvrir = () => {
        const e = [...efforts, ...temps.map((t) => ({ ...t, cle: `d${t.distance}` }))].find((x) => x.cle === ligne.dataset.effort);
        segment = e ? { debut_i: e.debut_i, fin_i: e.fin_i } : null;
        choisi = null;
        montrerSurGraphiques();
      };
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
      afficherChronologie(p, flux, { sportCode: a.sport, intervalles: detail.intervalles, segment, axe, surAxe: (x) => { axe = x; } });
    } catch (e) {
      p.innerHTML = messageErreurApi(e); // hors ligne sans flux en cache
    }
  }

  function afficherDetail(d) {
    detail = d;
    zone().innerHTML = rendreHaut(d);
    conteneur.querySelector('#resume').innerHTML = rendreResume(d.activite);
    afficherParcours(d.activite);
    afficherMemeParcours(d.activite);
    afficherMaterielSeance(d.activite);
    if (!modifiee) afficherRessenti(d.activite);
    const dispo = ongletsDisponibles(d);
    if (!dispo.includes(onglet)) onglet = 'resume';
    conteneur.querySelector('#onglets').innerHTML = dispo.length > 1 ? rendreOnglets(dispo, onglet) : '';
    conteneur.querySelectorAll('.onglets-activite [data-onglet]').forEach((b) => b.addEventListener('click', (ev) => {
      ev.preventDefault();
      // Ouvrir Graphiques par l'onglet efface le segment choisi.
      if (b.dataset.onglet === 'graphiques' && onglet !== 'graphiques' && segment) { segment = null; choisi = null; chronoAffichee = false; }
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
