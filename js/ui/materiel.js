// Écran E-13 "Matériel" (lot LC2 : F-125, F-126, D-43), ouvert depuis le Profil : vélos et chaussures en service, leurs
// pièces (chaîne, pneus...), kilomètres et usure calculés par l'appli, « Remplacé » qui remet le compteur à zéro, ajout
// de matériel et de pièces. #/materiel/{id} : nom et limite d'usure d'un matériel, le retirer.
// Écriture en ligne seulement (ENF-07) ; toutes les données de l'API passent par echapperHtml (D-21).

import {
  lireMateriel, creerMateriel, definirLimite, remettreAZero, modifierMateriel,
} from '../api/materiel.js';
import {
  TYPES_PRINCIPAUX, TYPES_PIECES, LIMITE_CHAUSSURES_KM, libelleType, lireLimiteKm,
} from '../logique/materiel.js';
import { jourISO } from '../logique/dates.js';
import { echapperHtml, formaterEntier, formaterDate } from '../logique/format.js';
import {
  message, messageErreurApi, squelette, boutonIcone, bandeauHorsLigne, surveillerReseau, boutonCrayon, boutonAnnuler, brancherEdition,
} from './composants.js';
import { iconeSport } from './icones.js';

const sportDuType = (type) => TYPES_PRINCIPAUX.find((t) => t.type === type)?.sport ?? 'AUTRE';

// Barre d'usure : neutre, puis en rouge (avec le texte « À changer ») à 100 %.
function barreUsure(u) {
  if (!u.limite_km) return `<span class="doux">${echapperHtml(formaterEntier(u.km))} km</span>`;
  const use = u.pct >= 100;
  return `<div class="usure${use ? ' usee' : ''}">
    <span class="usure-texte">${echapperHtml(`${formaterEntier(u.km)} / ${formaterEntier(u.limite_km)} km`)}${use ? ' · <strong>À changer</strong>' : ''}</span>
    <span class="barre-progression"><span class="barre-remplie" data-pct="${Math.min(100, u.pct)}"></span></span></div>`;
}

function lignePiece(p) {
  return `<li class="ligne-piece">
    <a class="piece-nom" href="#/materiel/${encodeURIComponent(p.id)}"><strong>${echapperHtml(p.nom || libelleType(p.type))}</strong>
      <span class="doux">${echapperHtml([p.nom && p.nom !== libelleType(p.type) ? libelleType(p.type) : '', p.usure.depuis ? `depuis le ${formaterDate(p.usure.depuis)}` : ''].filter(Boolean).join(' · '))}</span></a>
    ${barreUsure(p.usure)}
    ${p.usure.rappel ? `<button type="button" class="bouton ecriture" data-remplace="${echapperHtml(p.id)}">Remplacé</button>` : ''}
  </li>`;
}

function carteMateriel(m) {
  const sportCode = sportDuType(m.type);
  const optionsPieces = TYPES_PIECES.map((t) => `<option value="${t.type}">${echapperHtml(t.libelle)}</option>`).join('');
  return `<section class="carte sport-${sportCode}" aria-label="${echapperHtml(m.nom || libelleType(m.type))}">
    <div class="carte-ligne"><a class="materiel-titre" href="#/materiel/${encodeURIComponent(m.id)}">${iconeSport(sportCode, 20)}<strong>${echapperHtml(m.nom || libelleType(m.type))}</strong></a>
      <span class="info-droite">${echapperHtml(formaterEntier(m.total_km))} km</span></div>
    ${m.usure.rappel ? `${barreUsure(m.usure)}<button type="button" class="bouton ecriture" data-remplace="${echapperHtml(m.id)}">Remplacé</button>` : ''}
    ${m.pieces.length ? `<ul class="liste-pieces">${m.pieces.map(lignePiece).join('')}</ul>` : ''}
    ${m.type === 'Bike' ? `<details class="ajout-piece"><summary>Ajouter une pièce</summary>
      <form class="form-piece" data-parent="${echapperHtml(m.id)}" novalidate>
        <div class="deux-colonnes">
          <div class="champ"><label>Pièce<select name="type">${optionsPieces}</select></label></div>
          <div class="champ"><label>Limite (km)<input name="limite" inputmode="numeric" value="${TYPES_PIECES[0].limite_km}"></label></div>
        </div>
        <div class="champ"><label>Nom (facultatif)<input name="nom" maxlength="60" placeholder="Ex. Chaîne 11 vitesses"></label></div>
        <div class="champ"><label>Posée le (facultatif)<input type="date" name="achat" value=""></label>
          <div class="aide">Vide : la pièce compte toutes les sorties du vélo. Pour une pièce neuve, mets la date de pose.</div></div>
        <div class="erreurs" aria-live="polite"></div>
        <button type="submit" class="bouton principal ecriture">Ajouter la pièce</button>
      </form></details>` : ''}
  </section>`;
}

function formulaireAjout() {
  return `<details class="carte ajout-materiel"><summary>Ajouter un vélo ou des chaussures</summary>
    <form id="form-materiel" novalidate>
      <div class="deux-colonnes">
        <div class="champ"><label>Type<select name="type">${TYPES_PRINCIPAUX.map((t) => `<option value="${t.type}">${echapperHtml(t.libelle)}</option>`).join('')}</select></label></div>
        <div class="champ"><label>Acheté le<input type="date" name="achat" value="${jourISO()}"></label></div>
      </div>
      <div class="champ"><label>Nom<input name="nom" maxlength="60" placeholder="Ex. Vélo route"></label></div>
      <div class="champ"><label>Limite d'usure (km, facultatif)<input name="limite" inputmode="numeric" placeholder="Ex. ${LIMITE_CHAUSSURES_KM} pour des chaussures"></label></div>
      <div class="erreurs" aria-live="polite"></div>
      <button type="submit" class="bouton principal ecriture">Ajouter</button>
    </form></details>`;
}

export async function afficherMateriel(conteneur, segments = []) {
  const id = segments[1] ? decodeURIComponent(segments[1]) : null;
  if (id) return afficherUnMateriel(conteneur, id);
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/profil' })}
      <span class="titre-petit">Matériel</span>${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}</div>
    <div id="hors-ligne"></div><div id="etat"></div>
    <div id="materiel">${squelette()}</div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  const zone = $('#materiel');
  let donnees = null;

  function afficher(resultatHtml = '') {
    const arbre = donnees.arbre;
    zone.innerHTML = `${resultatHtml}${arbre.length ? arbre.map(carteMateriel).join('')
      : '<div class="carte"><p class="doux">Aucun matériel pour l\'instant. Ajoute ton vélo ou tes chaussures pour suivre leur usure.</p></div>'}${formulaireAjout()}
      <p class="doux petit-texte">Les kilomètres comptent les séances associées à chaque matériel (choix sur le détail d'une séance).</p>`;
    zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
    $('#etat').innerHTML = donnees.horsLigne ? bandeauHorsLigne(donnees.charge_le) : '';
    brancher();
    surveillerReseau(zone, $('#hors-ligne'), [...zone.querySelectorAll('.ecriture')]); // ENF-07
  }

  async function charger(forcer = false, resultatHtml = '') {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      donnees = await lireMateriel({ forcer });
      if (conteneur.contains(zone)) afficher(resultatHtml);
    } catch (e) {
      if (conteneur.contains(zone)) zone.innerHTML = messageErreurApi(e);
    } finally {
      bouton?.classList.remove('tourne');
    }
  }

  const tous = () => donnees.arbre.flatMap((m) => [m, ...m.pieces]);
  function brancher() {
    zone.querySelectorAll('[data-remplace]').forEach((b) => b.addEventListener('click', async () => {
      const m = tous().find((x) => x.id === b.dataset.remplace);
      if (!m || !confirm(`${m.nom || libelleType(m.type)} remplacé aujourd'hui ? Le compteur repart de zéro.`)) return; // texte, pas du HTML
      b.disabled = true;
      try {
        await remettreAZero(m.id, m.usure.rappel);
        await charger(true, message('succes', 'Compteur remis à zéro.'));
      } catch (e) { b.disabled = false; zone.insertAdjacentHTML('afterbegin', messageErreurApi(e)); }
    }));
    const lire = (form) => Object.fromEntries(new FormData(form).entries());
    zone.querySelectorAll('.form-piece').forEach((form) => {
      form.querySelector('[name="type"]').addEventListener('change', (ev) => {
        form.querySelector('[name="limite"]').value = TYPES_PIECES.find((t) => t.type === ev.target.value)?.limite_km ?? '';
      });
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = lire(form);
        const limite = lireLimiteKm(v.limite);
        if (limite.erreur) { form.querySelector('.erreurs').innerHTML = message('erreur', limite.erreur); return; }
        try {
          await creerMateriel({ type: v.type, nom: v.nom.trim() || libelleType(v.type), achat: v.achat, parent: form.dataset.parent, limite_m: limite.metres });
          await charger(true, message('succes', 'Pièce ajoutée.'));
        } catch (e) { form.querySelector('.erreurs').innerHTML = messageErreurApi(e); }
      });
    });
    $('#form-materiel')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const v = lire(form);
      if (!v.nom.trim()) { form.querySelector('.erreurs').innerHTML = message('erreur', 'Donne un nom à ce matériel.'); return; }
      const limite = lireLimiteKm(v.limite);
      if (limite.erreur) { form.querySelector('.erreurs').innerHTML = message('erreur', limite.erreur); return; }
      try {
        await creerMateriel({ type: v.type, nom: v.nom.trim(), achat: v.achat, limite_m: limite.metres });
        await charger(true, message('succes', 'Matériel ajouté.'));
      } catch (e) { form.querySelector('.erreurs').innerHTML = messageErreurApi(e); }
    });
  }

  $('#rafraichir').addEventListener('click', () => charger(true));
  await charger();
}

// #/materiel/{id} : nom et limite d'usure (crayon, D-27), retirer le matériel.
async function afficherUnMateriel(conteneur, id) {
  conteneur.innerHTML = `<div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/materiel' })}
    <span class="titre-petit">Matériel</span><span class="espace-bouton"></span></div><div id="hors-ligne"></div><div id="un-materiel">${squelette()}</div>`;
  const zone = conteneur.querySelector('#un-materiel');
  let m;
  try {
    const { arbre } = await lireMateriel();
    m = arbre.flatMap((x) => [x, ...x.pieces]).find((x) => x.id === id);
  } catch (e) {
    zone.innerHTML = messageErreurApi(e);
    return;
  }
  if (!m) { location.hash = '#/materiel'; return; }
  const limite = m.usure.limite_km ?? '';
  zone.innerHTML = `<form class="carte" id="form-un-materiel" novalidate><h2>${echapperHtml(libelleType(m.type))}</h2>${boutonCrayon('Modifier ce matériel')}
    <fieldset class="champs-formulaire">
      <div class="champ"><label for="nom-materiel">Nom</label><input id="nom-materiel" maxlength="60" value="${echapperHtml(m.nom)}"></div>
      <div class="champ"><label for="limite-materiel">Limite d'usure (km)</label><input id="limite-materiel" inputmode="numeric" value="${echapperHtml(limite)}"></div>
      <div class="champ"><label for="achat-materiel">${m.est_piece ? 'Posée le' : 'Acheté le'}</label><input type="date" id="achat-materiel" value="${echapperHtml(m.achat ?? '')}">
        ${m.est_piece ? '<div class="aide">Vide : la pièce compte toutes les sorties du vélo.</div>' : ''}</div>
    </fieldset>
    ${barreUsure(m.usure)}
    <div class="erreurs" aria-live="polite"></div>
    <div class="pile action-edition">
      <button type="submit" class="bouton principal" data-enregistrer>Enregistrer les modifications</button>
      <button type="button" class="bouton danger ecriture" id="retirer-materiel">Retirer ce matériel</button>${boutonAnnuler()}</div>
  </form>`;
  zone.querySelectorAll('.barre-remplie').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
  const form = zone.querySelector('form');
  brancherEdition(form, { surAnnuler: () => afficherUnMateriel(conteneur, id) });
  surveillerReseau(form, conteneur.querySelector('#hors-ligne'), [form.querySelector('#retirer-materiel')]);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nom = form.querySelector('#nom-materiel').value.trim();
    const l = lireLimiteKm(form.querySelector('#limite-materiel').value);
    const erreurs = form.querySelector('.erreurs');
    if (!nom) { erreurs.innerHTML = message('erreur', 'Donne un nom à ce matériel.'); return; }
    if (l.erreur) { erreurs.innerHTML = message('erreur', l.erreur); return; }
    try {
      const achat = form.querySelector('#achat-materiel').value;
      if (nom !== m.nom || achat !== (m.achat ?? '')) await modifierMateriel(m.id, { nom, achat });
      if (l.metres && l.metres !== m.usure.rappel?.distance_m) await definirLimite(m.id, m.usure.rappel?.id ?? null, l.metres);
      afficherUnMateriel(conteneur, id);
    } catch (e) { erreurs.innerHTML = messageErreurApi(e); }
  });
  form.querySelector('#retirer-materiel').addEventListener('click', async () => {
    if (!confirm(`Retirer « ${m.nom || libelleType(m.type)} » ? Il n'apparaîtra plus dans la liste ; ses séances restent.`)) return; // texte, pas du HTML
    try {
      await modifierMateriel(m.id, { retirer: true });
      location.hash = '#/materiel';
    } catch (e) { form.querySelector('.erreurs').innerHTML = messageErreurApi(e); }
  });
}
