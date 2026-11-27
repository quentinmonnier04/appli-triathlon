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

// Erreur passagère (D-49) : pas de réponse, trop de requêtes (429) ou panne du serveur (5xx). Une telle erreur peut être
// réessayée un peu plus tard ; les autres (identifiants refusés, requête refusée) non.
export function erreurPassagere(e) {
  if (!e) return false;
  if (e.type === 'RESEAU') return true;
  return e.type === 'SERVEUR' && (e.statut === 429 || e.statut >= 500);
}
