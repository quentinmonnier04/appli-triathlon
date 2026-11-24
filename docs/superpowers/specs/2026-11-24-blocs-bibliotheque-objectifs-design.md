# Conception : bibliothèque de séances, blocs à contenu propre, objectifs de course (évolution du lot L8)

Date : 24/11/2026. Statut : à valider par Quentin. Remplace la « semaine type unique » de `2026-11-23-objectif-semaine-type-design.md` ; la grille, les horaires et le graphique de `2026-11-23-agenda-planificateur-design.md` sont conservés.

## 1. Intention
Quentin prépare une vraie course (le lot L8 envoie déjà un plan dans Intervals.icu, test réel validé). Aujourd'hui le plan répète **une seule semaine type** dont seul le volume change. Il veut une préparation **par blocs à spécificités différentes** (ex. un bloc Endurance, puis un bloc Spécifique) : **les exercices changent d'un bloc à l'autre, le volume et l'intensité montent**, pour arriver le jour de la course au niveau visé. Il veut aussi **saisir ses objectifs de course par discipline et pour les transitions**.

Il fait **tout dans l'appli** : il ne doit jamais avoir besoin d'aller sur le site. Les données restent rangées sur Intervals.icu (ENF-05 : rien ne se perd, téléphone et PC synchronisés).

Réussite : construire en quelques minutes une préparation en 2 à 4 blocs, chacun avec sa semaine, en réutilisant les séances communes sans les recopier, voir dans l'aperçu le volume monter de bloc en bloc, envoyer le plan sur la montre comme aujourd'hui, et voir son temps visé à côté du compte à rebours.

## 2. Objectifs, non-objectifs, anti-objectifs
**Objectifs**
- Bibliothèque « Mes séances » créée et modifiée dans l'appli.
- Plusieurs blocs, chacun avec un nom, une durée en semaines et sa propre grille de la semaine.
- Une séance de la bibliothèque peut être placée dans plusieurs blocs, et plusieurs fois dans un même bloc ; la modifier modifie toutes ses apparitions.
- Volume qui continue de monter d'un bloc à l'autre, calculé par l'appli.
- Objectifs de course : temps ou allure par discipline, temps de T1 et T2, temps total calculé, affichés.

**Non-objectifs (pour cette fois)**
- Suivi de l'écart entre le niveau actuel et les objectifs (prévu plus tard, après quelques semaines d'usage).
- Progression automatique des zones : **l'intensité vient des exercices choisis par Quentin dans chaque bloc**, l'appli ne change jamais une zone.
- Glisser-déposer, plusieurs préparations en parallèle, partage de plan.

**Anti-objectifs (échec même si « ça marche »)**
- Devoir aller sur le site Intervals.icu pour construire ou modifier la préparation.
- Devoir recopier une séance pour l'utiliser dans un autre bloc.
- Devoir calculer soi-même la taille d'une grille pour que le volume reste cohérent.
- Perdre la préparation actuelle (semaine type et réglages) au passage à la nouvelle version.
- Toucher aux séances programmées à la main (règle d'étiquette `external_id` inchangée).

## 3. Contraintes
- Règles de CLAUDE.md : HTML/CSS/JS sans framework, couches (`ui/` sans calcul ni réseau, `logique/` pure et testée, `api/` seule à appeler Intervals.icu, `cache/` seule à toucher IndexedDB), règles de sécurité 0.3 (échappement, confirmations, données inventées dans les tests), champs d'API vérifiés dans la spécification.
- Pas d'abonnement payant : on reste sur les dossiers `FOLDER` et les séances de bibliothèque déjà utilisés et testés gratuitement en réel. Pas de dossier « plan » natif.
- Hors ligne : lecture depuis le cache, écriture désactivée avec M-04 (ENF-07).

## 4. Approches envisagées
| | Approche | Bilan |
|---|---|---|
| **A** | **Blocs décrits dans la description du dossier** ; séances = séances de bibliothèque du dossier | **Choisie par Quentin.** Une écriture par modification de bloc, une séance placée dans plusieurs blocs sans copie, toute la préparation relue d'un coup. Limite : une séance supprimée sur le site laisse un emplacement orphelin, ignoré par l'appli. |
| B | Emplacements écrits dans les étiquettes de chaque séance (`b1-jour-3-18:30`) | Prolonge l'existant, mais déplacer une séance réécrit la séance, reconstruire un bloc demande de relire toutes les séances, limite du nombre d'étiquettes inconnue. |
| C | Dossier « plan » natif d'Intervals.icu | Écartée : une séance doit être recopiée dans chaque bloc, risque d'abonnement. |
| — | Stockage seulement dans l'appli (IndexedDB) | Écartée : contraire à ENF-05, tout serait perdu en vidant le cache. |

Pour la mise à l'échelle entre blocs, deux options ont été comparées (« le niveau continue sur la grille du bloc suivant » contre « chaque bloc repart de sa grille ») ; Quentin veut que **le volume continue de monter** : retenu en 5.3, en heures, ce qui évite l'emballement de la première option.

## 5. Ce qui est décidé

### 5.1 Bibliothèque « Mes séances »
- Le dossier `FOLDER` existant est renommé **« Mes séances (appli triathlon) »** ; chaque séance y reste une séance de bibliothèque (Workout), créée et modifiée avec l'éditeur actuel (`ui/programmer.js`, mode séance type).
- Une séance de la bibliothèque **n'a plus de jour ni d'heure** : ce sont ses emplacements dans les blocs qui en ont. Un repos peut aussi être placé (séance de type repos, comme aujourd'hui).
- Supprimer une séance de la bibliothèque la retire de tous les blocs, **après confirmation** indiquant dans combien de blocs elle est utilisée.
- Modifier une séance utilisée dans plusieurs blocs : l'éditeur l'indique (« Utilisée dans 2 blocs : la modification s'applique partout »).

### 5.2 Blocs
- Un bloc = **nom**, **durée en semaines**, **emplacements** `{ séance, jour (1 à 7), heure facultative }`.
- Chaque bloc a **sa grille** de la semaine (la grille actuelle : 5 h à 23 h, ligne « Sans heure », chevauchements côte à côte).
- Dans la grille d'un bloc :
  - toucher une case vide propose **« Choisir dans Mes séances »** (liste avec sport, titre, durée, graphique compact) ou **« Nouvelle séance »** (éditeur ; la séance créée rejoint la bibliothèque et est placée à ce jour et cette heure) ;
  - toucher une séance placée propose : modifier la séance (éditeur de la bibliothèque), changer son jour ou son heure **dans ce bloc**, la retirer **de ce bloc** (la séance reste dans la bibliothèque).
- Les blocs se suivent dans l'ordre de la liste ; on peut en ajouter, renommer, changer la durée, supprimer (confirmation), et **dupliquer un bloc** (copie des emplacements, mêmes séances : point de départ naturel du bloc suivant, qui reprend quelques séances et en ajoute de plus spécifiques).
- Un bloc vide (aucune séance hors repos) empêche l'aperçu et l'envoi, avec un message clair.

### 5.3 Calcul du volume
- **Bloc 1** : sa première semaine vaut le volume de sa grille.
- **Dans un bloc** : chaque semaine ajoute `hausse` points, exprimés en pourcentage du volume de la grille du bloc 1 (même sens qu'aujourd'hui : 100, 108, 116...), dans la limite du plafond en heures.
- **Coupure** : la dernière semaine de chaque bloc est une semaine de coupure (`coupure` % de la semaine précédente), **sauf pour le dernier bloc**, suivi directement de l'affûtage.
- **Bloc suivant** : sa première semaine **vaut le volume, en heures, de la dernière semaine de hausse du bloc précédent** ; les séances de sa grille sont mises à l'échelle pour atteindre ce volume (coefficient = volume visé / volume de sa grille), quelle que soit la taille de la grille. Les semaines suivantes montent de `hausse` points comme ci-dessus.
- **Affûtage** : les dernières semaines reprennent **la grille du dernier bloc**, à `affûtage` % (70 puis 50 par défaut) du volume de la dernière semaine de hausse. La dernière semaine est la semaine de la course (séances avant la date de course seulement, comme aujourd'hui).
- La surcharge d'une séance reste la règle mixte actuelle (`surchargerSeance` : durées des blocs continus, nombre de répétitions, distances arrondies, zones inchangées).
- Réglages communs à tous les blocs : hausse, coupure, affûtage, plafond. Le réglage « semaines de hausse par bloc » disparaît (remplacé par la durée de chaque bloc).

### 5.4 Calendrier du plan
- Le plan se cale **à rebours depuis la course** : semaine de course et affûtage en dernier, les blocs avant, dans l'ordre. La date de début est donc calculée : somme des durées des blocs + affûtage, comptée en lundis avant la semaine de course.
- Début dans le passé : normal (on est déjà dans un bloc) ; seules les semaines à venir sont envoyées, comme aujourd'hui. Début dans le futur : l'aperçu l'indique (« Le plan commence le 05/01 ») et rien n'est envoyé avant.
- Envoi, régénération, suppression, étiquette `external_id` `plan-{objectif}-s{n}-{date}-{i}`, envoi groupé et garde-fou sur l'étiquette : **inchangés**. Le réglage « Début du plan » et l'enregistrement de la date au premier envoi disparaissent (la numérotation ne dépend plus que des blocs et de la date de course).
- Titre des séances générées : « {titre} S{n} » comme aujourd'hui.

### 5.5 Aperçu
- Semaine par semaine comme aujourd'hui, avec en plus le **nom du bloc** de chaque semaine (et Affûtage, Course) et une séparation visible entre blocs, pour voir le volume monter de bloc en bloc.

### 5.6 Objectifs de course
- **Format** (triathlon) : XS (400 m, 10 km, 2,5 km), S (750 m, 20 km, 5 km), M (1,5 km, 40 km, 10 km), 70.3 (1,9 km, 90 km, 21,1 km), Ironman (3,8 km, 180 km, 42,2 km) ou distances personnalisées. Course d'un seul sport : une seule discipline, distance saisie.
- **Par discipline** : on saisit **un temps ou une allure**, l'appli calcule l'autre (natation min/100 m, vélo km/h, course min/km, formats de 9.4). **T1 et T2** : un temps. **Temps total visé** calculé.
- Champs facultatifs : on peut ne remplir que certaines disciplines ; le total n'apparaît que si tout est rempli.
- **Affichage** : carte de l'écran Objectif (tableau comme ci-dessous) et temps total visé à côté du compte à rebours sur l'accueil.
  ```
  Triathlon M - 21/02/2027                     Total visé : 2:28:30
  Natation   1,5 km   30:00   2:00 /100 m
  T1                   2:30
  Vélo        40 km  1:10:00  34,3 km/h
  T2                   1:30
  CAP         10 km    44:30  4:27 /km
  ```
- **Stockage** : dans l'événement course (`RACE_A`) d'Intervals.icu, champ `description` (vérifié dans la spécification : `EventEx.description`), dans une section gérée par l'appli ; le texte que Quentin aurait écrit ailleurs dans la description est conservé.

### 5.7 Stockage de la préparation (approche A)
- Description du dossier : une ligne lisible d'en-tête puis les données de la préparation (version de format, réglages, blocs avec leurs emplacements qui citent l'identifiant de chaque séance de bibliothèque). Format exact laissé à la construction ; il doit être tolérant (champ inconnu ignoré, séance absente ignorée).
- Une écriture de la description par modification de bloc ou de réglage ; les séances de bibliothèque s'écrivent séparément (création, modification, suppression).
- Cache comme aujourd'hui (5 min, repli hors ligne).

### 5.8 Passage depuis la version actuelle (migration automatique)
- À la première lecture, si le dossier « Semaine type (appli triathlon) » a l'ancien format : il est renommé, les séances deviennent la bibliothèque, leur jour et leur heure (étiquettes `jour-N`, `heure-hh:mm`) deviennent les emplacements, et les réglages hausse, coupure, affûtage, plafond sont repris. Les anciennes étiquettes de jour et d'heure peuvent rester sur les séances (ignorées).
- **Le plan migré doit être identique au plan actuel** (même date de début, mêmes volumes semaine par semaine, même numérotation et mêmes `external_id`) : la migration crée **autant de blocs que de cycles actuels** (« Bloc 1 », « Bloc 2 »... avec les mêmes emplacements), de `semainesHausse + 1` semaines chacun, le dernier bloc prenant les semaines restantes avant l'affûtage (sans coupure). L'intervalle est celui de l'ancien plan : date de début enregistrée pour cet objectif (`debut` si `objectifDebut` correspond), sinon début par défaut (lundi suivant), jusqu'à la course. Sans objectif, un seul « Bloc 1 » de `semainesHausse + 1` semaines. Un test de non-régression compare l'ancien et le nouveau calcul sur des cas types. Quentin rend ensuite chaque bloc spécifique en modifiant sa grille.
- Le plan déjà envoyé reste dans le calendrier ; le prochain envoi le régénère à partir du lundi suivant, comme toute régénération.
- La migration n'écrit rien sans réseau ; tant qu'elle n'est pas faite, l'ancien format est lu tel quel.

## 6. Mes choix (à vérifier par Quentin à la lecture)
- **Dernier bloc sans coupure** : il enchaîne directement sur l'affûtage, qui joue déjà ce rôle.
- **Affûtage sur la grille du dernier bloc**, sans grille à construire.
- **Hausse en points du volume de départ du plan** (comme aujourd'hui), pas en pourcentage de chaque semaine.
- **Plan calé à rebours depuis la course**, ce qui supprime le réglage « Début du plan ».
- **Migration fidèle** : ta semaine type actuelle devient autant de blocs identiques que de cycles déjà prévus, pour que ton plan en cours ne change pas d'un chiffre ; tu les spécialises ensuite.
- **Dupliquer un bloc** ajouté : c'est la façon la plus rapide de faire le bloc suivant.
- **Mes séances proposées aussi comme modèles** lors de la programmation d'une séance à la main (F-47), puisqu'elles sont maintenant une vraie bibliothèque. Aujourd'hui elles en sont exclues.
- **Temps total visé** recopié aussi dans le champ `time_target` de l'événement course, s'il se révèle être bien le temps visé (à vérifier en réel ; sinon seulement dans la description).

## 7. Laissé à la construction
- Découpage du code (nouveaux modules `logique/blocs.js`, `logique/objectifs-course.js`, évolution de `api/semaine-type.js` ou nouveau `api/preparation.js`), format exact des données dans la description du dossier, présentation de la liste des blocs (onglets ou accordéon) et du choix dans la bibliothèque (feuille en bas d'écran ou écran dédié), routes exactes.
- Vérifier en test réel la longueur acceptée par la description d'un dossier ; si elle était limitée, compacter le format.
- Mise à jour de CLAUDE.md (fonctions F-8x, écran E-09, journal).
