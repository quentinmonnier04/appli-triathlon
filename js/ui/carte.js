// Cartes de parcours (F-70, F-71, ENF-12, ENF-26).
// - F-70 : carte du détail d'une activité, avec Leaflet (copie locale dans lib/leaflet) et les tuiles OpenStreetMap.
// - F-71 : aperçu du tracé sur les cartes du fil, dessiné en SVG sans tuiles (aucune requête de tuile pour le fil).
// Leaflet n'est chargé qu'à l'ouverture d'une carte : le démarrage de l'appli reste léger (ENF-09).

import { lireTrace, lireApercuTrace } from '../api/activites.js';
import { cheminApercu, limites, nombrePoints } from '../logique/carte.js';
import { sport } from '../logique/sports.js';

// Seul fournisseur de tuiles autorisé (ENF-12, D-03). Politique d'usage d'OpenStreetMap : attribution visible
// et en-tête Referer présent (l'appli est en "no-referrer" par défaut, d'où referrerPolicy sur les tuiles).
const TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

let promesseLeaflet = null;

// Charge lib/leaflet (script et feuille de style) une seule fois ; renvoie l'objet L.
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  promesseLeaflet ??= new Promise((resoudre, rejeter) => {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'lib/leaflet/leaflet.css';
    document.head.append(style);
    const script = document.createElement('script');
    script.src = 'lib/leaflet/leaflet.js';
    script.onload = () => resoudre(window.L);
    script.onerror = () => { promesseLeaflet = null; rejeter(new Error('Leaflet indisponible')); };
    document.head.append(script);
  });
  return promesseLeaflet;
}

// F-70 : affiche la carte du parcours dans "element" (bloc vide prévu par l'écran).
// Renvoie false si l'activité n'a finalement aucun point GPS (l'écran retire alors le bloc).
export async function afficherCarteParcours(element, id, sportCode) {
  const [L, trace] = await Promise.all([chargerLeaflet(), lireTrace(id)]);
  if (!element.isConnected) return true;
  if (!nombrePoints(trace.segments)) return false;
  // Couleur du sport selon le thème actif (design E : variable --couleur-sport posée par la classe sport-XXX).
  element.classList.add(`sport-${sport(sportCode).code}`);
  const couleur = getComputedStyle(element).getPropertyValue('--couleur-sport').trim() || sport(sportCode).couleur;
  const carte = L.map(element, {
    zoomControl: true,
    attributionControl: true,
    // ENF-17 : sur téléphone, un doigt fait défiler la page ; on zoome à deux doigts ou avec les boutons.
    dragging: !L.Browser.mobile,
    scrollWheelZoom: false,
  });
  L.tileLayer(TUILES, {
    maxZoom: 19,
    attribution: ATTRIBUTION,
    referrerPolicy: 'strict-origin-when-cross-origin',
  }).addTo(carte);
  L.polyline(trace.segments, { color: couleur, weight: 4, opacity: 0.95 }).addTo(carte);
  const depart = trace.segments[0][0];
  const dernier = trace.segments[trace.segments.length - 1];
  const arrivee = dernier[dernier.length - 1];
  L.circleMarker(depart, { radius: 7, color: '#FFFFFF', weight: 3, fillColor: '#2E7D32', fillOpacity: 1 }).bindTooltip('Départ').addTo(carte);
  L.circleMarker(arrivee, { radius: 7, color: '#FFFFFF', weight: 3, fillColor: '#C62828', fillOpacity: 1 }).bindTooltip('Arrivée').addTo(carte);
  carte.fitBounds(limites(trace.segments), { padding: [16, 16] });
  return true;
}

const LARGEUR_APERCU = 320;
const HAUTEUR_APERCU = 72;

// F-71 : remplit les aperçus de tracé ([data-apercu]) d'une zone à mesure qu'ils deviennent visibles.
// Chaque tracé n'est demandé qu'une fois à Intervals.icu, puis lu dans le cache (ENF-11).
// Sans réseau ni cache, l'aperçu est simplement retiré.
export function remplirApercus(racine) {
  const cibles = [...racine.querySelectorAll('[data-apercu]:not([data-charge])')];
  if (!cibles.length) return;
  const observateur = new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (!entree.isIntersecting) continue;
      const cible = entree.target;
      observateur.unobserve(cible);
      cible.dataset.charge = '1';
      lireApercuTrace(cible.dataset.apercu).then(({ segments }) => {
        const chemin = cheminApercu(segments, LARGEUR_APERCU, HAUTEUR_APERCU);
        if (!chemin) { cible.remove(); return; }
        cible.innerHTML = `<svg viewBox="0 0 ${LARGEUR_APERCU} ${HAUTEUR_APERCU}" aria-hidden="true"><path d="${chemin}"></path></svg>`;
      }).catch(() => cible.remove());
    }
  }, { rootMargin: '200px' });
  cibles.forEach((c) => observateur.observe(c));
}
