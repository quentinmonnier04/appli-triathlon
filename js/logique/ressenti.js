// Ressenti d'une activité et bilan du jour (F-60 à F-63). Fonctions pures.
// Échelles d'Intervals.icu (vérifiées sur le forum officiel) :
//   - RPE (icu_rpe) : 1 à 10 ;
//   - ressenti (feel) : 1 = fort ... 5 = faible (1 est le meilleur) ;
//   - bien-être (fatigue, soreness, sleepQuality) : 1 à 4, 1 étant le meilleur état.
//     Certaines sources ajoutent une valeur 0 : l'appli ne propose que 1 à 4, commun à toutes les sources.

// RPE de 1 (très facile) à 10 (maximal), glossaire.
export const ECHELLE_RPE = [
  { valeur: 1, libelle: 'Très facile' },
  { valeur: 2, libelle: 'Facile' },
  { valeur: 3, libelle: 'Modéré' },
  { valeur: 4, libelle: 'Un peu difficile' },
  { valeur: 5, libelle: 'Difficile' },
  { valeur: 6, libelle: 'Difficile' },
  { valeur: 7, libelle: 'Très difficile' },
  { valeur: 8, libelle: 'Très difficile' },
  { valeur: 9, libelle: 'Extrêmement difficile' },
  { valeur: 10, libelle: 'Maximal' },
];

// Ressenti (feel d'Intervals.icu : Strong, Good, Normal, Poor, Weak).
export const RESSENTIS = [
  { valeur: 1, libelle: 'Très bien', icone: '😄' },
  { valeur: 2, libelle: 'Bien', icone: '🙂' },
  { valeur: 3, libelle: 'Normal', icone: '😐' },
  { valeur: 4, libelle: 'Moyen', icone: '😕' },
  { valeur: 5, libelle: 'Mauvais', icone: '😣' },
];

// Échelles du bilan du jour (F-62).
export const ECHELLES_BILAN = {
  fatigue: [
    { valeur: 1, libelle: 'Faible' }, { valeur: 2, libelle: 'Moyenne' },
    { valeur: 3, libelle: 'Élevée' }, { valeur: 4, libelle: 'Extrême' },
  ],
  sommeil: [
    { valeur: 1, libelle: 'Excellent' }, { valeur: 2, libelle: 'Bon' },
    { valeur: 3, libelle: 'Moyen' }, { valeur: 4, libelle: 'Mauvais' },
  ],
  douleur: [
    { valeur: 1, libelle: 'Légères' }, { valeur: 2, libelle: 'Moyennes' },
    { valeur: 3, libelle: 'Fortes' }, { valeur: 4, libelle: 'Extrêmes' },
  ],
};

// Libellé d'une valeur dans une échelle, ou null.
export function libelleEchelle(echelle, valeur) {
  return echelle.find((e) => e.valeur === valeur)?.libelle ?? null;
}

const dansEchelle = (echelle, v) => v === null || v === undefined || echelle.some((e) => e.valeur === v);

// Nombre saisi au clavier ("72,5" ou "72.5") : nombre, null si vide, NaN si invalide.
export function lireNombreSaisi(texte) {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// Contrôle du ressenti d'une activité (F-60, F-61). Renvoie { champ: message } ; vide si tout est correct.
export function validerRessenti(s) {
  const erreurs = {};
  if (!dansEchelle(ECHELLE_RPE, s.rpe)) erreurs.rpe = 'RPE : entre 1 et 10.';
  if (!dansEchelle(RESSENTIS, s.ressenti)) erreurs.ressenti = 'Ressenti invalide.';
  if (String(s.commentaire ?? '').length > 2000) erreurs.commentaire = 'Commentaire trop long (2000 caractères au plus).';
  return erreurs;
}

// Contrôle du bilan du jour (F-62). Poids facultatif, entre 20 et 300 kg.
export function validerBilan(b) {
  const erreurs = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '')) erreurs.date = 'Date invalide.';
  for (const champ of ['fatigue', 'sommeil', 'douleur']) {
    if (!dansEchelle(ECHELLES_BILAN[champ], b[champ])) erreurs[champ] = 'Valeur invalide.';
  }
  const p = b.poids_kg;
  if (p !== null && p !== undefined && (Number.isNaN(p) || p < 20 || p > 300)) erreurs.poids_kg = 'Poids attendu entre 20 et 300 kg, par exemple 72,5.';
  if (String(b.commentaire ?? '').length > 2000) erreurs.commentaire = 'Commentaire trop long (2000 caractères au plus).';
  return erreurs;
}

// Activités du jour sans RPE (F-63), dans l'ordre reçu.
export function activitesSansRpe(activites, jour) {
  return activites.filter((a) => a.date === jour && (a.rpe === null || a.rpe === undefined));
}
