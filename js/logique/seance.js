// Séances structurées par blocs et texte de séance au format Intervals.icu (F-40 à F-42, ENF-24). Fonctions pures.
// Syntaxe vérifiée sur le forum officiel d'Intervals.icu (fils "Workout builder" 1163 et "distance based" 9973) :
//   - une étape commence par "- " ; le texte placé avant la durée devient le libellé de l'étape (ex. "- Récup 2m Z1") ;
//   - durées : 1h, 10m, 30s, 1m30s ("m" = minutes) ; distances : 1km, 400mtr ("mtr" = mètres) ;
//   - cibles : Z4 = zone de puissance, Z4 HR = zone de FC, Z4 Pace = zone d'allure ;
//   - répétition : une ligne de titre finissant par "Nx" suivie des étapes, avec une ligne vide avant et après.

// Types de bloc (F-41) et leur titre dans le texte.
export const TYPES_BLOC = [
  { code: 'ECHAUFFEMENT', libelle: 'Échauffement' },
  { code: 'REPETITIONS', libelle: 'Répétitions' },
  { code: 'CONTINU', libelle: 'Corps de séance' },
  { code: 'RETOUR_CALME', libelle: 'Retour au calme' },
];
const TITRES = { ECHAUFFEMENT: 'Échauffement', CONTINU: 'Corps de séance', RETOUR_CALME: 'Retour au calme' };

// Cibles possibles d'un bloc (D-13 : choix libre pour chaque bloc).
export const CIBLES = [
  { code: 'HR', libelle: 'FC' },
  { code: 'PACE', libelle: 'Allure' },
  { code: 'POWER', libelle: 'Puissance' },
];

// Cible proposée par défaut (D-13) : allure en course et natation, FC ailleurs.
export function cibleParDefaut(sportCode) {
  return sportCode === 'CAP' || sportCode === 'NATATION' ? 'PACE' : 'HR';
}

// Sport de l'appli -> type d'activité Intervals.icu (liste officielle de la spécification OpenAPI).
// ENCHAINEMENT -> Transition : type de l'objectif triathlon (F-80), relu en ENCHAINEMENT par logique/sports.js.
const TYPES_INTERVALS = { NATATION: 'Swim', VELO: 'Ride', CAP: 'Run', RENFO: 'WeightTraining', AUTRE: 'Other', ENCHAINEMENT: 'Transition' };
export function sportVersType(sportCode) {
  return TYPES_INTERVALS[sportCode] ?? 'Other';
}

// --- Écriture du texte ---

// 5400 -> "1h30m" ; 90 -> "1m30s".
export function dureeTexte(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${sec ? `${sec}s` : ''}` || '0s';
}

// 1000 -> "1km" ; 400 -> "400mtr" ; toujours en mètres pour la natation.
export function distanceTexte(m, sportCode) {
  if (sportCode !== 'NATATION' && m % 1000 === 0) return `${m / 1000}km`;
  return `${Math.round(m)}mtr`;
}

export function cibleTexte(zone, cible) {
  if (!zone) return '';
  return `Z${zone}${{ HR: ' HR', PACE: ' Pace', POWER: '' }[cible] ?? ''}`;
}

// Une étape : "- [libellé ]quantité[ cible]".
function etapeTexte(etape, cible, sportCode, libelle = '') {
  const quantite = etape.distance_m ? distanceTexte(etape.distance_m, sportCode) : dureeTexte(etape.duree_s ?? 0);
  return ['-', libelle, quantite, cibleTexte(etape.zone, cible)].filter(Boolean).join(' ');
}

// Blocs -> texte de séance Intervals.icu (F-42) ; une ligne vide sépare les blocs.
export function blocsVersTexte(blocs, sportCode) {
  return blocs.map((b) => {
    if (b.type === 'REPETITIONS') {
      const lignes = [`Série ${b.repetitions}x`, etapeTexte(b.effort, b.cible, sportCode)];
      if (b.recup) lignes.push(etapeTexte(b.recup, b.cible, sportCode, 'Récup'));
      return lignes.join('\n');
    }
    return `${TITRES[b.type]}\n${etapeTexte(b.etape, b.cible, sportCode)}`;
  }).join('\n\n');
}

// --- Relecture du texte produit par l'appli (pour modifier une séance, F-43) ---

const CIBLE_SUFFIXE = { '': 'POWER', HR: 'HR', Pace: 'PACE' };

// "- [Récup ]quantité[ Zn[ HR|Pace]]" -> { recup, etape, cible } ou null.
function lireEtape(ligne) {
  const m = ligne.match(/^- (Récup )?(\S+)(?: Z([1-5])(?: (HR|Pace))?)?$/);
  if (!m) return null;
  const quantite = m[2];
  let etape;
  const km = quantite.match(/^(\d+(?:\.\d+)?)km$/);
  const mtr = quantite.match(/^(\d+)mtr$/);
  const duree = quantite.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (km) etape = { distance_m: Math.round(Number(km[1]) * 1000) };
  else if (mtr) etape = { distance_m: Number(mtr[1]) };
  else if (duree && quantite) etape = { duree_s: Number(duree[1] ?? 0) * 3600 + Number(duree[2] ?? 0) * 60 + Number(duree[3] ?? 0) };
  else return null;
  etape.zone = m[3] ? Number(m[3]) : null;
  return { recup: Boolean(m[1]), etape, cible: m[3] ? CIBLE_SUFFIXE[m[4] ?? ''] : null };
}

// Texte -> blocs, uniquement pour un texte au format produit par blocsVersTexte ; sinon null.
export function texteVersBlocs(texte) {
  if (!texte || !texte.trim()) return null;
  const blocs = [];
  for (const section of texte.trim().split(/\n\s*\n/)) {
    const [titre, ...lignes] = section.split('\n').map((l) => l.trim());
    const etapes = lignes.map(lireEtape);
    if (!etapes.length || etapes.includes(null)) return null;
    const cibles = [...new Set(etapes.map((e) => e.cible).filter(Boolean))];
    if (cibles.length > 1) return null;
    const cible = cibles[0] ?? 'HR';
    const serie = titre.match(/^Série (\d+)x$/);
    if (serie) {
      if (etapes.length > 2 || etapes[0].recup || (etapes[1] && !etapes[1].recup)) return null;
      blocs.push({ type: 'REPETITIONS', cible, repetitions: Number(serie[1]), effort: etapes[0].etape, recup: etapes[1]?.etape ?? null });
      continue;
    }
    const type = Object.keys(TITRES).find((k) => TITRES[k] === titre);
    if (!type || etapes.length !== 1 || etapes[0].recup) return null;
    blocs.push({ type, cible, etape: etapes[0].etape });
  }
  return blocs;
}

// --- Saisie et contrôles ---

// Durée d'une séance saisie en h:mm, "1h30", "1h" ou minutes seules -> secondes, ou null.
export function lireDureeSaisie(texte) {
  const t = String(texte ?? '').replace(/\s+/g, '');
  if (/^\d+$/.test(t)) return Number(t) * 60;
  const h = t.match(/^(\d{1,2})h$/);
  if (h) return Number(h[1]) * 3600;
  const hm = t.match(/^(\d{1,2})[:h](\d{2})$/);
  if (hm && Number(hm[2]) < 60) return Number(hm[1]) * 3600 + Number(hm[2]) * 60;
  return null;
}

// Durée d'une étape saisie en m:ss ou minutes seules -> secondes, ou null.
export function lireDureeEtape(texte) {
  const t = String(texte ?? '').replace(/\s+/g, '');
  if (/^\d+$/.test(t)) return Number(t) * 60;
  const ms = t.match(/^(\d{1,3}):(\d{2})$/);
  if (ms && Number(ms[2]) < 60) return Number(ms[1]) * 60 + Number(ms[2]);
  return null;
}

const deux = (n) => String(n).padStart(2, '0');

// Secondes -> "h:mm" pour préremplir la durée d'une séance.
export function formaterDureeSaisie(s) {
  if (!s) return '';
  const minutes = Math.round(s / 60);
  return `${Math.floor(minutes / 60)}:${deux(minutes % 60)}`;
}

// Secondes -> "hh:mm" pour le champ de durée de la séance, choisi avec la même roue que l'heure (F-40, D-40).
// Au plus 23:59 (limite du champ) ; vide sans durée.
export function formaterDureeChamp(s) {
  if (!s) return '';
  const minutes = Math.min(23 * 60 + 59, Math.round(s / 60));
  return `${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}`;
}

// Secondes -> "m:ss" pour préremplir la durée d'une étape.
export function formaterDureeEtape(s) {
  if (!s) return '';
  return `${Math.floor(s / 60)}:${deux(Math.round(s % 60))}`;
}

// Séance structurée de départ, à ajuster (R-02 : programmer en moins d'une minute) :
// échauffement 15 min Z2, 5 x 4 min Z4 avec 2 min de récupération Z1, retour au calme 10 min Z1.
export function modeleParDefaut(sportCode) {
  const cible = cibleParDefaut(sportCode);
  return [
    { type: 'ECHAUFFEMENT', cible, etape: { duree_s: 900, zone: 2 } },
    { type: 'REPETITIONS', cible, repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } },
    { type: 'RETOUR_CALME', cible, etape: { duree_s: 600, zone: 1 } },
  ];
}

// Durée totale des étapes en temps (affichage indicatif) ; les étapes en distance ne comptent pas.
export function dureeTotaleBlocs(blocs) {
  const duree = (e) => (e && !e.distance_m ? e.duree_s ?? 0 : 0);
  return blocs.reduce((total, b) => total + (b.type === 'REPETITIONS'
    ? b.repetitions * (duree(b.effort) + duree(b.recup))
    : duree(b.etape)), 0);
}

// Contrôle d'une séance avant envoi (F-40, F-41). Renvoie { champ: message } ; vide si tout est correct.
export function validerSeance(s) {
  const erreurs = {};
  if (!String(s.titre ?? '').trim()) erreurs.titre = 'Champ obligatoire.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? '')) erreurs.date = 'Choisis une date.';
  if (!s.sport) erreurs.sport = 'Champ obligatoire.';
  // Heure facultative (F-40, F-81) : hh:mm, de 00:00 à 23:59.
  if (s.heure !== null && s.heure !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.heure)) erreurs.heure = 'Heure attendue au format hh:mm.';
  const etapeValide = (e) => Boolean(e) && ((e.duree_s ?? 0) > 0 || (e.distance_m ?? 0) > 0)
    && (e.zone === null || e.zone === undefined || (Number.isInteger(e.zone) && e.zone >= 1 && e.zone <= 5));
  (s.blocs ?? []).forEach((b, i) => {
    if (b.type === 'REPETITIONS') {
      if (!Number.isInteger(b.repetitions) || b.repetitions < 1 || b.repetitions > 50) erreurs[`blocs.${i}`] = 'Répétitions : entre 1 et 50.';
      else if (!etapeValide(b.effort) || (b.recup && !etapeValide(b.recup))) erreurs[`blocs.${i}`] = 'Indique une durée ou une distance.';
    } else if (!etapeValide(b.etape)) {
      erreurs[`blocs.${i}`] = 'Indique une durée ou une distance.';
    }
  });
  return erreurs;
}
