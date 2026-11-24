// Application du thème à la page (ENF-16) : attribut data-theme sur <html>, lu par css/style.css.
// Sans attribut, la page suit le téléphone (prefers-color-scheme).

import { normaliserTheme, themeEffectif, COULEUR_BARRE } from '../logique/theme.js';

export function appliquerTheme(choix) {
  const theme = normaliserTheme(choix);
  const racine = document.documentElement;
  if (theme === 'auto') delete racine.dataset.theme;
  else racine.dataset.theme = theme;
  // Barre du navigateur : en automatique, chaque balise garde sa media query ; sinon les deux prennent la couleur choisie.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const mode = theme === 'auto'
      ? (meta.media.includes('light') ? 'clair' : 'sombre')
      : themeEffectif(theme, false);
    meta.content = COULEUR_BARRE[mode];
  });
}
