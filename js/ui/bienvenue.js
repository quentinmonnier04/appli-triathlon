// Écran E-00 "Bienvenue" : premier lancement sans identifiants (F-04).

export async function afficherBienvenue(conteneur) {
  conteneur.innerHTML = `
    <div class="carte hero">
      <div class="etiquette-carte">Triathlon</div>
      <h1>Bienvenue !</h1>
      <p class="doux">Cette appli affiche et programme tes entraînements à partir de ton compte Intervals.icu.
        Pour commencer, il lui faut ton identifiant athlète et ta clé API.</p>
    </div>
    <div class="carte">
      <h2>Où les trouver ?</h2>
      <ol class="etapes">
        <li>Ouvre <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer">les réglages d'Intervals.icu</a>.</li>
        <li>Descends jusqu'à la section <strong>Developer Settings</strong>.</li>
        <li>Note ton <strong>identifiant athlète</strong> (il commence par la lettre i, par exemple i12345).</li>
        <li>Génère ta <strong>clé API</strong> si besoin, puis copie-la.</li>
        <li>Colle les deux dans l'écran Réglages de cette appli.</li>
      </ol>
      <p class="aide">Ta clé reste sur cet appareil : elle n'est envoyée qu'à Intervals.icu.</p>
    </div>
    <div class="carte">
      <h2>Avant de commencer</h2>
      <p class="doux">Connecte ta montre Suunto <strong>directement</strong> à Intervals.icu (pas seulement via Strava) :
        les activités venant de Strava ne sont pas transmises à cette appli.</p>
    </div>
    <div class="pile"><a class="bouton principal" href="#/reglages">Aller aux réglages</a></div>`;
}
