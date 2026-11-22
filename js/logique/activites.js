// Logique du fil et du détail des activités (F-10, F-12, F-13, ENF-11). Fonctions pures.

// Durée de validité du cache avant un nouvel appel à l'API (ENF-11).
export const VALIDITE_CACHE_MS = 5 * 60 * 1000;

// Vrai si les données chargées à "chargeLe" (ISO) ont plus de 5 minutes.
export function estPerime(chargeLe, maintenant = Date.now()) {
  if (!chargeLe) return true;
  return maintenant - Date.parse(chargeLe) > VALIDITE_CACHE_MS;
}

// Filtre par sport (F-12) ; code null = tous les sports.
export function filtrerParSport(activites, code) {
  return code ? activites.filter((a) => a.sport === code) : activites;
}

// Ajoute une page d'activités à la liste : sans doublon, de la plus récente à la plus ancienne (F-10).
export function fusionnerActivites(liste, page) {
  const parId = new Map([...liste, ...page].map((a) => [a.id, a]));
  const cle = (a) => `${a.date}T${a.heure ?? '00:00'}`;
  return [...parId.values()].sort((x, y) => (cle(x) < cle(y) ? 1 : cle(x) > cle(y) ? -1 : 0));
}

// Temps par zone (F-13) : tableau de secondes [Z1, Z2, ...] ou de {id, secs} (puissance).
// Renvoie [{ zone, secs, pct }] ; zones vides de fin retirées ; zones hors Z1-Z7 (ex. SS) ignorées.
export function repartitionZones(temps) {
  if (!Array.isArray(temps)) return [];
  const lignes = temps
    .map((t, i) => (typeof t === 'number' ? { zone: `Z${i + 1}`, secs: t } : { zone: t.id, secs: t.secs ?? 0 }))
    .filter((l) => /^Z[1-7]$/.test(l.zone));
  while (lignes.length && !lignes[lignes.length - 1].secs) lignes.pop();
  const total = lignes.reduce((s, l) => s + l.secs, 0);
  if (!total) return [];
  return lignes.map((l) => ({ ...l, pct: Math.round((l.secs / total) * 100) }));
}
