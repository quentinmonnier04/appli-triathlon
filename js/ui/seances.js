// Écran "Mes séances" (F-88, D-24) : banque de séances de la bibliothèque Intervals.icu, ouverte depuis le Profil.
// Même liste que dans Objectif et plan (ui/blocs.js) ; l'éditeur revient ici après une modification.

import { lirePreparation } from '../api/preparation.js';
import { lireAlluresSeuil } from '../api/profil.js';
import { messageErreurApi, squelette, boutonIcone } from './composants.js';
import { sectionMesSeances } from './blocs.js';

export async function afficherSeances(conteneur) {
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
    zone.querySelector('#reessayer').addEventListener('click', () => afficherSeances(conteneur));
    return;
  }
  if (!zone.isConnected) return;
  zone.innerHTML = `<p class="doux">Tes séances types, rangées dans ta bibliothèque Intervals.icu. Place-les dans tes blocs depuis Objectif et plan.</p>
    ${sectionMesSeances(preparation.seances ?? [], preparation.blocs ?? [], allures, { retour: 'seances' })}`;
}
