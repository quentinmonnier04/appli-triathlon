// Profil : totaux, seuils et zones (F-51 à F-54, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totauxAnnee, totauxParSport, reglagesTries, allureDepuisVitesse, seuilsAffichables,
  zonesPuissance, zonesFc, zonesAllure, zonesDuSport,
} from '../js/logique/profil.js';
import { convertirReglagesSport } from '../js/api/profil.js';
import { formaterKm } from '../js/logique/format.js';

const a = (date, sport, duree_s, distance_m) => ({ id: date + sport + duree_s, date, sport, duree_s, distance_m });
const activites = [
  a('2026-11-20', 'VELO', 7200, 60000), a('2026-11-20', 'CAP', 1800, 5000), a('2026-11-18', 'CAP', 3600, 10000),
  a('2026-03-02', 'NATATION', 2700, 2000), a('2026-02-01', 'RENFO', null, null),
];

test('totaux depuis le début de l\'année : activités, distance, durée, jours actifs (F-51)', () => {
  assert.deepEqual(totauxAnnee(activites), { nombre: 5, distance_m: 77000, duree_s: 15300, jours_actifs: 4 });
  assert.deepEqual(totauxAnnee([]), { nombre: 0, distance_m: 0, duree_s: 0, jours_actifs: 0 });
});

test('totaux par sport, triés par durée, avec la part de la durée totale (F-52)', () => {
  const t = totauxParSport(activites);
  assert.deepEqual(t.map((l) => l.sport), ['VELO', 'CAP', 'NATATION', 'RENFO']);
  assert.deepEqual(t[1], { sport: 'CAP', nombre: 2, duree_s: 5400, distance_m: 15000, pct: 35 });
  assert.equal(t[0].pct, 47);
  assert.equal(t[3].pct, 0);
  assert.deepEqual(totauxParSport([]), []);
});

test('distance totale en km entiers', () => {
  assert.equal(formaterKm(2345678), '2 346 km');
  assert.equal(formaterKm(0), '0 km');
});

test('SportSettings -> réglages internes (F-53, F-54)', () => {
  const r = convertirReglagesSport({
    types: ['Ride', 'VirtualRide'], ftp: 250, lthr: 165, max_hr: 185, threshold_pace: null,
    power_zones: [55, 75, 90, 105, 120, 150, 999], power_zone_names: ['Récup'], hr_zones: [130, 150, 160, 170, 185],
  });
  assert.equal(r.sport, 'VELO');
  assert.equal(r.ftp_w, 250);
  assert.equal(r.fc_seuil, 165);
  assert.equal(r.allure_seuil_ms, null);
  assert.equal(r.zones_allure, null);
  assert.equal(convertirReglagesSport({}).sport, 'AUTRE');
});

test('réglages : un seul par sport, dans l\'ordre de 9.3', () => {
  const r = reglagesTries([{ sport: 'AUTRE', n: 1 }, { sport: 'CAP', n: 2 }, { sport: 'NATATION', n: 3 }, { sport: 'CAP', n: 4 }]);
  assert.deepEqual(r.map((x) => x.n), [3, 2, 1]);
});

test('allure depuis une vitesse en m/s : min/km, min/100 m en natation', () => {
  assert.equal(allureDepuisVitesse(1000 / 255, 'CAP'), '4:15 /km');
  assert.equal(allureDepuisVitesse(100 / 105, 'NATATION'), '1:45 /100 m');
  assert.equal(allureDepuisVitesse(0, 'CAP'), null);
});

test('seuils affichables : seuls les seuils renseignés ; CSS en natation (F-53)', () => {
  assert.deepEqual(seuilsAffichables({ sport: 'VELO', ftp_w: 250, fc_seuil: 165, fc_max: null, allure_seuil_ms: null }), [
    { etiquette: 'FTP', valeur: '250 W' }, { etiquette: 'FC seuil', valeur: '165 bpm' },
  ]);
  assert.deepEqual(seuilsAffichables({ sport: 'NATATION', ftp_w: 0, allure_seuil_ms: 100 / 105 }), [{ etiquette: 'CSS', valeur: '1:45 /100 m' }]);
  assert.deepEqual(seuilsAffichables({ sport: 'CAP', allure_seuil_ms: 1000 / 255 }), [{ etiquette: 'Allure seuil', valeur: '4:15 /km' }]);
});

test('zones de puissance en watts depuis les % de FTP ; dernière zone ouverte (F-54)', () => {
  const z = zonesPuissance(200, [55, 75, 999], ['Récup', null]);
  assert.deepEqual(z, [
    { nom: 'Récup', texte: "jusqu'à 110 W" }, { nom: 'Z2', texte: '110-150 W' }, { nom: 'Z3', texte: 'plus de 150 W' },
  ]);
  assert.deepEqual(zonesPuissance(null, [55]), []);
});

test('zones de FC depuis les bornes hautes en bpm (F-54)', () => {
  assert.deepEqual(zonesFc([130, 150, 185]), [
    { nom: 'Z1', texte: "jusqu'à 130 bpm" }, { nom: 'Z2', texte: '131-150 bpm' }, { nom: 'Z3', texte: '151-185 bpm' },
  ]);
  assert.deepEqual(zonesFc(null), []);
});

test('zones d\'allure depuis les % de la vitesse au seuil (F-54)', () => {
  // Seuil 4:00 /km : 80 % -> 5:00 /km, 100 % -> 4:00 /km
  const z = zonesAllure(1000 / 240, [80, 100, 999], null, 'CAP');
  assert.deepEqual(z, [
    { nom: 'Z1', texte: 'plus lent que 5:00 /km' }, { nom: 'Z2', texte: '5:00 /km à 4:00 /km' }, { nom: 'Z3', texte: 'plus rapide que 4:00 /km' },
  ]);
});

test('zones d\'un sport : seules les familles renseignées', () => {
  const f = zonesDuSport({ sport: 'CAP', ftp_w: null, zones_puissance: [55], zones_fc: [150, 170], allure_seuil_ms: 4, zones_allure: [90, 999] });
  assert.deepEqual(f.map((x) => x.titre), ['Fréquence cardiaque', 'Allure']);
});

// F-124 : modifier ses seuils et ses zones.
import { allureSaisieDepuisVitesse, champsSeuils, lireSeuilsSaisis } from '../js/logique/profil.js';
test('seuils : préremplissage et lecture de la saisie', () => {
  assert.equal(allureSaisieDepuisVitesse(1000 / 270, 'CAP'), '4:30');
  assert.equal(allureSaisieDepuisVitesse(100 / 105, 'NATATION'), '1:45');
  assert.equal(allureSaisieDepuisVitesse(null, 'CAP'), '');
  const c = champsSeuils({ sport: 'VELO', ftp_w: 250, fc_seuil: 165, fc_max: 185, allure_seuil_ms: null, zones_puissance: [55, 75, 90], zones_fc: null, zones_allure: null });
  assert.deepEqual(c, { ftp: '250', fc_seuil: '165', fc_max: '185', allure: '', zones_puissance: '55, 75, 90', zones_fc: '', zones_allure: '' });
  const ok = lireSeuilsSaisis({ ftp: '260', fc_seuil: '', allure: '4:30', zones_puissance: '55, 75, 90, 105' }, 'CAP');
  assert.deepEqual(ok.erreurs, {});
  assert.deepEqual(ok.corps, { ftp: 260, threshold_pace: 3.7037, power_zones: [55, 75, 90, 105] });
  assert.equal(lireSeuilsSaisis({ allure: '1:45' }, 'NATATION').corps.threshold_pace, 0.9524);
  const ko = lireSeuilsSaisis({ ftp: '12', fc_seuil: '190', fc_max: '180', allure: '4h', zones_fc: '150, 140' }, 'CAP');
  assert.deepEqual(Object.keys(ko.erreurs).sort(), ['allure', 'fc_seuil', 'ftp', 'zones_fc']);
});
