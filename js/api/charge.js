// Charge et forme calculées par l'appli (lot LC1 : F-120 à F-123, F-131, D-41, D-42).
// Intervals.icu fournit seulement les données brutes : liste des séances (champs vérifiés dans la spécification OpenAPI,
// schéma Activity : moving_time, distance, icu_rpe, seuils de la séance icu_ftp, lthr, threshold_pace, stream_types ; et,
// pour le contrôle F-123, sa propre charge icu_training_load) et les flux d'une séance (GET /activity/{id}/streams).
// L'appli calcule (logique/charge.js) et ne garde que des résultats légers : une ligne par séance (F-122).

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache, lireReglages, ecrireReglages } from '../cache/stockage.js';
import { lireProfilEnCache, convertirReglagesSport } from './profil.js';
import { convertirFlux } from './activites.js';
import { chargerSeancesPrevues } from './evenements.js';
import { sportDepuisType } from '../logique/sports.js';
import { VERSION_CALCUL, chargeSeance, fluxPourCharge, formeQuotidienne } from '../logique/charge.js';
import {
  VERSION_EFFORTS, resumeEfforts, DUREES_RESUME, DUREES_FC_RESUME, DISTANCES_RESUME,
} from '../logique/efforts.js';
import { estPerime } from '../logique/activites.js';
import { jourISO, ajouterJours } from '../logique/dates.js';

// Historique calculé : 150 jours, pour que la CTL (42 jours) soit juste aujourd'hui (F-121).
export const JOURS_HISTORIQUE = 150;

export const CHAMPS_CHARGE = [
  'id', 'start_date_local', 'type', 'moving_time', 'elapsed_time', 'distance', 'icu_rpe',
  'icu_ftp', 'lthr', 'threshold_pace', 'stream_types', 'icu_training_load',
];

const ou = (v) => (v === undefined ? null : v);
const positif = (v) => (Number.isFinite(v) && v > 0 ? v : null);

// Activity -> séance à calculer. Seuils de la séance (ceux de son époque), sinon les réglages actuels du sport.
export function convertirSeanceCharge(brut, reglages = []) {
  const sport = sportDepuisType(brut.type);
  const r = reglages.find((x) => x.sport === sport) ?? {};
  return {
    id: String(brut.id),
    date: (brut.start_date_local ?? '').slice(0, 10),
    sport,
    duree_s: ou(brut.moving_time ?? brut.elapsed_time),
    distance_m: ou(brut.distance),
    rpe: ou(brut.icu_rpe),
    flux: Array.isArray(brut.stream_types) ? brut.stream_types : [],
    seuils: {
      ftp: positif(brut.icu_ftp) ?? positif(r.ftp_w),
      fc_seuil: positif(brut.lthr) ?? positif(r.fc_seuil),
      vitesse_seuil: positif(brut.threshold_pace) ?? positif(r.allure_seuil_ms),
    },
    charge_intervals: ou(brut.icu_training_load),
  };
}

// Clé de validité d'un résultat : version des formules et seuils utilisés (un changement fait recalculer, F-122).
export function cleCalcul(s) {
  return `${VERSION_CALCUL}|${s.seuils.ftp ?? ''}|${s.seuils.fc_seuil ?? ''}|${s.seuils.vitesse_seuil ?? ''}|${s.rpe ?? ''}|${s.duree_s ?? ''}|${s.distance_m ?? ''}`;
}

// Réglages actuels par sport (profil en cache, sinon Intervals.icu), pour les séances sans seuils.
async function reglagesActuels() {
  const profil = await lireProfilEnCache().catch(() => null);
  if (profil?.reglages) return profil.reglages;
  return ((await requeteAuthentifiee('/athlete/0/sport-settings').catch(() => [])) ?? []).map(convertirReglagesSport);
}

// Flux d'une séance téléchargés pour le calcul, sans être gardés (seul le résultat l'est).
async function fluxDuCalcul(id, types) {
  if (!types.length) return {};
  const bruts = await requeteAuthentifiee(`/activity/${encodeURIComponent(id)}/streams.json`, { types: types.join(',') });
  return convertirFlux(bruts);
}

// Calcule (ou relit) la charge de chaque séance des JOURS_HISTORIQUE derniers jours. surProgres(fait, total) pendant le
// calcul ; trois séances à la fois au plus (ENF-11). Renvoie { charges: [{ id, date, sport, charge, methode,
// charge_intervals }], charge_le }.
export async function calculerCharges({ surProgres = null } = {}) {
  const jour = jourISO();
  const debut = ajouterJours(jour, -(JOURS_HISTORIQUE - 1));
  const [bruts, reglages] = await Promise.all([
    requeteAuthentifiee('/athlete/0/activities', { oldest: debut, newest: `${jour}T23:59:59`, fields: CHAMPS_CHARGE.join(',') }),
    reglagesActuels(),
  ]);
  const seances = (bruts ?? []).filter((b) => b?.start_date_local).map((b) => convertirSeanceCharge(b, reglages));
  const resultats = [];
  let fait = 0;
  for (let i = 0; i < seances.length; i += 3) {
    const lot = seances.slice(i, i + 3);
    const calcules = await Promise.all(lot.map(async (s) => {
      const cle = `charge:${s.id}`;
      const deja = await lireCache(cle);
      if (deja?.donnees?.cle === cleCalcul(s)) return deja.donnees;
      // Un seul téléchargement par séance (D-48) : si le résumé des meilleurs efforts (LC3) manque, les flux qu'il
      // demande sont pris en même temps et le résumé est gardé.
      const besoins = fluxPourCharge(s, s.flux);
      const resumeManquant = (await lireCache(`resume:${s.id}`))?.donnees?.version !== VERSION_EFFORTS;
      const types = resumeManquant ? [...new Set([...besoins, ...['time', 'watts', 'heartrate', 'distance'].filter((t) => s.flux.includes(t))])] : besoins;
      const flux = await fluxDuCalcul(s.id, types.length > 1 || besoins.length ? types : []).catch((e) => {
        if (e.type === 'IDENTIFIANTS' || e.type === 'RESEAU') throw e;
        return {}; // flux indisponible : la méthode suivante (FC, RPE) est essayée
      });
      const { charge, methode } = chargeSeance(s, flux);
      const ligne = { cle: cleCalcul(s), charge, methode };
      await ecrireCache(cle, ligne);
      if (resumeManquant && Object.keys(flux).length) {
        await ecrireCache(`resume:${s.id}`, { version: VERSION_EFFORTS, resume: resumeEfforts(flux, { durees: DUREES_RESUME, dureesFc: DUREES_FC_RESUME, distances: DISTANCES_RESUME }) });
      }
      return ligne;
    }));
    lot.forEach((s, k) => resultats.push({
      id: s.id, date: s.date, sport: s.sport, charge: calcules[k].charge, methode: calcules[k].methode, charge_intervals: s.charge_intervals,
    }));
    fait += lot.length;
    surProgres?.(fait, seances.length);
  }
  const donnees = { charges: resultats, debut };
  await ecrireCache('charges', donnees);
  return { ...donnees, charge_le: (await lireCache('charges')).charge_le };
}

// Charges en cache : { charges, debut, charge_le } ou null.
export async function lireChargesEnCache() {
  const cache = await lireCache('charges');
  return cache ? { ...cache.donnees, charge_le: cache.charge_le } : null;
}

// Charges à jour : celles du cache si elles ont moins de 5 min (ENF-11), sinon recalcul (seules les nouvelles séances
// ou celles dont les seuils ont changé demandent des flux). Hors ligne : le cache.
export async function chargesAJour({ forcer = false, surProgres = null } = {}) {
  const cache = await lireChargesEnCache();
  if (cache && !forcer && !estPerime(cache.charge_le)) return cache;
  try {
    return await calculerCharges({ surProgres });
  } catch (e) {
    if (cache && e.type !== 'IDENTIFIANTS') return cache;
    throw e;
  }
}

// Forme de l'appli jour par jour, du début de l'historique à aujourd'hui (F-121).
export function formeDesCharges(donnees, jour = jourISO()) {
  return formeQuotidienne(donnees.charges, donnees.debut, jour);
}

// --- Source des calculs affichés (F-123) : "intervals" (par défaut) tant que je n'ai pas validé ceux de l'appli. ---
export async function lireSourceCalculs() {
  const { calculs } = await lireReglages();
  return calculs === 'appli' ? 'appli' : 'intervals';
}
export async function enregistrerSourceCalculs(source) {
  await ecrireReglages({ calculs: source === 'appli' ? 'appli' : 'intervals' });
}

// --- F-131 : bilan de la semaine passée (lundi à dimanche) ---
// Séances prévues de la semaine passée (une requête, en cache 5 min) ; le reste vient des charges.
export async function prevuesSemainePassee(lundiPasse) {
  const cle = `prevues:${lundiPasse}`;
  const cache = await lireCache(cle);
  if (cache && !estPerime(cache.charge_le)) return cache.donnees;
  const prevues = await chargerSeancesPrevues(lundiPasse, ajouterJours(lundiPasse, 6));
  await ecrireCache(cle, prevues);
  return prevues;
}

// Bilan déjà lu (fermé) pour cette semaine : enregistré sur l'appareil.
export async function bilanSemaineLu(lundi) {
  const { bilanSemaineLu: lu } = await lireReglages();
  return lu === lundi;
}
export async function marquerBilanSemaineLu(lundi) {
  await ecrireReglages({ bilanSemaineLu: lundi });
}

// Données du bilan de la semaine passée (F-131) : charges de la source choisie sur les 5 dernières semaines, séances
// faites et prévues de la semaine passée. Source "appli" : charges calculées (au fil de l'eau) ; "intervals" : charge
// d'Intervals.icu lue dans la liste des séances (une requête, sans calcul).
export async function donneesBilanSemaine(lundiPasse, source) {
  const debut = ajouterJours(lundiPasse, -28);
  const fin = ajouterJours(lundiPasse, 6);
  let charges;
  let seances;
  if (source === 'appli') {
    const donnees = await chargesAJour();
    charges = donnees.charges;
    seances = null;
  } else {
    const bruts = await requeteAuthentifiee('/athlete/0/activities', { oldest: debut, newest: `${fin}T23:59:59`, fields: CHAMPS_CHARGE.join(',') });
    seances = (bruts ?? []).filter((b) => b?.start_date_local).map((b) => convertirSeanceCharge(b));
    charges = seances.map((s) => ({ date: s.date, charge: s.charge_intervals }));
  }
  const prevues = await prevuesSemainePassee(lundiPasse);
  return { charges, seances, prevues };
}
