// Préparation par blocs (F-83, F-84, F-88, ENF-24) : calcul du plan, édition des blocs, migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coefficientsBlocs, debutDesBlocs, grilleDuBloc, blocsVides, genererPlanBlocs,
  ajouterBloc, dupliquerBloc, supprimerBloc, modifierBloc, ajouterEmplacement, modifierEmplacement, retirerEmplacement,
  retirerSeanceDesBlocs, utilisationsSeance, validerBlocs, migrerAncienFormat,
} from '../js/logique/blocs.js';
import { genererPlan, REGLAGES_ANCIENS_PAR_DEFAUT, lundiSuivant } from '../js/logique/plan.js';

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
  assert.deepEqual(g.map((s) => [s.id, s.jour, s.heure, s.emplacement]), [['a', 3, '18:30', 1]]);
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
  assert.equal(plan[0].seances.some((s) => 'emplacement' in s || 'id' in s || 'jour' in s), false); // champs de la grille retirés
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

// --- Édition des blocs (F-88) ---

const deuxBlocs = () => [
  { nom: 'Endurance', semaines: 4, emplacements: [place('a', 1), place('v', 6, '09:00')] },
  { nom: 'Spécifique', semaines: 3, emplacements: [place('a', 2), place('a', 4, '18:30')] },
];

test("édition des blocs : ajouter, dupliquer, supprimer, modifier, sans toucher à l'entrée", () => {
  const avant = deuxBlocs();
  const copie = structuredClone(avant);
  assert.deepEqual(ajouterBloc(avant, 'Affûtage long').at(-1), { nom: 'Affûtage long', semaines: 4, emplacements: [] });
  const d = dupliquerBloc(avant, 0);
  assert.deepEqual(d.map((b) => b.nom), ['Endurance', 'Endurance (copie)', 'Spécifique']);
  assert.deepEqual(d[1].emplacements, avant[0].emplacements);
  assert.notEqual(d[1].emplacements, avant[0].emplacements); // copie, pas la même liste
  assert.equal('coupure' in dupliquerBloc([{ ...avant[0], coupure: true }], 0)[1], false);
  assert.deepEqual(supprimerBloc(avant, 0).map((b) => b.nom), ['Spécifique']);
  assert.deepEqual(modifierBloc(avant, 1, { nom: 'Seuil', semaines: 5 })[1], { ...avant[1], nom: 'Seuil', semaines: 5 });
  assert.deepEqual(avant, copie);
});

test('édition des emplacements', () => {
  const avant = deuxBlocs();
  const copie = structuredClone(avant);
  assert.deepEqual(ajouterEmplacement(avant, 1, place('v', 6, '08:00'))[1].emplacements.at(-1), place('v', 6, '08:00'));
  assert.deepEqual(modifierEmplacement(avant, 1, 1, { jour: 5, heure: null })[1].emplacements[1], place('a', 5, null));
  assert.deepEqual(retirerEmplacement(avant, 0, 0)[0].emplacements, [place('v', 6, '09:00')]);
  assert.deepEqual(avant, copie);
});

test("revue 1 : retirer une séance de tous les blocs, compter les blocs qui l'utilisent", () => {
  const blocs = deuxBlocs();
  assert.equal(utilisationsSeance(blocs, 'a'), 2); // deux fois dans le bloc 2 = un bloc
  assert.equal(utilisationsSeance(blocs, 'v'), 1);
  assert.equal(utilisationsSeance(blocs, 'x'), 0);
  const sans = retirerSeanceDesBlocs(blocs, 'a');
  assert.deepEqual(sans.map((b) => b.emplacements), [[place('v', 6, '09:00')], []]);
  assert.equal(utilisationsSeance(blocs, 'a'), 2);
});

test('validation des blocs', () => {
  assert.deepEqual(validerBlocs(deuxBlocs()), {});
  assert.deepEqual(validerBlocs([]), { blocs: 'Ajoute au moins un bloc.' });
  const e = validerBlocs([{ nom: ' ', semaines: 0, emplacements: [] }, { nom: 'x'.repeat(41), semaines: 21, emplacements: [] }]);
  assert.deepEqual(Object.keys(e).sort(), ['blocs.0.nom', 'blocs.0.semaines', 'blocs.1.nom', 'blocs.1.semaines']);
  assert.ok(validerBlocs([{ nom: 'A', semaines: 2.5, emplacements: [] }])['blocs.0.semaines']);
  assert.ok(validerBlocs([{ nom: 'A', semaines: 2, emplacements: [place('a', 8)] }])['blocs.0.emplacements']);
  assert.ok(validerBlocs([{ nom: 'A', semaines: 2, emplacements: [place('a', 1, '25:00')] }])['blocs.0.emplacements']);
});

// --- Migration de la semaine type (F-88, conception 5.8) : le plan en cours ne change pas ---

const ANCIENNE = [{ ...FRAC, jour: 2, heure: '18:30' }, { ...EF, jour: 4, heure: null }, { ...VELO, jour: 7, heure: '09:00' }];
const AUJ = '2026-11-24';
const resume = (plan) => plan.map((s) => [s.lundi, s.pct, s.type, s.seances.map((x) => [x.external_id, x.titre, x.date, x.heure, x.duree_s, JSON.stringify(x.blocs)])]);

function comparer(reglagesAnciens, objectif) {
  const anciens = { ...REGLAGES_ANCIENS_PAR_DEFAUT, ...reglagesAnciens };
  const debut = anciens.debut && anciens.objectifDebut === objectif.id ? anciens.debut : lundiSuivant(AUJ);
  const ancien = genererPlan({ semaineType: ANCIENNE, reglages: { ...anciens, debut }, dateCourse: objectif.date, objectifId: objectif.id });
  const m = migrerAncienFormat({ seances: ANCIENNE, reglagesAnciens: anciens, objectif, aujourdhui: AUJ });
  const nouveau = genererPlanBlocs({ seances: ANCIENNE, blocs: m.blocs, reglages: m.reglages, dateCourse: objectif.date, objectifId: objectif.id });
  assert.deepEqual(resume(nouveau), resume(ancien));
  return m;
}

test('migration : cycle incomplet en fin (12 semaines, blocs 4, 4, 2)', () => {
  const m = comparer({}, { id: 'o1', date: '2027-02-21' }); // du 30/11 au 15/02 : 12 semaines
  assert.deepEqual(m.blocs.map((b) => [b.nom, b.semaines, b.coupure]), [['Bloc 1', 4, undefined], ['Bloc 2', 4, undefined], ['Bloc 3', 2, undefined]]);
  assert.deepEqual(m.reglages, { hausse: 8, coupure: 70, affutage: [70, 50], plafond_h: null });
  assert.deepEqual(m.blocs[0].emplacements, [{ seanceId: 'f', jour: 2, heure: '18:30' }, { seanceId: 'a', jour: 4, heure: null }, { seanceId: 'v', jour: 7, heure: '09:00' }]);
});

test('migration : cycle complet en fin (10 semaines, blocs 4, 4 avec coupure forcée)', () => {
  const m = comparer({}, { id: 'o1', date: '2027-02-07' });
  assert.deepEqual(m.blocs.map((b) => [b.semaines, b.coupure]), [[4, undefined], [4, true]]);
});

test("migration : date de début enregistrée pour cet objectif, ou pour un autre", () => {
  comparer({ debut: '2026-12-14', objectifDebut: 'o1' }, { id: 'o1', date: '2027-03-14' });
  comparer({ debut: '2026-12-14', objectifDebut: 'autre' }, { id: 'o1', date: '2027-03-14' });
});

test('migration : plafond et autres réglages repris', () => {
  const m = comparer({ hausse: 10, semainesHausse: 2, coupure: 60, affutage: [80, 60, 40], plafond_h: 4.5 }, { id: 'o1', date: '2027-03-28' });
  assert.deepEqual(m.reglages, { hausse: 10, coupure: 60, affutage: [80, 60, 40], plafond_h: 4.5 });
});

test('migration sans objectif : un bloc de semainesHausse + 1 semaines', () => {
  const m = migrerAncienFormat({ seances: ANCIENNE, reglagesAnciens: REGLAGES_ANCIENS_PAR_DEFAUT, objectif: null, aujourdhui: AUJ });
  assert.deepEqual(m.blocs.map((b) => [b.nom, b.semaines]), [['Bloc 1', 4]]);
});

test("migration : plan plus court que l'affûtage, la semaine de course à venir reste identique", () => {
  // course la semaine prochaine : l'ancien plan n'a qu'une semaine (affûtage 50 %) ; le nouveau commence dans le
  // passé (bloc d'une semaine + affûtage complet), seules les semaines à venir sont envoyées : la dernière est la même.
  const objectif = { id: 'o1', date: '2026-12-05' };
  const ancien = genererPlan({ semaineType: ANCIENNE, reglages: { ...REGLAGES_ANCIENS_PAR_DEFAUT, debut: lundiSuivant(AUJ) }, dateCourse: objectif.date, objectifId: 'o1' });
  const m = migrerAncienFormat({ seances: ANCIENNE, reglagesAnciens: REGLAGES_ANCIENS_PAR_DEFAUT, objectif, aujourdhui: AUJ });
  assert.deepEqual(m.blocs.map((b) => b.semaines), [1]);
  const nouveau = genererPlanBlocs({ seances: ANCIENNE, blocs: m.blocs, reglages: m.reglages, dateCourse: objectif.date, objectifId: 'o1' });
  assert.deepEqual(resume(nouveau.slice(-1)).map((x) => x.slice(0, 2)), resume(ancien).map((x) => x.slice(0, 2)));
});
