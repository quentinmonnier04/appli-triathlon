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

// --- Durées (D-09, F-11, F-22) ---

// Lit une durée saisie en h:mm et renvoie des secondes, ou null si illisible.
// Formats acceptés : "1:30", "1h30", "1h", "1.30", "1,30", minutes seules "90".
export function lireDuree(texte) {
  const t = String(texte ?? '').replace(/\s+/g, '');
  if (/^\d+$/.test(t)) return Number(t) * 60;
  let m = t.match(/^(\d{1,2})h$/);
  if (m) return Number(m[1]) * 3600;
  m = t.match(/^(\d{1,2})[:h.,](\d{2})$/);
  if (m && Number(m[2]) < 60) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  return null;
}

// Secondes -> "h:mm" (secondes arrondies à la minute inférieure).
export function formaterDuree(s) {
  const minutes = Math.floor(s / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

// Lit une durée courte "m:ss" ou des minutes seules (blocs, récupération).
export function lireDureeCourte(texte) {
  const t = String(texte ?? '').replace(/\s+/g, '');
  if (/^\d+$/.test(t)) return Number(t) * 60;
  const m = t.match(/^(\d{1,3}):(\d{2})$/);
  if (m && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

// Secondes -> "m:ss".
export function formaterDureeCourte(s) {
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// --- Distances (F-11, F-22) ---

// Lit une distance saisie : km (virgule ou point) ou mètres pour la natation. Renvoie des mètres.
export function lireDistance(texte, sport) {
  const t = String(texte ?? '').replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return sport === 'NATATION' ? Math.round(n) : Math.round(n * 1000);
}

// Mètres -> texte à placer dans le champ de saisie ("10,5" ou "1500" pour la natation).
export function formaterDistanceSaisie(m, sport) {
  if (sport === 'NATATION') return String(m);
  return String(m / 1000).replace('.', ',');
}

// --- Allure (4.4, F-22) : calculée, jamais stockée ---

// CAP : "m:ss /km" ; natation : "m:ss /100 m" ; vélo : "xx,x km/h" ; sinon null.
export function calculerAllure(sport, duree_s, distance_m) {
  if (!(duree_s > 0) || !(distance_m > 0)) return null;
  if (sport === 'CAP') return `${formaterDureeCourte(duree_s / (distance_m / 1000))} /km`;
  if (sport === 'NATATION') return `${formaterDureeCourte(duree_s / (distance_m / 100))} /100 m`;
  if (sport === 'VELO') return `${((distance_m / 1000) / (duree_s / 3600)).toFixed(1).replace('.', ',')} km/h`;
  return null;
}
