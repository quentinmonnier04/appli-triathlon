// Graphique des blocs d'une séance (F-41, F-84, F-20, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLURES_PAR_DEFAUT, barresSeance } from '../js/logique/graphique-seance.js';

const fractionne = { sport: 'CAP', titre: 'Fractionné', blocs: [
  { type: 'ECHAUFFEMENT', cible: 'PACE', etape: { duree_s: 900, zone: 2 } },
  { type: 'REPETITIONS', cible: 'PACE', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } },
  { type: 'RETOUR_CALME', cible: 'PACE', etape: { duree_s: 600, zone: 1 } }] };

test('allures par défaut', () => {
  assert.deepEqual(ALLURES_PAR_DEFAUT, { CAP: 3, VELO: 8, NATATION: 1, AUTRE: 3 });
});

test("répétitions dépliées, barres dans l'ordre", () => {
  const { barres, total_s } = barresSeance(fractionne);
  assert.equal(barres.length, 12);
  assert.equal(total_s, 3300);
  assert.deepEqual(barres[0], { debut_s: 0, duree_s: 900, zone: 2, estimee: false });
  assert.deepEqual(barres[1], { debut_s: 900, duree_s: 240, zone: 4, estimee: false });
  assert.deepEqual(barres[2], { debut_s: 1140, duree_s: 120, zone: 1, estimee: false });
  assert.deepEqual(barres[11], { debut_s: 2700, duree_s: 600, zone: 1, estimee: false });
});

test('étape en distance : allure seuil, sinon allure par défaut et barre estimée', () => {
  const s = { sport: 'CAP', blocs: [{ type: 'CONTINU', cible: 'PACE', etape: { distance_m: 1000, zone: 3 } }] };
  assert.deepEqual(barresSeance(s, { CAP: 4 }).barres[0], { debut_s: 0, duree_s: 250, zone: 3, estimee: false });
  assert.deepEqual(barresSeance(s).barres[0], { debut_s: 0, duree_s: 333, zone: 3, estimee: true });
});

test('séance simple avec durée : une barre sans zone', () => {
  assert.deepEqual(barresSeance({ sport: 'VELO', duree_s: 3600 }), { barres: [{ debut_s: 0, duree_s: 3600, zone: null, estimee: false }], total_s: 3600 });
  assert.equal(barresSeance({ sport: 'NATATION', distance_m: 2000 }).barres[0].estimee, true);
});

test('séance sans étape', () => {
  assert.deepEqual(barresSeance({ sport: 'CAP', blocs: [] }), { barres: [], total_s: 0 });
  assert.deepEqual(barresSeance({ sport: 'REPOS', titre: 'Repos' }), { barres: [], total_s: 0 });
  assert.deepEqual(barresSeance({ sport: 'CAP', blocs: [{ type: 'CONTINU', cible: 'HR', etape: { duree_s: null, zone: 2 } }] }), { barres: [], total_s: 0 });
});

test('rectangles du graphique : proportion de la durée, hauteur selon la zone', async () => {
  const { rectanglesGraphique } = await import('../js/logique/graphique-seance.js');
  const r = rectanglesGraphique(barresSeance({ sport: 'VELO', blocs: [
    { type: 'ECHAUFFEMENT', cible: 'HR', etape: { duree_s: 600, zone: 2 } },
    { type: 'CONTINU', cible: 'HR', etape: { duree_s: 1800, zone: null } }] }), 300, 80);
  assert.deepEqual(r, [
    { x: 0, largeur: 75, y: 48, hauteur: 32, classe: 'barre-Z2' },
    { x: 75, largeur: 225, y: 68, hauteur: 12, classe: 'barre-sans-zone' },
  ]);
  const estimee = rectanglesGraphique(barresSeance({ sport: 'CAP', blocs: [{ type: 'CONTINU', cible: 'PACE', etape: { distance_m: 3000, zone: 5 } }] }), 300, 40);
  assert.deepEqual(estimee, [{ x: 0, largeur: 300, y: 0, hauteur: 40, classe: 'barre-Z5 barre-estimee' }]);
  assert.deepEqual(rectanglesGraphique({ barres: [], total_s: 0 }, 300, 80), []);
});
