// Semaine type et réglages du plan, rangés dans la bibliothèque Intervals.icu (F-81, F-82, ENF-05).
// Un dossier simple (FOLDER) contient une séance de bibliothèque par séance de la semaine type ;
// le jour est dans les étiquettes (tags), les réglages sont écrits en clair dans la description du dossier.
// Endpoints vérifiés dans la spécification OpenAPI (https://intervals.icu/api/v1/docs) :
//   GET  /api/v1/athlete/{id}/folders                 -> Folder[]   (id, type, name, description)
//   POST /api/v1/athlete/{id}/folders                 (CreateFolderDTO : type, name, description) -> Folder
//   PUT  /api/v1/athlete/{id}/folders/{folderId}      (Folder) -> Folder
//   GET  /api/v1/athlete/{id}/workouts                -> Workout[]  (id, name, type, description, moving_time, distance, folder_id, tags)
//   GET, PUT, DELETE /api/v1/athlete/{id}/workouts/{workoutId} ; POST /api/v1/athlete/{id}/workouts (WorkoutEx)

import { requeteAuthentifiee } from './client.js';
import { lireCache, ecrireCache, supprimerCachePrefixe } from '../cache/stockage.js';
import { sportDepuisType, sport } from '../logique/sports.js';
import { blocsVersTexte, texteVersBlocs, sportVersType } from '../logique/seance.js';
import { REGLAGES_ANCIENS_PAR_DEFAUT as REGLAGES_PAR_DEFAUT } from '../logique/plan.js';
import { estPerime } from '../logique/activites.js';

export const NOM_DOSSIER = 'Semaine type (appli triathlon)';
const ETIQUETTE = 'semaine-type';

const ou = (v) => (v === undefined ? null : v);

// --- Réglages <-> texte de la description du dossier ---

const ENTETE = "Réglages du plan (gérés par l'appli) : ";

export function reglagesVersTexte(r) {
  return `${ENTETE}hausse ${r.hausse} ; semaines ${r.semainesHausse} ; coupure ${r.coupure} ; `
    + `affûtage ${r.affutage.length ? r.affutage.join('/') : 'aucun'} ; `
    + `plafond ${r.plafond_h ? `${r.plafond_h} h` : 'aucun'} ; début ${r.debut ?? 'aucun'}`
    + (r.debut && r.objectifDebut ? ` (objectif ${r.objectifDebut})` : '');
}

// Texte -> réglages ; un texte illisible (modifié à la main) redonne les réglages par défaut.
export function texteVersReglages(texte) {
  const m = String(texte ?? '').match(
    /hausse (\d+) ; semaines (\d+) ; coupure (\d+) ; affûtage ([\d/]+|aucun) ; plafond (?:([\d.]+) h|aucun) ; début (\d{4}-\d{2}-\d{2}|aucun)(?: \(objectif ([^)]+)\))?/,
  );
  if (!m) return { ...REGLAGES_PAR_DEFAUT, affutage: [...REGLAGES_PAR_DEFAUT.affutage] };
  return {
    hausse: Number(m[1]),
    semainesHausse: Number(m[2]),
    coupure: Number(m[3]),
    affutage: m[4] === 'aucun' ? [] : m[4].split('/').map(Number),
    plafond_h: m[5] ? Number(m[5]) : null,
    debut: m[6] === 'aucun' ? null : m[6],
    objectifDebut: m[6] !== 'aucun' && m[7] ? m[7] : null,
  };
}

// --- Séance type <-> séance de bibliothèque ---

// Séance type (jour 1 = lundi ... 7 = dimanche) -> corps WorkoutEx.
export function versSeanceBibliotheque(s, folderId) {
  const tags = [ETIQUETTE, `jour-${s.jour}`];
  if (s.heure) tags.push(`heure-${s.heure}`); // le modèle Workout n'a pas de champ d'heure
  if (s.sport === 'REPOS') {
    return { name: s.titre || 'Repos', type: 'Other', folder_id: folderId, tags: [...tags, 'repos'], description: s.description ?? '' };
  }
  const corps = { name: s.titre, type: sportVersType(s.sport), folder_id: folderId, tags };
  if (s.blocs?.length) return { ...corps, description: blocsVersTexte(s.blocs, s.sport) };
  corps.description = s.description ?? '';
  if (s.duree_s) corps.moving_time = s.duree_s;
  if (s.distance_m) corps.distance = s.distance_m;
  return corps;
}

// Workout (Intervals.icu) -> séance type ; le jour vient de l'étiquette "jour-N" (1 par défaut).
export function convertirSeanceType(brut) {
  const tags = brut.tags ?? [];
  const jour = Number(tags.find((t) => /^jour-[1-7]$/.test(t))?.slice(5) ?? 1);
  const heure = tags.find((t) => /^heure-([01]\d|2[0-3]):[0-5]\d$/.test(t))?.slice(6) ?? null;
  if (tags.includes('repos')) {
    return { id: String(brut.id), jour, heure, sport: 'REPOS', titre: brut.name || 'Repos', duree_s: null, distance_m: null, description: brut.description ?? '', blocs: null };
  }
  const code = sportDepuisType(brut.type);
  const blocs = texteVersBlocs(brut.description);
  return {
    id: String(brut.id),
    jour,
    heure,
    sport: code,
    titre: brut.name || sport(code).libelle,
    duree_s: ou(brut.moving_time),
    distance_m: ou(brut.distance),
    description: blocs ? null : (brut.description || null),
    blocs,
  };
}

// --- Lecture et écriture ---

// Semaine type : { dossierId, seances, reglages }. Cache de 5 min (ENF-11), vidé à chaque écriture ;
// une modification faite sur un autre appareil ou sur le site est donc vue (revue I-5). Hors ligne, le cache fait foi.
export async function lireSemaineType({ forcer = false } = {}) {
  const cache = await lireCache('semaine-type');
  if (cache && !forcer && !estPerime(cache.charge_le)) return cache.donnees;
  let dossiers;
  try {
    dossiers = (await requeteAuthentifiee('/athlete/0/folders')) ?? [];
  } catch (e) {
    if (cache && e.type === 'RESEAU') return cache.donnees;
    throw e;
  }
  const dossier = dossiers.find((d) => d.type === 'FOLDER' && d.name === NOM_DOSSIER);
  let donnees = { dossierId: null, seances: [], reglages: texteVersReglages(null) };
  if (dossier) {
    const seances = ((await requeteAuthentifiee('/athlete/0/workouts')) ?? [])
      .filter((w) => w.folder_id === dossier.id && (w.tags ?? []).includes(ETIQUETTE))
      .map(convertirSeanceType);
    donnees = { dossierId: dossier.id, seances, reglages: texteVersReglages(dossier.description) };
  }
  await ecrireCache('semaine-type', donnees);
  return donnees;
}

async function invaliderCaches() {
  await supprimerCachePrefixe('semaine-type');
  await supprimerCachePrefixe('bibliotheque');
}

// Identifiant du dossier, créé avec les réglages par défaut s'il n'existe pas encore. Relecture forcée avant
// toute création : un dossier créé depuis un autre appareil n'est pas créé une seconde fois (revue I-5).
async function dossierId() {
  const { dossierId: id } = await lireSemaineType({ forcer: true });
  if (id) return id;
  const dossier = await requeteAuthentifiee('/athlete/0/folders', null, {
    methode: 'POST', corps: { type: 'FOLDER', name: NOM_DOSSIER, description: reglagesVersTexte(REGLAGES_PAR_DEFAUT) },
  });
  await invaliderCaches();
  return dossier.id;
}

export async function lireSeanceType(id) {
  return convertirSeanceType(await requeteAuthentifiee(`/athlete/0/workouts/${encodeURIComponent(id)}`));
}

// Création ou modification d'une séance de la semaine type ; renvoie la séance enregistrée.
export async function enregistrerSeanceType(s) {
  const corps = versSeanceBibliotheque(s, await dossierId());
  const brut = s.id
    ? await requeteAuthentifiee(`/athlete/0/workouts/${encodeURIComponent(s.id)}`, null, { methode: 'PUT', corps })
    : await requeteAuthentifiee('/athlete/0/workouts', null, { methode: 'POST', corps });
  await invaliderCaches();
  return convertirSeanceType(brut);
}

export async function supprimerSeanceType(id) {
  await requeteAuthentifiee(`/athlete/0/workouts/${encodeURIComponent(id)}`, null, { methode: 'DELETE' });
  await invaliderCaches();
}

// Réglages du plan, écrits dans la description du dossier.
export async function enregistrerReglages(reglages) {
  const id = await dossierId();
  await requeteAuthentifiee(`/athlete/0/folders/${encodeURIComponent(id)}`, null, {
    methode: 'PUT', corps: { name: NOM_DOSSIER, description: reglagesVersTexte(reglages) },
  });
  await invaliderCaches();
}
