// Constantes d'affichage et outils communs aux écrans (9.4.3, 9.4.4, ENF-15).
// Ce module ne touche pas au DOM au chargement : il reste importable par node --test.

import { formaterDureeCourte } from '../regles/validation.js';

// Sports (9.4.3) ; ENCHAINEMENT masqué jusqu'en V1.2 (D-05).
export const SPORTS = [
  { code: 'NATATION', libelle: 'Natation', couleur: '#1565C0', icone: '🏊' },
  { code: 'VELO', libelle: 'Vélo', couleur: '#E65100', icone: '🚴' },
  { code: 'CAP', libelle: 'Course', couleur: '#2E7D32', icone: '🏃' },
  { code: 'RENFO', libelle: 'Renfo', couleur: '#6A1B9A', icone: '💪' },
  { code: 'REPOS', libelle: 'Repos', couleur: '#616161', icone: '😴' },
];

// Renvoie la description d'un sport à partir de son code.
export function sport(code) {
  return SPORTS.find((s) => s.code === code) ?? SPORTS[2];
}

// Types de séance (F-11).
export const TYPES = [
  { code: 'ENDURANCE', libelle: 'Endurance' },
  { code: 'SEUIL', libelle: 'Seuil' },
  { code: 'FRACTIONNE', libelle: 'Fractionné' },
  { code: 'TECHNIQUE', libelle: 'Technique' },
  { code: 'TEST', libelle: 'Test' },
  { code: 'RECUP', libelle: 'Récup' },
];

// Zones et repère RPE (9.4.3, D-02).
export const ZONES = {
  1: { rpe: '1-2', libelle: 'Très facile, récupération' },
  2: { rpe: '3-4', libelle: 'Endurance, conversation possible' },
  3: { rpe: '5-6', libelle: 'Tempo, phrases courtes' },
  4: { rpe: '7-8', libelle: 'Seuil, quelques mots' },
  5: { rpe: '9-10', libelle: 'Maximal' },
};

// Libellés RPE (9.4.3).
export const LIBELLES_RPE = {
  1: 'Très facile', 2: 'Très facile', 3: 'Facile', 4: 'Facile', 5: 'Modéré',
  6: 'Modéré', 7: 'Difficile', 8: 'Difficile', 9: 'Très difficile', 10: 'Maximal',
};

// Motifs de séance sautée (F-21, 9.4.2).
export const MOTIFS = [
  { code: 'FATIGUE', libelle: 'Fatigue' },
  { code: 'BLESSURE', libelle: 'Blessure' },
  { code: 'TEMPS', libelle: 'Manque de temps' },
  { code: 'METEO', libelle: 'Météo' },
  { code: 'AUTRE', libelle: 'Autre' },
];

// Statuts d'une réalisation (F-21).
export const STATUTS = [
  { code: 'FAITE', libelle: 'Faite' },
  { code: 'PARTIELLE', libelle: 'Partielle' },
  { code: 'SAUTEE', libelle: 'Sautée' },
];

// Zones de douleur (F-23, 9.4.2).
export const ZONES_DOULEUR = ['Pied', 'Cheville', 'Mollet', 'Genou', 'Cuisse', 'Hanche', 'Dos', 'Épaule', 'Autre'];

// Messages (9.4.4), recopiés à l'identique.
export const MESSAGES = {
  'M-01': 'Le titre est obligatoire.',
  'M-02': 'Valeur impossible : {champ} doit être entre {min} et {max}.',
  'M-03': 'Supprimer cette séance ? Le réalisé éventuel sera conservé.',
  'M-04': 'Effacer le statut de cette séance ?',
  'M-05': 'Dernière sauvegarde : {delai}. Sauvegarder maintenant ?',
  'M-06': 'Ce fichier contient des données de santé (FC, douleurs). Garde-le dans un endroit privé.',
  'M-07': "L'import remplace toutes les données actuelles. Continuer ?",
  'M-08': "Fichier invalide : ce n'est pas une sauvegarde de l'application.",
  'M-09': 'Toutes les données seront effacées définitivement. Tape SUPPRIMER pour confirmer.',
  'M-10': 'Champ obligatoire.',
};

// Texte d'un message à partir d'une erreur {code, ...} ou d'un code et de paramètres.
export function formaterMessage(erreurOuCode, params = {}) {
  const e = typeof erreurOuCode === 'string' ? { code: erreurOuCode, ...params } : erreurOuCode;
  return MESSAGES[e.code].replace(/\{(\w+)\}/g, (_, cle) => e[cle] ?? '');
}

// --- Dates (ENF-15) : jours AAAA-MM-JJ en heure locale ---

const NOMS_JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function deux(n) {
  return String(n).padStart(2, '0');
}

function versDate(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
}

// Jour local au format AAAA-MM-JJ (et non toISOString, qui est en UTC).
export function jourISO(date = new Date()) {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

// Jour décalé de n jours (C-19).
export function decalerJour(iso, n) {
  const d = versDate(iso);
  return jourISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

// "Mardi 27/10/2026" (en-tête de E-01).
export function formaterDateLongue(iso) {
  return `${NOMS_JOURS[versDate(iso).getDay()]} ${formaterDateCourte(iso)}`;
}

// "27/10/2026".
export function formaterDateCourte(iso) {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

// --- Textes ---

// Échappe un texte saisi par l'utilisateur avant de l'insérer dans du HTML.
export function echapperHtml(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Distance affichée : "10,5 km" ou "1500 m" pour la natation.
export function formaterDistance(m, sportCode) {
  if (sportCode === 'NATATION') return `${m} m`;
  return `${String(Number((m / 1000).toFixed(2))).replace('.', ',')} km`;
}

// Texte d'un bloc (F-11) : "5 × 400 m Z4, récup 1:00".
export function texteBloc(bloc) {
  let texte = bloc.repetitions > 1 ? `${bloc.repetitions} × ` : '';
  if (bloc.distance_m) texte += `${bloc.distance_m} m`;
  else if (bloc.duree_s) texte += formaterDureeCourte(bloc.duree_s);
  if (bloc.zone) texte += ` Z${bloc.zone}`;
  if (bloc.recup_s) texte += `, récup ${formaterDureeCourte(bloc.recup_s)}`;
  return texte.trim();
}

// --- Routeur ---

// "#/seance/abc?date=..." -> { segments: ['seance', 'abc'], params: { date: '...' } }.
export function lireRoute(hash) {
  const [chemin, requete = ''] = String(hash ?? '').replace(/^#\/?/, '').split('?');
  return {
    segments: chemin.split('/').filter(Boolean),
    params: Object.fromEntries(new URLSearchParams(requete)),
  };
}
