// Écran E-08 "Bilan du jour" (F-62) : fatigue, qualité du sommeil, douleurs, poids en option et commentaire,
// enregistrés dans les données wellness d'Intervals.icu. Écriture en ligne seulement (ENF-07).

import { lireBilanEnCache, rafraichirBilan, enregistrerBilan } from '../api/wellness.js';
import { estPerime } from '../logique/activites.js';
import { jourISO } from '../logique/dates.js';
import { ECHELLES_BILAN, lireNombreSaisi, validerBilan } from '../logique/ressenti.js';
import { echapperHtml, formaterDateHeure } from '../logique/format.js';
import {
  bandeauHorsLigne, messageErreurApi, squelette, message, groupeChoix, brancherChoix, surveillerReseau, boutonIcone,
  boutonCrayon, boutonAnnuler, brancherEdition,
} from './composants.js';

// Un bilan déjà rempli s'ouvre en lecture, avec le crayon (D-27).
const estRempli = (b) => [b.fatigue, b.sommeil, b.douleur, b.poids_kg].some((v) => v !== null && v !== undefined) || Boolean(b.commentaire);

// Poids affiché avec une virgule (ENF-20).
const poidsTexte = (kg) => (kg === null || kg === undefined ? '' : String(kg).replace('.', ','));

function rendreFormulaire(b) {
  return `<form class="carte" id="form-bilan" novalidate><h2>Ma journée</h2>${boutonCrayon('Modifier le bilan')}
    <fieldset class="champs-formulaire">
    ${groupeChoix('fatigue', 'Fatigue', ECHELLES_BILAN.fatigue, b.fatigue)}
    ${groupeChoix('sommeil', 'Qualité du sommeil', ECHELLES_BILAN.sommeil, b.sommeil)}
    ${groupeChoix('douleur', 'Douleurs', ECHELLES_BILAN.douleur, b.douleur)}
    <div class="champ"><label for="poids">Poids (kg, facultatif)</label>
      <input id="poids" inputmode="decimal" autocomplete="off" value="${echapperHtml(poidsTexte(b.poids_kg))}" placeholder="72,5"></div>
    <div class="champ"><label for="commentaire">Commentaire</label>
      <textarea id="commentaire" rows="3" maxlength="2000" placeholder="Une remarque sur ta journée ?">${echapperHtml(b.commentaire)}</textarea></div>
    </fieldset>
    <div id="hors-ligne-bilan"></div>
    <div id="resultat-bilan" aria-live="polite"></div>
    <div class="pile"><button type="submit" class="bouton principal" id="enregistrer-bilan" data-enregistrer>${estRempli(b) ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
      ${estRempli(b) ? boutonAnnuler() : ''}</div>
  </form>`;
}

export async function afficherBilan(conteneur, segments, params = {}) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : jourISO();
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/accueil' })}
      <span class="titre-petit">Bilan du jour</span><span class="espace-bouton"></span></div>
    <p class="doux">${echapperHtml(formaterDateHeure(date))}</p>
    <div id="etat"></div>
    <div id="bilan">${squelette()}</div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  $('.entete a').addEventListener('click', (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });
  const zone = $('#bilan');

  // La saisie en cours n'est pas écrasée par un rechargement.
  let saisie = null;
  let modifiee = false;

  function afficher(bilan, resultatHtml = '') {
    saisie = { ...bilan, date };
    modifiee = false;
    zone.innerHTML = rendreFormulaire(saisie);
    const form = zone.querySelector('form');
    const bouton = form.querySelector('#enregistrer-bilan');
    form.querySelector('#resultat-bilan').innerHTML = resultatHtml;
    brancherChoix(form, (champ, valeur) => { saisie[champ] = valeur; modifiee = true; });
    form.querySelectorAll('input, textarea').forEach((c) => c.addEventListener('input', () => { modifiee = true; }));
    // D-27 : bilan rempli en lecture (crayon) ; Annuler réaffiche le bilan enregistré.
    const libelle = bouton.textContent;
    const enregistre = { ...bilan };
    brancherEdition(form, { lecture: estRempli(bilan), nouveau: !estRempli(bilan), surAnnuler: () => afficher(enregistre) });
    surveillerReseau(form, form.querySelector('#hors-ligne-bilan'), []); // ENF-07

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      saisie.poids_kg = lireNombreSaisi(form.querySelector('#poids').value);
      saisie.commentaire = form.querySelector('#commentaire').value.trim();
      const erreurs = validerBilan(saisie);
      const resultat = form.querySelector('#resultat-bilan');
      if (Object.keys(erreurs).length) { resultat.innerHTML = message('erreur', Object.values(erreurs).join(' ')); return; }
      bouton.disabled = true;
      bouton.textContent = 'Enregistrement...'; // ENF-10
      try {
        const enregistre = await enregistrerBilan(saisie);
        if (!form.isConnected) return;
        afficher(enregistre, message('succes', 'Bilan enregistré.'));
      } catch (e) {
        if (!form.isConnected) return;
        resultat.innerHTML = messageErreurApi(e); // la saisie reste dans le formulaire (ENF-07)
        bouton.disabled = !navigator.onLine;
        bouton.textContent = libelle;
      }
    });
  }

  // 5.5 : cache d'abord, puis Intervals.icu si le cache a plus de 5 min.
  const cache = await lireBilanEnCache(date);
  if (cache) afficher(cache.bilan);
  if (cache && !estPerime(cache.charge_le)) return;
  try {
    const frais = await rafraichirBilan(date);
    if (!conteneur.contains(zone)) return; // écran quitté entre-temps
    if (!modifiee) afficher(frais.bilan);
  } catch (e) {
    if (!conteneur.contains(zone)) return;
    if (cache && e.type !== 'IDENTIFIANTS') {
      $('#etat').innerHTML = bandeauHorsLigne(cache.charge_le); // ENF-06
    } else {
      zone.innerHTML = `${messageErreurApi(e)}<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>`;
      $('#reessayer').addEventListener('click', () => afficherBilan(conteneur, segments, params));
    }
  }
}
