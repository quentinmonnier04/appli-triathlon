// Envoi, régénération et suppression du plan dans le calendrier Intervals.icu (F-85, F-86, F-87).
// Endpoints vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET  /api/v1/athlete/{id}/events          (oldest, newest, category, fields)          -> Event[]
//   PUT  /api/v1/athlete/{id}/events/bulk-delete   (corps DoomedEvent[] : { id })            -> { eventsDeleted }
//   POST /api/v1/athlete/{id}/events/bulk     (upsertOnUid obligatoire ; corps EventEx[])  -> Event[]
// Les séances d'un plan portent une étiquette external_id ("plan-{objectif}-...") : seules elles sont
// supprimées ou remplacées, jamais les séances programmées à la main. L'option "upsert" (réservée aux
// applications OAuth) n'est pas utilisée.

import { requeteAuthentifiee } from './client.js';
import { supprimerCachePrefixe } from '../cache/stockage.js';
import { versEvenement } from './evenements.js';
import { prefixePlan } from '../logique/plan.js';
import { ajouterJours } from '../logique/dates.js';

// Nombre de séances envoyées par requête (ENF-11).
export const TAILLE_LOT = 50;

// Identifiants des séances du plan datées à partir de "apartirDe" ; evenements = [{ id, date, external_id }].
export function seancesASupprimer(evenements, prefixe, apartirDe) {
  return evenements
    .filter((e) => typeof e.external_id === 'string' && e.external_id.startsWith(prefixe) && e.date >= apartirDe)
    .map((e) => e.id);
}

// Séance générée -> corps EventEx, avec son étiquette.
export function versEvenementPlan(seance) {
  return { ...versEvenement(seance), external_id: seance.external_id };
}

// Supprime les séances du plan à partir de "apartirDe" (sur deux ans) ; renvoie le nombre supprimé.
async function supprimerSeancesDuPlan(objectifId, apartirDe) {
  const bruts = (await requeteAuthentifiee('/athlete/0/events', {
    oldest: apartirDe, newest: ajouterJours(apartirDe, 730), category: 'WORKOUT,NOTE', fields: 'id,start_date_local,external_id',
  })) ?? [];
  const evenements = bruts.map((b) => ({ id: b.id, date: (b.start_date_local ?? '').slice(0, 10), external_id: b.external_id ?? null }));
  const ids = seancesASupprimer(evenements, prefixePlan(objectifId), apartirDe);
  if (ids.length) {
    await requeteAuthentifiee('/athlete/0/events/bulk-delete', null, { methode: 'PUT', corps: ids.map((id) => ({ id })) });
  }
  return ids.length;
}

async function invaliderCaches() {
  await supprimerCachePrefixe('tableau');
  await supprimerCachePrefixe('agenda:');
}

// Envoie le plan (F-85) ou le régénère (F-86) : les séances du plan à partir de "apartirDe" sont d'abord
// supprimées, puis les séances générées à partir de cette date sont créées par lots.
// surProgression(fait, total) est appelé après chaque lot. Renvoie le nombre de séances créées.
export async function envoyerPlan(plan, objectifId, apartirDe, surProgression = () => {}) {
  const seances = plan.flatMap((semaine) => semaine.seances).filter((s) => s.date >= apartirDe);
  await supprimerSeancesDuPlan(objectifId, apartirDe);
  let fait = 0;
  surProgression(0, seances.length);
  try {
    for (let i = 0; i < seances.length; i += TAILLE_LOT) {
      const lot = seances.slice(i, i + TAILLE_LOT).map(versEvenementPlan);
      await requeteAuthentifiee('/athlete/0/events/bulk', { upsertOnUid: 'false' }, { methode: 'POST', corps: lot });
      fait += lot.length;
      surProgression(fait, seances.length);
    }
  } finally {
    await invaliderCaches(); // un envoi interrompu se reprend en renvoyant le plan (les séances déjà créées sont remplacées)
  }
  return fait;
}

// Supprime les séances à venir du plan (F-87) ; les semaines passées restent. Renvoie le nombre supprimé.
export async function supprimerPlan(objectifId, apartirDe) {
  const n = await supprimerSeancesDuPlan(objectifId, apartirDe);
  await invaliderCaches();
  return n;
}
