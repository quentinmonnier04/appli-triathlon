// Sports de l'appli et correspondance avec les types d'activité Intervals.icu (9.3, ENF-18). Fonctions pures.
// Types vérifiés dans la liste officielle de la spécification OpenAPI (Ride, Run, Swim, ...).

export const SPORTS = [
  { code: 'NATATION', libelle: 'Natation', couleur: '#1565C0', icone: '🏊' },
  { code: 'VELO', libelle: 'Vélo', couleur: '#E65100', icone: '🚴' },
  { code: 'CAP', libelle: 'Course', couleur: '#2E7D32', icone: '🏃' },
  { code: 'RENFO', libelle: 'Renfo', couleur: '#6A1B9A', icone: '💪' },
  { code: 'ENCHAINEMENT', libelle: 'Enchaînement', couleur: '#C62828', icone: '🔁' },
  { code: 'REPOS', libelle: 'Repos', couleur: '#616161', icone: '😴' },
  { code: 'AUTRE', libelle: 'Autre', couleur: '#455A64', icone: '⭐' },
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
