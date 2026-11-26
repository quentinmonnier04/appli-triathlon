// Analyse d'une activité, onglets de l'écran E-03 (lot LA, D-31) : Résumé (F-100), Graphiques (F-101),
// Zones (F-103), Intervalles (F-102). Aucun calcul d'analyse : les valeurs viennent d'Intervals.icu, la mise en forme
// et la réduction des points viennent de logique/analyse.js. Toute donnée de l'API passe par echapperHtml (D-21).

import {
  reduirePoints, indiceProche, graduations, etendue, cheminSerie, cheminAire, formaterIntensite, valeursFacultatives,
  FILTRES_INTERVALLES, filtrerIntervalles, moyenneIntervalles, zonesDetaillees, classeZone, libelleEffort,
  indicesApresPause, couperAuxPauses,
} from '../logique/analyse.js';
import { zonesDuSport } from '../logique/profil.js';
import { RESSENTIS, libelleEchelle } from '../logique/ressenti.js';
import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterEntier,
} from '../logique/format.js';
import { stat } from './composants.js';

// --- Onglets ---

export const ONGLETS = [
  { code: 'resume', libelle: 'Résumé' },
  { code: 'graphiques', libelle: 'Graphiques' },
  { code: 'zones', libelle: 'Zones' },
  { code: 'intervalles', libelle: 'Intervalles' },
  { code: 'top', libelle: 'Top' },
];

export function rendreOnglets(disponibles, actif) {
  return `<nav class="onglets-vue onglets-activite" aria-label="Analyse de l'activité">
    ${ONGLETS.filter((o) => disponibles.includes(o.code)).map((o) => `<a href="#" data-onglet="${o.code}" class="${o.code === actif ? 'actif' : ''}"${o.code === actif ? ' aria-current="page"' : ''}>${echapperHtml(o.libelle)}</a>`).join('')}
  </nav>`;
}

// --- F-100 : résumé ---

export function rendreResume(a) {
  const sensation = libelleEchelle(RESSENTIS, a.ressenti);
  const principales = [
    stat('Dénivelé +', a.denivele_m > 0 ? `${formaterEntier(a.denivele_m)} m` : null),
    stat('Charge', a.charge > 0 ? formaterEntier(a.charge) : null),
    stat('Intensité', formaterIntensite(a.intensite)),
    stat('RPE', a.rpe ? `${a.rpe}/10` : null),
    stat('Sensation', sensation ?? null),
  ].join('');
  const facultatives = valeursFacultatives(a).map((l) => stat(l.etiquette, l.valeur)).join('');
  if (!principales && !facultatives) return '';
  return `<div class="carte"><div class="stats grille-stats">${principales}${facultatives}</div></div>`;
}

// --- F-103 : zones ---

const FAMILLES_ZONES = [
  { champ: 'zones_puissance', titre: 'Puissance', famille: 'Puissance', sports: ['VELO', 'CAP'] },
  { champ: 'zones_fc', titre: 'Fréquence cardiaque', famille: 'Fréquence cardiaque', sports: null },
  { champ: 'zones_allure', titre: 'Allure', famille: 'Allure', sports: ['CAP', 'NATATION'] },
];

// Familles de zones disponibles pour l'activité (puissance vélo, FC partout, allure course et natation).
export function famillesZones(a, reglages) {
  const definitions = reglages ? zonesDuSport(reglages) : [];
  return FAMILLES_ZONES
    .filter((f) => !f.sports || f.sports.includes(a.sport))
    .map((f) => ({ titre: f.titre, lignes: zonesDetaillees(a[f.champ], definitions.find((d) => d.titre === f.famille)?.zones ?? []) }))
    .filter((f) => f.lignes.length);
}

export function rendreZones(familles) {
  if (!familles.length) return '<div class="carte"><p class="doux">Pas de temps par zone pour cette activité.</p></div>';
  return familles.map((f) => `<div class="carte"><h2>${echapperHtml(f.titre)}</h2>
    ${f.lignes.map((l) => `<div class="zone-ligne">
      <span class="zone-pastille ${classeZone(l.numero)}" aria-hidden="true"></span>
      <span class="zone-libelle"><strong>Z${l.numero} ${echapperHtml(l.nom === `Z${l.numero}` ? '' : l.nom)}</strong>${l.bornes ? `<span class="doux"> ${echapperHtml(l.bornes)}</span>` : ''}</span>
      <span class="zone-chiffres"><strong>${echapperHtml(l.duree)}</strong> <span class="doux">${l.pct} %</span></span>
      <span class="zone-barre"><span class="zone-remplie ${classeZone(l.numero)}" data-pct="${l.pct}"></span></span>
    </div>`).join('')}</div>`).join('');
}

// --- F-102 : intervalles ---

function celluleVitesse(i, sportCode) {
  if (!i.vitesse_ms) return '';
  return formaterVitesse(sportCode, i.vitesse_ms * 1000, 1000) ?? '';
}

function nombre(v, decimales = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  return decimales ? String(Math.round(v * 10 ** decimales) / 10 ** decimales).replace('.', ',') : formaterEntier(v);
}

export function rendreIntervalles(intervalles, sportCode, filtre, choisi = null) {
  if (!intervalles.length) return '<div class="carte"><p class="doux">Pas d\'intervalles pour cette activité.</p></div>';
  const liste = filtrerIntervalles(intervalles, filtre);
  const moyenne = moyenneIntervalles(liste);
  const col = (cle) => intervalles.some((i) => i[cle] !== null && i[cle] !== undefined);
  const colonnes = [
    { titre: 'Durée', valeur: (i) => formaterDuree(i.duree_s) ?? '' },
    col('puissance_moy_w') && { titre: 'Puiss.', valeur: (i) => nombre(i.puissance_moy_w) },
    col('fc_moy') && { titre: 'FC moy', valeur: (i) => nombre(i.fc_moy) },
    col('fc_max') && { titre: 'FC max', valeur: (i) => nombre(i.fc_max) },
    col('cadence_moy') && { titre: 'Cad.', valeur: (i) => nombre(i.cadence_moy) },
    col('vitesse_ms') && { titre: sportCode === 'VELO' ? 'Vitesse' : 'Allure', valeur: (i) => celluleVitesse(i, sportCode) },
    col('pente_pct') && { titre: 'Pente', valeur: (i) => (i.pente_pct === null || i.pente_pct === undefined ? '' : `${nombre(i.pente_pct, 1)} %`) },
    col('intensite') && { titre: 'Int.', valeur: (i) => formaterIntensite(i.intensite) ?? '' },
    col('zone') && { titre: 'Zone', valeur: (i) => (i.zone ? `Z${formaterEntier(i.zone)}` : '') },
  ].filter(Boolean);
  const ligne = (i) => `<tr class="${i.type === 'RECOVERY' ? 'recup' : ''}${choisi === i.n ? ' choisi' : ''}" data-intervalle="${i.n}" tabindex="0"
      aria-label="Intervalle ${i.n + 1} : le montrer sur les graphiques">
    <th scope="row">${echapperHtml(i.libelle ?? String(i.n + 1))}</th>${colonnes.map((c) => `<td>${echapperHtml(c.valeur(i))}</td>`).join('')}</tr>`;
  return `<div class="carte">
    <div class="bascule large" role="group" aria-label="Intervalles affichés">
      ${FILTRES_INTERVALLES.map((f) => `<button type="button" data-filtre="${f.code}" class="${f.code === filtre ? 'actif' : ''}" aria-pressed="${f.code === filtre}">${echapperHtml(f.libelle)}</button>`).join('')}
    </div>
    ${liste.length ? `<div class="tableau-defilant"><table class="intervalles tableau-analyse">
      <thead><tr><th scope="col">#</th>${colonnes.map((c) => `<th scope="col">${echapperHtml(c.titre)}</th>`).join('')}</tr></thead>
      <tbody>${liste.map(ligne).join('')}</tbody>
      ${moyenne ? `<tfoot><tr><th scope="row">Moy.</th>${colonnes.map((c) => `<td>${echapperHtml(c.valeur(moyenne))}</td>`).join('')}</tr></tfoot>` : ''}
    </table></div>
    <p class="doux petit-texte">Touche un intervalle pour le voir sur les graphiques.</p>` : '<p class="doux">Aucun intervalle de ce type.</p>'}
  </div>`;
}

// --- F-105 : meilleurs efforts de l'activité (D-33, D-34) ---

// efforts : meilleures puissances (best-efforts) ; temps : meilleurs temps par distance (courbe d'allure).
// diagnostic : texte affiché quand Intervals.icu ne renvoie rien (pour comprendre pourquoi sur une vraie séance).
export function rendreTop(efforts, temps, a, diagnostic = '') {
  if (!efforts.length && !temps.length) {
    return `<div class="carte"><p class="doux">Intervals.icu n'a renvoyé aucun meilleur effort pour cette séance.</p>
      ${diagnostic ? `<p class="doux petit-texte">Détail technique : ${echapperHtml(diagnostic)}</p>` : ''}</div>`;
  }
  const ligne = (cle, libelle, cellules) => `<tr data-effort="${echapperHtml(cle)}" tabindex="0" aria-label="${echapperHtml(libelle)} : le montrer sur les graphiques">
    <th scope="row">${echapperHtml(libelle)}</th>${cellules.map((c) => `<td>${echapperHtml(c)}</td>`).join('')}</tr>`;
  const avecWkg = a.poids_kg > 0;
  const wkg = (w) => String(Math.round((w / a.poids_kg) * 100) / 100).replace('.', ',');
  const tetePuissance = `<th scope="col">Durée</th><th scope="col">Puissance</th>${avecWkg ? '<th scope="col">W/kg</th>' : ''}`;
  const blocPuissance = efforts.length ? `<div class="carte"><h2>Top puissance</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr>${tetePuissance}</tr></thead>
    <tbody>${efforts.map((e) => ligne(e.cle, libelleEffort(e), [`${formaterEntier(e.moyenne)} W`, ...(avecWkg ? [wkg(e.moyenne)] : [])])).join('')}</tbody></table></div></div>` : '';
  const titreAllure = a.sport === 'NATATION' ? 'Top natation' : 'Top course';
  const blocAllure = temps.length ? `<div class="carte"><h2>${titreAllure}</h2>
    <div class="tableau-defilant"><table class="intervalles tableau-analyse"><thead><tr><th scope="col">Distance</th><th scope="col">Temps</th><th scope="col">Allure</th></tr></thead>
    <tbody>${temps.map((t) => ligne(`d${t.distance}`, libelleEffort(t), [formaterDuree(t.temps_s) ?? '', formaterVitesse(a.sport, t.distance, t.temps_s) ?? ''])).join('')}</tbody></table></div></div>` : '';
  return `${blocPuissance}${blocAllure}
  <p class="doux petit-texte">Meilleurs efforts calculés par Intervals.icu sur cette séance. Touche une ligne pour la voir sur les graphiques.</p>`;
}

// --- F-101 : chronologie ---

// Séries dessinées, dans l'ordre d'affichage. lire(v, sport) : valeur affichée (nombre) ; texte(v, sport) : lecture.
const SERIES = [
  { flux: 'watts', titre: 'Puissance', classe: 'serie-puissance', texte: (v) => `${formaterEntier(v)} W` },
  { flux: 'heartrate', titre: 'FC', classe: 'serie-fc', texte: (v) => `${formaterEntier(v)} bpm` },
  { flux: 'cadence', titre: 'Cadence', classe: 'serie-cadence', texte: (v) => `${formaterEntier(v)} /min` },
  {
    flux: 'velocity_smooth',
    titre: (s) => (s === 'VELO' ? 'Vitesse' : 'Allure'),
    classe: 'serie-vitesse',
    texte: (v, s) => (v > 0 ? formaterVitesse(s, v * 1000, 1000) ?? '' : '-'),
    lire: (v, s) => (s === 'VELO' ? v * 3.6 : v), // km/h pour le vélo ; vitesse brute (m/s) pour l'allure
    axe: (v, s) => (s === 'VELO' ? formaterEntier(v) : ''),
  },
  { flux: 'altitude', titre: 'Altitude', classe: 'serie-altitude', aire: true, texte: (v) => `${formaterEntier(v)} m` },
];

const HAUTEUR_GRAPHIQUE = 84;
const MARGE_GAUCHE = 34;

function titreSerie(s, sportCode) { return typeof s.titre === 'function' ? s.titre(sportCode) : s.titre; }

// Prépare les données de la chronologie : axe x (temps ou distance) et séries disponibles.
function preparer(flux, sportCode, axe) {
  const n = Math.max(...Object.values(flux).map((d) => d.length), 0);
  const temps = flux.time ?? Array.from({ length: n }, (_, i) => i);
  const xs = axe === 'distance' && flux.distance ? flux.distance : temps;
  // Sur l'axe du temps, une pause coupe les traits (pas de diagonale entre l'avant et l'après).
  const pauses = axe === 'distance' ? [] : indicesApresPause(temps);
  const series = SERIES.filter((s) => flux[s.flux] && etendue(flux[s.flux]))
    .map((s) => {
      const ys = s.lire ? flux[s.flux].map((v) => (v === null ? null : s.lire(v, sportCode))) : flux[s.flux];
      return { ...s, ys: couperAuxPauses(ys, pauses), brut: flux[s.flux] };
    });
  return { xs, temps, series, n };
}

function texteX(x, axe) {
  if (axe === 'distance') return `${String(Math.round(x / 100) / 10).replace('.', ',')} km`;
  return formaterDuree(Math.round(x)) ?? '0:00';
}

// Bande du segment choisi (intervalle ou meilleur effort), plus foncée.
function bandeSegment(segment, xs, versX, hauteur) {
  if (!segment || xs[segment.debut_i] === undefined) return '';
  const xa = versX(xs[segment.debut_i]);
  const xb = versX(xs[Math.min(segment.fin_i, xs.length - 1)]);
  return `<rect class="bande-intervalle choisie" x="${xa}" y="0" width="${Math.max(2, xb - xa)}" height="${hauteur}"></rect>`;
}

// Dessin d'un graphique de la pile ; bandes des intervalles de travail, intervalle choisi en évidence.
function svgSerie(s, donnees, largeur, hauteur, sportCode, intervalles, segment) {
  const { xs } = donnees;
  const plage = etendue(s.ys);
  // Puissance depuis 0 ; FC, cadence, vitesse et altitude resserrées sur leurs valeurs (courbes lisibles).
  const g = graduations(s.flux === 'watts' ? 0 : plage.min, plage.max, 4);
  const x0 = xs[0];
  const x1 = xs[xs.length - 1] || 1;
  const versX = (x) => MARGE_GAUCHE + ((x - x0) / ((x1 - x0) || 1)) * (largeur - MARGE_GAUCHE);
  const versY = (y) => hauteur - 2 - ((y - g.min) / ((g.max - g.min) || 1)) * (hauteur - 6);
  const indices = reduirePoints(xs, s.ys, Math.max(10, Math.round(largeur - MARGE_GAUCHE)));
  // Altitude : une aire par morceau continu (une pause coupe la série sans déformer l'aire).
  const d = s.aire ? cheminAire(xs, s.ys, indices, versX, versY, hauteur) : cheminSerie(xs, s.ys, indices, versX, versY);
  const bandes = intervalles.map((iv, n) => ({ iv, n })).filter(({ iv }) => iv.type !== 'RECOVERY' && Number.isInteger(iv.debut_i) && Number.isInteger(iv.fin_i) && xs[iv.debut_i] !== undefined)
    .map(({ iv, n }) => {
      const xa = versX(xs[iv.debut_i]);
      const xb = versX(xs[Math.min(iv.fin_i, xs.length - 1)]);
      return `<rect class="bande-intervalle" x="${xa}" y="0" width="${Math.max(1, xb - xa)}" height="${hauteur}"></rect>`;
    }).join('') + bandeSegment(segment, xs, versX, hauteur);
  const axeTexte = (v) => (s.axe ? s.axe(v, sportCode) : formaterEntier(v));
  const reperes = s.flux === 'velocity_smooth' && sportCode !== 'VELO' ? [] : [g.min, g.max];
  const titre = titreSerie(s, sportCode);
  return `<div class="graphique-ligne"><div class="graphique-titre">${titre}${s.flux === 'velocity_smooth' && sportCode === 'VELO' ? ' (km/h)' : ''}</div>
    <svg class="graphique-chrono ${s.classe}" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img"
      aria-label="${titre} au fil de la séance, de ${echapperHtml(s.texte(plage.min, sportCode))} à ${echapperHtml(s.texte(plage.max, sportCode))}">
      ${bandes}
      ${reperes.map((v) => `<text class="axe-texte" x="2" y="${Math.min(hauteur - 2, Math.max(9, versY(v) + 3))}">${echapperHtml(axeTexte(v))}</text>`).join('')}
      <path class="${s.aire ? 'trace-aire' : 'trace-ligne'}" d="${d}"></path>
    </svg></div>`;
}

// Chronologie active par zone : une nouvelle chronologie arrête la précédente (sinon l'ancienne se redessinerait
// par-dessus au prochain changement de taille).
const chronologiesActives = new WeakMap();

// Affiche la chronologie dans "zone" et branche le curseur commun. Renvoie une fonction de nettoyage.
// options : { sportCode, intervalles, segment ({ debut_i, fin_i } mis en évidence : intervalle ou meilleur effort),
//   axe ('temps' | 'distance'), surAxe(axe) }
export function afficherChronologie(zone, flux, options) {
  const { sportCode, intervalles = [] } = options;
  const segment = Number.isInteger(options.segment?.debut_i) && Number.isInteger(options.segment?.fin_i) ? options.segment : null;
  let axe = options.axe === 'distance' && flux.distance ? 'distance' : 'temps';
  const paysage = window.matchMedia('(orientation: landscape) and (max-height: 560px)');
  let lecture = null;

  function dessiner() {
    const donnees = preparer(flux, sportCode, axe);
    if (!donnees.series.length || donnees.n < 2) {
      zone.innerHTML = '<div class="carte"><p class="doux">Pas de données détaillées pour cette activité.</p></div>';
      return;
    }
    const plein = paysage.matches;
    zone.classList.toggle('chrono-plein-ecran', plein);
    const largeur = Math.max(240, Math.round((plein ? window.innerWidth : zone.clientWidth || 340) - (plein ? 24 : 32)));
    // En paysage, la pile tient dans la hauteur de l'écran (en-tête, titres et axe compris).
    const hauteur = plein
      ? Math.max(28, Math.floor((window.innerHeight - 80) / donnees.series.length) - 20)
      : HAUTEUR_GRAPHIQUE;
    const x0 = donnees.xs[0];
    const x1 = donnees.xs[donnees.xs.length - 1];
    zone.innerHTML = `<div class="carte chronologie sport-${echapperHtml(sportCode)}">
      <div class="chrono-tete">
        ${flux.distance ? `<div class="bascule" role="group" aria-label="Axe des graphiques">
          <button type="button" data-axe="temps" class="${axe === 'temps' ? 'actif' : ''}" aria-pressed="${axe === 'temps'}">Temps</button>
          <button type="button" data-axe="distance" class="${axe === 'distance' ? 'actif' : ''}" aria-pressed="${axe === 'distance'}">Distance</button></div>` : ''}
        <div class="chrono-lecture"><span class="doux">Touche ou glisse sur les graphiques pour lire les valeurs.</span></div>
      </div>
      <div class="chrono-pile">
        ${donnees.series.map((s) => svgSerie(s, donnees, largeur, hauteur, sportCode, intervalles, segment)).join('')}
        <div class="chrono-curseur" hidden></div>
      </div>
      <div class="axe-x doux"><span>${echapperHtml(texteX(x0, axe))}</span><span>${echapperHtml(texteX((x0 + x1) / 2, axe))}</span><span>${echapperHtml(texteX(x1, axe))}</span></div>
      ${plein ? '' : '<p class="doux petit-texte">Tourne le téléphone pour voir les graphiques en grand.</p>'}
    </div>`;
    zone.querySelectorAll('[data-axe]').forEach((b) => b.addEventListener('click', () => {
      axe = b.dataset.axe;
      options.surAxe?.(axe);
      dessiner();
    }));
    brancherCurseur(donnees, largeur);
    if (segment) placer(donnees, largeur, segment.debut_i);
  }

  // Curseur commun (F-101) : la même verticale sur tous les graphiques, valeurs lues au même instant.
  // Fluidité : la lecture est construite une seule fois, puis seuls ses textes changent, une fois par image.
  function placer(donnees, largeur, i) {
    const curseur = zone.querySelector('.chrono-curseur');
    const zoneLecture = zone.querySelector('.chrono-lecture');
    if (!curseur || !zoneLecture || i < 0) return;
    if (!zoneLecture.dataset.prete) {
      const cases = donnees.series.map((s, k) => `<span><span class="doux">${titreSerie(s, sportCode)}</span> <strong data-lecture="${k}"></strong></span>`).join('');
      zoneLecture.innerHTML = `<span><strong data-lecture="x"></strong></span>${cases}`;
      zoneLecture.dataset.prete = '1';
    }
    const { xs } = donnees;
    const x0 = xs[0];
    const x1 = xs[xs.length - 1] || 1;
    const px = MARGE_GAUCHE + ((xs[i] - x0) / ((x1 - x0) || 1)) * (largeur - MARGE_GAUCHE);
    curseur.hidden = false;
    curseur.style.transform = `translateX(${px}px)`;
    zoneLecture.querySelector('[data-lecture="x"]').textContent = texteX(xs[i], axe);
    donnees.series.forEach((s, k) => {
      const v = s.brut[i];
      zoneLecture.querySelector(`[data-lecture="${k}"]`).textContent = v === null || v === undefined ? '-' : s.texte(v, sportCode);
    });
  }

  function brancherCurseur(donnees, largeur) {
    const pile = zone.querySelector('.chrono-pile');
    const { xs } = donnees;
    const x0 = xs[0];
    const x1 = xs[xs.length - 1] || 1;
    let gauche = null;
    let demande = 0;
    let dernierX = 0;
    const appliquer = () => {
      demande = 0;
      const px = Math.min(largeur, Math.max(MARGE_GAUCHE, dernierX - gauche));
      const x = x0 + ((px - MARGE_GAUCHE) / (largeur - MARGE_GAUCHE)) * (x1 - x0);
      placer(donnees, largeur, indiceProche(xs, x));
    };
    const lire = (ev) => {
      if (gauche === null) gauche = pile.getBoundingClientRect().left;
      dernierX = ev.clientX;
      if (!demande) demande = requestAnimationFrame(appliquer);
    };
    pile.addEventListener('pointerdown', (ev) => { gauche = pile.getBoundingClientRect().left; lire(ev); });
    pile.addEventListener('pointermove', lire);
    pile.addEventListener('pointerleave', () => { gauche = null; });
  }

  // Redessin au changement d'orientation ou de taille (plein écran en paysage).
  let attente = null;
  const redessiner = () => { clearTimeout(attente); attente = setTimeout(() => { if (zone.isConnected) dessiner(); else nettoyer(); }, 150); };
  function nettoyer() {
    clearTimeout(attente);
    window.removeEventListener('resize', redessiner);
    paysage.removeEventListener?.('change', redessiner);
    zone.classList.remove('chrono-plein-ecran');
  }
  chronologiesActives.get(zone)?.();
  chronologiesActives.set(zone, nettoyer);
  window.addEventListener('resize', redessiner);
  paysage.addEventListener?.('change', redessiner);
  dessiner();
  lecture = nettoyer;
  return lecture;
}
