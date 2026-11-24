// Tests des types de séance de la banque Mes séances (D-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  libelleType, typeVersEtiquette, typeDepuisEtiquettes, typesProposes, rangerSeances, SANS_TYPE,
} from '../js/logique/types-seance.js';
import { versSeanceBibliotheque, convertirSeanceBibliotheque } from '../js/api/preparation.js';

test('libelleType : type fixe reconnu sans casse ni accents, type libre nettoyé', () => {
  assert.equal(libelleType('fractionne'), 'Fractionné');
  assert.equal(libelleType('  SORTIE   longue '), 'Sortie longue');
  assert.equal(libelleType('côtes'), 'Côtes');
  assert.equal(libelleType('   '), null);
  assert.equal(libelleType('x'.repeat(50)).length, 30);
});

test('étiquette Intervals.icu : code pour un type fixe, texte pour un type libre, aller-retour', () => {
  assert.equal(typeVersEtiquette('Fractionné'), 'type-fractionne');
  assert.equal(typeVersEtiquette('Sortie longue'), 'type-sortie-longue');
  assert.equal(typeVersEtiquette('Côtes'), 'type-Côtes');
  assert.equal(typeVersEtiquette(''), null);
  assert.equal(typeDepuisEtiquettes(['semaine-type', 'type-fractionne']), 'Fractionné');
  assert.equal(typeDepuisEtiquettes(['semaine-type', 'type-sortie-longue']), 'Sortie longue');
  assert.equal(typeDepuisEtiquettes(['type-Côtes']), 'Côtes');
  assert.equal(typeDepuisEtiquettes(['type-côtes']), 'Côtes'); // étiquette mise en minuscules : relue proprement
  assert.equal(typeDepuisEtiquettes(['semaine-type', 'type-']), null);
  assert.equal(typeDepuisEtiquettes(undefined), null);
});

test('typesProposes : liste fixe du sport puis types libres déjà utilisés', () => {
  const seances = [{ sport: 'CAP', type_seance: 'Côtes' }, { sport: 'CAP', type_seance: 'Seuil' }, { sport: 'VELO', type_seance: 'Home trainer' }];
  assert.deepEqual(typesProposes('CAP', seances), ['Endurance', 'Seuil', 'Fractionné', 'Sortie longue', 'Récupération', 'Enchaînement', 'Côtes']);
  assert.deepEqual(typesProposes('RENFO'), ['Gainage', 'Force']);
  assert.deepEqual(typesProposes('REPOS'), []);
});

test('rangerSeances : par sport (ordre 9.3) puis par type, sans type à la fin, filtre', () => {
  const s = [
    { id: '1', sport: 'CAP', titre: 'VMA', type_seance: 'Fractionné' },
    { id: '2', sport: 'CAP', titre: 'Footing', type_seance: 'Endurance' },
    { id: '3', sport: 'CAP', titre: 'Divers', type_seance: null },
    { id: '4', sport: 'CAP', titre: 'Côtes 10x', type_seance: 'Côtes' },
    { id: '5', sport: 'VELO', titre: 'Z2', type_seance: 'Endurance' },
    { id: '6', sport: 'CAP', titre: 'Allure', type_seance: 'Endurance' },
  ];
  const r = rangerSeances(s);
  assert.deepEqual(r.map((g) => g.sport), ['VELO', 'CAP']);
  const cap = r[1];
  assert.equal(cap.nb, 5);
  assert.deepEqual(cap.groupes.map((g) => g.type), ['Endurance', 'Fractionné', 'Côtes', SANS_TYPE]);
  assert.deepEqual(cap.groupes[0].seances.map((x) => x.titre), ['Allure', 'Footing']);
  assert.deepEqual(rangerSeances(s, 'VELO').map((g) => g.sport), ['VELO']);
  assert.deepEqual(rangerSeances(s, 'RENFO'), []);
});

test('séance de bibliothèque : le type part dans les étiquettes et revient à la lecture', () => {
  const w = versSeanceBibliotheque({ sport: 'CAP', titre: 'VMA', duree_s: 3000, type_seance: 'Fractionné' }, 42);
  assert.deepEqual(w.tags, ['semaine-type', 'type-fractionne']);
  assert.equal(convertirSeanceBibliotheque({ id: 9, ...w }).type_seance, 'Fractionné');
  const sans = versSeanceBibliotheque({ sport: 'CAP', titre: 'VMA', duree_s: 3000 }, 42);
  assert.deepEqual(sans.tags, ['semaine-type']);
  assert.equal('type_seance' in convertirSeanceBibliotheque({ id: 9, ...sans }), false);
  assert.deepEqual(versSeanceBibliotheque({ sport: 'REPOS', titre: 'Repos', type_seance: 'Seuil' }, 42).tags, ['semaine-type', 'repos']);
});
