// Écran E-11 "Historique de la forme" (F-26, D-26) : CTL, ATL et TSB sur 6 semaines, 3 mois ou 1 an.
// Ouvert uniquement depuis le widget Forme de l'accueil. Affiché depuis le cache, puis mis à jour depuis
// Intervals.icu si le cache a plus de 5 min ou ne couvre pas la période du jour (5.5, ENF-11).

import { lireHistoriqueEnCache, rafraichirHistorique } from '../api/wellness.js';
import { lireSourceCalculs, chargesAJour, formeDesCharges } from '../api/charge.js';
import { estPerime } from '../logique/activites.js';
import { jourISO } from '../logique/dates.js';
import {
  PERIODES_FORME, periodeForme, serieForme, echelleForme, cheminForme, bandesTsb, resumeForme, phraseForme,
} from '../logique/forme.js';
import { echapperHtml, formaterEntier, formaterJourMois } from '../logique/format.js';
import { bandeauHorsLigne, messageErreurApi, squelette, boutonIcone, stat } from './composants.js';

const LARGEUR = 300;
const HAUTEUR = 140;

// Nombre signé pour l'affichage (signe moins typographique en entité HTML, comme sur l'accueil).
function signe(n) {
  return `${n > 0 ? '+' : n < 0 ? '&minus;' : ''}${formaterEntier(Math.abs(n))}`;
}

// Nombre signé en texte simple, pour stat() qui échappe sa valeur.
function signeTexte(n) {
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${formaterEntier(Math.abs(n))}`;
}

// Dates de début et de fin sous le graphique.
function axeDates(periode) {
  return `<div class="axe-dates" aria-hidden="true"><span>${formaterJourMois(periode.debut)}</span><span>${formaterJourMois(periode.fin)}</span></div>`;
}

// Valeurs haute et basse de l'échelle, à gauche du graphique.
function axeValeurs(echelle) {
  return `<div class="axe-valeurs" aria-hidden="true"><span>${formaterEntier(echelle.max)}</span><span>${formaterEntier(echelle.min)}</span></div>`;
}

// Carte du résumé : TSB du dernier jour avec sa phrase (9.4), CTL et ATL, évolution du CTL sur la période.
function carteResume(r, periode) {
  return `<div class="carte carte-forme">
    <div class="carte-ligne"><h2>Au ${formaterJourMois(r.derniere.date)}</h2>
      <span class="info-droite"><abbr title="Forme de fond">CTL</abbr> ${formaterEntier(r.derniere.ctl)} · <abbr title="Fatigue récente">ATL</abbr> ${formaterEntier(r.derniere.atl)}</span></div>
    <div class="forme-valeur"><span class="chiffre-forme"><span class="lecteur">Fraîcheur (TSB) : </span>${signe(r.derniere.tsb)}</span><span class="phrase-forme">${phraseForme(r.derniere.tsb)}</span></div>
    <div class="stats stats-forme">${stat('CTL sur ' + periode.libelle, signeTexte(r.ecart_ctl))}${stat('CTL le plus haut', formaterEntier(r.ctl_max))}
      ${stat('TSB le plus bas', signeTexte(r.tsb_min))}${stat('TSB le plus haut', signeTexte(r.tsb_max))}
    </div></div>`;
}

// Graphique CTL (trait plein) et ATL (pointillés).
function carteCharge(serie, periode) {
  const e = echelleForme(serie.flatMap((f) => [f.ctl, f.atl]));
  return `<div class="carte"><h2>Forme de fond et fatigue</h2>
    <div class="legende-forme"><span class="legende-ctl">CTL (42 j)</span><span class="legende-atl">ATL (7 j)</span></div>
    <div class="graphique-forme">${axeValeurs(e)}
      <svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" preserveAspectRatio="none" role="img"
        aria-label="Évolution du CTL (trait plein) et de l'ATL (pointillés) du ${formaterJourMois(periode.debut)} au ${formaterJourMois(periode.fin)}">
        <path class="trait-atl" d="${cheminForme(serie, 'atl', periode, e, LARGEUR, HAUTEUR)}"></path>
        <path class="trait-ctl" d="${cheminForme(serie, 'ctl', periode, e, LARGEUR, HAUTEUR)}"></path>
      </svg></div>${axeDates(periode)}</div>`;
}

// Graphique du TSB sur les bandes de la jauge (Fatigue, En charge, Équilibré, Frais).
function carteTsb(serie, periode) {
  const e = echelleForme(serie.map((f) => f.tsb), { avecZero: true });
  const bandes = bandesTsb(e, HAUTEUR).map((b) => `<rect class="bande-tsb bande-${b.numero}" x="0" y="${b.y}" width="${LARGEUR}" height="${b.hauteur}"></rect>`).join('');
  return `<div class="carte"><h2>Fraîcheur (TSB)</h2>
    <div class="legende-forme legende-bandes">${['Fatigue', 'En charge', 'Équilibré', 'Frais'].map((l, i) => `<span class="legende-bande-${i + 1}">${l}</span>`).join('')}</div>
    <div class="graphique-forme">${axeValeurs(e)}
      <svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" preserveAspectRatio="none" role="img"
        aria-label="Évolution du TSB du ${formaterJourMois(periode.debut)} au ${formaterJourMois(periode.fin)}, sur les zones Fatigue, En charge, Équilibré et Frais">
        ${bandes}<path class="trait-ctl" d="${cheminForme(serie, 'tsb', periode, e, LARGEUR, HAUTEUR)}"></path>
      </svg></div>${axeDates(periode)}</div>`;
}

function rendre(donnees, periode) {
  const serie = serieForme(donnees.formes, periode);
  const r = resumeForme(serie);
  if (!r) return '<div class="carte"><p class="doux">Pas de données de forme sur cette période.</p></div>';
  return `${carteResume(r, periode)}${carteCharge(serie, periode)}${carteTsb(serie, periode)}`;
}

export async function afficherForme(conteneur, segments, params = {}) {
  const periode = periodeForme(params.periode, jourISO()); // code vérifié : 3 mois par défaut
  conteneur.innerHTML = `
    <div class="entete entete-retour">${boutonIcone('retour', 'Retour', { href: '#/accueil' })}
      <span class="titre-petit">Forme</span>${boutonIcone('rafraichir', 'Rafraîchir', { id: 'rafraichir' })}</div>
    <nav class="onglets-vue" aria-label="Période">
      ${PERIODES_FORME.map((p) => `<a href="#/forme?periode=${p.code}" class="${p.code === periode.code ? 'actif' : ''}" ${p.code === periode.code ? 'aria-current="page"' : ''}>${echapperHtml(p.libelle)}</a>`).join('')}
    </nav>
    <div id="etat"></div>
    <div id="forme">${squelette()}${squelette()}</div>`;
  const $ = (sel) => conteneur.querySelector(sel);
  $('.entete a').addEventListener('click', (ev) => { if (history.length > 1) { ev.preventDefault(); history.back(); } });
  const zone = $('#forme');
  let donnees = null;

  async function rafraichir() {
    const bouton = $('#rafraichir');
    bouton?.classList.add('tourne');
    try {
      const frais = await rafraichirHistorique(periode.code, periode.debut, periode.fin);
      if (!conteneur.contains(zone)) return; // écran quitté entre-temps
      donnees = frais;
      $('#etat').innerHTML = '';
      zone.innerHTML = rendre(donnees, periode);
    } catch (e) {
      if (!conteneur.contains(zone)) return;
      if (donnees && e.type !== 'IDENTIFIANTS') {
        $('#etat').innerHTML = bandeauHorsLigne(donnees.charge_le); // ENF-06
      } else {
        $('#etat').innerHTML = messageErreurApi(e); // ENF-22 : M-02 ou M-07
        if (!donnees) zone.innerHTML = '<div class="pile"><button type="button" class="bouton" id="reessayer">Réessayer</button></div>';
        $('#reessayer')?.addEventListener('click', () => { zone.innerHTML = squelette(); rafraichir(); });
      }
    } finally {
      bouton?.classList.remove('tourne');
    }
  }

  $('#rafraichir').addEventListener('click', rafraichir);

  // F-121 : forme calculée par l'appli si je l'ai choisie (150 derniers jours au plus : historique de l'appli).
  if (await lireSourceCalculs() === 'appli') {
    $('#rafraichir').hidden = true;
    zone.innerHTML = squelette();
    try {
      const charges = await chargesAJour();
      if (!conteneur.contains(zone)) return;
      const formes = formeDesCharges(charges, jourISO()).filter((f) => f.date >= periode.debut);
      zone.innerHTML = rendre({ formes }, periode)
        + (charges.debut > periode.debut ? `<p class="doux petit-texte">Calculs de l'appli disponibles depuis le ${echapperHtml(formaterJourMois(charges.debut))}.</p>` : '');
    } catch (e) {
      zone.innerHTML = messageErreurApi(e);
    }
    return;
  }

  // 5.5 : cache affiché immédiatement (s'il couvre la période du jour), puis mise à jour si besoin.
  const cache = await lireHistoriqueEnCache(periode.code);
  if (cache) { donnees = cache; zone.innerHTML = rendre(cache, periode); }
  if (!cache || cache.debut !== periode.debut || estPerime(cache.charge_le)) await rafraichir();
}
