// Contrôles et conversions (ENF-20, ENF-29).
// Fonctions pures : aucun accès au DOM ni à IndexedDB.
// Les erreurs sont renvoyées sous forme de code (M-xx) ; le texte est fabriqué par ui/commun.js.

// Bornes des valeurs saisies (ENF-20, 9.4.4).
// min / max dans l'unité stockée ; minAff / maxAff pour le message M-02.
export const BORNES = {
  rpe: { min: 1, max: 10, entier: true, libelle: 'RPE', minAff: '1', maxAff: '10' },
  fc: { min: 30, max: 230, entier: true, libelle: 'FC moyenne', minAff: '30 bpm', maxAff: '230 bpm' },
  puissance: { min: 0, max: 2000, libelle: 'Puissance', minAff: '0 W', maxAff: '2000 W' },
  duree: { min: 60, max: 43200, libelle: 'Durée', minAff: '0:01', maxAff: '12:00' },
  distance: { min: 0, max: 300000, minExclusif: true, libelle: 'Distance', minAff: '0 km', maxAff: '300 km' },
  repetitions: { min: 1, max: 50, entier: true, libelle: 'Répétitions', minAff: '1', maxAff: '50' },
};

// Vérifie une valeur par rapport à sa borne (ENF-20).
// Renvoie null si la valeur est absente ou correcte, sinon une erreur M-02.
export function verifierBorne(cle, valeur) {
  if (valeur === null || valeur === undefined) return null;
  const b = BORNES[cle];
  const erreur = { code: 'M-02', champ: b.libelle, min: b.minAff, max: b.maxAff };
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return erreur;
  if (b.entier && !Number.isInteger(valeur)) return erreur;
  if (b.minExclusif ? valeur <= b.min : valeur < b.min) return erreur;
  if (valeur > b.max) return erreur;
  return null;
}
