// Forme (F-23, F-26, 9.4, glossaire : TSB = CTL - ATL). Fonctions pures.

import { ajouterJours, joursEntre } from './dates.js';

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

// --- Historique de la forme (F-26, D-26) ---

// Périodes proposées sur l'écran d'historique ; 3 mois par défaut.
export const PERIODES_FORME = [
  { code: '6s', libelle: '6 semaines', jours: 42 },
  { code: '3m', libelle: '3 mois', jours: 91 },
  { code: '1a', libelle: '1 an', jours: 365 },
];

// Période demandée (code de l'adresse, vérifié) -> { code, libelle, debut, fin } ; fin = jour donné inclus.
export function periodeForme(code, jour) {
  const p = PERIODES_FORME.find((x) => x.code === code) ?? PERIODES_FORME[1];
  return { code: p.code, libelle: p.libelle, debut: ajouterJours(jour, -(p.jours - 1)), fin: jour };
}

// Jours qui ont un CTL et un ATL, du plus ancien au plus récent ; limités à la période si elle est donnée.
export function serieForme(formes, periode = null) {
  return formes.filter((f) => f.ctl !== null && f.atl !== null && f.tsb !== null)
    .filter((f) => !periode || (f.date >= periode.debut && f.date <= periode.fin))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

// Bornes verticales d'un graphique : min et max des valeurs, élargis de 10 % (au moins 1) ; zéro inclus si demandé.
export function echelleForme(valeurs, { avecZero = false } = {}) {
  if (!valeurs.length) return { min: 0, max: 1 };
  let min = Math.min(...valeurs);
  let max = Math.max(...valeurs);
  if (avecZero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  const marge = Math.max(1, (max - min) * 0.1);
  return { min: Math.floor(min - marge), max: Math.ceil(max + marge) };
}

// Ordonnée SVG d'une valeur (y = 0 en haut).
export function ordonnee(v, { min, max }, hauteur) {
  return Math.round((hauteur - ((v - min) / (max - min)) * hauteur) * 10) / 10;
}

// Chemin SVG d'une série : x selon la date dans la période (jours manquants sautés sans couper le trait).
export function cheminForme(serie, champ, periode, echelle, largeur, hauteur) {
  const nb = joursEntre(periode.debut, periode.fin);
  return serie.map((f, i) => {
    const x = nb > 0 ? Math.round((joursEntre(periode.debut, f.date) / nb) * largeur * 10) / 10 : 0;
    return `${i ? 'L' : 'M'}${x},${ordonnee(f[champ], echelle, hauteur)}`;
  }).join(' ');
}

// Bandes horizontales du graphique du TSB, aux bornes de 9.4 (Fatigue < -30 < En charge < -10 < Équilibré <= 5 < Frais),
// limitées à l'échelle ; numero = 1 (fatigue) à 4 (frais), comme les segments de la jauge.
export function bandesTsb(echelle, hauteur) {
  const bornes = [[-Infinity, -30], [-30, -10], [-10, 5], [5, Infinity]];
  return bornes.map(([bas, haut], i) => {
    const b = Math.max(bas, echelle.min);
    const h = Math.min(haut, echelle.max);
    if (h <= b) return null;
    const y = ordonnee(h, echelle, hauteur);
    return { numero: i + 1, y, hauteur: Math.round((ordonnee(b, echelle, hauteur) - y) * 10) / 10 };
  }).filter(Boolean);
}

// Résumé de la période : dernière forme, évolution du CTL, CTL le plus haut, TSB le plus bas et le plus haut.
export function resumeForme(serie) {
  if (!serie.length) return null;
  const derniere = serie.at(-1);
  const ctls = serie.map((f) => f.ctl);
  const tsbs = serie.map((f) => f.tsb);
  return {
    derniere,
    ecart_ctl: derniere.ctl - serie[0].ctl,
    ctl_max: Math.max(...ctls),
    tsb_min: Math.min(...tsbs),
    tsb_max: Math.max(...tsbs),
  };
}
