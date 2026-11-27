// Charge de chaque séance et forme calculées par l'appli (lot LC1 : F-120, F-121, F-131, D-41, D-42). Fonctions pures.
// Formules classiques, publiques (Intervals.icu ne publie pas les siennes : de petits écarts sont normaux) :
//   puissance : charge = heures x IF^2 x 100, IF = puissance normalisée / FTP ;
//   allure (course) : IF = vitesse moyenne / vitesse seuil, même formule ;
//   natation : IF = vitesse moyenne / vitesse CSS, charge = heures x IF^3 x 100 ;
//   FC : somme sur la séance de (FC / FC seuil)^2, ramenée à l'heure, x 100 ;
//   RPE : IF estimé = 0,5 + 0,05 x RPE (RPE 10 -> 1,0), même formule que la puissance.
// Forme : CTL et ATL = moyennes exponentielles de la charge quotidienne sur 42 et 7 jours ; TSB = CTL - ATL.

import { ajouterJours, joursEntre } from './dates.js';
import { volumeSemaine, totauxSemaine } from './totaux.js';

// Version des formules : un changement de formule fait recalculer toutes les séances.
export const VERSION_CALCUL = 1;

// Pause : un saut de plus de 15 s dans le temps n'est pas compté (comme les graphiques, F-101).
const PAUSE_S = 15;

// Puissance normalisée : moyenne glissante sur 30 s, élevée à la puissance 4, moyennée, puis racine 4e.
// watts et temps (s) alignés ; les trous (null) et les pauses coupent la moyenne glissante. null si moins de 30 s.
export function puissanceNormalisee(watts, temps = null) {
  const n = watts?.length ?? 0;
  if (n < 30) return null;
  let somme4 = 0;
  let nb = 0;
  let fenetre = [];
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const pause = temps && i > 0 && temps[i] - temps[i - 1] > PAUSE_S;
    const w = watts[i];
    if (pause || w === null || w === undefined || !Number.isFinite(w)) {
      if (pause) { fenetre = []; total = 0; }
      continue;
    }
    fenetre.push(w);
    total += w;
    if (fenetre.length > 30) total -= fenetre.shift();
    if (fenetre.length === 30) { somme4 += (total / 30) ** 4; nb += 1; }
  }
  return nb ? Math.round((somme4 / nb) ** 0.25) : null;
}

const parIntensite = (duree_s, intensite, exposant = 2) => Math.round((duree_s / 3600) * intensite ** exposant * 100);

export function chargePuissance(duree_s, np, ftp) {
  if (!(duree_s > 0) || !(np > 0) || !(ftp > 0)) return null;
  return parIntensite(duree_s, np / ftp);
}

// Allure : vitesse moyenne (distance / temps en mouvement) rapportée à la vitesse seuil ; exposant 3 en natation.
export function chargeAllure(duree_s, distance_m, vitesseSeuil, exposant = 2) {
  if (!(duree_s > 0) || !(distance_m > 0) || !(vitesseSeuil > 0)) return null;
  return parIntensite(duree_s, distance_m / duree_s / vitesseSeuil, exposant);
}

// FC : chaque seconde compte (FC / FC seuil)^2 ; les pauses et les trous ne comptent pas.
export function chargeFc(fc, temps, fcSeuil) {
  if (!(fcSeuil > 0) || !fc?.length) return null;
  let somme = 0;
  let compte = 0;
  for (let i = 0; i < fc.length; i += 1) {
    const v = fc[i];
    if (v === null || v === undefined || !Number.isFinite(v) || v <= 0) continue;
    let dt = temps && i > 0 ? temps[i] - temps[i - 1] : 1;
    if (!(dt > 0) || dt > PAUSE_S) dt = 1;
    somme += (v / fcSeuil) ** 2 * dt;
    compte += 1;
  }
  return compte ? Math.round((somme / 3600) * 100) : null;
}

export function chargeRpe(duree_s, rpe) {
  if (!(duree_s > 0) || !Number.isInteger(rpe) || rpe < 1 || rpe > 10) return null;
  return parIntensite(duree_s, 0.5 + 0.05 * rpe);
}

// Ordre des méthodes par sport : la première possible est retenue.
const ORDRE = {
  VELO: ['puissance', 'fc', 'rpe'],
  CAP: ['allure', 'puissance', 'fc', 'rpe'],
  NATATION: ['allure', 'fc', 'rpe'],
};

export const LIBELLES_METHODE = { puissance: 'Puissance', allure: 'Allure', fc: 'Fréquence cardiaque', rpe: 'RPE' };

// Charge d'une séance. s : { sport, duree_s, distance_m, rpe, seuils: { ftp, fc_seuil, vitesse_seuil } } ;
// flux : { time, watts, heartrate } (facultatif). Renvoie { charge, methode } ; charge null si rien ne permet de la calculer.
export function chargeSeance(s, flux = {}) {
  const seuils = s.seuils ?? {};
  for (const methode of ORDRE[s.sport] ?? ['fc', 'rpe']) {
    let charge = null;
    if (methode === 'puissance') charge = chargePuissance(s.duree_s, puissanceNormalisee(flux.watts, flux.time), seuils.ftp);
    else if (methode === 'allure') charge = chargeAllure(s.duree_s, s.distance_m, seuils.vitesse_seuil, s.sport === 'NATATION' ? 3 : 2);
    else if (methode === 'fc') charge = chargeFc(flux.heartrate, flux.time, seuils.fc_seuil);
    else if (methode === 'rpe') charge = chargeRpe(s.duree_s, s.rpe);
    if (charge !== null) return { charge, methode };
  }
  return { charge: null, methode: null };
}

// Flux nécessaires au calcul d'une séance (téléchargés une fois, sans être gardés) : seulement si la méthode en a besoin.
export function fluxPourCharge(s, streamTypes) {
  const t = streamTypes ?? [];
  const ordre = ORDRE[s.sport] ?? ['fc', 'rpe'];
  const besoins = [];
  if (ordre.includes('puissance') && t.includes('watts') && s.seuils?.ftp > 0) besoins.push('watts');
  if (ordre.includes('fc') && t.includes('heartrate') && s.seuils?.fc_seuil > 0) besoins.push('heartrate');
  return besoins.length && t.includes('time') ? ['time', ...besoins] : besoins;
}

// Forme quotidienne entre deux jours inclus. charges : [{ date, charge }] (plusieurs séances par jour additionnées).
// Départ à 0 au premier jour : prévoir assez d'historique (environ 150 jours) pour que la CTL soit juste.
export function formeQuotidienne(charges, debut, fin) {
  const parJour = {};
  for (const c of charges) if (c.charge > 0) parJour[c.date] = (parJour[c.date] ?? 0) + c.charge;
  const kCtl = 1 - Math.exp(-1 / 42);
  const kAtl = 1 - Math.exp(-1 / 7);
  const resultat = [];
  let ctl = 0;
  let atl = 0;
  const n = joursEntre(debut, fin);
  for (let i = 0; i <= n; i += 1) {
    const date = ajouterJours(debut, i);
    const charge = parJour[date] ?? 0;
    ctl += (charge - ctl) * kCtl;
    atl += (charge - atl) * kAtl;
    const c = Math.round(ctl);
    const a = Math.round(atl);
    resultat.push({ date, ctl: c, atl: a, tsb: c - a });
  }
  return resultat;
}

// --- F-131 : bilan de la semaine ---

// Charge totale d'une semaine (lundi à dimanche) et moyenne des 4 semaines précédentes.
export function chargesSemaines(charges, lundi) {
  const somme = (d) => charges.filter((c) => c.date >= d && c.date <= ajouterJours(d, 6)).reduce((t, c) => t + (c.charge ?? 0), 0);
  const semaine = somme(lundi);
  const precedentes = [1, 2, 3, 4].map((k) => somme(ajouterJours(lundi, -7 * k)));
  return { semaine, moyenne4: Math.round(precedentes.reduce((t, v) => t + v, 0) / 4) };
}

// Phrase simple selon la charge de la semaine par rapport aux 4 précédentes, et la fraîcheur (TSB) en fin de semaine.
export function phraseBilan(semaine, moyenne4, tsb) {
  if (!semaine) return 'Semaine sans séance : reprends en douceur.';
  if (!moyenne4) return 'Première semaine suivie : continue comme ça.';
  const ratio = semaine / moyenne4;
  if (ratio > 1.3 || (tsb !== null && tsb < -30)) return 'Semaine très chargée : garde du repos dans les prochains jours.';
  if (ratio > 1.1) return 'Semaine chargée : la progression est là, surveille la fatigue.';
  if (ratio >= 0.8) return 'Semaine régulière : charge proche de tes habitudes.';
  return 'Semaine légère : bonne récupération, ou du retard à rattraper.';
}

// Bilan de la semaine passée (F-131) : volume par sport (réalisé et prévu), totaux, charge comparée aux 4 semaines
// précédentes et phrase. charges : [{ date, charge }] de la source choisie (appli ou Intervals.icu).
export function bilanDeLaSemaine({ charges, activites, prevues, lundi, tsb = null }) {
  const lignes = volumeSemaine(prevues, activites, lundi);
  const { semaine, moyenne4 } = chargesSemaines(charges, lundi);
  return {
    lundi,
    dimanche: ajouterJours(lundi, 6),
    lignes,
    ...totauxSemaine(lignes),
    charge: semaine,
    moyenne4,
    phrase: phraseBilan(semaine, moyenne4, tsb),
  };
}

// Contrôle (F-123) : écart moyen entre la charge de l'appli et celle d'Intervals.icu, sur les séances où les deux existent.
// Renvoie { nb, ecart_moyen (points), ecart_pct (%) } ou null.
export function ecartsCharges(charges) {
  const paires = charges.filter((c) => c.charge > 0 && c.charge_intervals > 0);
  if (!paires.length) return null;
  const somme = paires.reduce((t, c) => t + Math.abs(c.charge - c.charge_intervals), 0);
  const total = paires.reduce((t, c) => t + c.charge_intervals, 0);
  return { nb: paires.length, ecart_moyen: Math.round(somme / paires.length), ecart_pct: Math.round((somme / total) * 100) };
}
