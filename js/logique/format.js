// Formatage pour l'affichage (4.3, 9.4, ENF-20). Fonctions pures.
// Unités internes : durée en s, distance en m ; dates locales AAAA-MM-JJ.

// Échappe un texte (venant de l'API ou de l'utilisateur) avant de l'insérer dans du HTML.
export function echapperHtml(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const deux = (n) => String(n).padStart(2, '0');

// Entier arrondi avec espace comme séparateur de milliers : 1234 -> "1 234".
export function formaterEntier(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Durée (9.4) : "1:39:34" au-delà d'une heure, "45:12" sinon.
export function formaterDuree(s) {
  if (s === null || s === undefined) return null;
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0 ? `${h}:${deux(m)}:${deux(sec)}` : `${m}:${deux(sec)}`;
}

// Durée totale pour les widgets (F-22, F-25) : "12 h 34", "45 min" ; le signe est ignoré.
export function formaterDureeLongue(s) {
  const minutes = Math.round(Math.abs(s ?? 0) / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} h ${deux(minutes % 60)}` : `${minutes} min`;
}

// Distance (9.4) : "48,38 km" ; natation en mètres "1 500 m".
export function formaterDistance(m, sportCode) {
  if (!(m > 0)) return null;
  if (sportCode === 'NATATION') return `${formaterEntier(m)} m`;
  return `${(m / 1000).toFixed(2).replace('.', ',')} km`;
}

// Distance totale en kilomètres entiers (F-51, F-52) : 2345678 -> "2 346 km".
export function formaterKm(m) {
  return `${formaterEntier((m ?? 0) / 1000)} km`;
}

// Allure m:ss à partir d'un nombre de secondes.
function allure(secondes) {
  const total = Math.round(secondes);
  return `${Math.floor(total / 60)}:${deux(total % 60)}`;
}

// Vitesse ou allure selon le sport (9.4) : vélo en km/h, course en min/km, natation en min/100 m.
export function formaterVitesse(sportCode, distance_m, duree_s) {
  if (!(distance_m > 0) || !(duree_s > 0)) return null;
  if (sportCode === 'VELO') return `${(distance_m / 1000 / (duree_s / 3600)).toFixed(1).replace('.', ',')} km/h`;
  if (sportCode === 'CAP') return `${allure(duree_s / (distance_m / 1000))} /km`;
  if (sportCode === 'NATATION') return `${allure(duree_s / (distance_m / 100))} /100 m`;
  return null;
}

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// "Vendredi 20/11/2026 à 07:30" (ENF-20) ; sans heure : "Vendredi 20/11/2026".
export function formaterDateHeure(date, heure) {
  const [a, m, j] = date.split('-').map(Number);
  const jour = JOURS[new Date(a, m - 1, j).getDay()];
  const texte = `${jour} ${deux(j)}/${deux(m)}/${a}`;
  return heure ? `${texte} à ${heure}` : texte;
}

// Horodatage ISO -> paramètres du message M-03, en heure locale.
export function formaterHorodatage(iso) {
  const d = new Date(iso);
  return { 'jj/mm': `${deux(d.getDate())}/${deux(d.getMonth() + 1)}`, 'hh:mm': `${deux(d.getHours())}:${deux(d.getMinutes())}` };
}
