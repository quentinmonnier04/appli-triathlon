// Écran E-07 "Réglages" : identifiants Intervals.icu, test de connexion, déconnexion (F-01, F-02, F-03).
// La clé est saisie masquée et n'est jamais réaffichée (ENF-13).

import {
  lireIdentifiantsAffichables, connecter, seDeconnecter, estConnecte, lireMontre, enregistrerMontre,
} from '../api/session.js';
import { validerIdentifiants } from '../logique/connexion.js';
import { MESSAGES, formaterMessage } from '../logique/messages.js';
import { echapperHtml } from '../logique/format.js';
import { VERSION_APP } from '../version.js';
import { message, messageErreurApi } from './composants.js';

export async function afficherReglages(conteneur) {
  const { athleteId, cleEnregistree } = await lireIdentifiantsAffichables();
  const connecte = await estConnecte();
  const montre = await lireMontre();

  conteneur.innerHTML = `
    <div class="entete"><span class="titre-petit">Réglages</span>
      ${connecte ? '<a class="icone-bouton" href="#/profil" aria-label="Retour au profil">✕</a>' : '<a class="icone-bouton" href="#/bienvenue" aria-label="Retour">←</a>'}</div>
    <h1>Intervals.icu</h1>
    <p class="doux">Identifiant et clé se trouvent dans les réglages d'Intervals.icu, section Developer Settings.</p>
    <form class="carte" novalidate>
      <div class="champ">
        <label for="athlete">Identifiant athlète</label>
        <input id="athlete" name="athlete" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="i12345" value="${echapperHtml(athleteId)}">
      </div>
      <div class="champ">
        <label for="cle">Clé API</label>
        <input id="cle" name="cle" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="${cleEnregistree ? 'Clé enregistrée' : 'Colle ta clé API'}">
        <div class="aide">${cleEnregistree ? 'Laisse vide pour garder la clé enregistrée. ' : ''}La clé reste sur cet appareil et n'est jamais affichée.</div>
      </div>
      <button type="submit" class="bouton principal" id="tester">Tester la connexion</button>
      <div id="resultat" aria-live="polite"></div>
    </form>
    ${connecte ? `<form class="carte" id="form-montre" novalidate><h2>Montre</h2>
      <div class="champ"><label for="montre">Nom affiché sur le profil</label>
        <input id="montre" maxlength="40" value="${echapperHtml(montre)}"></div>
      <button type="submit" class="bouton">Enregistrer</button>
      <div id="resultat-montre" aria-live="polite"></div></form>` : ''}
    ${connecte ? `<div class="carte"><h2>Compte</h2>
      <p class="doux">Efface la clé et les données en cache de cet appareil.</p>
      <button type="button" class="bouton danger" id="deconnecter">Se déconnecter</button></div>` : ''}
    <p class="version">Version ${VERSION_APP}</p>`;

  const form = conteneur.querySelector('form');
  const resultat = conteneur.querySelector('#resultat');
  const bouton = conteneur.querySelector('#tester');

  // Affiche les erreurs de saisie sous les champs.
  function afficherErreursChamps(erreurs) {
    form.querySelectorAll('.erreur-champ').forEach((e) => e.remove());
    form.querySelectorAll('.invalide').forEach((e) => e.classList.remove('invalide'));
    for (const [champ, texte] of Object.entries(erreurs)) {
      const input = form.querySelector(champ === 'athleteId' ? '#athlete' : '#cle');
      input.classList.add('invalide');
      input.insertAdjacentHTML('afterend', `<div class="erreur-champ" role="alert">${echapperHtml(texte)}</div>`);
    }
  }

  // F-01 : "Tester la connexion" ; les identifiants ne sont enregistrés que s'ils sont acceptés.
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = form.athlete.value.trim();
    const cle = form.cle.value.trim();
    const erreurs = validerIdentifiants({ athleteId: id, cle: cle || (cleEnregistree ? 'enregistree' : '') });
    afficherErreursChamps(erreurs);
    resultat.innerHTML = '';
    if (Object.keys(erreurs).length) return;

    bouton.disabled = true;
    bouton.textContent = 'Test en cours...'; // ENF-10 : retour visuel immédiat
    try {
      const athlete = await connecter(id, cle);
      form.cle.value = '';
      // F-02 : nom renvoyé par Intervals.icu (M-01)
      resultat.innerHTML = message('succes', formaterMessage('M-01', { nom: athlete.nom }))
        + '<div class="pile"><a class="bouton" href="#/accueil">Aller à l\'accueil</a></div>';
      if (!connecte) await afficherApresConnexion();
    } catch (e) {
      resultat.innerHTML = messageErreurApi(e, { lienReglages: false }); // M-02 ou M-07
    } finally {
      bouton.disabled = false;
      bouton.textContent = 'Tester la connexion';
    }
  });

  // Après une première connexion : la navigation et le bouton de déconnexion apparaissent.
  async function afficherApresConnexion() {
    document.dispatchEvent(new CustomEvent('connexion-changee'));
    const resultatHtml = resultat.innerHTML;
    await afficherReglages(conteneur);
    conteneur.querySelector('#resultat').innerHTML = resultatHtml;
  }

  // F-50 : nom de la montre, enregistré sur l'appareil.
  conteneur.querySelector('#form-montre')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await enregistrerMontre(ev.target.montre.value);
    ev.target.montre.value = await lireMontre();
    conteneur.querySelector('#resultat-montre').innerHTML = message('succes', 'Montre enregistrée.');
  });

  // F-03 : "Se déconnecter" après confirmation M-06, puis retour à l'écran de bienvenue.
  conteneur.querySelector('#deconnecter')?.addEventListener('click', async () => {
    if (!confirm(MESSAGES['M-06'])) return;
    await seDeconnecter();
    document.dispatchEvent(new CustomEvent('connexion-changee'));
    location.hash = '#/bienvenue';
  });
}
