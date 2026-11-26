// Performances par sport (lot LP, écran E-12 : F-110 à F-112, F-114, D-34).
// Endpoints vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET /api/v1/athlete/{id}/power-curves{ext}  (type, curves) -> DataCurveSetPowerCurve { list: DataCurve[], activities }
//   GET /api/v1/athlete/{id}/pace-curves{ext}   (type, curves) -> DataCurveSetPaceCurve  { list: DataCurve[], activities }
// DataCurve : secs, distance, values, activity_id, start_index, end_index, weight ; "activities" : activités des records.
// Les records sont lus aux durées et distances de l'appli (logique/performances.js), rien n'est recalculé.
// Cache de 5 min par sport et par période (ENF-11) ; hors ligne, le dernier chargement reste affiché (ENF-06).

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache } from '../cache/stockage.js';
import { estPerime } from '../logique/activites.js';
import { jourISO } from '../logique/dates.js';
import {
  SPORTS_PERF, DUREES_RECORDS, DISTANCES_RECORDS, codeCourbe, pointsAuxDurees, tempsAuxDistances, activiteDuRecord,
} from '../logique/performances.js';

// Réponse d'une courbe -> records datés : [{ duree | distance, valeur | temps_s, activite_id, date, titre }].
export function convertirRecords(reponse, mesure, sportCode) {
  const courbe = reponse?.list?.[0];
  if (!courbe) return { records: [], poids_kg: null };
  const points = mesure === 'puissance' ? pointsAuxDurees(courbe, DUREES_RECORDS) : tempsAuxDistances(courbe, DISTANCES_RECORDS[sportCode] ?? []);
  return {
    records: points.map((p) => ({ ...p, ...activiteDuRecord(reponse.activities, p.activite_id) })),
    poids_kg: Number.isFinite(courbe.weight) && courbe.weight > 0 ? courbe.weight : null,
  };
}

async function chargerCourbe(chemin, type, periode) {
  // Extension ".json" comme pour les flux (chemin {ext} de la spécification).
  return requeteAuthentifiee(`/athlete/0/${chemin}.json`, { type, curves: codeCourbe(periode, jourISO()) });
}

export async function lirePerformances(sportCode, periode, { forcer = false } = {}) {
  const cle = `perf:${sportCode}:${periode}`;
  const cache = await lireCache(cle);
  if (cache && !forcer && !estPerime(cache.charge_le)) return { ...cache.donnees, charge_le: cache.charge_le };
  const sport = SPORTS_PERF.find((s) => s.code === sportCode) ?? SPORTS_PERF[0];
  try {
    const [puissance, allure] = await Promise.all([
      sport.puissance ? chargerCourbe('power-curves', sport.type, periode) : null,
      sport.allure ? chargerCourbe('pace-curves', sport.type, periode) : null,
    ]);
    const p = convertirRecords(puissance, 'puissance', sport.code);
    const a = convertirRecords(allure, 'allure', sport.code);
    const donnees = { puissance: p.records, allure: a.records, poids_kg: p.poids_kg };
    await ecrireCache(cle, donnees);
    return { ...donnees, charge_le: (await lireCache(cle)).charge_le };
  } catch (e) {
    if (cache && e.type !== 'IDENTIFIANTS') return { ...cache.donnees, charge_le: cache.charge_le, horsLigne: true };
    throw e;
  }
}
