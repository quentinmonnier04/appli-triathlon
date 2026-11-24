// Écran E-10 "Mes séances" (F-88, D-24, D-25) : banque de séances de la bibliothèque Intervals.icu, ouverte depuis
// le Profil, rangée par sport puis par type de séance (logique/types-seance.js). Filtre par sport dans l'adresse
// (#/seances?sport=CAP). L'éditeur ouvert d'ici revient ici après une modification.

import { lirePreparation } from '../api/preparation.js';
import { lireAlluresSeuil } from '../api/profil.js';
import { utilisationsSeance } from '../logique/blocs.js';
import { volumeSeance_s } from '../logique/plan.js';
import { rangerSeances } from '../logique/types-seance.js';
import { sport } from '../logique/sports.js';
import { echapperHtml, formaterDureeLongue } from '../logique/format.js';
import { messageErreurApi, squelette, boutonIcone } from './composants.js';
import { icone, iconeSport } from './icones.js';

// Une séance : titre, durée estimée, nombre de blocs qui l'utilisent.
function ligne(s, blocs, allures) {
  const n = utilisationsSeance(blocs, s.id);
  const duree = s.sport === 'REPOS' ? '' : formaterDureeLongue(volumeSeance_s(s, allures));
  return `<li><a class="ligne-seance" href="#/seance-type/${encodeURIComponent(s.id)}?retour=seances">
    <span class="seance-type-titre">${echapperHtml(s.titre)}</span>
    <span class="doux">${echapperHtml(duree)}${n ? ` · ${n} bloc${n > 1 ? 's' : ''}` : ''}</span></a></li>`;
}

// Une carte par sport, un groupe par type.
function carteSport(g, blocs, allures) {
  const s = sport(g.sport);
  return `<section class="carte sport-${s.code}">
    <h2 class="sport-titre">${iconeSport(s.code, 18)}<span class="sport-titre-texte">${echapperHtml(s.libelle)}</span><span class="compte-type">${g.nb}</span></h2>
    ${g.groupes.map((t) => `<div class="groupe-type"><div class="etiquette-carte">${echapperHtml(t.type)} <span class="compte-type">${t.seances.length}</span></div>
      <ul class="liste-seances">${t.seances.map((x) => ligne(x, blocs, allures)).join('')}</ul></div>`).join('')}
  </section>`;
}

export async function afficherSeances(conteneur, segments = [], params = {}) {
  conteneur.innerHTML = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/profil' })}
    <span class="titre-petit">Mes séances</span><span class="espace-bouton"></span></div>
    <div id="ecran-seances">${squelette()}</div>`;
  const zone = conteneur.querySelector('#ecran-seances');

  let preparation;
  let allures;
  try {
    [preparation, allures] = await Promise.all([lirePreparation(), lireAlluresSeuil()]);
  } catch (e) {
    if (!zone.isConnected) return;
    zone.innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
    zone.querySelector('#reessayer').addEventListener('click', () => afficherSeances(conteneur, segments, params));
    return;
  }
  if (!zone.isConnected) return;

  const seances = preparation.seances ?? [];
  const blocs = preparation.blocs ?? [];
  const tous = rangerSeances(seances);
  // Filtre contrôlé (D-21) : seulement un sport présent dans la banque.
  const filtre = tous.some((g) => g.sport === params.sport) ? params.sport : null;
  const ranges = filtre ? tous.filter((g) => g.sport === filtre) : tous;
  const filtres = tous.length > 1 ? `<nav class="filtres" aria-label="Filtrer par sport">
      <a class="filtre${filtre ? '' : ' actif'}" href="#/seances"${filtre ? '' : ' aria-current="page"'}>Tous</a>
      ${tous.map((g) => `<a class="filtre filtre-sport sport-${g.sport}${g.sport === filtre ? ' actif' : ''}" href="#/seances?sport=${g.sport}"${g.sport === filtre ? ' aria-current="page"' : ''}>
        ${iconeSport(g.sport, 16)} ${echapperHtml(sport(g.sport).libelle)}</a>`).join('')}</nav>` : '';

  zone.innerHTML = `<p class="doux">Tes séances types, rangées par sport et par type. Crée-les et modifie-les ici, puis place-les dans tes blocs depuis Objectif et plan.</p>
    ${filtres}
    ${ranges.length ? ranges.map((g) => carteSport(g, blocs, allures)).join('') : '<div class="carte"><p class="doux">Aucune séance pour l\'instant.</p></div>'}
    <div class="pile"><a class="bouton principal" href="#/seance-type/nouvelle?retour=seances">${icone('plus', 18)} Nouvelle séance</a></div>`;
}
