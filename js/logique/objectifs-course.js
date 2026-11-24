// Objectifs de course par discipline et transitions (F-89, conception 2026-11-24 section 5.6). Fonctions pures.
// Objet interne : { format: 'XS' | 'S' | 'M' | '70.3' | 'IRONMAN' | 'PERSO' | null,
//                   segments: { NATATION?: { distance_m, temps_s }, T1?: { temps_s }, VELO?: ..., T2?: ..., CAP?: ... } }.

// Distances des formats de triathlon, en mètres.
export const FORMATS_COURSE = {
  XS: { NATATION: 400, VELO: 10000, CAP: 2500 },
  S: { NATATION: 750, VELO: 20000, CAP: 5000 },
  M: { NATATION: 1500, VELO: 40000, CAP: 10000 },
  '70.3': { NATATION: 1900, VELO: 90000, CAP: 21100 },
  IRONMAN: { NATATION: 3800, VELO: 180000, CAP: 42200 },
};

export const SEGMENTS_TRIATHLON = ['NATATION', 'T1', 'VELO', 'T2', 'CAP'];
const TRANSITIONS = ['T1', 'T2'];

// Segments d'une course selon son sport : les cinq en triathlon, sinon la seule discipline.
export const segmentsDeLaCourse = (sportCourse) => (sportCourse === 'ENCHAINEMENT' ? SEGMENTS_TRIATHLON : [sportCourse]);

// "h:mm:ss" ou "mm:ss" -> secondes ; null si la saisie est invalide.
export function lireTempsCourse(texte) {
  const t = String(texte ?? '').trim();
  const hms = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(t);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const ms = /^(\d+):([0-5]\d)$/.exec(t);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  return null;
}

// Temps du segment depuis l'allure saisie : natation en m:ss par 100 m, course en m:ss par km, vélo en km/h.
export function tempsDepuisAllure(sport, distance_m, texte) {
  if (!(distance_m > 0)) return null;
  if (sport === 'VELO') {
    const kmh = Number(String(texte ?? '').trim().replace(',', '.'));
    return Number.isFinite(kmh) && kmh > 0 ? Math.round((distance_m / 1000 / kmh) * 3600) : null;
  }
  const m = /^(\d+):([0-5]\d)$/.exec(String(texte ?? '').trim());
  if (!m) return null;
  const parUnite = Number(m[1]) * 60 + Number(m[2]);
  const unites = sport === 'NATATION' ? distance_m / 100 : distance_m / 1000;
  return parUnite > 0 ? Math.round(parUnite * unites) : null;
}

// Distance saisie : mètres en natation, kilomètres ailleurs (virgule acceptée) ; null si vide, NaN si invalide.
function lireDistance(sport, texte) {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(sport === 'NATATION' ? Number(t) : Number(t) * 1000);
}

// Formulaire (textes "SEGMENT.distance", "SEGMENT.temps", "SEGMENT.allure", "format") -> { objectifs, erreurs }.
// Le temps l'emporte sur l'allure ; un segment sans temps ni allure est absent ; distance vide = celle du format.
export function lireObjectifsSaisis(champs, sportCourse) {
  const triathlon = sportCourse === 'ENCHAINEMENT';
  const format = triathlon ? (champs.format || null) : null;
  const segments = {};
  const erreurs = {};
  for (const seg of segmentsDeLaCourse(sportCourse)) {
    const tempsTexte = String(champs[`${seg}.temps`] ?? '').trim();
    if (TRANSITIONS.includes(seg)) {
      if (!tempsTexte) continue;
      const temps_s = lireTempsCourse(tempsTexte);
      if (temps_s === null) erreurs[`${seg}.temps`] = 'Temps attendu en mm:ss ou h:mm:ss.';
      else segments[seg] = { temps_s };
      continue;
    }
    const allureTexte = String(champs[`${seg}.allure`] ?? '').trim();
    let distance_m = lireDistance(seg, champs[`${seg}.distance`]);
    if (Number.isNaN(distance_m)) { erreurs[`${seg}.distance`] = 'Distance invalide.'; continue; }
    if (distance_m === null && FORMATS_COURSE[format]) distance_m = FORMATS_COURSE[format][seg];
    if (!tempsTexte && !allureTexte) continue;
    const temps_s = tempsTexte ? lireTempsCourse(tempsTexte) : tempsDepuisAllure(seg, distance_m, allureTexte);
    if (temps_s === null) erreurs[tempsTexte ? `${seg}.temps` : `${seg}.allure`] = tempsTexte ? 'Temps attendu en mm:ss ou h:mm:ss.' : 'Allure invalide ou distance manquante.';
    else segments[seg] = { distance_m, temps_s };
  }
  const objectifs = Object.keys(segments).length ? { format, segments } : null;
  return { objectifs, erreurs };
}

// Temps total visé : somme des segments de la course si tous ont un temps, sinon null (revue 5).
export function tempsTotal(objectifs, sportCourse) {
  if (!objectifs?.segments) return null;
  const temps = segmentsDeLaCourse(sportCourse).map((s) => objectifs.segments[s]?.temps_s);
  return temps.every((t) => Number.isFinite(t)) ? temps.reduce((a, b) => a + b, 0) : null;
}

// --- Rangement dans la description de la course (EventEx.description), à côté du texte libre ---

export const ENTETE_OBJECTIFS = "Objectifs (gérés par l'appli) :";

export function objectifsVersTexte(objectifs) {
  return `${ENTETE_OBJECTIFS} ${JSON.stringify(objectifs)}`;
}

// Objectifs lus dans la description ; null s'il n'y en a pas ou si la ligne est illisible.
export function texteVersObjectifs(description) {
  const ligne = String(description ?? '').split('\n').find((l) => l.startsWith(ENTETE_OBJECTIFS));
  if (!ligne) return null;
  try {
    const o = JSON.parse(ligne.slice(ENTETE_OBJECTIFS.length));
    return o && typeof o.segments === 'object' && o.segments !== null ? o : null;
  } catch {
    return null;
  }
}

// Description mise à jour : la ligne gérée par l'appli est remplacée (ou retirée si objectifs null), le reste gardé.
export function fusionnerDescription(description, objectifs) {
  const libre = String(description ?? '').split('\n').filter((l) => !l.startsWith(ENTETE_OBJECTIFS)).join('\n').replace(/\s+$/, '');
  if (!objectifs) return libre;
  return libre ? `${libre}\n${objectifsVersTexte(objectifs)}` : objectifsVersTexte(objectifs);
}
