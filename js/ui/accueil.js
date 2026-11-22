// Écran E-01 "Accueil". En L0 : preuve de connexion avec le nom de l'athlète (F-02).
// Le tableau de bord complet arrive en L2.

import { lireAthlete } from '../api/athlete.js';
import { echapperHtml } from '../logique/format.js';
import { messageErreurApi, squelette } from './composants.js';

function entete() {
  return `<div class="entete"><span class="titre-petit">Accueil</span>
    <a class="icone-bouton" href="#/reglages" aria-label="Réglages">⚙️</a></div>`;
}

export async function afficherAccueil(conteneur) {
  conteneur.innerHTML = entete() + squelette(); // ENF-22 : état de chargement
  try {
    const athlete = await lireAthlete();
    conteneur.innerHTML = `${entete()}
      <div class="carte hero">
        <div class="etiquette-carte">Bonjour</div>
        <div class="grand-chiffre">${echapperHtml(athlete.nom)}</div>
        <p class="doux">Connecté à Intervals.icu.</p>
      </div>
      <a class="carte carte-lien" href="#/activites">
        <h2>Mes activités</h2>
        <p class="doux">Parcours tes activités réalisées et leurs détails.</p>
        <span class="lien-fleche" aria-hidden="true">→</span>
      </a>
      <div class="carte">
        <h2>Tableau de bord</h2>
        <p class="doux">Ta séance du jour, ta dernière activité et ta forme s'afficheront ici.</p>
      </div>`;
  } catch (e) {
    // ENF-22 : erreur d'identifiants (M-02) ou erreur réseau (M-07)
    conteneur.innerHTML = `${entete()}${messageErreurApi(e)}
      <div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
    conteneur.querySelector('#reessayer').addEventListener('click', () => afficherAccueil(conteneur));
  }
}
