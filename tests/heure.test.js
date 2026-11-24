// Heure des séances : manuelles (F-40, F-43, F-44), types (F-81), envoyées avec le plan (F-85)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versEvenement, convertirSeancePrevue, corpsDeplacement } from '../js/api/evenements.js';
import { versSeanceBibliotheque, convertirSeanceBibliotheque } from '../js/api/preparation.js';
import { REGLAGES_ANCIENS_PAR_DEFAUT as REGLAGES_PAR_DEFAUT } from '../js/logique/plan.js';
import { genererPlan } from './reference/ancien-plan.js';
import { validerSeance } from '../js/logique/seance.js';

const footing = { date: '2026-11-25', sport: 'CAP', titre: 'Footing', duree_s: 2700, blocs: [] };

test("séance avec heure -> start_date_local à l'heure ; sans heure -> minuit", () => {
  assert.equal(versEvenement({ ...footing, heure: '18:30' }).start_date_local, '2026-11-25T18:30:00');
  assert.equal(versEvenement({ ...footing, heure: null }).start_date_local, '2026-11-25T00:00:00');
  assert.equal(versEvenement({ ...footing }).start_date_local, '2026-11-25T00:00:00');
  assert.equal(versEvenement({ date: '2026-11-26', sport: 'REPOS', titre: 'Repos', heure: '12:00' }).start_date_local, '2026-11-26T12:00:00');
});

test("lecture de l'heure d'une séance prévue ; minuit = sans heure", () => {
  const brut = { id: 3, category: 'WORKOUT', type: 'Run', name: 'Footing' };
  assert.equal(convertirSeancePrevue({ ...brut, start_date_local: '2026-11-25T18:30:00' }).heure, '18:30');
  assert.equal(convertirSeancePrevue({ ...brut, start_date_local: '2026-11-25T00:00:00' }).heure, null);
  assert.equal(convertirSeancePrevue({ ...brut, start_date_local: '2026-11-25' }).heure, null);
  assert.equal(convertirSeancePrevue({ id: 4, category: 'RACE_A', start_date_local: '2026-11-25T09:00:00', name: 'Course' }).heure, '09:00');
});

test('corps de déplacement avec heure (F-44)', () => {
  assert.deepEqual(corpsDeplacement('2026-11-27', '07:15'), { start_date_local: '2026-11-27T07:15:00' });
  assert.deepEqual(corpsDeplacement('2026-11-27', null), { start_date_local: '2026-11-27T00:00:00' });
});

test("ancien format : heure lue dans les étiquettes (migration) ; plus écrite sur la séance (F-88)", () => {
  const s = { jour: 2, heure: '18:30', sport: 'VELO', titre: 'Home trainer', duree_s: 3600, distance_m: null, description: '', blocs: null };
  const w = versSeanceBibliotheque(s, 42);
  assert.deepEqual(w.tags, ['semaine-type']);
  assert.deepEqual(convertirSeanceBibliotheque({ id: 1, ...w, tags: ['semaine-type', 'jour-2', 'heure-18:30'] }), { id: '1', ...s, description: null });
  assert.equal(convertirSeanceBibliotheque({ id: 2, ...w, tags: ['semaine-type', 'jour-2'] }).heure, null);
  assert.equal(convertirSeanceBibliotheque({ id: 3, ...w, tags: ['semaine-type', 'heure-25:00'] }).heure, null);
});

test("plan : séances d'un jour triées par heure, heure recopiée", () => {
  const semaineType = [
    { id: 'a', jour: 2, heure: '18:30', sport: 'CAP', titre: 'Fractionné', duree_s: 3000 },
    { id: 'b', jour: 2, heure: '07:00', sport: 'NATATION', titre: 'Nage', duree_s: 2700 },
    { id: 'c', jour: 2, heure: null, sport: 'RENFO', titre: 'Gainage', duree_s: 900 },
  ];
  const plan = genererPlan({ semaineType, reglages: { ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' },
    dateCourse: '2027-01-31', allures: {}, objectifId: '5' });
  const s1 = plan[0].seances;
  assert.deepEqual(s1.map((s) => [s.heure, s.titre]), [[null, 'Gainage S1'], ['07:00', 'Nage S1'], ['18:30', 'Fractionné S1']]);
  assert.equal(s1[1].external_id, 'plan-5-s1-2026-12-01-1');
});

test("contrôle de l'heure saisie", () => {
  const valide = { titre: 'Footing', date: '2026-11-25', sport: 'CAP', blocs: [] };
  assert.deepEqual(validerSeance({ ...valide, heure: null }), {});
  assert.deepEqual(validerSeance({ ...valide, heure: '06:05' }), {});
  assert.ok(validerSeance({ ...valide, heure: '25:00' }).heure);
  assert.ok(validerSeance({ ...valide, heure: '7h' }).heure);
});
