// Icônes SVG en ligne, dessinées en local (design E, docs/design.md ; ENF-18, ENF-19 : une icône accompagne chaque couleur).
// Grille 24 x 24, trait 2 px, extrémités arrondies ; la couleur suit le texte (currentColor). Aucun emoji.

import { sport } from '../logique/sports.js';

const TRACES = {
  // Sports (9.3)
  natation: '<circle cx="16.5" cy="6" r="1.8"></circle><path d="M4 13l4.5-3.5 3.5 2.5 3-2.5"></path><path d="M2 17.5c1.7 1.2 3.3 1.2 5 0s3.3-1.2 5 0 3.3 1.2 5 0 3.3-1.2 5 0"></path>',
  velo: '<circle cx="5.5" cy="17" r="3.5"></circle><circle cx="18.5" cy="17" r="3.5"></circle><path d="M5.5 17l4-8h6l3 8M9.5 9l3 8M14 6h2.5"></path>',
  course: '<circle cx="14" cy="4.5" r="1.8"></circle><path d="M9 21l3-6 3 3v3M6 12l3-4h4l2 3 3 1M12 15l-1-4"></path>',
  renfo: '<path d="M6.5 7v10M17.5 7v10M3.5 10v4M20.5 10v4M6.5 12h11"></path>',
  enchainement: '<path d="M17 3l3 3-3 3"></path><path d="M4 11V10a4 4 0 0 1 4-4h12"></path><path d="M7 21l-3-3 3-3"></path><path d="M20 13v1a4 4 0 0 1-4 4H4"></path>',
  repos: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  autre: '<path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"></path>',
  // Navigation (9.1)
  accueil: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"></path>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  activites: '<path d="M3 12h4l3-7 4 14 3-7h4"></path>',
  profil: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>',
  // Actions et repères
  retour: '<path d="M15 5l-7 7 7 7"></path>',
  precedent: '<path d="M15 5l-7 7 7 7"></path>',
  suivant: '<path d="M9 5l7 7-7 7"></path>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"></path>',
  rafraichir: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"></path><path d="M4 3v5h5"></path><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"></path><path d="M20 21v-5h-5"></path>',
  reglages: '<circle cx="12" cy="12" r="3"></circle><path d="M10.3 2.5h3.4l.6 2.6 1.8.8 2.3-1.4 2.4 2.4-1.4 2.3.8 1.8 2.6.6v3.4l-2.6.6-.8 1.8 1.4 2.3-2.4 2.4-2.3-1.4-1.8.8-.6 2.6h-3.4l-.6-2.6-1.8-.8-2.3 1.4-2.4-2.4 1.4-2.3-.8-1.8-2.6-.6v-3.4l2.6-.6.8-1.8-1.4-2.3 2.4-2.4 2.3 1.4 1.8-.8z"></path>',
  crayon: '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path>',
  drapeau: '<path d="M5 21V4"></path><path d="M5 4h12l-2.5 4L17 12H5"></path>',
  montre: '<rect x="6" y="6" width="12" height="12" rx="3"></rect><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 9.5V12l1.5 1.5"></path>',
  succes: '<circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l2.7 2.7L16 10"></path>',
  erreur: '<path d="M12 3.5L2.5 20h19z"></path><path d="M12 10v4.5M12 17.5v.01"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5.5M12 7.5v.01"></path>',
};

// SVG d'une icône par son nom ; décorative par défaut (aria-hidden), le sens est porté par le texte ou un aria-label.
export function icone(nom, taille = 20) {
  const trace = TRACES[nom] ?? TRACES.autre;
  return `<svg class="icone" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trace}</svg>`;
}

// Icône d'un sport (ENF-18), dans la couleur du sport quand le parent porte la classe sport-XXX.
export function iconeSport(code, taille = 20) {
  return icone(sport(code).icone, taille);
}
