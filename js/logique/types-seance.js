// Types de séance de la banque Mes séances (D-25) : liste fixe par sport, plus des types libres. Fonctions pures.
// Le type est rangé dans une étiquette de la séance de bibliothèque Intervals.icu :
// "type-<code>" pour un type de la liste fixe, "type-<texte>" pour un type libre.

import { SPORTS } from './sports.js';

export const PREFIXE_TYPE = 'type-';
const LONGUEUR_MAX = 30;

// Liste fixe proposée pour chaque sport (choix de l'utilisateur, D-25).
export const TYPES_PAR_SPORT = {
  CAP: [['endurance', 'Endurance'], ['seuil', 'Seuil'], ['fractionne', 'Fractionné'], ['sortie-longue', 'Sortie longue'], ['recuperation', 'Récupération'], ['enchainement', 'Enchaînement']],
  VELO: [['endurance', 'Endurance'], ['seuil', 'Seuil'], ['pma', 'PMA'], ['sortie-longue', 'Sortie longue'], ['recuperation', 'Récupération'], ['enchainement', 'Enchaînement']],
  NATATION: [['technique', 'Technique'], ['endurance', 'Endurance'], ['seuil', 'Seuil'], ['vitesse', 'Vitesse']],
  RENFO: [['gainage', 'Gainage'], ['force', 'Force']],
  AUTRE: [['autre', 'Autre']],
};
const TOUS_FIXES = Object.values(TYPES_PAR_SPORT).flat();

// Comparaison sans casse ni accents ("fractionne" = "Fractionné").
function cle(texte) {
  return String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Texte saisi -> libellé propre : type fixe reconnu (libellé officiel), sinon texte nettoyé (1re lettre en majuscule).
export function libelleType(texte) {
  const t = String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, LONGUEUR_MAX);
  if (!t) return null;
  const fixe = TOUS_FIXES.find(([code, libelle]) => cle(libelle) === cle(t) || code === cle(t).replace(/ /g, '-'));
  return fixe ? fixe[1] : t.charAt(0).toUpperCase() + t.slice(1);
}

// Libellé -> étiquette Intervals.icu (null si aucun type).
export function typeVersEtiquette(texte) {
  const libelle = libelleType(texte);
  if (!libelle) return null;
  const fixe = TOUS_FIXES.find(([, l]) => l === libelle);
  return PREFIXE_TYPE + (fixe ? fixe[0] : libelle);
}

// Étiquettes d'une séance -> libellé du type (null si aucun).
export function typeDepuisEtiquettes(tags) {
  const tag = (tags ?? []).find((t) => typeof t === 'string' && t.startsWith(PREFIXE_TYPE) && t.length > PREFIXE_TYPE.length);
  return tag ? libelleType(tag.slice(PREFIXE_TYPE.length)) : null;
}

// Types proposés dans l'éditeur pour un sport : la liste fixe, puis les types libres déjà utilisés dans ce sport.
export function typesProposes(codeSport, seances = []) {
  const fixes = (TYPES_PAR_SPORT[codeSport] ?? []).map(([, l]) => l);
  const libres = seances.filter((s) => s.sport === codeSport && s.type_seance && !fixes.includes(s.type_seance))
    .map((s) => s.type_seance);
  return [...fixes, ...[...new Set(libres)].sort((a, b) => a.localeCompare(b, 'fr'))];
}

export const SANS_TYPE = 'Sans type';

// Banque rangée par sport puis par type (D-25) : [{ sport, nb, groupes: [{ type, seances }] }].
// Ordre : sports de 9.3 ; types de la liste fixe, puis types libres (alphabétique), puis "Sans type" ; séances par titre.
export function rangerSeances(seances, filtreSport = null) {
  return SPORTS.map((s) => s.code)
    .filter((code) => !filtreSport || code === filtreSport)
    .map((code) => {
      const duSport = seances.filter((x) => x.sport === code);
      const ordre = typesProposes(code, duSport);
      const parType = new Map();
      for (const x of duSport) {
        const type = x.type_seance || SANS_TYPE;
        if (!parType.has(type)) parType.set(type, []);
        parType.get(type).push(x);
      }
      const rang = (t) => (t === SANS_TYPE ? Infinity : ordre.indexOf(t));
      const groupes = [...parType.entries()]
        .sort(([a], [b]) => rang(a) - rang(b))
        .map(([type, liste]) => ({ type, seances: [...liste].sort((a, b) => (a.titre ?? '').localeCompare(b.titre ?? '', 'fr')) }));
      return { sport: code, nb: duSport.length, groupes };
    })
    .filter((g) => g.nb > 0);
}
