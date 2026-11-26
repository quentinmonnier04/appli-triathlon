// Analyse d'une activité (lot LA, F-100 à F-103, ENF-24) : données inventées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reduirePoints, indiceProche, graduations, etendue, cheminSerie, formaterIntensite, valeursFacultatives,
  filtrerIntervalles, moyenneIntervalles, zonesDetaillees, classeZone,
} from '../js/logique/analyse.js';

const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('réduction : garde les pics (un sprint d\'un seul point) et le début et la fin', () => {
  const xs = serie(3600, (i) => i);
  const ys = serie(3600, (i) => 200 + (i % 7)); // puissance stable
  ys[1234] = 1100; // sprint d'une seconde
  ys[2500] = 0; // arrêt d'une seconde
  const garde = reduirePoints(xs, ys, 300);
  assert.ok(garde.length <= 2 * 300 + 2, `trop de points : ${garde.length}`);
  assert.ok(garde.includes(1234), 'le sprint doit rester');
  assert.ok(garde.includes(2500), 'le creux doit rester');
  assert.equal(garde[0], 0);
  assert.equal(garde.at(-1), 3599);
  assert.deepEqual([...garde].sort((a, b) => a - b), garde);
});

test('réduction : série courte gardée entière, trous conservés comme coupures', () => {
  assert.deepEqual(reduirePoints([0, 1, 2], [5, 6, 7], 10), [0, 1, 2]);
  const xs = serie(1000, (i) => i);
  const ys = serie(1000, (i) => (i >= 400 && i < 450 ? null : 150));
  const garde = reduirePoints(xs, ys, 50);
  assert.ok(garde.some((i) => ys[i] === null), 'le trou doit couper le trait');
});

test('indice le plus proche et étendue', () => {
  assert.equal(indiceProche([0, 10, 20, 30], 14), 1);
  assert.equal(indiceProche([0, 10, 20, 30], 16), 2);
  assert.equal(indiceProche([0, 10, 20, 30], 99), 3);
  assert.equal(indiceProche([], 3), -1);
  assert.deepEqual(etendue([null, 3, 9, undefined, 1]), { min: 1, max: 9 });
  assert.equal(etendue([null, null]), null);
});

test('graduations rondes', () => {
  const g = graduations(83, 412, 3);
  assert.equal(g.pas, 200);
  assert.deepEqual(g.valeurs, [0, 200, 400, 600]);
  const h = graduations(120, 175, 3);
  assert.ok(h.min <= 120 && h.max >= 175);
  assert.deepEqual(graduations(5, 5, 2).valeurs.length > 1, true);
});

test('chemin SVG : un trou lève le crayon', () => {
  const d = cheminSerie([0, 1, 2, 3], [1, null, 3, 4], [0, 1, 2, 3], (x) => x * 10, (y) => 100 - y);
  assert.equal(d, 'M0,99M20,97L30,96');
});

test('intensité en pourcentage, que la valeur soit une fraction ou un pourcentage', () => {
  assert.equal(formaterIntensite(0.853), '85 %');
  assert.equal(formaterIntensite(85.3), '85 %');
  assert.equal(formaterIntensite(null), null);
  assert.equal(formaterIntensite(0), null);
});

test('résumé : seules les valeurs présentes et non nulles', () => {
  const lignes = valeursFacultatives({ np_w: 231, puissance_moy_w: 205, variabilite: 1.127, fc_moy: 0, fc_max: null, cadence_moy: 88, travail_j: 738000, calories: undefined });
  assert.deepEqual(lignes.map((l) => l.etiquette), ['Puissance normalisée', 'Puissance moy.', 'Variabilité', 'Cadence moy.', 'Travail']);
  assert.equal(lignes.find((l) => l.etiquette === 'Variabilité').valeur, '1,13');
  assert.equal(lignes.find((l) => l.etiquette === 'Travail').valeur, '738 kJ');
  assert.deepEqual(valeursFacultatives({}), []);
});

test('intervalles : filtre et ligne de moyenne pondérée par la durée', () => {
  const liste = [
    { type: 'WORK', duree_s: 300, distance_m: 2000, puissance_moy_w: 300, fc_moy: 160, fc_max: 172 },
    { type: 'RECOVERY', duree_s: 120, distance_m: 500, puissance_moy_w: 120, fc_moy: 130, fc_max: 150 },
    { type: 'WORK', duree_s: 100, distance_m: 600, puissance_moy_w: 340, fc_moy: null, fc_max: 175 },
  ];
  assert.deepEqual(filtrerIntervalles(liste, 'travail').map((i) => i.n), [0, 2]);
  assert.deepEqual(filtrerIntervalles(liste, 'recup').map((i) => i.n), [1]);
  assert.equal(filtrerIntervalles(liste, 'tout').length, 3);
  const m = moyenneIntervalles(filtrerIntervalles(liste, 'travail'));
  assert.equal(m.duree_s, 400);
  assert.equal(m.distance_m, 2600);
  assert.equal(m.puissance_moy_w, 310);
  assert.equal(m.fc_moy, 160); // valeur absente ignorée
  assert.equal(m.fc_max, 175);
  assert.equal(moyenneIntervalles([]), null);
});

test('zones : noms et bornes d\'Intervals.icu, pourcentages, zones vides de fin retirées', () => {
  const z = zonesDetaillees([600, 1200, 300, 0, 0], [{ nom: 'Récup', texte: '< 55 %' }, { nom: 'Endurance', texte: '55 à 75 %' }]);
  assert.deepEqual(z.map((l) => [l.numero, l.nom, l.pct]), [[1, 'Récup', 29], [2, 'Endurance', 57], [3, 'Z3', 14]]);
  assert.equal(z[1].duree, '20:00');
  assert.deepEqual(zonesDetaillees([{ id: 'Z1', secs: 60 }, { id: 'SS', secs: 30 }]).map((l) => l.nom), ['Z1']);
  assert.deepEqual(zonesDetaillees(null), []);
  assert.equal(classeZone(7), 'zone-c6');
  assert.equal(classeZone(2), 'zone-c2');
});

// Données reçues d'Intervals.icu (réponses simulées) -> objets internes.
import { convertirActivite, convertirIntervalle, convertirFlux, fluxADemander } from '../js/api/activites.js';

test('activité enrichie (F-100) et intervalle enrichi (F-102)', () => {
  const a = convertirActivite({
    id: 'i9', type: 'Ride', start_date_local: '2026-11-20T07:30:00', icu_intensity: 0.82, icu_weighted_avg_watts: 231,
    icu_variability_index: 1.08, average_cadence: 88, icu_joules: 738000, calories: 812, stream_types: ['time', 'watts', 'latlng'],
  });
  assert.equal(a.intensite, 0.82);
  assert.equal(a.np_w, 231);
  assert.equal(a.travail_j, 738000);
  assert.deepEqual(a.flux, ['time', 'watts', 'latlng']);
  const i = convertirIntervalle({ type: 'WORK', moving_time: 300, average_cadence: 92, average_speed: 10.5, average_gradient: 4.2, intensity: 105, zone: 5, start_index: 600, end_index: 900 });
  assert.deepEqual([i.cadence_moy, i.vitesse_ms, i.pente_pct, i.intensite, i.zone, i.debut_i, i.fin_i], [92, 10.5, 4.2, 105, 5, 600, 900]);
});

test('flux : seulement ceux que l\'activité annonce et que les graphiques lisent ; valeurs non numériques en trous', () => {
  assert.deepEqual(fluxADemander(['latlng', 'time', 'watts', 'temp', 'heartrate']), ['time', 'watts', 'heartrate']);
  assert.deepEqual(fluxADemander(undefined), []);
  const f = convertirFlux([
    { type: 'time', data: [0, 1, 2] },
    { type: 'watts', data: [200, null, 'x'] },
    { type: 'latlng', data: [[1, 2]] },
    { type: 'heartrate', data: [1, 2], allNull: true },
  ]);
  assert.deepEqual(f, { time: [0, 1, 2], watts: [200, null, null] });
});

// D-33 : altitude avec une pause, meilleurs efforts.
import { cheminAire, effortsAChercher, libelleEffort } from '../js/logique/analyse.js';
import { convertirEffort } from '../js/api/activites.js';

test('aire : une pause donne deux aires fermées vers le bas, sans relier les morceaux', () => {
  const d = cheminAire([0, 1, 2, 3, 4, 5], [10, 12, null, null, 11, 13], [0, 1, 2, 3, 4, 5], (x) => x * 10, (y) => 50 - y, 50);
  assert.equal(d, 'M0,50L0,40L10,38L10,50ZM40,50L40,39L50,37L50,50Z');
  assert.equal(cheminAire([0, 1], [null, 5], [0, 1], (x) => x, (y) => y, 9), ''); // un seul point : rien
});

test('efforts cherchés selon le sport et la longueur de la séance', () => {
  const velo = effortsAChercher({ sport: 'VELO', duree_s: 2400, flux: ['time', 'watts'] });
  assert.deepEqual(velo.map((r) => r.duree), [1, 5, 15, 30, 60, 300, 600, 1200]);
  assert.ok(velo.every((r) => r.stream === 'watts'));
  // D-34 : les distances ne passent plus par best-efforts (courbe d'allure de la séance).
  assert.deepEqual(effortsAChercher({ sport: 'CAP', duree_s: 3000, distance_m: 10500, flux: ['velocity_smooth'] }), []);
  assert.deepEqual(effortsAChercher({ sport: 'RENFO', flux: ['heartrate'] }), []);
  assert.equal(effortsAChercher({ sport: 'CAP', duree_s: 600, distance_m: 2000, flux: ['watts', 'velocity_smooth'] }).filter((r) => r.duree).length, 7); // 1 s à 10 min
});

test('libellés des efforts', () => {
  assert.deepEqual([1, 30, 300, 3600].map((duree) => libelleEffort({ duree })), ['1 s', '30 s', '5 min', '1 h']);
  assert.deepEqual([400, 1000, 21097].map((distance) => libelleEffort({ distance })), ['400 m', '1 km', 'Semi']);
});

test('effort reçu (réponse simulée) -> objet interne ; réponse vide ignorée', () => {
  const e = convertirEffort({ cle: 'w300', duree: 300 }, { efforts: [{ start_index: 610, end_index: 910, average: 318.4, duration: 300, distance: 3400 }] });
  assert.deepEqual(e, { cle: 'w300', duree: 300, distance: null, moyenne: 318.4, duree_s: 300, distance_m: 3400, debut_i: 610, fin_i: 910 });
  assert.equal(convertirEffort({ cle: 'd1000', distance: 1000 }, { efforts: [] }), null);
  assert.equal(convertirEffort({ cle: 'd1000', distance: 1000 }, null), null);
});

import { indicesApresPause, couperAuxPauses } from '../js/logique/analyse.js';
test('pauses : le trait est coupé quand le temps saute', () => {
  const temps = [0, 1, 2, 300, 301, 302, 303, 700];
  assert.deepEqual(indicesApresPause(temps), [3, 7]);
  assert.deepEqual(indicesApresPause([0, 5, 10, 20]), []); // enregistrement toutes les 5 ou 10 s : pas une pause
  const ys = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(couperAuxPauses(ys, [3, 7]), [1, 2, 3, null, 5, 6, 7, null]);
  assert.equal(couperAuxPauses(ys, []), ys);
  assert.equal(ys[3], 4); // série d'origine intacte
});
