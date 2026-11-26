// Messages de l'application (9.5), recopiés à l'identique. Fonctions pures.

export const MESSAGES = {
  'M-01': 'Connexion réussie : bonjour {nom} !',
  'M-02': 'Identifiants refusés. Vérifie ton identifiant athlète et ta clé API.',
  'M-03': 'Hors ligne. Données du {jj/mm} à {hh:mm}.',
  'M-04': 'Connexion nécessaire pour modifier tes séances.',
  'M-05': 'Supprimer cette séance de ton calendrier ?',
  'M-06': 'Se déconnecter ? Ta clé et le cache seront effacés de cet appareil. Tes données restent enregistrées en ligne.',
  'M-07': 'Le serveur ne répond pas. Réessaie dans un instant.',
  'M-08': "Aucune activité pour l'instant. Vérifie que ta montre Suunto est bien synchronisée.",
};

// Texte d'un message avec ses paramètres, ex. formaterMessage('M-01', { nom: 'Alex' }).
export function formaterMessage(code, params = {}) {
  return MESSAGES[code].replace(/\{([^}]+)\}/g, (tout, cle) => params[cle] ?? tout);
}
