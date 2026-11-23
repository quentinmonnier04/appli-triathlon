// Tests des conversions de la couche api/ (ENF-25, 9.2, 5.4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertirAthlete } from '../js/api/athlete.js';
import { typeErreurHttp } from '../js/api/client.js';
import { convertirActivite, convertirIntervalle, CHAMPS_FIL } from '../js/api/activites.js';
import { convertirSeancePrevue, versEvenement, estAffichable } from '../js/api/evenements.js';
import { convertirModele } from '../js/api/bibliotheque.js';

test('séance structurée -> corps EventEx : texte de séance dans description, sans durée imposée (F-42)', () => {
  const blocs = [{ type: 'REPETITIONS', cible: 'HR', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } }];
  assert.deepEqual(versEvenement({ date: '2026-11-24', sport: 'VELO', titre: 'PMA', blocs, description: 'ignorée' }), {
    category: 'WORKOUT', start_date_local: '2026-11-24T00:00:00', type: 'Ride', name: 'PMA',
    description: 'Série 5x\n- 4m Z4 HR\n- Récup 2m Z1 HR',
  });
});

test('séance simple -> corps EventEx avec durée, distance et description (F-40)', () => {
  assert.deepEqual(versEvenement({ date: '2026-11-25', sport: 'CAP', titre: 'Footing', duree_s: 2700, distance_m: 8000, description: 'Tranquille', blocs: [] }), {
    category: 'WORKOUT', start_date_local: '2026-11-25T00:00:00', type: 'Run', name: 'Footing', description: 'Tranquille', moving_time: 2700, distance: 8000,
  });
});

test('repos -> note du calendrier (F-46)', () => {
  assert.deepEqual(versEvenement({ date: '2026-11-26', sport: 'REPOS', titre: 'Repos', description: '' }), {
    category: 'NOTE', start_date_local: '2026-11-26T00:00:00', name: 'Repos', description: '',
  });
});

test('lecture : note "Repos" = séance de repos ; autres notes ignorées ; blocs relus', () => {
  const repos = convertirSeancePrevue({ id: 9, start_date_local: '2026-11-26T00:00:00', category: 'NOTE', name: 'Repos' });
  assert.equal(repos.sport, 'REPOS');
  assert.equal(estAffichable({ category: 'NOTE', name: 'Repos complet' }), true);
  assert.equal(estAffichable({ category: 'NOTE', name: 'Anniversaire' }), false);
  assert.equal(estAffichable({ category: 'WORKOUT', name: 'x' }), true);
  const s = convertirSeancePrevue({ id: 3, start_date_local: '2026-11-24T00:00:00', category: 'WORKOUT', type: 'Ride', name: 'PMA', description: 'Série 5x\n- 4m Z4 HR' });
  assert.deepEqual(s.blocs, [{ type: 'REPETITIONS', cible: 'HR', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: null }]);
});

test('modèle de la bibliothèque Intervals.icu -> objet interne (F-47)', () => {
  assert.deepEqual(convertirModele({ id: 12, name: 'Sweet spot', type: 'Ride', description: '- 20m 90%', moving_time: 3600, folder_id: 2 }),
    { id: '12', titre: 'Sweet spot', sport: 'VELO', description: '- 20m 90%', duree_s: 3600, distance_m: null, blocs: null });
});
import { convertirForme } from '../js/api/wellness.js';

test('événement WORKOUT -> objet interne SeancePrevue (9.2)', () => {
  assert.deepEqual(convertirSeancePrevue({ id: 77, start_date_local: '2026-11-22T00:00:00', category: 'WORKOUT', type: 'Run',
    name: 'Fractionné', moving_time: 3600, distance: 10000, description: '5x1km' }), {
    id: '77', date: '2026-11-22', sport: 'CAP', titre: 'Fractionné', duree_s: 3600, distance_m: 10000, description: '5x1km', blocs: null,
  });
});

test('séance prévue : repli sur les objectifs de temps et de distance, titre par défaut', () => {
  const s = convertirSeancePrevue({ id: 5, start_date_local: '2026-11-23T00:00:00', type: 'Swim', time_target: 2700, distance_target: 2000 });
  assert.equal(s.duree_s, 2700);
  assert.equal(s.distance_m, 2000);
  assert.equal(s.titre, 'Natation');
  assert.equal(s.description, null);
});

test('wellness -> objet interne Forme (9.2) : valeurs entières cohérentes, TSB = CTL - ATL', () => {
  assert.deepEqual(convertirForme({ id: '2026-11-22', ctl: 52.44, atl: 61.9 }), { date: '2026-11-22', ctl: 52, atl: 62, tsb: -10 });
  assert.deepEqual(convertirForme({ id: '2026-11-21' }), { date: '2026-11-21', ctl: null, atl: null, tsb: null });
});

test('athlète : nom repris du champ name', () => {
  assert.deepEqual(convertirAthlete({ id: 'i42', name: 'Quentin M', firstname: 'Quentin', sportSettings: [] }), { id: 'i42', nom: 'Quentin M' });
});

test('athlète : repli sur prénom et nom, puis texte par défaut', () => {
  assert.equal(convertirAthlete({ id: 'i1', firstname: 'Ana', lastname: 'Bo' }).nom, 'Ana Bo');
  assert.equal(convertirAthlete({ id: 'i1' }).nom, 'athlète');
});

test('erreurs HTTP : 401 et 403 = identifiants refusés, le reste = serveur', () => {
  assert.equal(typeErreurHttp(401), 'IDENTIFIANTS');
  assert.equal(typeErreurHttp(403), 'IDENTIFIANTS');
  assert.equal(typeErreurHttp(404), 'SERVEUR');
  assert.equal(typeErreurHttp(500), 'SERVEUR');
  assert.equal(typeErreurHttp(429), 'SERVEUR');
});

test('activité Intervals.icu -> objet interne Activite (9.2)', () => {
  const brut = {
    id: 'i123', start_date_local: '2026-11-20T07:30:15', type: 'Ride', name: 'Sortie', moving_time: 6000, elapsed_time: 6300,
    distance: 48380.5, total_elevation_gain: 420.4, average_heartrate: 142, max_heartrate: 171, icu_average_watts: 188,
    icu_training_load: 95, icu_rpe: 6, feel: 2, icu_hr_zone_times: [600, 3000], icu_zone_times: [{ id: 'Z1', secs: 100 }],
    pace_zone_times: null, icu_lap_count: 3, source: 'SUUNTO',
  };
  assert.deepEqual(convertirActivite(brut), {
    id: 'i123', date: '2026-11-20', heure: '07:30', sport: 'VELO', titre: 'Sortie', duree_s: 6000, distance_m: 48380.5,
    denivele_m: 420.4, fc_moy: 142, fc_max: 171, puissance_moy_w: 188, charge: 95, rpe: 6, ressenti: 2, commentaire: null,
    zones_fc: [600, 3000], zones_puissance: [{ id: 'Z1', secs: 100 }], zones_allure: null, nb_tours: 3,
  });
});

test('activité incomplète : champs absents à null, durée de repli, titre par défaut', () => {
  const a = convertirActivite({ id: 'i9', start_date_local: '2026-11-21T18:00:00', type: 'Run', elapsed_time: 1800, icu_distance: 5000 });
  assert.equal(a.duree_s, 1800);
  assert.equal(a.distance_m, 5000);
  assert.equal(a.titre, 'Course');
  assert.equal(a.fc_moy, null);
  assert.equal(a.puissance_moy_w, null);
});

test('intervalle -> objet interne', () => {
  assert.deepEqual(
    convertirIntervalle({ id: 1, type: 'WORK', label: 'Rep 1', moving_time: 240, elapsed_time: 250, distance: 1000, average_heartrate: 165, max_heartrate: 172, average_watts: null }),
    { libelle: 'Rep 1', type: 'WORK', duree_s: 240, distance_m: 1000, fc_moy: 165, fc_max: 172, puissance_moy_w: null },
  );
});

test('le fil ne demande que les champs utiles (ENF-11)', () => {
  assert.ok(CHAMPS_FIL.includes('start_date_local') && CHAMPS_FIL.includes('icu_training_load'));
  assert.ok(!CHAMPS_FIL.includes('icu_hr_zone_times'));
});
