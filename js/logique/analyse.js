// Analyse d'une activité (lot LA : F-100 à F-103, D-31). Fonctions pures, sans calcul d'analyse refait :
// les valeurs viennent d'Intervals.icu ; ici on trie, on réduit le nombre de points à dessiner et on met en forme.

import { formaterDuree, formaterEntier } from './format.js';

// --- Réduction des points (F-101, ENF-09) ---

// Réduit une série à environ 2 points par tranche (le minimum et le maximum de chaque tranche, dans l'ordre),
// pour dessiner autant de tranches que de pixels sans perdre les pics (sprints, montées de FC).
// xs, ys : tableaux de même longueur (ys peut contenir null : trou de données, gardé comme coupure).
// Renvoie les indices gardés, croissants. Une série plus courte que 2 x tranches est gardée entière.
export function reduirePoints(xs, ys, tranches) {
  const n = Math.min(xs.length, ys.length);
  if (n <= 2 * tranches || tranches < 1) return Array.from({ length: n }, (_, i) => i);
  const x0 = xs[0];
  const largeur = (xs[n - 1] - x0) || 1;
  const garde = [];
  let tranche = -1;
  let iMin = -1;
  let iMax = -1;
  let trouVu = false;
  const vider = () => {
    if (iMin === -1) return;
    if (iMin === iMax) garde.push(iMin);
    else garde.push(Math.min(iMin, iMax), Math.max(iMin, iMax));
  };
  for (let i = 0; i < n; i += 1) {
    const t = Math.min(tranches - 1, Math.floor(((xs[i] - x0) / largeur) * tranches));
    if (t !== tranche) { vider(); tranche = t; iMin = -1; iMax = -1; trouVu = false; }
    const y = ys[i];
    if (y === null || y === undefined || Number.isNaN(y)) {
      if (!trouVu) { vider(); iMin = -1; iMax = -1; garde.push(i); trouVu = true; } // coupure conservée une fois par tranche
      continue;
    }
    if (iMin === -1 || y < ys[iMin]) iMin = i;
    if (iMax === -1 || y > ys[iMax]) iMax = i;
  }
  vider();
  garde.push(0, n - 1);
  return [...new Set(garde)].sort((a, b) => a - b);
}

// Indice du point le plus proche de x dans un tableau croissant (recherche dichotomique).
export function indiceProche(xs, x) {
  if (!xs.length) return -1;
  let bas = 0;
  let haut = xs.length - 1;
  while (haut - bas > 1) {
    const milieu = (bas + haut) >> 1;
    if (xs[milieu] <= x) bas = milieu; else haut = milieu;
  }
  return Math.abs(xs[haut] - x) < Math.abs(xs[bas] - x) ? haut : bas;
}

// Bornes "rondes" d'un axe et graduations (environ n), pour des axes lisibles.
export function graduations(min, max, n = 3) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, pas: 1, valeurs: [0, 1] };
  if (min === max) { min -= 1; max += 1; }
  const brut = (max - min) / n;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * puissance).find((p) => p >= brut);
  const bas = Math.floor(min / pas) * pas;
  const hautB = Math.ceil(max / pas) * pas;
  const valeurs = [];
  for (let v = bas; v <= hautB + pas / 2; v += pas) valeurs.push(Math.round(v * 1000) / 1000);
  return { min: bas, max: hautB, pas, valeurs };
}

// Min et max d'une série, en ignorant les trous.
export function etendue(ys) {
  let min = Infinity;
  let max = -Infinity;
  for (const y of ys) {
    if (y === null || y === undefined || Number.isNaN(y)) continue;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return Number.isFinite(min) ? { min, max } : null;
}

// Chemin SVG d'une série réduite : x et y déjà convertis en pixels par les fonctions d'échelle ; un trou coupe le trait.
export function cheminSerie(xs, ys, indices, versX, versY) {
  let d = '';
  let leve = true;
  for (const i of indices) {
    const y = ys[i];
    if (y === null || y === undefined || Number.isNaN(y)) { leve = true; continue; }
    d += `${leve ? 'M' : 'L'}${Math.round(versX(xs[i]) * 10) / 10},${Math.round(versY(y) * 10) / 10}`;
    leve = false;
  }
  return d;
}

// --- Résumé détaillé (F-100) ---

// Intensité : Intervals.icu peut la donner en fraction (0,85) ou en pourcentage (85) ; affichée en %.
export function formaterIntensite(v) {
  if (v === null || v === undefined || !Number.isFinite(v) || v <= 0) return null;
  return `${Math.round(v <= 3 ? v * 100 : v)} %`;
}

// Valeurs facultatives du résumé : seulement celles qui existent (ni "?" ni "0").
// a : objet Activite (9.2) enrichi par api/activites.js. Renvoie [{ etiquette, valeur }].
export function valeursFacultatives(a) {
  const present = (v) => v !== null && v !== undefined && Number.isFinite(v) && v > 0;
  const lignes = [];
  const ajouter = (etiquette, v, texte) => { if (present(v)) lignes.push({ etiquette, valeur: texte }); };
  ajouter('Puissance normalisée', a.np_w, `${formaterEntier(a.np_w)} W`);
  ajouter('Puissance moy.', a.puissance_moy_w, `${formaterEntier(a.puissance_moy_w)} W`);
  ajouter('Variabilité', a.variabilite, String(Math.round(a.variabilite * 100) / 100).replace('.', ','));
  ajouter('FC moy.', a.fc_moy, `${formaterEntier(a.fc_moy)} bpm`);
  ajouter('FC max', a.fc_max, `${formaterEntier(a.fc_max)} bpm`);
  ajouter('Cadence moy.', a.cadence_moy, `${formaterEntier(a.cadence_moy)} /min`);
  ajouter('Travail', a.travail_j, `${formaterEntier(a.travail_j / 1000)} kJ`);
  ajouter('Calories', a.calories, `${formaterEntier(a.calories)} kcal`);
  return lignes;
}

// --- Intervalles (F-102) ---

export const FILTRES_INTERVALLES = [
  { code: 'travail', libelle: 'Travail' },
  { code: 'tout', libelle: 'Tout' },
  { code: 'recup', libelle: 'Récupération' },
];

// Intervalles affichés selon le filtre ; chaque ligne garde son numéro d'origine (n) pour la chronologie.
export function filtrerIntervalles(intervalles, filtre) {
  return intervalles.map((i, n) => ({ ...i, n }))
    .filter((i) => filtre === 'tout' || (filtre === 'travail' ? i.type !== 'RECOVERY' : i.type === 'RECOVERY'));
}

// Ligne de moyenne : moyennes pondérées par la durée des intervalles affichés (champs absents ignorés),
// durée et distance totales. null s'il n'y a rien à moyenner.
export function moyenneIntervalles(liste) {
  if (!liste.length) return null;
  const champs = ['puissance_moy_w', 'fc_moy', 'cadence_moy', 'vitesse_ms', 'pente_pct', 'intensite'];
  const resultat = { duree_s: 0, distance_m: 0, fc_max: null };
  for (const i of liste) {
    resultat.duree_s += i.duree_s ?? 0;
    resultat.distance_m += i.distance_m ?? 0;
    if (i.fc_max) resultat.fc_max = Math.max(resultat.fc_max ?? 0, i.fc_max);
  }
  for (const c of champs) {
    let somme = 0;
    let poids = 0;
    for (const i of liste) {
      const v = i[c];
      const p = i.duree_s ?? 0;
      if (v === null || v === undefined || !Number.isFinite(v) || !p) continue;
      somme += v * p;
      poids += p;
    }
    resultat[c] = poids ? somme / poids : null;
  }
  return resultat;
}

// --- Zones (F-103) ---

// Temps par zone d'une activité, avec les noms et bornes des zones du sport (lus dans Intervals.icu).
// temps : tableau de secondes ou de { id, secs } ; zones : [{ nom, texte }] (logique/profil.js), peut être vide.
// Renvoie [{ numero, nom, bornes, secs, pct, duree }] ; zones vides de fin retirées.
export function zonesDetaillees(temps, zones = []) {
  if (!Array.isArray(temps)) return [];
  const lignes = temps
    .map((t, i) => (typeof t === 'number' ? { id: `Z${i + 1}`, secs: t } : { id: t.id, secs: t.secs ?? 0 }))
    .filter((l) => /^Z[1-7]$/.test(l.id))
    .map((l) => {
      const numero = Number(l.id.slice(1));
      const z = zones[numero - 1];
      return { numero, nom: z?.nom ?? l.id, bornes: z?.texte ?? '', secs: l.secs };
    });
  while (lignes.length && !lignes[lignes.length - 1].secs) lignes.pop();
  const total = lignes.reduce((s, l) => s + l.secs, 0);
  if (!total) return [];
  return lignes.map((l) => ({ ...l, pct: Math.round((l.secs / total) * 100), duree: formaterDuree(l.secs) }));
}

// Classe de couleur d'une zone, la même partout (--zone-1 à --zone-6 ; Z7 reprend la couleur de Z6).
export function classeZone(numero) {
  return `zone-c${Math.min(6, Math.max(1, numero))}`;
}

// Aire sous une série (altitude, F-101) : chaque morceau continu est fermé vers le bas séparément. Avec une pause
// (trou dans la série), on obtient plusieurs aires au lieu d'une forme déformée qui relierait les morceaux.
export function cheminAire(xs, ys, indices, versX, versY, bas) {
  const morceaux = [];
  let courant = [];
  for (const i of indices) {
    const y = ys[i];
    if (y === null || y === undefined || Number.isNaN(y)) { if (courant.length) morceaux.push(courant); courant = []; continue; }
    courant.push([Math.round(versX(xs[i]) * 10) / 10, Math.round(versY(y) * 10) / 10]);
  }
  if (courant.length) morceaux.push(courant);
  return morceaux.filter((m) => m.length > 1)
    .map((m) => `M${m[0][0]},${bas}${m.map(([x, y]) => `L${x},${y}`).join('')}L${m[m.length - 1][0]},${bas}Z`).join('');
}

// --- Meilleurs efforts d'une activité (F-105, D-33) ---
// Durées (vélo, et course avec puissance) et distances (course, natation) cherchées, limitées à ce que la séance
// permet (une séance de 40 min n'a pas de meilleur effort sur 1 h).
export const DUREES_PUISSANCE = [1, 5, 15, 30, 60, 300, 600, 1200, 3600];
export const DISTANCES_COURSE = [400, 1000, 5000, 10000, 21097];
export const DISTANCES_NATATION = [100, 200, 400, 1000, 1500];

// Recherches à faire pour une activité : [{ cle, stream, duree } | { cle, stream, distance }].
// Puissance : flux "watts" (vélo, ou course avec capteur) ; allure : flux de vitesse (course, natation).
export function effortsAChercher(a) {
  const flux = a.flux ?? [];
  const liste = [];
  if (flux.includes('watts') && (a.sport === 'VELO' || a.sport === 'CAP')) {
    for (const d of DUREES_PUISSANCE) if (!a.duree_s || d <= a.duree_s) liste.push({ cle: `w${d}`, stream: 'watts', duree: d });
  }
  const distances = a.sport === 'CAP' ? DISTANCES_COURSE : a.sport === 'NATATION' ? DISTANCES_NATATION : [];
  if (flux.includes('velocity_smooth')) {
    for (const m of distances) if (!a.distance_m || m <= a.distance_m) liste.push({ cle: `d${m}`, stream: 'velocity_smooth', distance: m });
  }
  return liste;
}

// Libellé d'une durée d'effort (1 s, 30 s, 5 min, 1 h) ou d'une distance (400 m, 1 km, semi).
export function libelleEffort(r) {
  if (r.duree) return r.duree < 60 ? `${r.duree} s` : r.duree < 3600 ? `${r.duree / 60} min` : `${r.duree / 3600} h`;
  if (r.distance === 21097) return 'Semi';
  return r.distance >= 1000 ? `${String(r.distance / 1000).replace('.', ',')} km` : `${r.distance} m`;
}

// Pauses (F-101) : indices où le temps saute de plus de "seuil" secondes depuis le point précédent. Sur l'axe du temps,
// le trait est coupé à ces endroits au lieu de relier l'avant et l'après de la pause par une diagonale.
export function indicesApresPause(temps, seuil = 15) {
  const indices = [];
  for (let i = 1; i < temps.length; i += 1) if (temps[i] - temps[i - 1] > seuil) indices.push(i);
  return indices;
}

// Copie d'une série avec un trou au premier point après chaque pause (la valeur reste lisible au curseur).
export function couperAuxPauses(ys, indices) {
  if (!indices.length) return ys;
  const copie = ys.slice();
  for (const i of indices) copie[i] = null;
  return copie;
}
