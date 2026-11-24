// Préparation par blocs (F-83, F-84, F-88, ENF-24) : calcul du plan, édition des blocs, migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coefficientsBlocs, debutDesBlocs, grilleDuBloc, blocsVides, genererPlanBlocs } from '../js/logique/blocs.js';
import { genererPlan } from '../js/logique/plan.js';

const R = { hausse: 8, coupure: 70, affutage: [70, 50], plafond_h: null };
const EF = { id: 'a', sport: 'CAP', titre: 'EF', duree_s: 3600, distance_m: null, description: null, blocs: null };
const VELO = { id: 'v', sport: 'VELO', titre: 'Vélo long', duree_s: 7200, distance_m: null, description: null, blocs: null };
const FRAC = {
  id: 'f', sport: 'CAP', titre: 'Fractionné', duree_s: null, distance_m: null, description: null,
  blocs: [{ type: 'ECHAUFFEMENT', etape: { duree_s: 900, distance_m: null, zone: 2, cible: 'ALLURE' } },
    { type: 'REPETITIONS', repetitions: 4, effort: { duree_s: 300, distance_m: null, zone: 4, cible: 'ALLURE' }, recup: { duree_s: 120, distance_m: null, zone: 1, cible: 'ALLURE' } }],
};
const place = (seanceId, jour, heure = null) => ({ seanceId, jour, heure });

test('deux blocs de 4 semaines, affûtage 70/50 : le volume continue de monter', () => {
  const c = coefficientsBlocs([{ nom: 'A', semaines: 4 }, { nom: 'B', semaines: 4 }], [21600, 18000], R);
  assert.deepEqual(c.map((s) => s.pct), [100, 108, 116, 81, 116, 124, 132, 140, 98, 70]);
  assert.deepEqual(c.map((s) => s.type), ['HAUSSE', 'HAUSSE', 'HAUSSE', 'COUPURE', 'HAUSSE', 'HAUSSE', 'HAUSSE', 'HAUSSE', 'AFFUTAGE', 'COURSE']);
  assert.deepEqual(c.map((s) => s.bloc), [0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(c.map((s) => s.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(c[0].pctSeances, 100);
  assert.equal(c[4].pctSeances, (116 * 21600) / 18000); // grille du bloc 2 (5 h) mise à l'échelle : 7 h
});

test('coupure forcée sur le dernier bloc (migration)', () => {
  const c = coefficientsBlocs([{ nom: 'A', semaines: 4, coupure: true }], [3600], { ...R, affutage: [70] });
  assert.deepEqual(c.map((s) => s.pct), [100, 108, 116, 81, 81]);
  assert.deepEqual(c.map((s) => s.type), ['HAUSSE', 'HAUSSE', 'HAUSSE', 'COUPURE', 'COURSE']);
});

test('plafond en heures', () => {
  const c = coefficientsBlocs([{ nom: 'A', semaines: 4 }], [3600], { ...R, affutage: [], plafond_h: 1.1 });
  assert.deepEqual(c.map((s) => s.pct), [100, 108, 110, 110]);
});

test('sans affûtage : la dernière semaine du dernier bloc est la semaine de course', () => {
  const c = coefficientsBlocs([{ nom: 'A', semaines: 2 }, { nom: 'B', semaines: 2 }], [3600, 3600], { ...R, affutage: [] });
  assert.deepEqual(c.map((s) => s.type), ['HAUSSE', 'COUPURE', 'HAUSSE', 'COURSE']);
  assert.deepEqual(c.map((s) => s.pct), [100, 70, 100, 108]);
});

test('début : lundis comptés à rebours depuis la semaine de la course', () => {
  assert.equal(debutDesBlocs('2027-02-21', 10), '2026-12-14'); // course un dimanche (lundi 15/02, 9 semaines avant)
  assert.equal(debutDesBlocs('2027-02-15', 1), '2027-02-15'); // course un lundi, une semaine
});

test('revue 1 : emplacement orphelin ignoré', () => {
  const g = grilleDuBloc({ emplacements: [place('x', 2), place('a', 3, '18:30')] }, [EF]);
  assert.deepEqual(g.map((s) => [s.id, s.jour, s.heure]), [['a', 3, '18:30']]);
});

test('revue 2 : bloc vide ou sans volume signalé', () => {
  const repos = { id: 'r', sport: 'REPOS', titre: 'Repos' };
  assert.deepEqual(blocsVides([{ emplacements: [] }, { emplacements: [place('r', 1)] }, { emplacements: [place('a', 1)] }], [repos, EF], {}), [0, 1]);
});

test('genererPlanBlocs : même séance placée deux fois, noms des blocs, titres S{n}, rien après la course', () => {
  const blocs = [{ nom: 'Endurance', semaines: 2, emplacements: [place('a', 2, '18:00'), place('a', 4)] },
    { nom: 'Spécifique', semaines: 1, emplacements: [place('v', 6), place('a', 7)] }];
  const plan = genererPlanBlocs({ seances: [EF, VELO], blocs, reglages: { ...R, affutage: [70] }, dateCourse: '2027-01-02', objectifId: 'o1' });
  assert.deepEqual(plan.map((s) => s.nomBloc), ['Endurance', 'Endurance', 'Spécifique', 'Course']);
  assert.deepEqual(plan.map((s) => s.lundi), ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
  assert.deepEqual(plan[0].seances.map((s) => [s.date, s.heure, s.titre]), [['2026-12-08', '18:00', 'EF S1'], ['2026-12-10', null, 'EF S1']]);
  // semaine 3 : bloc 2 (grille 3 h) au volume de la dernière hausse du bloc 1 (1 h x 2 x 100 % = 2 h)
  assert.equal(plan[2].volume_s, 7200);
  // semaine de course (affûtage sur la grille du dernier bloc) : rien le dimanche 03/01 ni après le samedi 02/01
  assert.ok(plan[3].seances.every((s) => s.date < '2027-01-02'));
  assert.deepEqual(plan[3].seances.map((s) => s.titre), []);
});

test("non-régression : un bloc unique de la même grille donne le même plan que l'ancien genererPlan", () => {
  const grille = [{ ...FRAC, jour: 2, heure: '18:30' }, { ...EF, jour: 4, heure: null }, { ...VELO, jour: 7, heure: '09:00' }];
  const anciens = { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: null, debut: '2026-11-30', objectifDebut: 'o1' };
  const ancien = genererPlan({ semaineType: grille, reglages: anciens, dateCourse: '2027-02-21', objectifId: 'o1' });
  const emplacements = grille.map((s) => place(s.id, s.jour, s.heure));
  const blocs = [{ nom: 'Bloc 1', semaines: 4, emplacements }, { nom: 'Bloc 2', semaines: 4, emplacements }, { nom: 'Bloc 3', semaines: 2, emplacements }];
  const nouveau = genererPlanBlocs({ seances: grille, blocs, reglages: R, dateCourse: '2027-02-21', objectifId: 'o1' });
  const resume = (plan) => plan.map((s) => [s.lundi, s.pct, s.type, s.seances.map((x) => [x.external_id, x.titre, x.date, x.heure, x.duree_s, JSON.stringify(x.blocs)])]);
  assert.equal(ancien.length, 12);
  assert.deepEqual(resume(nouveau), resume(ancien));
});
