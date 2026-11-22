// Calculs pour les petits graphiques du tableau de bord (F-22, F-25). Fonctions pures.

// Chemin SVG d'une courbe cumulée : un point par jour, x réparti sur nbJours, y = 0 en bas.
export function cheminCourbe(valeurs, nbJours, max, largeur, hauteur) {
  if (!valeurs.length) return '';
  const pas = nbJours > 1 ? largeur / (nbJours - 1) : 0;
  const arrondi = (v) => Math.round(v * 10) / 10;
  return valeurs
    .map((v, i) => `${i ? 'L' : 'M'}${arrondi(i * pas)},${arrondi(max > 0 ? hauteur - (v / max) * hauteur : hauteur)}`)
    .join(' ');
}

// Part du prévu déjà réalisée, en %, bornée à 100 ; null si rien n'était prévu (F-25).
export function progression(realise_s, prevu_s) {
  if (!prevu_s) return null;
  return Math.min(100, Math.round((realise_s / prevu_s) * 100));
}
