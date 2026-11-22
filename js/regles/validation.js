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

// --- Validation des objets (C-14, ENF-20) ---

// Ajoute l'erreur de borne de la valeur au dictionnaire des erreurs, si besoin.
function ajouterBorne(erreurs, champ, cle, valeur) {
  const e = verifierBorne(cle, valeur);
  if (e) erreurs[champ] = e;
}

// Vrai si la valeur est absente (null, undefined ou texte vide).
function estVide(v) {
  return v === null || v === undefined || v === '';
}

// Séance prévue (F-10, F-11) : titre obligatoire (M-01), 60 caractères max, bornes de durée, distance, répétitions.
export function validerSeancePrevue(s) {
  const erreurs = {};
  const titre = String(s.titre ?? '').trim();
  if (!titre) erreurs.titre = { code: 'M-01' };
  else if (titre.length > 60) erreurs.titre = { code: 'M-02', champ: 'Titre', min: '1', max: '60 caractères' };
  ajouterBorne(erreurs, 'duree_s', 'duree', s.duree_s);
  ajouterBorne(erreurs, 'distance_m', 'distance', s.distance_m);
  const blocs = s.segments?.[0]?.blocs ?? [];
  blocs.forEach((b, i) => {
    ajouterBorne(erreurs, `blocs.${i}.repetitions`, 'repetitions', b.repetitions);
    ajouterBorne(erreurs, `blocs.${i}.distance_m`, 'distance', b.distance_m);
  });
  return { ok: Object.keys(erreurs).length === 0, erreurs };
}

// Réalisation (F-21 à F-24) : champs obligatoires selon le statut (M-10) et bornes (M-02).
export function validerRealisation(r) {
  const erreurs = {};
  if (estVide(r.sport)) erreurs.sport = { code: 'M-10' };
  if (estVide(r.statut)) erreurs.statut = { code: 'M-10' };
  if (r.statut === 'SAUTEE') {
    if (estVide(r.motif)) erreurs.motif = { code: 'M-10' };
  } else if (r.statut === 'FAITE' || r.statut === 'PARTIELLE') {
    if (estVide(r.duree_s)) erreurs.duree_s = { code: 'M-10' };
    if (estVide(r.rpe)) erreurs.rpe = { code: 'M-10' };
  }
  if (!erreurs.duree_s) ajouterBorne(erreurs, 'duree_s', 'duree', r.duree_s);
  if (!erreurs.rpe) ajouterBorne(erreurs, 'rpe', 'rpe', r.rpe);
  ajouterBorne(erreurs, 'distance_m', 'distance', r.distance_m);
  ajouterBorne(erreurs, 'fc_moy', 'fc', r.fc_moy);
  ajouterBorne(erreurs, 'puissance_moy_w', 'puissance', r.puissance_moy_w);
  if (r.douleur) {
    const i = r.douleur.intensite;
    if (estVide(r.douleur.zone)) erreurs.douleur = { code: 'M-10' };
    else if (!Number.isInteger(i) || i < 1 || i > 5) erreurs.douleur = { code: 'M-02', champ: 'Intensité', min: '1', max: '5' };
  }
  return { ok: Object.keys(erreurs).length === 0, erreurs };
}

// Copie nettoyée d'une réalisation (règle 4.5.2) :
// SAUTEE -> aucune mesure ; non SAUTEE -> pas de motif ; puissance seulement pour le vélo ; champs vides retirés.
export function normaliserRealisation(r) {
  const n = {};
  for (const [cle, valeur] of Object.entries(r)) if (!estVide(valeur)) n[cle] = valeur;
  if (n.statut === 'SAUTEE') {
    for (const cle of ['duree_s', 'distance_m', 'fc_moy', 'puissance_moy_w', 'rpe', 'douleur']) delete n[cle];
  } else {
    delete n.motif;
  }
  if (n.sport !== 'VELO') delete n.puissance_moy_w;
  return n;
}

// --- Format de sauvegarde (9.6, F-36) ---

export const SCHEMA_VERSION = 1;
export const STORES = ['meta', 'athletes', 'parametres', 'seances_prevues', 'realisations'];

// Vrai seulement pour une sauvegarde de l'application lisible par cette version du code.
export function verifierSauvegarde(objet, versionCode = SCHEMA_VERSION) {
  if (!objet || typeof objet !== 'object' || Array.isArray(objet)) return false;
  if (objet.app !== 'triathlon-app') return false;
  if (!Number.isInteger(objet.schema_version) || objet.schema_version > versionCode) return false;
  const d = objet.donnees;
  if (!d || typeof d !== 'object') return false;
  return STORES.every((store) => Array.isArray(d[store]));
}
