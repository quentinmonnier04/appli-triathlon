// Semaine type dans la bibliothèque Intervals.icu et envoi du plan (F-81, F-85, F-86, F-87, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOM_DOSSIER, reglagesVersTexte, texteVersReglages, versSeanceBibliotheque, convertirSeanceType,
} from '../js/api/semaine-type.js';
import { seancesASupprimer, versEvenementPlan, TAILLE_LOT, etiquettesConservees } from '../js/api/plan.js';
import { estModeleAffichable } from '../js/api/bibliotheque.js';
import { REGLAGES_PAR_DEFAUT } from '../js/logique/plan.js';

test('réglages <-> texte lisible de la description du dossier', () => {
  const r = { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: 8, debut: '2026-11-30', objectifDebut: null };
  const texte = reglagesVersTexte(r);
  assert.equal(texte, "Réglages du plan (gérés par l'appli) : hausse 8 ; semaines 3 ; coupure 70 ; affûtage 70/50 ; plafond 8 h ; début 2026-11-30");
  assert.deepEqual(texteVersReglages(texte), r);
  const sans = { ...r, plafond_h: null, affutage: [], debut: null };
  assert.deepEqual(texteVersReglages(reglagesVersTexte(sans)), sans);
  assert.deepEqual(texteVersReglages(reglagesVersTexte({ ...r, plafond_h: 7.5 })).plafond_h, 7.5);
  assert.deepEqual(texteVersReglages('texte modifié à la main'), REGLAGES_PAR_DEFAUT);
  assert.deepEqual(texteVersReglages(null), REGLAGES_PAR_DEFAUT);
});

const structuree = { jour: 2, sport: 'CAP', titre: 'Fractionné', duree_s: null, distance_m: null, description: null, blocs: [
  { type: 'ECHAUFFEMENT', cible: 'PACE', etape: { duree_s: 900, zone: 2 } },
  { type: 'REPETITIONS', cible: 'PACE', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } }] };

test('séance type structurée -> séance de bibliothèque et retour', () => {
  const w = versSeanceBibliotheque(structuree, 42);
  assert.deepEqual(w, {
    name: 'Fractionné', type: 'Run', folder_id: 42, tags: ['semaine-type', 'jour-2'],
    description: 'Échauffement\n- 15m Z2 Pace\n\nSérie 5x\n- 4m Z4 Pace\n- Récup 2m Z1 Pace',
  });
  assert.deepEqual(convertirSeanceType({ id: 7, ...w }), { id: '7', ...structuree });
});

test('séance type simple et repos -> bibliothèque et retour', () => {
  const simple = { jour: 7, sport: 'VELO', titre: 'Sortie longue', duree_s: 7200, distance_m: 60000, description: 'Tranquille', blocs: null };
  const w = versSeanceBibliotheque(simple, 42);
  assert.deepEqual(w, { name: 'Sortie longue', type: 'Ride', folder_id: 42, tags: ['semaine-type', 'jour-7'], description: 'Tranquille', moving_time: 7200, distance: 60000 });
  assert.deepEqual(convertirSeanceType({ id: 8, ...w }), { id: '8', ...simple });
  const repos = { jour: 1, sport: 'REPOS', titre: 'Repos', duree_s: null, distance_m: null, description: '', blocs: null };
  const wr = versSeanceBibliotheque(repos, 42);
  assert.deepEqual(wr.tags, ['semaine-type', 'jour-1', 'repos']);
  assert.equal(wr.type, 'Other');
  assert.deepEqual(convertirSeanceType({ id: 9, ...wr }), { id: '9', ...repos });
});

test('les séances de la semaine type ne sont pas proposées comme modèles (F-47)', () => {
  assert.equal(estModeleAffichable({ tags: ['semaine-type', 'jour-1'] }), false);
  assert.equal(estModeleAffichable({ tags: ['seuil'] }), true);
  assert.equal(estModeleAffichable({}), true);
  assert.equal(NOM_DOSSIER, 'Semaine type (appli triathlon)');
});

test('sélection des séances à supprimer : préfixe du plan, à partir de la date', () => {
  const evenements = [
    { id: '1', date: '2026-12-01', external_id: 'plan-77-s1-2026-12-01-0' },
    { id: '2', date: '2026-12-08', external_id: 'plan-77-s2-2026-12-08-0' },
    { id: '3', date: '2026-12-08', external_id: null }, // séance manuelle le même jour
    { id: '4', date: '2026-12-09', external_id: 'plan-78-s2-2026-12-09-0' }, // autre objectif
    { id: '5', date: '2026-12-15', external_id: 'plan-77-s3-2026-12-15-1' },
  ];
  assert.deepEqual(seancesASupprimer(evenements, 'plan-77-', '2026-12-07'), ['2', '5']);
});

test('séance du plan -> événement avec son étiquette', () => {
  const corps = versEvenementPlan({ date: '2026-12-08', sport: 'CAP', titre: 'Footing S2', duree_s: 2940, description: '', blocs: [], external_id: 'plan-77-s2-2026-12-08-0' });
  assert.equal(corps.category, 'WORKOUT');
  assert.equal(corps.name, 'Footing S2');
  assert.equal(corps.moving_time, 2940);
  assert.equal(corps.external_id, 'plan-77-s2-2026-12-08-0');
  assert.equal(TAILLE_LOT, 50);
});

test("réglages : le début garde l'identifiant de son objectif (revue I-4)", () => {
  const r = { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: null, debut: '2026-11-30', objectifDebut: '123' };
  assert.match(reglagesVersTexte(r), /début 2026-11-30 \(objectif 123\)$/);
  assert.deepEqual(texteVersReglages(reglagesVersTexte(r)), r);
  assert.equal(texteVersReglages(reglagesVersTexte({ ...r, debut: null, objectifDebut: null })).objectifDebut, null);
});

test("garde-fou : Intervals.icu doit renvoyer l'étiquette des séances créées (revue I-3)", () => {
  const envoyes = [{ external_id: 'plan-1-s1-2026-12-01-0' }];
  assert.equal(etiquettesConservees(envoyes, [{ id: 5, external_id: 'plan-1-s1-2026-12-01-0' }]), true);
  assert.equal(etiquettesConservees(envoyes, [{ id: 5 }]), false);
  assert.equal(etiquettesConservees(envoyes, null), false);
});
