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

// Garde-fou (revue I-3) : Intervals.icu doit renvoyer l'étiquette des séances créées ; sinon une régénération
// ne pourrait pas les retrouver et chaque envoi ajouterait un plan complet en double.
export function etiquettesConservees(envoyes, recus) {
  if (!Array.isArray(recus) || recus.length !== envoyes.length) return false;
  return envoyes.every((e, i) => recus[i]?.external_id === e.external_id);
}

// Erreur levée quand le garde-fou se déclenche ; une seule séance a alors été créée.
export class ErreurEtiquette extends Error {
  constructor() {
    super("Intervals.icu n'a pas conservé l'étiquette des séances du plan.");
    this.type = 'ETIQUETTE';
  }
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

// Envoie le plan (F-85) ou le régénère (F-86) : les séances du plan datées à partir de "bornes.regeneration"
// sont d'abord supprimées, puis les séances générées à partir de "bornes.creation" sont créées par lots.
// La première séance part seule pour vérifier que son étiquette est conservée (revue I-3).
// surProgression(fait, total) est appelé après chaque lot. Renvoie le nombre de séances créées.
export async function envoyerPlan(plan, objectifId, bornes, surProgression = () => {}) {
  const seances = plan.flatMap((semaine) => semaine.seances).filter((s) => s.date >= bornes.creation);
  await supprimerSeancesDuPlan(objectifId, bornes.regeneration);
  let fait = 0;
  surProgression(0, seances.length);
  try {
    let i = 0;
    while (i < seances.length) {
      const taille = i === 0 ? 1 : TAILLE_LOT;
      const lot = seances.slice(i, i + taille).map(versEvenementPlan);
      const recus = await requeteAuthentifiee('/athlete/0/events/bulk', { upsertOnUid: 'false' }, { methode: 'POST', corps: lot });
      if (i === 0 && !etiquettesConservees(lot, recus)) throw new ErreurEtiquette();
      fait += lot.length;
      i += taille;
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
