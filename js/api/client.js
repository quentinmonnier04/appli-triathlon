// Client HTTPS Intervals.icu (5.4, ENF-25). Seule couche avec api/ qui appelle le réseau.
// La clé API n'est jamais écrite dans la console ni dans les messages d'erreur (ENF-13).

import { enteteAuthorization } from '../logique/connexion.js';
import { lireReglages } from '../cache/stockage.js';

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

// Requête authentifiée ; renvoie le JSON (ou null si la réponse est vide) ou lève une ErreurApi.
// options : { methode: 'GET' | 'POST' | 'PUT' | 'DELETE', params: {...}, corps: objet envoyé en JSON }.
export async function requete(chemin, cle, { methode = 'GET', params = null, corps = undefined } = {}) {
  const enTetes = { Authorization: enteteAuthorization(cle), Accept: 'application/json' };
  if (corps !== undefined) enTetes['Content-Type'] = 'application/json';
  const parametres = params ? `?${new URLSearchParams(params)}` : '';
  let reponse;
  try {
    reponse = await fetch(BASE + chemin + parametres, {
      method: methode,
      headers: enTetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    throw new ErreurApi('RESEAU');
  }
  if (!reponse.ok) throw new ErreurApi(typeErreurHttp(reponse.status), reponse.status);
  const texte = await reponse.text();
  return texte ? JSON.parse(texte) : null;
}

// Requête GET avec une clé donnée (test de connexion, F-01).
export async function requeteGet(chemin, cle, params = null) {
  return requete(chemin, cle, { params });
}

// Requête avec la clé enregistrée sur l'appareil (ENF-13 : la clé ne sort pas de api/ et cache/).
// Deuxième argument : paramètres de requête (lecture) ; troisième : méthode et corps (écriture, L4).
export async function requeteAuthentifiee(chemin, params = null, options = {}) {
  const { cle } = await lireReglages();
  if (!cle) throw new ErreurApi('IDENTIFIANTS');
  return requete(chemin, cle, { ...options, params });
}
