// Client HTTPS Intervals.icu (5.4, ENF-25). Seule couche avec api/ qui appelle le réseau.
// La clé API n'est jamais écrite dans la console ni dans les messages d'erreur (ENF-13).

import { enteteAuthorization } from '../logique/connexion.js';

const BASE = 'https://intervals.icu/api/v1';

// Erreur d'appel : type IDENTIFIANTS (401/403), SERVEUR (autre code HTTP) ou RESEAU (pas de réponse).
export class ErreurApi extends Error {
  constructor(type, statut = null) {
    super(`Erreur Intervals.icu : ${type}${statut ? ' (HTTP ' + statut + ')' : ''}`);
    this.type = type;
    this.statut = statut;
  }
}

// Classe un code HTTP d'échec (5.4).
export function typeErreurHttp(statut) {
  return statut === 401 || statut === 403 ? 'IDENTIFIANTS' : 'SERVEUR';
}

// Requête GET authentifiée ; renvoie le JSON ou lève une ErreurApi.
export async function requeteGet(chemin, cle) {
  let reponse;
  try {
    reponse = await fetch(BASE + chemin, {
      headers: { Authorization: enteteAuthorization(cle), Accept: 'application/json' },
    });
  } catch {
    throw new ErreurApi('RESEAU');
  }
  if (!reponse.ok) throw new ErreurApi(typeErreurHttp(reponse.status), reponse.status);
  return reponse.json();
}
