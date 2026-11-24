// Contrôles de sécurité permanents (0.3, D-21) : secrets, fichiers ignorés par git, liens externes,
// échappement des données insérées dans le HTML, paramètres d'adresse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { dateParametre } from '../js/logique/dates.js';

const RACINE = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const IGNORES = new Set(['.git', 'node_modules', '.superpowers', 'lib', 'fonts', 'icons']);
const TEXTES = new Set(['.js', '.mjs', '.html', '.css', '.json', '.md', '.py', '.txt', '.yml', '.webmanifest']);

// Tous les fichiers texte du projet (hors bibliothèques tierces, polices, icônes et dossiers de travail).
function fichiersTexte(dossier = RACINE) {
  const liste = [];
  for (const nom of readdirSync(dossier)) {
    if (IGNORES.has(nom)) continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) liste.push(...fichiersTexte(chemin));
    else if (TEXTES.has(extname(nom))) liste.push(chemin);
  }
  return liste;
}

const lignesAvec = (motif, fichiers) => fichiers.flatMap((f) => readFileSync(f, 'utf8').split('\n')
  .map((ligne, i) => ({ ligne, ou: `${relative(RACINE, f)}:${i + 1}` }))
  .filter(({ ligne }) => motif.test(ligne)));

test('aucun motif de secret dans les fichiers du dépôt', () => {
  const motifs = [
    /Basic [A-Za-z0-9+/]{24,}={0,2}/, // en-tête d'authentification déjà encodé
    /API_KEY:[A-Za-z0-9]{12,}/, // couple utilisateur:clé en clair
    /\b(cle|apiKey|api_key|token|password|secret)\b\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/i, // clé affectée en dur
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  ];
  const fichiers = fichiersTexte();
  assert.ok(fichiers.length > 50);
  for (const motif of motifs) assert.deepEqual(lignesAvec(motif, fichiers).map((x) => x.ou), [], `motif ${motif}`);
});

test('.gitignore exclut secrets, réglages locaux, dossiers de travail et données personnelles', () => {
  const chemin = join(RACINE, '.gitignore');
  assert.ok(existsSync(chemin), '.gitignore absent');
  const entrees = readFileSync(chemin, 'utf8').split('\n').map((l) => l.trim());
  for (const e of ['.env*', '.claude/settings.local.json', '.superpowers/', 'node_modules/', '*.bak', '*.fit', '*.gpx', '*.tcx', 'export*.json']) {
    assert.ok(entrees.includes(e), `entrée manquante : ${e}`);
  }
});

test('liens externes : https uniquement, et noopener noreferrer pour un nouvel onglet', () => {
  const code = fichiersTexte().filter((f) => /\.(js|html)$/.test(f) && !f.includes('docs') && !f.includes('tests'));
  assert.deepEqual(lignesAvec(/href=["']?(http:|javascript:|data:)/i, code).map((x) => x.ou), []);
  const nouveauxOnglets = lignesAvec(/target=["']_blank/, code);
  assert.ok(nouveauxOnglets.length > 0);
  for (const { ligne, ou } of nouveauxOnglets) assert.match(ligne, /rel="noopener noreferrer"/, ou);
});

test("affichage : toute donnée insérée dans le HTML passe par echapperHtml", () => {
  // Champs venant d'Intervals.icu ou de l'adresse ; une interpolation qui les cite doit être échappée,
  // encodée pour une URL ou formatée par une fonction de logique/format.js.
  const champs = 'titre|nom|name|description|commentaire|libelle|texte|date|heure|zone|fc_moy|fc_max|puissance_moy_w|charge';
  const interpolation = new RegExp(`\\$\\{[^{}]*\\.(${champs})\\b[^{}]*\\}`, 'g');
  // stat() et enTete() échappent eux-mêmes ; une comparaison (===) ne produit pas de texte.
  const sur = /echapperHtml\(|encodeURIComponent\(|formater[A-Za-z]*\(|jjmm\(|Number\(|sport\(|stat\(|enTete\(|===/;
  const dossier = join(RACINE, 'js', 'ui');
  const fautes = [];
  for (const nom of readdirSync(dossier)) {
    readFileSync(join(dossier, nom), 'utf8').split('\n').forEach((ligne, i) => {
      if (/textContent|location\.hash|aria-label="\$\{echapperHtml/.test(ligne) && !/innerHTML|`</.test(ligne)) return;
      // Texte qui n'est pas du HTML (confirm, ou message() qui échappe lui-même) : marqué explicitement.
      if (ligne.includes('// texte, pas du HTML')) return;
      for (const m of ligne.matchAll(interpolation)) {
        if (sur.test(m[0]) || ligne.slice(Math.max(0, m.index - 10), m.index) === 'new Date(`') continue;
        fautes.push(`ui/${nom}:${i + 1} ${m[0]}`);
      }
    });
  }
  assert.deepEqual(fautes, []);
});

test("paramètre de date de l'adresse : format AAAA-MM-JJ seulement, sinon valeur par défaut", () => {
  assert.equal(dateParametre('2026-11-24', '2000-01-01'), '2026-11-24');
  assert.equal(dateParametre('"><a href=x>', '2000-01-01'), '2000-01-01');
  assert.equal(dateParametre('2026-11-24"><b>', '2000-01-01'), '2000-01-01');
  assert.equal(dateParametre(undefined, '2000-01-01'), '2000-01-01');
  assert.equal(dateParametre('', '2000-01-01'), '2000-01-01');
});
