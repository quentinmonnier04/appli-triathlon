// Forme (F-23, 9.4, glossaire : TSB = CTL - ATL). Fonctions pures.

// Phrase simple selon le TSB (9.4) : > 5 Frais ; -10 à 5 Équilibré ; -30 à -10 En charge ; < -30 Fatigue élevée.
export function phraseForme(tsb) {
  if (tsb === null || tsb === undefined) return null;
  if (tsb > 5) return 'Frais';
  if (tsb >= -10) return 'Équilibré';
  if (tsb >= -30) return 'En charge';
  return 'Fatigue élevée';
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
