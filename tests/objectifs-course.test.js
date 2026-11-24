// Objectifs de course par discipline (F-89, conception 2026-11-24 section 5.6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMATS_COURSE, SEGMENTS_TRIATHLON, lireTempsCourse, tempsDepuisAllure, lireObjectifsSaisis, tempsTotal,
  ENTETE_OBJECTIFS, objectifsVersTexte, texteVersObjectifs, fusionnerDescription,
} from '../js/logique/objectifs-course.js';
import { convertirObjectif, versEvenementObjectif } from '../js/api/objectif.js';

const OBJECTIFS_M = {
  format: 'M',
  segments: {
    NATATION: { distance_m: 1500, temps_s: 1800 }, T1: { temps_s: 150 }, VELO: { distance_m: 40000, temps_s: 4200 },
    T2: { temps_s: 90 }, CAP: { distance_m: 10000, temps_s: 2670 },
  },
};

test('formats et segments', () => {
  assert.deepEqual(FORMATS_COURSE.M, { NATATION: 1500, VELO: 40000, CAP: 10000 });
  assert.deepEqual(FORMATS_COURSE['70.3'], { NATATION: 1900, VELO: 90000, CAP: 21100 });
  assert.deepEqual(FORMATS_COURSE.IRONMAN, { NATATION: 3800, VELO: 180000, CAP: 42200 });
  assert.deepEqual(Object.keys(FORMATS_COURSE), ['XS', 'S', 'M', '70.3', 'IRONMAN']);
  assert.deepEqual(SEGMENTS_TRIATHLON, ['NATATION', 'T1', 'VELO', 'T2', 'CAP']);
});

test('temps saisis : h:mm:ss ou mm:ss', () => {
  assert.equal(lireTempsCourse('1:10:00'), 4200);
  assert.equal(lireTempsCourse('44:30'), 2670);
  assert.equal(lireTempsCourse(' 2:30 '), 150);
  assert.equal(lireTempsCourse('1:75'), null);
  assert.equal(lireTempsCourse('1:60:00'), null);
  assert.equal(lireTempsCourse('abc'), null);
  assert.equal(lireTempsCourse(''), null);
});

test("temps calculé depuis l'allure", () => {
  assert.equal(tempsDepuisAllure('NATATION', 1500, '2:00'), 1800);
  assert.equal(tempsDepuisAllure('CAP', 10000, '4:27'), 2670);
  assert.equal(tempsDepuisAllure('VELO', 40000, '34,3'), Math.round((40 / 34.3) * 3600));
  assert.equal(tempsDepuisAllure('VELO', 40000, '0'), null);
  assert.equal(tempsDepuisAllure('CAP', 10000, '4:75'), null);
  assert.equal(tempsDepuisAllure('CAP', 0, '4:27'), null);
});

test('temps total visé : exemple de la conception, 2:28:30', () => {
  assert.equal(tempsTotal(OBJECTIFS_M, 'ENCHAINEMENT'), 8910);
  assert.equal(tempsTotal({ format: null, segments: { CAP: { distance_m: 10000, temps_s: 2670 } } }, 'CAP'), 2670);
});

test('revue 5 : total absent si une partie manque', () => {
  assert.equal(tempsTotal({ format: 'M', segments: { NATATION: { distance_m: 1500, temps_s: 1800 } } }, 'ENCHAINEMENT'), null);
  assert.equal(tempsTotal(null, 'ENCHAINEMENT'), null);
});

test('lecture du formulaire : temps prioritaire, allure sinon, champ vide = segment absent', () => {
  const { objectifs, erreurs } = lireObjectifsSaisis({
    format: 'M', 'NATATION.distance': '1500', 'NATATION.temps': '', 'NATATION.allure': '2:00', 'T1.temps': '2:30',
    'VELO.distance': '40', 'VELO.temps': '1:10:00', 'VELO.allure': '50', 'T2.temps': '', 'CAP.distance': '10', 'CAP.temps': '44:30',
  }, 'ENCHAINEMENT');
  assert.deepEqual(erreurs, {});
  assert.deepEqual(objectifs, {
    format: 'M',
    segments: { NATATION: { distance_m: 1500, temps_s: 1800 }, T1: { temps_s: 150 }, VELO: { distance_m: 40000, temps_s: 4200 }, CAP: { distance_m: 10000, temps_s: 2670 } },
  });
  // course d'un seul sport : seul ce segment
  const seul = lireObjectifsSaisis({ 'CAP.distance': '21,1', 'CAP.temps': '1:35:00', 'VELO.temps': '1:00:00' }, 'CAP');
  assert.deepEqual(seul.objectifs, { format: null, segments: { CAP: { distance_m: 21100, temps_s: 5700 } } });
  // rien de saisi : pas d'objectifs
  assert.equal(lireObjectifsSaisis({ format: 'M' }, 'ENCHAINEMENT').objectifs, null);
});

test('revue 5 : erreur par champ mal saisi', () => {
  assert.deepEqual(Object.keys(lireObjectifsSaisis({ format: 'M', 'CAP.distance': '10', 'CAP.temps': '4:7' }, 'ENCHAINEMENT').erreurs), ['CAP.temps']);
  assert.deepEqual(Object.keys(lireObjectifsSaisis({ format: 'M', 'CAP.distance': '10', 'CAP.allure': 'vite' }, 'ENCHAINEMENT').erreurs), ['CAP.allure']);
  assert.deepEqual(Object.keys(lireObjectifsSaisis({ format: 'PERSO', 'CAP.distance': 'x', 'CAP.temps': '44:30' }, 'ENCHAINEMENT').erreurs), ['CAP.distance']);
});

test('description de la course : ligne gérée par l\'appli, texte libre conservé', () => {
  const ligne = objectifsVersTexte(OBJECTIFS_M);
  assert.ok(ligne.startsWith(`${ENTETE_OBJECTIFS} {`));
  assert.deepEqual(texteVersObjectifs(`Départ 8 h\n${ligne}`), OBJECTIFS_M);
  assert.equal(texteVersObjectifs('Départ 8 h'), null);
  assert.equal(texteVersObjectifs(`${ENTETE_OBJECTIFS} {illisible`), null);
  assert.equal(fusionnerDescription('Départ 8 h\nVague 2', OBJECTIFS_M), `Départ 8 h\nVague 2\n${ligne}`);
  assert.equal(fusionnerDescription(fusionnerDescription('Départ 8 h', OBJECTIFS_M), null), 'Départ 8 h');
  assert.equal(fusionnerDescription('', OBJECTIFS_M), ligne);
  const autre = { format: 'S', segments: { T1: { temps_s: 60 } } };
  assert.equal(fusionnerDescription(fusionnerDescription('Départ 8 h', OBJECTIFS_M), autre), `Départ 8 h\n${objectifsVersTexte(autre)}`);
});

test('objectif : objectifs dans la description, temps total dans time_target', () => {
  const o = { nom: 'Triathlon M', date: '2027-06-14', sport: 'ENCHAINEMENT', objectifs: OBJECTIFS_M, descriptionBrute: 'Départ 8 h' };
  const corps = versEvenementObjectif(o);
  assert.equal(corps.description, `Départ 8 h\n${objectifsVersTexte(OBJECTIFS_M)}`);
  assert.equal(corps.time_target, 8910);
  const lu = convertirObjectif({ id: 55, ...corps });
  assert.deepEqual(lu.objectifs, OBJECTIFS_M);
  assert.equal(lu.descriptionBrute, corps.description);
  const sans = versEvenementObjectif({ ...o, objectifs: null, descriptionBrute: '' });
  assert.equal(sans.description, '');
  assert.equal('time_target' in sans, false);
});
