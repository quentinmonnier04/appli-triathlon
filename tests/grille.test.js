// Grille hebdomadaire du planificateur (F-81, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRILLE, dispositionSemaine, heureDepuisPosition } from '../js/logique/grille.js';

const s = (id, jour, heure, duree_s, sport = 'CAP') => ({ id, jour, heure, sport, titre: id, duree_s });
const bloc = (r, id) => {
  const b = r.blocs.find((x) => x.seance.id === id);
  return { jour: b.jour, haut_px: b.haut_px, hauteur_px: b.hauteur_px, colonne: b.colonne, nbColonnes: b.nbColonnes };
};

test('réglages de la grille', () => {
  assert.deepEqual(GRILLE, { heureDebut: 5, heureFin: 23, pxParHeure: 48, hauteurMin: 24 });
});

test('séance placée à son heure, hauteur = durée', () => {
  const r = dispositionSemaine([s('a', 2, '18:30', 3600)]);
  assert.deepEqual(bloc(r, 'a'), { jour: 2, haut_px: 648, hauteur_px: 48, colonne: 0, nbColonnes: 1 });
});

test('bloc coupé en fin de grille', () => {
  const r = dispositionSemaine([s('a', 1, '22:30', 3600)]);
  assert.equal(bloc(r, 'a').haut_px, 840);
  assert.equal(bloc(r, 'a').hauteur_px, 24);
});

test('bloc avant 5 h', () => {
  const r = dispositionSemaine([s('a', 1, '04:30', 3600)]);
  assert.equal(bloc(r, 'a').haut_px, 0);
  assert.equal(bloc(r, 'a').hauteur_px, 24);
});

test('chevauchement partiel : seules les séances qui se chevauchent partagent la colonne', () => {
  const r = dispositionSemaine([s('a', 2, '18:00', 3600), s('b', 2, '18:30', 3600), s('c', 2, '20:00', 3600), s('d', 3, '18:00', 3600)]);
  assert.deepEqual([bloc(r, 'a').colonne, bloc(r, 'a').nbColonnes], [0, 2]);
  assert.deepEqual([bloc(r, 'b').colonne, bloc(r, 'b').nbColonnes], [1, 2]);
  assert.deepEqual([bloc(r, 'c').colonne, bloc(r, 'c').nbColonnes], [0, 1]);
  assert.deepEqual([bloc(r, 'd').colonne, bloc(r, 'd').nbColonnes], [0, 1]);
});

test('chevauchement en chaîne : un groupe de trois', () => {
  const r = dispositionSemaine([s('a', 4, '07:00', 3600), s('b', 4, '07:30', 3600), s('c', 4, '08:15', 1800)]);
  assert.deepEqual([bloc(r, 'a').colonne, bloc(r, 'b').colonne, bloc(r, 'c').colonne], [0, 1, 0]);
  assert.equal(bloc(r, 'c').nbColonnes, 2);
});

test('hauteur minimale, durée inconnue = 1 h, repos et sans heure à part', () => {
  const r = dispositionSemaine([
    s('court', 1, '07:00', 600), s('inconnue', 1, '09:00', null),
    s('libre', 2, null, 3600), { id: 'repos', jour: 3, heure: '12:00', sport: 'REPOS', titre: 'Repos' },
  ]);
  assert.equal(bloc(r, 'court').hauteur_px, 24);
  assert.equal(bloc(r, 'inconnue').hauteur_px, 48);
  assert.deepEqual(r.sansHeure.map((x) => x.id), ['libre', 'repos']);
  assert.equal(r.blocs.length, 2);
});

test('durée des étapes en distance avec les allures', () => {
  const longue = { id: 'v', jour: 7, heure: '08:00', sport: 'VELO', titre: 'v', distance_m: 72000 };
  assert.equal(dispositionSemaine([longue], { VELO: 10 }).blocs[0].hauteur_px, 96); // 2 h
});

test('heure de la case touchée', () => {
  assert.equal(heureDepuisPosition(0), '05:00');
  assert.equal(heureDepuisPosition(650), '18:00');
  assert.equal(heureDepuisPosition(5000), '22:00');
  assert.equal(heureDepuisPosition(-10), '05:00');
});
