// Préparation (Mes séances et blocs) dans la bibliothèque Intervals.icu et envoi du plan (F-81, F-85 à F-88, F-47, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOM_DOSSIER, ANCIEN_NOM, ENTETE_PREPARATION, reglagesVersTexte, texteVersReglages, versSeanceBibliotheque,
  convertirSeanceBibliotheque as convertirSeanceType, preparationVersTexte, texteVersPreparation, corpsDossier,
} from '../js/api/preparation.js';
import { REGLAGES_PAR_DEFAUT as REGLAGES_NOUVEAUX } from '../js/logique/plan.js';
import { ajouterBloc } from '../js/logique/blocs.js';
import { seancesASupprimer, versEvenementPlan, TAILLE_LOT, etiquettesConservees } from '../js/api/plan.js';
import { estModeleAffichable } from '../js/api/bibliotheque.js';
import { REGLAGES_ANCIENS_PAR_DEFAUT as REGLAGES_PAR_DEFAUT } from '../js/logique/plan.js';

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

const structuree = { jour: 2, heure: null, sport: 'CAP', titre: 'Fractionné', duree_s: null, distance_m: null, description: null, blocs: [
  { type: 'ECHAUFFEMENT', cible: 'PACE', etape: { duree_s: 900, zone: 2 } },
  { type: 'REPETITIONS', cible: 'PACE', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } }] };

test('séance type structurée -> séance de bibliothèque et retour', () => {
  const w = versSeanceBibliotheque(structuree, 42);
  assert.deepEqual(w, {
    name: 'Fractionné', type: 'Run', folder_id: 42, tags: ['semaine-type'],
    description: 'Échauffement\n- 15m Z2 Pace\n\nSérie 5x\n- 4m Z4 Pace\n- Récup 2m Z1 Pace',
  });
  assert.deepEqual(convertirSeanceType({ id: 7, ...w }), { id: '7', ...structuree, jour: 1 });
  // ancien format : jour et heure lus dans les étiquettes (migration)
  assert.deepEqual(convertirSeanceType({ id: 7, ...w, tags: ['semaine-type', 'jour-2', 'heure-18:30'] }), { id: '7', ...structuree, heure: '18:30' });
});

test('séance type simple et repos -> bibliothèque et retour', () => {
  const simple = { jour: 7, heure: null, sport: 'VELO', titre: 'Sortie longue', duree_s: 7200, distance_m: 60000, description: 'Tranquille', blocs: null };
  const w = versSeanceBibliotheque(simple, 42);
  assert.deepEqual(w, { name: 'Sortie longue', type: 'Ride', folder_id: 42, tags: ['semaine-type'], description: 'Tranquille', moving_time: 7200, distance: 60000 });
  assert.deepEqual(convertirSeanceType({ id: 8, ...w }), { id: '8', ...simple, jour: 1 });
  const repos = { jour: 1, heure: null, sport: 'REPOS', titre: 'Repos', duree_s: null, distance_m: null, description: '', blocs: null };
  const wr = versSeanceBibliotheque(repos, 42);
  assert.deepEqual(wr.tags, ['semaine-type', 'repos']);
  assert.equal(wr.type, 'Other');
  assert.deepEqual(convertirSeanceType({ id: 9, ...wr }), { id: '9', ...repos });
});

test('Mes séances sont proposées comme modèles, sauf les repos (F-47, conception 6)', () => {
  assert.equal(estModeleAffichable({ tags: ['semaine-type', 'jour-1'] }), true);
  assert.equal(estModeleAffichable({ tags: ['semaine-type', 'repos'] }), false);
  assert.equal(estModeleAffichable({ tags: ['seuil'] }), true);
  assert.equal(estModeleAffichable({}), true);
  assert.equal(NOM_DOSSIER, 'Mes séances (appli triathlon)');
  assert.equal(ANCIEN_NOM, 'Semaine type (appli triathlon)');
});

const BLOCS = [
  { nom: 'Endurance', semaines: 4, emplacements: [{ seanceId: '7', jour: 2, heure: '18:30' }, { seanceId: '8', jour: 7, heure: null }] },
  { nom: 'Spécifique', semaines: 3, coupure: true, emplacements: [] },
];
const REG = { hausse: 10, coupure: 60, affutage: [70], plafond_h: 7.5 };

test('préparation <-> description du dossier (F-88)', () => {
  const texte = preparationVersTexte({ reglages: REG, blocs: BLOCS });
  assert.ok(texte.startsWith(`${ENTETE_PREPARATION}
{`));
  assert.deepEqual(texteVersPreparation(texte), { reglages: REG, blocs: BLOCS });
  // champ inconnu ignoré, réglage absent remplacé par sa valeur par défaut
  const json = JSON.parse(texte.slice(texte.indexOf('{')));
  const enrichi = `${ENTETE_PREPARATION}
${JSON.stringify({ ...json, inconnu: 1, reglages: { hausse: 5 } })}`;
  assert.deepEqual(texteVersPreparation(enrichi).reglages, { ...REGLAGES_NOUVEAUX, hausse: 5 });
});

test('ancien format reconnu, y compris description vide', () => {
  const ancien = "Réglages du plan (gérés par l'appli) : hausse 8 ; semaines 3 ; coupure 70 ; affûtage 70/50 ; plafond aucun ; début aucun";
  assert.deepEqual(texteVersPreparation(ancien), { ancien: texteVersReglages(ancien) });
  assert.deepEqual(texteVersPreparation(''), { ancien: REGLAGES_PAR_DEFAUT });
  assert.deepEqual(texteVersPreparation(null), { ancien: REGLAGES_PAR_DEFAUT });
});

test('revue 3 : description illisible, aucune écriture possible', () => {
  assert.deepEqual(texteVersPreparation(`${ENTETE_PREPARATION}
{"v":2,"blocs":[`), { illisible: true });
  assert.deepEqual(texteVersPreparation(`${ENTETE_PREPARATION}
{"v":3,"blocs":[]}`), { illisible: true });
  assert.throws(() => corpsDossier({ illisible: true }, (p) => p), (e) => e.type === 'ILLISIBLE');
});

test("revue 4 : la modification s'applique à la préparation relue (changements d'un autre appareil gardés)", () => {
  const relue = { dossierId: 42, seances: [], reglages: REG, blocs: BLOCS, ancienFormat: null, illisible: false };
  const corps = corpsDossier(relue, (p) => ({ reglages: p.reglages, blocs: ajouterBloc(p.blocs, 'Affûtage long') }));
  assert.equal(corps.name, NOM_DOSSIER);
  assert.deepEqual(texteVersPreparation(corps.description).blocs.map((b) => b.nom), ['Endurance', 'Spécifique', 'Affûtage long']);
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

test("ancien format : le début garde l'identifiant de son objectif (revue I-4)", () => {
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

test("revue finale I-1 : pas d'écriture sur une préparation encore à l'ancien format, sauf la migration", () => {
  const relue = { dossierId: 42, seances: [], reglages: REG, blocs: null, ancienFormat: { reglages: REG }, illisible: false };
  assert.throws(() => corpsDossier(relue, (p) => ({ reglages: p.reglages, blocs: [] })), (e) => e.type === 'MIGRATION');
  const corps = corpsDossier(relue, () => ({ reglages: REG, blocs: BLOCS }), { migration: true });
  assert.deepEqual(texteVersPreparation(corps.description).blocs, BLOCS);
});
