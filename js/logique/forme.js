// Forme (F-23, 9.4, glossaire : TSB = CTL - ATL). Fonctions pures.

// Phrase simple selon le TSB (9.4) : > 5 Frais ; -10 à 5 Équilibré ; -30 à -10 En charge ; < -30 Fatigue élevée.
export function phraseForme(tsb) {
  if (tsb === null || tsb === undefined) return null;
  if (tsb > 5) return 'Frais';
  if (tsb >= -10) return 'Équilibré';
  if (tsb >= -30) return 'En charge';
  return 'Fatigue élevée';
}

// Position du repère sur la jauge de forme (F-23, design E) : 4 segments égaux (Fatigue, En charge, Équilibré, Frais)
// qui suivent les bornes de 9.4. Chaque segment est linéaire entre ses bornes ; les extrêmes sont bornés à -50 et +25.
// Renvoie un pourcentage de 0 à 100, ou null sans TSB.
const SEGMENTS_JAUGE = [[-50, -30], [-30, -10], [-10, 5], [5, 25]];
export function positionJauge(tsb) {
  if (tsb === null || tsb === undefined || Number.isNaN(tsb)) return null;
  const t = Math.min(25, Math.max(-50, tsb));
  const i = t > 5 ? 3 : t >= -10 ? 2 : t >= -30 ? 1 : 0;
  const [bas, haut] = SEGMENTS_JAUGE[i];
  return Math.round((i + (t - bas) / (haut - bas)) * 25 * 10) / 10;
}

// TSB arrondi au dixième ; null si une valeur manque.
export function calculerTsb(ctl, atl) {
  if (ctl === null || ctl === undefined || atl === null || atl === undefined) return null;
  return Math.round((ctl - atl) * 10) / 10;
}

// Forme la plus récente qui a un CTL et un ATL (le jour même peut ne pas encore être calculé).
export function derniereForme(liste) {
  const valides = liste.filter((f) => f.ctl !== null && f.atl !== null);
  valides.sort((x, y) => (x.date < y.date ? 1 : -1));
  return valides[0] ?? null;
}
