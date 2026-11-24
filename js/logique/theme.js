// Thème d'affichage (ENF-16) : automatique (suit le téléphone), clair ou sombre. Fonctions pures.

export const THEMES = [
  { valeur: 'auto', libelle: 'Automatique' },
  { valeur: 'clair', libelle: 'Clair' },
  { valeur: 'sombre', libelle: 'Sombre' },
];

// Couleur de la barre du navigateur (meta theme-color), identique au fond de page (docs/design.md).
export const COULEUR_BARRE = { sombre: '#0A0B0C', clair: '#F4F5F6' };

// Valeur enregistrée -> thème connu ; toute autre valeur revient à "auto".
export function normaliserTheme(valeur) {
  return THEMES.some((t) => t.valeur === valeur) ? valeur : 'auto';
}

// Thème réellement affiché : le choix manuel, sinon le réglage du téléphone.
export function themeEffectif(choix, telephoneClair) {
  const t = normaliserTheme(choix);
  if (t !== 'auto') return t;
  return telephoneClair ? 'clair' : 'sombre';
}
