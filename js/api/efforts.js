// Meilleurs efforts et records calculés par l'appli (lot LC3 : F-129, F-130, D-48).
// Intervals.icu fournit seulement les données brutes : la liste des séances des 12 derniers mois (schéma Activity) et
// leurs flux (GET /activity/{id}/streams.json : time, watts, heartrate, distance). Pour chaque séance, l'appli garde un
// résumé léger (meilleures valeurs par durée et par distance) ; le détail n'est pas gardé. Les flux téléchargés servent
// aussi à calculer la charge de la séance (LC1) si elle ne l'est pas encore : un seul téléchargement par séance.

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache } from '../cache/stockage.js';
import { convertirFlux } from './activites.js';
import { CHAMPS_CHARGE, convertirSeanceCharge, cleCalcul } from './charge.js';
import { lireProfilEnCache } from './profil.js';
import { chargeSeance } from '../logique/charge.js';
import {
  VERSION_EFFORTS, resumeEfforts, DUREES_RESUME, DUREES_FC_RESUME, DISTANCES_RESUME,
} from '../logique/efforts.js';
import { estPerime } from '../logique/activites.js';
import { jourISO, ajouterJours } from '../logique/dates.js';

// Historique des records calculés par l'appli : 12 mois (choix du 27/11/2026, D-48).
export const JOURS_RECORDS = 365;
const FLUX_RESUME = ['time', 'watts', 'heartrate', 'distance'];

// Résumés de chaque séance des 12 derniers mois : relus en cache, calculés pour les nouvelles séances (trois à la fois,
// ENF-11). surProgres(fait, total). Renvoie { resumes: [{ id, date, sport, poids_kg, resume }], charge_le }.
export async function calculerResumes({ surProgres = null } = {}) {
  const jour = jourISO();
  const debut = ajouterJours(jour, -(JOURS_RECORDS - 1));
  const [bruts, profil] = await Promise.all([
    requeteAuthentifiee('/athlete/0/activities', { oldest: debut, newest: `${jour}T23:59:59`, fields: [...CHAMPS_CHARGE, 'icu_weight'].join(',') }),
    lireProfilEnCache().catch(() => null),
  ]);
  const seances = (bruts ?? []).filter((b) => b?.start_date_local).map((b) => ({ ...convertirSeanceCharge(b, profil?.reglages ?? []), poids_kg: b.icu_weight ?? null }));
  const resumes = [];
  let fait = 0;
  for (let i = 0; i < seances.length; i += 3) {
    const lot = seances.slice(i, i + 3);
    const calcules = await Promise.all(lot.map(async (s) => {
      const cle = `resume:${s.id}`;
      const deja = await lireCache(cle);
      if (deja?.donnees?.version === VERSION_EFFORTS) return deja.donnees.resume;
      const types = FLUX_RESUME.filter((t) => s.flux.includes(t));
      let flux = {};
      if (types.length > 1) {
        try {
          flux = convertirFlux(await requeteAuthentifiee(`/activity/${encodeURIComponent(s.id)}/streams.json`, { types: types.join(',') }));
        } catch (e) {
          if (e.type === 'IDENTIFIANTS' || e.type === 'RESEAU') throw e;
        }
      }
      const resume = resumeEfforts(flux, { durees: DUREES_RESUME, dureesFc: DUREES_FC_RESUME, distances: DISTANCES_RESUME });
      await ecrireCache(cle, { version: VERSION_EFFORTS, resume });
      // Même téléchargement pour la charge (LC1), si elle n'est pas déjà calculée avec ces seuils.
      const cleCharge = `charge:${s.id}`;
      if ((await lireCache(cleCharge))?.donnees?.cle !== cleCalcul(s)) {
        const { charge, methode } = chargeSeance(s, flux);
        await ecrireCache(cleCharge, { cle: cleCalcul(s), charge, methode });
      }
      return resume;
    }));
    lot.forEach((s, k) => resumes.push({ id: s.id, date: s.date, sport: s.sport, poids_kg: s.poids_kg, resume: calcules[k] }));
    fait += lot.length;
    surProgres?.(fait, seances.length);
  }
  await ecrireCache('resumes', { resumes });
  return { resumes, charge_le: (await lireCache('resumes')).charge_le };
}

// Résumés à jour (5 min, ENF-11) ; hors ligne, le cache.
export async function resumesAJour({ forcer = false, surProgres = null } = {}) {
  const cache = await lireCache('resumes');
  if (cache && !forcer && !estPerime(cache.charge_le)) return { ...cache.donnees, charge_le: cache.charge_le };
  try {
    return await calculerResumes({ surProgres });
  } catch (e) {
    if (cache && e.type !== 'IDENTIFIANTS') return { ...cache.donnees, charge_le: cache.charge_le, horsLigne: true };
    throw e;
  }
}

// Résumés en cache seulement (comparaison des 42 jours sur le détail d'une séance), sans calcul.
export async function lireResumesEnCache() {
  const cache = await lireCache('resumes');
  return cache?.donnees?.resumes ?? [];
}
