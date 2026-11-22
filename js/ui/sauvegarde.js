// Écran E-04 "Sauvegarde" et bandeau de rappel (F-36, C-15 à C-18, ENF-17, ENF-23, ENF-24, D-03).

import {
  exporterDonnees, importerDonnees, joursDepuisSauvegarde, derniereSauvegarde, aDesDonnees, toutSupprimer,
} from '../db/sauvegarde.js';
import { listerTout } from '../db/database.js';
import { initialiser } from '../db/migrations.js';
import { verifierSauvegarde } from '../regles/validation.js';
import { MESSAGES, formaterMessage, formaterDateCourte, jourISO, VERSION_APP } from './commun.js';

// HTML du bandeau M-05, ou chaîne vide si la sauvegarde est récente ou s'il n'y a pas de données (C-15).
export async function bandeauRappel(contexte) {
  if (!(await aDesDonnees())) return '';
  const jours = await joursDepuisSauvegarde();
  const parametres = (await listerTout('parametres')).find((p) => p.athlete_id === contexte.athleteId);
  const limite = parametres?.rappel_sauvegarde_jours ?? 7;
  if (jours !== null && jours <= limite) return '';
  const delai = jours === null ? 'jamais' : `il y a ${jours} jours`;
  return `<div class="bandeau"><span>${formaterMessage('M-05', { delai })}</span>
    <a class="bouton principal" href="#/sauvegarde">Sauvegarder</a></div>`;
}

// Télécharge un objet JSON sous le nom donné.
function telecharger(objet, nom) {
  const blob = new Blob([JSON.stringify(objet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Affiche l'écran E-04.
export async function afficherSauvegarde(conteneur, contexte) {
  const derniere = await derniereSauvegarde();
  conteneur.innerHTML = `
    <h1>Sauvegarde</h1>
    <p>Dernière sauvegarde : <strong>${derniere ? formaterDateCourte(jourISO(new Date(derniere))) : 'jamais'}</strong></p>
    <div class="ligne-sauvegarde">
      <button type="button" class="principal" id="exporter">💾 Exporter</button>
      <button type="button" id="importer">📂 Importer</button>
      <input type="file" id="fichier" accept=".json,application/json" class="masque">
    </div>
    <h2>Effacer mes données</h2>
    <div class="ligne-sauvegarde">
      <button type="button" class="danger" id="supprimer-tout">🗑 Tout supprimer</button>
    </div>
    <p class="version">Version ${VERSION_APP}</p>`;

  const $ = (sel) => conteneur.querySelector(sel);

  // C-16 : avertissement M-06 puis téléchargement (ENF-24).
  $('#exporter').addEventListener('click', async () => {
    if (!confirm(MESSAGES['M-06'])) return;
    const sauvegarde = await exporterDonnees();
    telecharger(sauvegarde, `triathlon-sauvegarde-${jourISO()}.json`);
    await afficherSauvegarde(conteneur, contexte);
  });

  // C-17 : contrôle du format d'abord, confirmation M-07 ensuite, puis remplacement.
  $('#importer').addEventListener('click', () => $('#fichier').click());
  $('#fichier').addEventListener('change', async (ev) => {
    const fichier = ev.target.files[0];
    if (!fichier) return;
    let objet = null;
    try {
      objet = JSON.parse(await fichier.text());
    } catch {
      objet = null;
    }
    if (!verifierSauvegarde(objet)) {
      alert(MESSAGES['M-08']);
      ev.target.value = '';
      return;
    }
    if (!confirm(MESSAGES['M-07'])) {
      ev.target.value = '';
      return;
    }
    await importerDonnees(objet);
    Object.assign(contexte, await initialiser());
    location.hash = '#/aujourdhui';
  });

  // C-18 : saisie exacte de SUPPRIMER (M-09), base vidée, retour à l'état du premier lancement.
  $('#supprimer-tout').addEventListener('click', async () => {
    const saisie = prompt(MESSAGES['M-09']);
    if (saisie !== 'SUPPRIMER') return;
    Object.assign(contexte, await toutSupprimer());
    location.hash = '#/aujourdhui';
  });
}
