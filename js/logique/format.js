// Formatage pour l'affichage (4.3). Fonctions pures.

// Échappe un texte (venant de l'API ou de l'utilisateur) avant de l'insérer dans du HTML.
export function echapperHtml(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
