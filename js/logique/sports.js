// Sports de l'appli et correspondance avec les types d'activité Intervals.icu (9.3, ENF-18). Fonctions pures.
// Types vérifiés dans la liste officielle de la spécification OpenAPI (Ride, Run, Swim, ...).

// couleur : couleur du thème sombre (design E, docs/design.md) ; icone : nom de l'icône SVG dessinée dans ui/icones.js.
export const SPORTS = [
  { code: 'NATATION', libelle: 'Natation', couleur: '#3FA7FF', icone: 'natation' },
  { code: 'VELO', libelle: 'Vélo', couleur: '#FF7A1A', icone: 'velo' },
  { code: 'CAP', libelle: 'Course', couleur: '#3DDC84', icone: 'course' },
  { code: 'RENFO', libelle: 'Renfo', couleur: '#B98CFF', icone: 'renfo' },
  { code: 'ENCHAINEMENT', libelle: 'Enchaînement', couleur: '#FFD23F', icone: 'enchainement' },
  { code: 'REPOS', libelle: 'Repos', couleur: '#A3ABB3', icone: 'repos' },
  { code: 'AUTRE', libelle: 'Autre', couleur: '#F28CC6', icone: 'autre' },
];

// Type Intervals.icu -> code sport ; tout type absent de cette table devient AUTRE.
const CORRESPONDANCE = {
  Swim: 'NATATION',
  OpenWaterSwim: 'NATATION',
  Ride: 'VELO',
  VirtualRide: 'VELO',
  GravelRide: 'VELO',
  MountainBikeRide: 'VELO',
  TrackRide: 'VELO',
  EBikeRide: 'VELO',
  EMountainBikeRide: 'VELO',
  Cyclocross: 'VELO',
  Velomobile: 'VELO',
  Handcycle: 'VELO',
  Run: 'CAP',
  TrailRun: 'CAP',
  VirtualRun: 'CAP',
  WeightTraining: 'RENFO',
  Crossfit: 'RENFO',
  HighIntensityIntervalTraining: 'RENFO',
  Workout: 'RENFO',
  Pilates: 'RENFO',
  Transition: 'ENCHAINEMENT',
};

export function sportDepuisType(type) {
  return CORRESPONDANCE[type] ?? 'AUTRE';
}

// Description d'un sport (libellé, couleur, icône) à partir de son code.
export function sport(code) {
  return SPORTS.find((s) => s.code === code) ?? SPORTS[SPORTS.length - 1];
}
