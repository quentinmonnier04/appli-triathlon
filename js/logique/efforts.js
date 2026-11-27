// Analyse d'une séance calculée par l'appli à partir des flux (lot LC3 : F-129, F-130, D-48). Fonctions pures.
// Flux à 1 point par seconde (enregistrement des montres) ; un trou (null) compte comme 0 pour la puissance (arrêt) et
// est ignoré pour la FC et la vitesse. Les pauses (saut de plus de 15 s dans le temps) ne comptent pas dans les zones.

const PAUSE_S = 15;
export const VERSION_EFFORTS = 1;

// Meilleure moyenne d'une série sur chaque durée (en nombre de points, 1 point = 1 s) : puissance (W) ou FC (bpm).
// Renvoie [{ duree, valeur, debut_i, fin_i }] (durées plus longues que la séance ignorées). zeroSiVide : un trou vaut 0
// (puissance) ; sinon une fenêtre qui contient un trou n'est pas retenue (FC).
export function meilleuresMoyennes(serie, durees, { zeroSiVide = true } = {}) {
  const n = serie?.length ?? 0;
  if (!n) return [];
  const cumul = new Float64Array(n + 1);
  const trous = new Int32Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    const v = serie[i];
    const vide = v === null || v === undefined || !Number.isFinite(v);
    cumul[i + 1] = cumul[i] + (vide ? 0 : v);
    trous[i + 1] = trous[i] + (vide ? 1 : 0);
  }
  const resultat = [];
  for (const d of durees) {
    if (d > n) continue;
    let meilleur = -1;
    let debut = 0;
    for (let i = 0; i + d <= n; i += 1) {
      if (!zeroSiVide && trous[i + d] - trous[i] > 0) continue;
      const somme = cumul[i + d] - cumul[i];
      if (somme > meilleur) { meilleur = somme; debut = i; }
    }
    if (meilleur > 0) resultat.push({ duree: d, valeur: Math.round(meilleur / d), debut_i: debut, fin_i: debut + d - 1 });
  }
  return resultat;
}

// Meilleur temps pour couvrir chaque distance (m) : distance et temps cumulés alignés (flux distance et time).
// Renvoie [{ distance, temps_s, debut_i, fin_i }] ; distances plus longues que la séance ignorées.
export function meilleursTemps(distance, temps, distances) {
  const n = Math.min(distance?.length ?? 0, temps?.length ?? 0);
  const resultat = [];
  for (const cible of distances) {
    let meilleur = Infinity;
    let bornes = null;
    let i = 0;
    for (let j = 0; j < n; j += 1) {
      if (!Number.isFinite(distance[j]) || !Number.isFinite(temps[j])) continue;
      while (i < j && Number.isFinite(distance[i + 1]) && distance[j] - distance[i + 1] >= cible) i += 1;
      if (Number.isFinite(distance[i]) && distance[j] - distance[i] >= cible) {
        const t = temps[j] - temps[i];
        if (t > 0 && t < meilleur) { meilleur = t; bornes = [i, j]; }
      }
    }
    if (bornes) resultat.push({ distance: cible, temps_s: Math.round(meilleur), debut_i: bornes[0], fin_i: bornes[1] });
  }
  return resultat;
}

// Temps passé dans chaque zone. bornesHautes : borne haute de chaque zone dans l'unité de la série (W, bpm, m/s), la
// dernière pouvant être Infinity. Renvoie un tableau de secondes (une case par zone), comme icu_hr_zone_times.
export function tempsParZone(serie, temps, bornesHautes) {
  const secs = new Array(bornesHautes.length).fill(0);
  if (!serie?.length || !bornesHautes.length) return secs;
  for (let i = 0; i < serie.length; i += 1) {
    const v = serie[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    let dt = temps && i > 0 ? temps[i] - temps[i - 1] : 1;
    if (!(dt > 0) || dt > PAUSE_S) dt = 1;
    let z = bornesHautes.findIndex((b) => v <= b);
    if (z === -1) z = bornesHautes.length - 1;
    secs[z] += dt;
  }
  return secs.map((s) => Math.round(s));
}

// Bornes hautes des zones à partir des réglages : puissance en % de la FTP, allure en % de la vitesse seuil (m/s), FC en
// bpm. Une borne de 999 % ou plus est la dernière zone, sans limite.
export function bornesZones(famille, zones, seuil = null) {
  if (!Array.isArray(zones) || !zones.length) return [];
  if (famille === 'fc') return zones.map((b) => (b >= 999 ? Infinity : b));
  if (!(seuil > 0)) return [];
  return zones.map((pct) => (pct >= 999 ? Infinity : Math.round((pct / 100) * seuil * 1000) / 1000));
}

// Histogramme : temps par tranche de "largeur" (W ou bpm), au format des réponses d'Intervals.icu (start, secs),
// pour réutiliser barresHistogramme (logique/analyse.js).
export function histogrammeFlux(serie, temps, largeur) {
  const parTranche = new Map();
  for (let i = 0; i < (serie?.length ?? 0); i += 1) {
    const v = serie[i];
    if (v === null || v === undefined || !Number.isFinite(v) || v < 0) continue;
    let dt = temps && i > 0 ? temps[i] - temps[i - 1] : 1;
    if (!(dt > 0) || dt > PAUSE_S) dt = 1;
    const debut = Math.floor(v / largeur) * largeur;
    parTranche.set(debut, (parTranche.get(debut) ?? 0) + dt);
  }
  return [...parTranche.entries()].map(([start, secs]) => ({ start, secs: Math.round(secs) })).sort((a, b) => a.start - b.start);
}

// Durées et distances des courbes dessinées (échelle logarithmique).
export const DUREES_COURBE = [1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200];
export const DISTANCES_COURBE = [100, 200, 400, 800, 1000, 1500, 2000, 3000, 5000, 10000, 15000, 21097];

// Points de courbe : puissance [{ x: s, y: W }] ou allure [{ x: m, y: m/s }].
export function courbeDepuisFlux(flux, mesure) {
  if (mesure === 'allure') {
    return meilleursTemps(flux.distance, flux.time, DISTANCES_COURBE).map((t) => ({ x: t.distance, y: t.distance / t.temps_s }));
  }
  return meilleuresMoyennes(flux.watts, DUREES_COURBE).map((p) => ({ x: p.duree, y: p.valeur }));
}

// Résumé léger des meilleurs efforts d'une séance (F-130), gardé sur le téléphone : { puissance: { durée: W },
// fc: { durée: bpm }, temps: { distance: s } }.
export function resumeEfforts(flux, { durees, dureesFc, distances }) {
  const objet = (liste, cle, valeur) => Object.fromEntries(liste.map((x) => [x[cle], x[valeur]]));
  return {
    puissance: flux.watts ? objet(meilleuresMoyennes(flux.watts, durees), 'duree', 'valeur') : {},
    fc: flux.heartrate ? objet(meilleuresMoyennes(flux.heartrate, dureesFc, { zeroSiVide: false }), 'duree', 'valeur') : {},
    temps: flux.distance && flux.time ? objet(meilleursTemps(flux.distance, flux.time, distances), 'distance', 'temps_s') : {},
  };
}

// Records d'une période à partir des résumés de chaque séance : meilleure valeur par durée ou distance, et l'activité
// (pour les W/kg avec son poids). seances : [{ id, poids_kg, resume }].
export function agregerRecords(seances, { durees, dureesFc, distances }) {
  const meilleur = (cleFamille, cle, plusGrand) => {
    let r = null;
    for (const s of seances) {
      const v = s.resume?.[cleFamille]?.[cle];
      if (!Number.isFinite(v)) continue;
      if (!r || (plusGrand ? v > r.v : v < r.v)) r = { v, id: s.id, poids_kg: s.poids_kg ?? null };
    }
    return r;
  };
  return {
    puissance: durees.map((d) => ({ d, r: meilleur('puissance', d, true) })).filter((x) => x.r)
      .map(({ d, r }) => ({ duree: d, valeur: r.v, activite_id: r.id, poids_kg: r.poids_kg })),
    fc: dureesFc.map((d) => ({ d, r: meilleur('fc', d, true) })).filter((x) => x.r)
      .map(({ d, r }) => ({ duree: d, valeur: r.v, activite_id: r.id })),
    allure: distances.map((m) => ({ m, r: meilleur('temps', m, false) })).filter((x) => x.r)
      .map(({ m, r }) => ({ distance: m, temps_s: r.v, activite_id: r.id })),
  };
}

// --- Assemblage (F-129, F-130) ---

// Durées et distances gardées dans le résumé de chaque séance : celles des records et celles des courbes.
const union = (...listes) => [...new Set(listes.flat())].sort((a, b) => a - b);
export const DUREES_RESUME = union([1, 5, 15, 30, 60, 300, 600, 1200, 3600, 7200], DUREES_COURBE);
export const DUREES_FC_RESUME = [60, 300, 1200, 3600];
export const DISTANCES_RESUME = union([100, 200, 400, 1000, 1500, 5000, 10000, 21097], DISTANCES_COURBE);

// Analyse d'une séance par l'appli (F-129) à partir de ses flux et de ses seuils (ceux de la séance, sinon les
// réglages actuels du sport). Zones au format des temps par zone d'Intervals.icu (secondes par zone).
export function analyseSeance(a, flux, reglages = null) {
  const seuils = {
    ftp: a.seuils?.ftp ?? reglages?.ftp_w ?? null,
    vitesse: a.seuils?.vitesse_seuil ?? reglages?.allure_seuil_ms ?? null,
  };
  const bornes = {
    puissance: bornesZones('puissance', a.bornes_zones?.puissance ?? reglages?.zones_puissance, seuils.ftp),
    fc: bornesZones('fc', a.bornes_zones?.fc ?? reglages?.zones_fc),
    allure: bornesZones('allure', a.bornes_zones?.allure ?? reglages?.zones_allure, seuils.vitesse),
  };
  const zones = (serie, b) => (serie && b.length ? tempsParZone(serie, flux.time, b) : null);
  return {
    zones_puissance: zones(flux.watts, bornes.puissance),
    zones_fc: zones(flux.heartrate, bornes.fc),
    zones_allure: zones(flux.velocity_smooth, bornes.allure),
    histo_puissance: flux.watts ? histogrammeFlux(flux.watts, flux.time, 25) : [],
    histo_fc: flux.heartrate ? histogrammeFlux(flux.heartrate, flux.time, 5) : [],
    puissance: flux.watts ? meilleuresMoyennes(flux.watts, [1, 5, 15, 30, 60, 300, 600, 1200, 3600]) : [],
    courbe_puissance: flux.watts ? courbeDepuisFlux(flux, 'puissance') : [],
    courbe_allure: flux.distance && flux.time ? courbeDepuisFlux(flux, 'allure') : [],
  };
}

// Courbe d'une période (F-105, comparaison) à partir des résumés : meilleure valeur pour chaque durée ou distance.
export function courbePeriode(resumes, mesure) {
  const points = [];
  if (mesure === 'allure') {
    for (const m of DISTANCES_COURBE) {
      const temps = resumes.map((r) => r.resume?.temps?.[m]).filter((t) => t > 0);
      if (temps.length) points.push({ x: m, y: m / Math.min(...temps) });
    }
  } else {
    for (const d of DUREES_COURBE) {
      const w = resumes.map((r) => r.resume?.puissance?.[d]).filter((v) => v > 0);
      if (w.length) points.push({ x: d, y: Math.max(...w) });
    }
  }
  return points;
}
