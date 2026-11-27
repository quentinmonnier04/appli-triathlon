// Matériel et usure calculés par l'appli (lot LC2 : F-125 à F-128, D-43). Fonctions pures.
// Intervals.icu range le matériel (schéma Gear : type, name, purchased, retired, component_ids, reminders) et le matériel
// de chaque séance (Activity.gear.id) ; l'appli additionne elle-même les kilomètres et calcule l'usure.
// Distances en mètres partout (comme Activity.distance) ; la limite d'usure est celle du rappel (GearReminder.distance).

// Matériels principaux (portent les séances) et pièces proposées (types de la spécification).
export const TYPES_PRINCIPAUX = [
  { type: 'Bike', libelle: 'Vélo', sport: 'VELO' },
  { type: 'Shoes', libelle: 'Chaussures', sport: 'CAP' },
];
export const TYPES_PIECES = [
  { type: 'Chain', libelle: 'Chaîne', limite_km: 3000 },
  { type: 'Tyre', libelle: 'Pneu', limite_km: 4000 },
  { type: 'Cassette', libelle: 'Cassette', limite_km: 9000 },
  { type: 'Chainrings', libelle: 'Plateaux', limite_km: 20000 },
  { type: 'BrakePads', libelle: 'Plaquettes', limite_km: 3000 },
  { type: 'Tube', libelle: 'Chambre à air', limite_km: 5000 },
  { type: 'Cleats', libelle: 'Cales', limite_km: 5000 },
  { type: 'Cable', libelle: 'Câbles', limite_km: 10000 },
];
// Limite proposée pour des chaussures de course (une paire s'use aussi) : 700 km.
export const LIMITE_CHAUSSURES_KM = 700;

export function libelleType(type) {
  return [...TYPES_PRINCIPAUX, ...TYPES_PIECES].find((t) => t.type === type)?.libelle ?? type ?? 'Matériel';
}

// Distance (m) des séances d'un matériel, à partir d'une date (AAAA-MM-JJ, incluse) ; toutes si "depuis" est vide.
export function distanceDepuis(seances, gearId, depuis = null) {
  return seances
    .filter((s) => s.gear_id === gearId && (!depuis || s.date >= depuis))
    .reduce((t, s) => t + (s.distance_m ?? 0), 0);
}

// Usure d'un matériel ou d'une pièce. Une pièce compte les séances du matériel qui la porte (parentId), depuis sa pose
// (date d'achat) ou son dernier remplacement (last_reset du rappel). Un matériel principal (vélo, chaussures) compte
// toutes ses séances depuis son dernier remplacement : elles sont à lui, même avant la date saisie (D-44).
// Renvoie { km, limite_km, pct, depuis } ; limite et pourcentage null sans rappel de distance.
export function usure(materiel, seances, parentId = null) {
  const rappel = (materiel.rappels ?? []).find((r) => r.distance_m > 0) ?? null;
  const dates = [parentId ? materiel.achat : null, rappel?.dernier_remplacement].filter(Boolean).sort();
  const depuis = dates.at(-1) ?? null;
  const metres = distanceDepuis(seances, parentId ?? materiel.id, depuis);
  const km = Math.round(metres / 1000);
  const limite_km = rappel ? Math.round(rappel.distance_m / 1000) : null;
  return { km, limite_km, pct: limite_km ? Math.round((metres / rappel.distance_m) * 100) : null, depuis, rappel };
}

// Arbre du matériel en service : matériels principaux avec leurs pièces, et leur usure. Matériel retiré ignoré.
export function arbreMateriel(materiels, seances) {
  const actifs = materiels.filter((m) => !m.retire);
  const parId = new Map(actifs.map((m) => [m.id, m]));
  const pieceDe = new Map();
  for (const m of actifs) for (const id of m.pieces_ids ?? []) pieceDe.set(id, m.id);
  return actifs
    .filter((m) => !m.est_piece && !pieceDe.has(m.id))
    .map((m) => ({
      ...m,
      total_km: Math.round(distanceDepuis(seances, m.id) / 1000),
      usure: usure(m, seances),
      pieces: (m.pieces_ids ?? []).map((id) => parId.get(id)).filter(Boolean).map((p) => ({ ...p, usure: usure(p, seances, m.id) })),
    }));
}

// Alertes (F-128) : matériels et pièces arrivés à leur limite d'usure (100 % ou plus).
export function alertesUsure(arbre) {
  const alertes = [];
  for (const m of arbre) {
    if (m.usure.pct >= 100) alertes.push({ id: m.id, nom: m.nom, type: m.type, pct: m.usure.pct, parent: null });
    for (const p of m.pieces) if (p.usure.pct >= 100) alertes.push({ id: p.id, nom: p.nom, type: p.type, pct: p.usure.pct, parent: m.nom });
  }
  return alertes;
}

// Matériels proposés pour une séance (F-127) : vélos pour le vélo, chaussures pour la course.
export function materielsPourSport(arbre, sportCode) {
  const types = TYPES_PRINCIPAUX.filter((t) => t.sport === sportCode).map((t) => t.type);
  return arbre.filter((m) => types.includes(m.type));
}

// Limite saisie (km) -> mètres, ou erreur.
export function lireLimiteKm(texte) {
  const t = String(texte ?? '').trim().replace(/\s/g, '');
  if (!t) return { metres: null };
  if (!/^\d+$/.test(t) || Number(t) < 10 || Number(t) > 100000) return { erreur: 'Limite : un nombre de km entre 10 et 100 000.' };
  return { metres: Number(t) * 1000 };
}
