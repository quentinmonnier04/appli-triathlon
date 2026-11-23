// Tracés GPS (F-70, F-71). Fonctions pures.
// Un tracé est une liste de segments ; un segment est une liste de points [latitude, longitude].

// Point GPS valide : deux nombres dans les bornes terrestres, et pas (0, 0) (position absente).
function pointValide(p) {
  return Array.isArray(p) && p.length >= 2
    && Number.isFinite(p[0]) && Number.isFinite(p[1])
    && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
    && !(p[0] === 0 && p[1] === 0);
}

// latlngs d'Intervals.icu -> segments ; un point absent ou invalide coupe le tracé (perte du signal GPS).
// Les segments de moins de deux points sont ignorés.
export function decouperSegments(latlngs) {
  if (!Array.isArray(latlngs)) return [];
  const segments = [];
  let courant = [];
  for (const p of latlngs) {
    if (pointValide(p)) {
      courant.push([p[0], p[1]]);
    } else if (courant.length) {
      segments.push(courant);
      courant = [];
    }
  }
  segments.push(courant);
  return segments.filter((s) => s.length >= 2);
}

// Nombre total de points d'un tracé.
export function nombrePoints(segments) {
  return segments.reduce((n, s) => n + s.length, 0);
}

// Allège un tracé à environ "maxPoints" points en gardant un point sur k ; le premier et le dernier
// point de chaque segment sont toujours gardés (départ et arrivée exacts).
export function alleger(segments, maxPoints) {
  const total = nombrePoints(segments);
  if (total <= maxPoints) return segments;
  const pas = Math.ceil(total / maxPoints);
  return segments.map((s) => s.filter((_, i) => i % pas === 0 || i === s.length - 1));
}

// Limites du tracé : [[latMin, lngMin], [latMax, lngMax]], ou null si vide.
export function limites(segments) {
  const points = segments.flat();
  if (!points.length) return null;
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

// Chemin SVG de l'aperçu (F-71) : projection simple (longitude corrigée par le cosinus de la latitude),
// tracé centré dans le cadre en gardant ses proportions, avec une marge. Renvoie '' si le tracé est vide.
export function cheminApercu(segments, largeur, hauteur, marge = 4) {
  const bornes = limites(segments);
  if (!bornes) return '';
  const [[latMin, lngMin], [latMax, lngMax]] = bornes;
  const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
  const etendueX = (lngMax - lngMin) * k;
  const etendueY = latMax - latMin;
  const echelle = Math.min(
    etendueX > 0 ? (largeur - 2 * marge) / etendueX : Infinity,
    etendueY > 0 ? (hauteur - 2 * marge) / etendueY : Infinity,
  );
  const e = Number.isFinite(echelle) ? echelle : 0; // tracé réduit à un point
  const decalX = (largeur - etendueX * e) / 2;
  const decalY = (hauteur - etendueY * e) / 2;
  const arrondi = (v) => Math.round(v * 10) / 10;
  return segments.map((s) => s.map((p, i) => {
    const x = decalX + (p[1] - lngMin) * k * e;
    const y = hauteur - (decalY + (p[0] - latMin) * e); // le nord en haut
    return `${i ? 'L' : 'M'}${arrondi(x)},${arrondi(y)}`;
  }).join(' ')).join(' ');
}
