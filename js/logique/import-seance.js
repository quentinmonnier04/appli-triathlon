// Import d'une séance depuis un fichier (F-132, D-51). Fonctions pures.
// Intervals.icu convertit lui-même les fichiers de séance (POST /athlete/{id}/workouts, champs file_contents pour un
// fichier texte, file_contents_base64 pour un fichier binaire, et filename) : .zwo (Zwift), .mrc, .erg (texte), .fit.

export const FORMATS_IMPORT = ['zwo', 'mrc', 'erg', 'fit'];
export const TAILLE_MAX_IMPORT = 1000000; // 1 Mo : une séance pèse quelques Ko

// Octets -> base64 (par morceaux, pour les fichiers .fit).
export function base64DepuisOctets(octets) {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

// Nom et contenu d'un fichier choisi -> corps à envoyer, ou { erreur } (format inconnu, fichier vide ou trop lourd).
export function preparerImport(nom, octets) {
  const extension = String(nom ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (!FORMATS_IMPORT.includes(extension)) return { erreur: 'Format non pris en charge : choisis un fichier .zwo, .mrc, .erg ou .fit.' };
  if (!octets?.length) return { erreur: 'Le fichier est vide.' };
  if (octets.length > TAILLE_MAX_IMPORT) return { erreur: 'Fichier trop lourd pour une séance (1 Mo au plus).' };
  const filename = String(nom).replace(/[^\w.\- ]/g, '_').slice(0, 100);
  if (extension === 'fit') return { filename, file_contents_base64: base64DepuisOctets(octets) };
  return { filename, file_contents: new TextDecoder('utf-8').decode(octets) };
}
