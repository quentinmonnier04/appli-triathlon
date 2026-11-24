// Préparation (F-81, F-82, F-88, ENF-05) rangée dans la bibliothèque Intervals.icu, sans passer par le site :
// un dossier simple (FOLDER) "Mes séances" contient les séances de bibliothèque ; les blocs (emplacements des
// séances) et les réglages sont écrits dans la description du dossier (conception 2026-11-24, approche A).
// Ancien format (semaine type unique, avant D-22) : jour et heure dans les étiquettes, réglages en clair ; il est lu
// pour la migration (logique/blocs.js, migrerAncienFormat).
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
import { REGLAGES_ANCIENS_PAR_DEFAUT, REGLAGES_PAR_DEFAUT } from '../logique/plan.js';
import { estPerime } from '../logique/activites.js';
import { retirerSeanceDesBlocs } from '../logique/blocs.js';

export const NOM_DOSSIER = 'Mes séances (appli triathlon)';
export const ANCIEN_NOM = 'Semaine type (appli triathlon)';
export const ENTETE_PREPARATION = "Préparation gérée par l'appli triathlon (ne pas modifier) :";
const ETIQUETTE = 'semaine-type';

const ou = (v) => (v === undefined ? null : v);

// --- Ancien format : réglages <-> texte de la description du dossier ---

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
  if (!m) return { ...REGLAGES_ANCIENS_PAR_DEFAUT, affutage: [...REGLAGES_ANCIENS_PAR_DEFAUT.affutage] };
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

// --- Nouveau format : préparation <-> description du dossier (F-88) ---

// { reglages, blocs } -> en-tête + JSON compact (emplacements en triplets [séance, jour, heure]).
export function preparationVersTexte({ reglages, blocs }) {
  const { hausse, coupure, affutage, plafond_h } = reglages;
  return `${ENTETE_PREPARATION}\n${JSON.stringify({
    v: 2,
    reglages: { hausse, coupure, affutage, plafond_h },
    blocs: blocs.map(({ nom, semaines, coupure: c, emplacements }) => ({
      nom, semaines, coupure: c, p: emplacements.map((e) => [e.seanceId, e.jour, e.heure ?? null]),
    })),
  })}`;
}

// Description -> { reglages, blocs } (nouveau format), { ancien: réglages } (ancien format ou description vide)
// ou { illisible: true } (en-tête présent mais données illisibles : rien ne doit être écrit, revue 3).
export function texteVersPreparation(texte) {
  const t = String(texte ?? '');
  const i = t.indexOf(ENTETE_PREPARATION);
  if (i === -1) return { ancien: texteVersReglages(t) };
  try {
    const d = JSON.parse(t.slice(i + ENTETE_PREPARATION.length));
    if (d.v !== 2 || !Array.isArray(d.blocs)) return { illisible: true };
    const blocs = d.blocs.map((b) => {
      const bloc = {
        nom: String(b.nom ?? ''),
        semaines: b.semaines,
        emplacements: (b.p ?? []).map(([seanceId, jour, heure]) => ({ seanceId: String(seanceId), jour, heure: heure ?? null })),
      };
      if (typeof b.coupure === 'boolean') bloc.coupure = b.coupure;
      return bloc;
    });
    const r = d.reglages ?? {};
    const reglages = { ...REGLAGES_PAR_DEFAUT, affutage: [...REGLAGES_PAR_DEFAUT.affutage] };
    for (const cle of Object.keys(reglages)) if (r[cle] !== undefined) reglages[cle] = r[cle];
    return { reglages, blocs };
  } catch {
    return { illisible: true };
  }
}

// Erreur d'écriture : la description du dossier est illisible (revue 3).
export class ErreurPreparation extends Error {
  constructor() {
    super('La préparation enregistrée sur Intervals.icu est illisible.');
    this.type = 'ILLISIBLE';
  }
}

// Corps du dossier après modification de la préparation relue (revue 4) ; transformer reçoit
// { reglages, blocs, seances, ancienFormat } et renvoie { reglages, blocs }.
export function corpsDossier(relue, transformer) {
  if (relue.illisible) throw new ErreurPreparation();
  const { reglages, blocs } = transformer({ reglages: relue.reglages, blocs: relue.blocs, seances: relue.seances, ancienFormat: relue.ancienFormat });
  return { name: NOM_DOSSIER, description: preparationVersTexte({ reglages, blocs }) };
}

// --- Séance de la bibliothèque <-> Workout ---

// Séance de la bibliothèque -> corps WorkoutEx ; le jour et l'heure sont ceux des emplacements dans les blocs,
// plus dans les étiquettes (F-88).
export function versSeanceBibliotheque(s, folderId) {
  const tags = [ETIQUETTE];
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

// Workout (Intervals.icu) -> séance de la bibliothèque ; jour et heure lus dans les étiquettes de l'ancien format
// ("jour-N", 1 par défaut ; "heure-hh:mm"), utiles seulement à la migration.
export function convertirSeanceBibliotheque(brut) {
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

// Préparation : { dossierId, seances, reglages, blocs, ancienFormat, illisible }. blocs null si ancien format
// (ancienFormat = { reglages }) ou illisible. Cache de 5 min (ENF-11) vidé à chaque écriture ; hors ligne, le cache fait foi.
export async function lirePreparation({ forcer = false } = {}) {
  const cache = await lireCache('preparation');
  if (cache && !forcer && !estPerime(cache.charge_le)) return cache.donnees;
  let dossiers;
  try {
    dossiers = (await requeteAuthentifiee('/athlete/0/folders')) ?? [];
  } catch (e) {
    if (cache && e.type === 'RESEAU') return cache.donnees;
    throw e;
  }
  const dossier = dossiers.find((d) => d.type === 'FOLDER' && d.name === NOM_DOSSIER)
    ?? dossiers.find((d) => d.type === 'FOLDER' && d.name === ANCIEN_NOM);
  let donnees = { dossierId: null, seances: [], reglages: { ...REGLAGES_PAR_DEFAUT }, blocs: [], ancienFormat: null, illisible: false };
  if (dossier) {
    const seances = ((await requeteAuthentifiee('/athlete/0/workouts')) ?? [])
      .filter((w) => w.folder_id === dossier.id && (w.tags ?? []).includes(ETIQUETTE))
      .map(convertirSeanceBibliotheque);
    const lu = texteVersPreparation(dossier.description);
    donnees = {
      dossierId: dossier.id,
      seances,
      reglages: lu.reglages ?? lu.ancien ?? { ...REGLAGES_PAR_DEFAUT },
      blocs: lu.blocs ?? null,
      ancienFormat: lu.ancien ? { reglages: lu.ancien } : null,
      illisible: Boolean(lu.illisible),
    };
  }
  await ecrireCache('preparation', donnees);
  return donnees;
}

async function invaliderCaches() {
  await supprimerCachePrefixe('preparation');
  await supprimerCachePrefixe('bibliotheque');
}

// Modifie la préparation (blocs, réglages, migration) : relecture forcée, transformation, écriture du dossier
// (créé s'il n'existe pas). Une préparation illisible n'est jamais réécrite (revue 3, revue 4). Renvoie le dossier.
export async function modifierPreparation(transformer) {
  const relue = await lirePreparation({ forcer: true });
  const corps = corpsDossier(relue, transformer);
  const dossier = relue.dossierId
    ? await requeteAuthentifiee(`/athlete/0/folders/${encodeURIComponent(relue.dossierId)}`, null, { methode: 'PUT', corps })
    : await requeteAuthentifiee('/athlete/0/folders', null, { methode: 'POST', corps: { type: 'FOLDER', ...corps } });
  await invaliderCaches();
  return dossier;
}

// Identifiant du dossier, créé vide s'il n'existe pas encore (relecture forcée, revue I-5).
async function dossierId() {
  const { dossierId: id } = await lirePreparation({ forcer: true });
  if (id) return id;
  const dossier = await modifierPreparation((p) => ({ reglages: p.reglages, blocs: p.blocs ?? [] }));
  return dossier.id;
}

export async function lireSeanceBibliotheque(id) {
  return convertirSeanceBibliotheque(await requeteAuthentifiee(`/athlete/0/workouts/${encodeURIComponent(id)}`));
}

// Création ou modification d'une séance de la bibliothèque ; renvoie la séance enregistrée.
export async function enregistrerSeanceBibliotheque(s) {
  const corps = versSeanceBibliotheque(s, await dossierId());
  const brut = s.id
    ? await requeteAuthentifiee(`/athlete/0/workouts/${encodeURIComponent(s.id)}`, null, { methode: 'PUT', corps })
    : await requeteAuthentifiee('/athlete/0/workouts', null, { methode: 'POST', corps });
  await invaliderCaches();
  return convertirSeanceBibliotheque(brut);
}

// Suppression (conception 5.1) : la séance est d'abord retirée de tous les blocs, puis supprimée de la bibliothèque.
export async function supprimerSeanceBibliotheque(id) {
  const relue = await lirePreparation({ forcer: true });
  if (relue.illisible) throw new ErreurPreparation();
  if (relue.blocs) await modifierPreparation((p) => ({ reglages: p.reglages, blocs: retirerSeanceDesBlocs(p.blocs, id) }));
  await requeteAuthentifiee(`/athlete/0/workouts/${encodeURIComponent(id)}`, null, { methode: 'DELETE' });
  await invaliderCaches();
}
