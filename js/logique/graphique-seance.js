// Graphique des blocs d'une séance (F-41, F-84, F-20) : une barre par étape, largeur = durée, hauteur = zone.
// Fonctions pures. Les répétitions sont dépliées (effort puis récupération, n fois).

// Allures utilisées quand le profil n'a pas d'allure seuil pour le sport (m/s) ; la barre est alors "estimée".
export const ALLURES_PAR_DEFAUT = { CAP: 3, VELO: 8, NATATION: 1, AUTRE: 3 };

// Durée d'une étape : { duree_s, estimee } ; null si l'étape n'a ni durée ni distance.
function dureeEtape(e, sportCode, allures) {
  if (!e) return null;
  if (e.duree_s > 0) return { duree_s: e.duree_s, estimee: false };
  if (e.distance_m > 0) {
    const allure = allures[sportCode];
    if (allure > 0) return { duree_s: Math.round(e.distance_m / allure), estimee: false };
    const defaut = ALLURES_PAR_DEFAUT[sportCode] ?? ALLURES_PAR_DEFAUT.AUTRE;
    return { duree_s: Math.round(e.distance_m / defaut), estimee: true };
  }
  return null;
}

// Barres d'une séance : { barres: [{ debut_s, duree_s, zone: 1..5 | null, estimee }], total_s }.
// Séance simple : une barre sans zone ; repos ou séance sans étape : aucune barre.
export function barresSeance(seance, allures = {}) {
  const barres = [];
  let t = 0;
  const ajouter = (e, zone) => {
    const d = dureeEtape(e, seance.sport, allures);
    if (!d) return;
    barres.push({ debut_s: t, duree_s: d.duree_s, zone: zone ?? null, estimee: d.estimee });
    t += d.duree_s;
  };
  if (seance.sport === 'REPOS') return { barres, total_s: 0 };
  if (seance.blocs?.length) {
    for (const b of seance.blocs) {
      if (b.type === 'REPETITIONS') {
        for (let i = 0; i < (b.repetitions ?? 0); i++) {
          ajouter(b.effort, b.effort?.zone);
          if (b.recup) ajouter(b.recup, b.recup.zone);
        }
      } else {
        ajouter(b.etape, b.etape?.zone);
      }
    }
  } else {
    ajouter(seance, null);
  }
  return { barres, total_s: t };
}

const arrondi = (v) => Math.round(v * 10) / 10;

// Rectangles SVG du graphique dans un cadre largeur x hauteur : x et largeur en proportion de la durée totale,
// hauteur = zone / 5 de la hauteur (étape sans zone : 15 %), barre posée en bas ; classe CSS de couleur.
export function rectanglesGraphique({ barres, total_s }, largeur, hauteur) {
  if (!total_s) return [];
  return barres.map((b) => {
    const h = arrondi((b.zone ? b.zone / 5 : 0.15) * hauteur);
    return {
      x: arrondi((b.debut_s / total_s) * largeur),
      largeur: arrondi((b.duree_s / total_s) * largeur),
      y: arrondi(hauteur - h),
      hauteur: h,
      classe: `${b.zone ? `barre-Z${b.zone}` : 'barre-sans-zone'}${b.estimee ? ' barre-estimee' : ''}`,
    };
  });
}
