// Référence figée de l'ancien calcul (semaine type unique, lot L8 avant D-22), retiré de js/logique/plan.js.
// Sert uniquement aux tests : la migration vers les blocs doit donner exactement le même plan.
import { REGLAGES_ANCIENS_PAR_DEFAUT, lundisDuPlan, volumeSemaine_s, seancesDeLaSemaine } from '../../js/logique/plan.js';

// Coefficient de chaque semaine : [{ numero, type: HAUSSE | COUPURE | AFFUTAGE | COURSE, pct }].
export function coefficientsPlan(nbSemaines, reglages, volumeBase_s) {
  const r = { ...REGLAGES_ANCIENS_PAR_DEFAUT, ...reglages };
  const nbAffutage = Math.min(r.affutage.length, nbSemaines);
  const pctMax = r.plafond_h && volumeBase_s > 0 ? Math.round(((r.plafond_h * 3600) / volumeBase_s) * 100) : Infinity;
  const semaines = [];
  let depart = 100;
  let derniereHausse = null;
  let rang = 0; // rang de la semaine dans le bloc
  while (semaines.length < nbSemaines - nbAffutage) {
    if (rang < r.semainesHausse) {
      derniereHausse = Math.min(depart + rang * r.hausse, pctMax);
      semaines.push({ type: 'HAUSSE', pct: derniereHausse });
      rang += 1;
    } else {
      semaines.push({ type: 'COUPURE', pct: Math.round((semaines.at(-1).pct * r.coupure) / 100) });
      depart = derniereHausse; // reprise au volume de la semaine d'avant la coupure
      rang = 0;
    }
  }
  const reference = derniereHausse ?? 100;
  // Plan plus court que l'affûtage : on garde les derniers niveaux, les plus proches de la course.
  for (const niveau of nbAffutage ? r.affutage.slice(-nbAffutage) : []) {
    semaines.push({ type: 'AFFUTAGE', pct: Math.round((reference * niveau) / 100) });
  }
  if (semaines.length) semaines.at(-1).type = 'COURSE';
  return semaines.map((s, i) => ({ numero: i + 1, ...s }));
}

// Plan complet d'une semaine type unique : [{ numero, lundi, type, pct, seances, volume_s }].
export function genererPlan({ semaineType, reglages, dateCourse, allures = {}, objectifId }) {
  const lundis = lundisDuPlan(reglages.debut, dateCourse);
  const coefficients = coefficientsPlan(lundis.length, reglages, volumeSemaine_s(semaineType, allures));
  return coefficients.map((c, i) => {
    const seances = seancesDeLaSemaine(semaineType, lundis[i], c.pct, c.numero, dateCourse, objectifId);
    return { ...c, lundi: lundis[i], seances, volume_s: volumeSemaine_s(seances, allures) };
  });
}

