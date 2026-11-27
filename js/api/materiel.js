// Matériel (lot LC2 : F-125 à F-128, D-43). Rangé dans Intervals.icu, usure calculée par l'appli (logique/materiel.js).
// Endpoints et champs vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET  /api/v1/athlete/{id}/gear{ext}                      -> Gear[] (id, type, name, purchased, retired, component,
//                                                               component_ids, reminders : GearReminder[])
//   POST /api/v1/athlete/{id}/gear (Gear) ; PUT /api/v1/athlete/{id}/gear/{gearId} (Gear)
//   POST /api/v1/athlete/{id}/gear/{gearId}/reminder (GearReminder : name, distance, last_reset)
//   PUT  /api/v1/athlete/{id}/gear/{gearId}/reminder/{reminderId} (reset, snoozeDays obligatoires)
//   Activity.gear (StravaGear : id, name, distance, primary) ; PUT /api/v1/activity/{id} (Activity)
// À confirmer en réel (non documenté) : distances des rappels en mètres comme Activity.distance ; écriture de
// Activity.gear par PUT /activity/{id}.

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache, supprimerCachePrefixe } from '../cache/stockage.js';
import { estPerime } from '../logique/activites.js';
import { jourISO, ajouterJours } from '../logique/dates.js';
import { arbreMateriel } from '../logique/materiel.js';

const date = (v) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

// Gear -> matériel interne.
export function convertirMateriel(brut) {
  return {
    id: String(brut.id),
    type: brut.type ?? null,
    nom: brut.name || '',
    achat: date(brut.purchased),
    retire: date(brut.retired),
    est_piece: Boolean(brut.component),
    pieces_ids: (brut.component_ids ?? []).map(String),
    rappels: (brut.reminders ?? []).map((r) => ({
      id: r.id,
      distance_m: Number.isFinite(r.distance) && r.distance > 0 ? r.distance : null,
      dernier_remplacement: date(r.last_reset),
    })),
  };
}

// Activity (liste) -> séance pour l'usure : date, distance, matériel.
export function convertirSeanceMateriel(brut) {
  return {
    id: String(brut.id),
    date: (brut.start_date_local ?? '').slice(0, 10),
    gear_id: brut.gear?.id ? String(brut.gear.id) : null,
    distance_m: Number.isFinite(brut.distance) ? brut.distance : 0,
  };
}

// Matériel et usure : une requête pour le matériel, une pour les séances depuis le plus ancien achat (5 ans au plus).
// Cache de 5 min (ENF-11) ; hors ligne, le dernier chargement. Renvoie { arbre, charge_le }.
// validiteMs : âge maximal du cache (5 min par défaut ; l'accueil accepte plus vieux pour rester léger).
export async function lireMateriel({ forcer = false, validiteMs = null } = {}) {
  const cache = await lireCache('materiel');
  const frais = cache && (validiteMs ? Date.now() - Date.parse(cache.charge_le) < validiteMs : !estPerime(cache.charge_le));
  if (cache && !forcer && frais) return { ...cache.donnees, charge_le: cache.charge_le };
  try {
    const materiels = ((await requeteAuthentifiee('/athlete/0/gear.json')) ?? []).map(convertirMateriel);
    const jour = jourISO();
    const plusAncien = materiels.map((m) => m.achat).filter(Boolean).sort()[0] ?? ajouterJours(jour, -365);
    const debut = plusAncien < ajouterJours(jour, -5 * 365) ? ajouterJours(jour, -5 * 365) : plusAncien;
    const seances = materiels.length
      ? ((await requeteAuthentifiee('/athlete/0/activities', { oldest: debut, newest: `${jour}T23:59:59`, fields: 'id,start_date_local,distance,gear' })) ?? [])
        .map(convertirSeanceMateriel)
      : [];
    const donnees = { arbre: arbreMateriel(materiels, seances) };
    await ecrireCache('materiel', donnees);
    return { ...donnees, charge_le: (await lireCache('materiel')).charge_le };
  } catch (e) {
    if (cache && e.type !== 'IDENTIFIANTS') return { ...cache.donnees, charge_le: cache.charge_le, horsLigne: true };
    throw e;
  }
}

// Matériel en cache seulement (alerte de l'accueil, F-128), sans requête.
export async function lireMaterielEnCache() {
  const cache = await lireCache('materiel');
  return cache ? cache.donnees : null;
}

async function apresEcriture() {
  await supprimerCachePrefixe('materiel');
}

// Crée un matériel principal, ou une pièce rattachée à "parent" (ajoutée à ses component_ids). Avec "limite_m", un
// rappel d'usure est créé (nom "Usure").
export async function creerMateriel({ type, nom, achat, parent = null, limite_m = null }) {
  const cree = await requeteAuthentifiee('/athlete/0/gear', null, {
    methode: 'POST', corps: { type, name: nom, purchased: achat || jourISO(), component: Boolean(parent) },
  });
  if (parent) {
    const brutParent = (await requeteAuthentifiee('/athlete/0/gear.json')).find((g) => String(g.id) === String(parent));
    if (brutParent) {
      await requeteAuthentifiee(`/athlete/0/gear/${encodeURIComponent(parent)}`, null, {
        methode: 'PUT', corps: { ...brutParent, component_ids: [...(brutParent.component_ids ?? []), cree.id] },
      });
    }
  }
  if (limite_m) await definirLimite(cree.id, null, limite_m);
  await apresEcriture();
  return convertirMateriel(cree);
}

// Limite d'usure : crée le rappel, ou modifie celui qui existe (sans remise à zéro).
export async function definirLimite(gearId, rappelId, limite_m) {
  const base = `/athlete/0/gear/${encodeURIComponent(gearId)}/reminder`;
  if (rappelId === null || rappelId === undefined) {
    await requeteAuthentifiee(base, null, { methode: 'POST', corps: { name: 'Usure', distance: limite_m } });
  } else {
    await requeteAuthentifiee(`${base}/${encodeURIComponent(rappelId)}`, { reset: 'false', snoozeDays: '0' }, {
      methode: 'PUT', corps: { id: rappelId, gear_id: gearId, name: 'Usure', distance: limite_m },
    });
  }
  await apresEcriture();
}

// F-126 : « Remplacé » : le rappel est remis à zéro (last_reset = maintenant), le compteur de l'appli repart de ce jour.
export async function remettreAZero(gearId, rappel) {
  await requeteAuthentifiee(`/athlete/0/gear/${encodeURIComponent(gearId)}/reminder/${encodeURIComponent(rappel.id)}`,
    { reset: 'true', snoozeDays: '0' }, {
      methode: 'PUT', corps: { id: rappel.id, gear_id: gearId, name: 'Usure', distance: rappel.distance_m },
    });
  await apresEcriture();
}

// Renomme ou retire un matériel (retired = date du jour). Le Gear complet est relu pour ne rien effacer.
export async function modifierMateriel(gearId, { nom = null, retirer = false }) {
  const brut = ((await requeteAuthentifiee('/athlete/0/gear.json')) ?? []).find((g) => String(g.id) === String(gearId));
  if (!brut) throw new Error('Matériel introuvable');
  const corps = { ...brut, ...(nom !== null ? { name: nom } : {}), ...(retirer ? { retired: jourISO() } : {}) };
  await requeteAuthentifiee(`/athlete/0/gear/${encodeURIComponent(gearId)}`, null, { methode: 'PUT', corps });
  await apresEcriture();
}

// F-127 : matériel d'une séance (null pour aucun). Le fil, le détail et le matériel seront rechargés.
export async function choisirMaterielSeance(activiteId, gearId) {
  await requeteAuthentifiee(`/activity/${encodeURIComponent(activiteId)}`, null, {
    methode: 'PUT', corps: { gear: gearId ? { id: gearId } : null },
  });
  await apresEcriture();
  await supprimerCachePrefixe(`activite:${activiteId}`);
}
