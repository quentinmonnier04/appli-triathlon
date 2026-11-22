// Logique de connexion à Intervals.icu (F-01, 5.4). Fonctions pures.

// Contrôle des identifiants saisis dans Réglages (F-01).
// Renvoie un objet { champ: message } ; vide si tout est correct.
export function validerIdentifiants({ athleteId, cle }) {
  const erreurs = {};
  const id = String(athleteId ?? '').trim();
  if (!id) erreurs.athleteId = 'Champ obligatoire.';
  else if (/\s/.test(id)) erreurs.athleteId = "L'identifiant ne doit pas contenir d'espace.";
  if (!String(cle ?? '').trim()) erreurs.cle = 'Champ obligatoire.';
  return erreurs;
}

// En-tête HTTP d'authentification (5.4) : Basic, utilisateur "API_KEY", mot de passe = clé API.
// Vérifié dans la spécification OpenAPI d'Intervals.icu (securitySchemes.APIKey).
export function enteteAuthorization(cle) {
  const octets = new TextEncoder().encode(`API_KEY:${cle}`);
  return 'Basic ' + btoa(String.fromCharCode(...octets));
}
