// Dates locales au format AAAA-MM-JJ (4.3, ENF-20 : semaine du lundi au dimanche). Fonctions pures.

const deux = (n) => String(n).padStart(2, '0');
const versDate = (iso) => { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j); };

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Jour local (et non UTC, qui décale les soirées au lendemain).
export function jourISO(date = new Date()) {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

export function ajouterJours(iso, n) {
  const d = versDate(iso);
  return jourISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

// Lundi de la semaine contenant ce jour (ENF-20).
export function lundiDe(iso) {
  const jour = versDate(iso).getDay(); // 0 = dimanche
  return ajouterJours(iso, jour === 0 ? -6 : 1 - jour);
}

export function debutMois(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export function joursDansMois(iso) {
  const d = versDate(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// Même jour du mois précédent, ramené au dernier jour si ce mois est plus court (31/03 -> 28/02).
export function memeJourMoisPrecedent(iso) {
  const d = versDate(iso);
  const debutPrecedent = jourISO(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const jour = Math.min(d.getDate(), joursDansMois(debutPrecedent));
  return `${debutPrecedent.slice(0, 8)}${deux(jour)}`;
}

// Grille du mois pour un calendrier : semaines du lundi au dimanche, null hors du mois (F-24).
export function grilleMois(iso) {
  const premier = debutMois(iso);
  const decalage = (versDate(premier).getDay() + 6) % 7; // lundi = 0
  const cases = Array(decalage).fill(null);
  for (let j = 0; j < joursDansMois(iso); j++) cases.push(ajouterJours(premier, j));
  while (cases.length % 7) cases.push(null);
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

// Nombre de jours de "a" à "b" (compte à rebours de l'objectif, F-80).
export function joursEntre(a, b) {
  return Math.round((versDate(b) - versDate(a)) / 86400000);
}

// Numéro de semaine ISO 8601 (semaine du lundi au dimanche, ENF-20) : la semaine 1 contient le premier jeudi de l'année.
export function numeroSemaine(iso) {
  const d = versDate(iso);
  const jeudi = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const premierJanvier = new Date(jeudi.getFullYear(), 0, 1);
  return 1 + Math.floor(Math.round((jeudi - premierJanvier) / 86400000) / 7);
}

const JOURS_LONGS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// "Mardi 24 nov." (en-tête de l'accueil, design E).
export function libelleJourCourt(iso) {
  const d = versDate(iso);
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

// "novembre 2026".
export function libelleMois(iso) {
  return `${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

// Date lue dans l'adresse (#/...?date=) : acceptée seulement au format AAAA-MM-JJ, sinon "defaut" (D-21, sécurité :
// la valeur est ensuite insérée dans la page).
export function dateParametre(valeur, defaut) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valeur ?? '') ? valeur : defaut;
}
