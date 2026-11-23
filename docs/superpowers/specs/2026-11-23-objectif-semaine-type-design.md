# Conception : objectif, semaine type et surcharge progressive (lot L8)

Date : 23/11/2026. Statut : à valider par Quentin.
Hors du CDC v2.0 : une fois validé, ce document donne lieu au lot **L8**, à ses fonctions F-80 à F-87 dans CLAUDE.md et à une entrée au journal des décisions.

---

## 1. Intention

Quentin prépare une **vraie course à date fixe**. Les outils qui génèrent un plan d'entraînement et l'envoient sur la montre sont payants. Il veut le faire **gratuitement** dans son appli :

1. il enregistre son **objectif** (la course) ;
2. il construit **une seule fois** sa **semaine type** (quelles séances, quels jours) ;
3. l'appli **déroule** cette semaine type jusqu'à la course avec une **surcharge progressive**, et envoie toutes les séances dans le calendrier Intervals.icu, d'où elles partent sur la Suunto comme aujourd'hui (boucle 1.5 du CDC).

Réussite : une préparation complète programmée en quelques minutes, que Quentin peut ajuster en cours de route sans tout refaire, sans payer d'abonnement.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Un objectif (course A) enregistré dans Intervals.icu, visible dans l'agenda et sur l'accueil.
- Une semaine type éditée avec l'éditeur de séances existant (L4), conservée dans Intervals.icu.
- Un modèle de progression par **blocs**, entièrement **paramétrable dans l'appli** (section 5).
- Un **aperçu** semaine par semaine avant tout envoi.
- L'envoi groupé des séances, puis la **régénération** des semaines à venir après une modification.

**Non-objectifs (pas dans L8)**
- Plusieurs objectifs simultanés ; courses B et C.
- Plusieurs semaines types selon la période (foncier, spécifique...).
- Progression de l'intensité : seules les quantités augmentent, **les zones ne changent jamais**.
- Adaptation automatique du plan à la forme (TSB) ou au ressenti.

**Anti-objectifs (échec même si « ça marche »)**
- Toucher à une séance que Quentin a programmée à la main.
- Envoyer des séances sans que Quentin ait vu et validé l'aperçu.
- Perdre la semaine type ou les réglages (déconnexion, changement de téléphone).
- Dépendre d'une fonction payante d'Intervals.icu.

## 3. Contraintes

- Règles du CDC inchangées : JS sans framework, couches `ui/` `logique/` `api/` `cache/`, fonctions pures testées (ENF-24), français, traçabilité F-xx.
- **ENF-05** : Intervals.icu est la seule source de vérité ; aucune donnée d'entraînement n'existe seulement dans l'appli.
- **ENF-07** : écriture en ligne seulement, rien n'est perdu en silence.
- **ENF-11** : appels sobres ; les séances sont créées **en lot**.
- Budget 0 € : uniquement des fonctions gratuites d'Intervals.icu.
- Tout endpoint et tout nom de champ est vérifié dans la spécification officielle avant usage (règle 0.2).

## 4. Approches envisagées (stockage de la semaine type)

| | Approche | Verdict |
|---|---|---|
| **1** | Semaine type = **dossier simple (`FOLDER`) de la bibliothèque Intervals.icu**, une séance de bibliothèque par séance de la semaine, avec son jour ; réglages écrits en clair dans la description du dossier | **Choisie par Quentin.** Respecte ENF-05, survit à la déconnexion, visible sur le site, réutilisable pour une prochaine course, s'appuie sur la bibliothèque déjà lue en L4 (F-47). |
| 2 | Semaine type stockée sur le téléphone (IndexedDB) | Écartée : perdue à la déconnexion ou au changement d'appareil, contraire à ENF-05. |
| 3 | Semaine type sérialisée dans le texte de l'objectif (événement course A) | Écartée : pollue l'affichage de la course sur Intervals.icu, fragile si le texte est modifié à la main. |

Le modèle de progression a lui aussi été discuté : A (linéaire), B (cycles avec coupure) et C (affûtage) ne sont pas des alternatives mais **les trois morceaux d'un même plan** (section 5).

## 5. Ce qui a été décidé

### 5.1 Objectif (F-80)
- Événement Intervals.icu de catégorie **`RACE_A`** : nom, date, sport. Un seul objectif actif à la fois.
- Créer, modifier, supprimer depuis l'appli. Supprimer l'objectif propose aussi de supprimer les séances futures du plan (F-87).
- Affiché dans l'agenda (jour de la course) et sur l'accueil (compte à rebours « J-xx », ou bouton « Définir un objectif » s'il n'y en a pas).

### 5.2 Semaine type (F-81)
- Du lundi au dimanche ; zéro, une ou plusieurs séances par jour.
- Chaque séance suit le modèle de L4 : sport, titre, séance simple (durée ou distance) ou structurée par blocs (échauffement, répétitions, corps de séance, retour au calme, cibles et zones), ou repos.
- Édition dans l'appli en **réutilisant l'éditeur de `ui/programmer.js`**.
- Stockage : approche 1 (section 4).

### 5.3 Modèle de progression (F-82, F-83)
Le plan démarre un lundi (par défaut le lundi qui suit la création) et se termine la semaine de la course. Le volume est exprimé en **pourcentage de la semaine type** (100 % = la semaine type telle quelle).

- **Blocs** : dans un bloc, le volume **monte de façon linéaire** pendant N semaines, puis vient **une semaine de coupure**.
- **Hausse linéaire** : + H points de pourcentage par semaine (additif, pas composé).
- **Coupure** : C % de la semaine qui la précède.
- **Reprise** : le bloc suivant **repart du volume de la semaine d'avant la coupure**, puis remonte.
- **Affûtage** : les dernières semaines descendent jusqu'à la course ; la dernière semaine est la semaine de course.
- **Plafond** en **heures par semaine** : une semaine qui le dépasserait est ramenée au plafond ; les coupures et l'affûtage s'appliquent ensuite normalement.

Exemple validé (H = 8, N = 3, C = 70 %, affûtage 2 semaines à 70 % puis 50 %, sans plafond atteint) :

```
Bloc 1   S1 100 %   S2 108 %   S3 116 %   S4  81 % (coupure)
Bloc 2   S5 116 %   S6 124 %   S7 132 %   S8  92 % (coupure)
Bloc 3   S9 132 %   S10 140 %
Affûtage S11 98 %   S12 70 % (semaine de course)
```

**Tous les paramètres sont réglables dans l'appli** : H, N, C, nombre et niveaux des semaines d'affûtage, plafond, date de début.

### 5.4 Surcharge d'une séance : règle mixte (F-83)
Un coefficient k (le pourcentage de la semaine) s'applique à chaque séance :
- **blocs continus** (échauffement, corps de séance, retour au calme, séance simple en durée) : la **durée** est multipliée par k ;
- **répétitions** : le **nombre de répétitions** est multiplié par k (au moins 1) ; la durée de chaque répétition et de chaque récupération ne change pas ;
- étapes en **distance** : la distance est multipliée par k ;
- **zones et cibles** : inchangées ;
- **repos** : recopié tel quel.

### 5.5 Aperçu et envoi (F-84, F-85)
- Aperçu avant envoi : une ligne par semaine (numéro, dates, pourcentage, volume réel en heures, type : hausse, coupure, affûtage, course). Toucher une semaine affiche ses séances.
- Le volume affiché est celui des séances **après arrondis**, donc le volume réellement envoyé.
- Bouton d'envoi avec le nombre de séances, désactivé hors ligne (M-04, ENF-07).
- Création **en lot** (`POST /athlete/{id}/events/bulk`). Chaque séance porte une **étiquette `external_id`** propre au plan, qui permet de retrouver ses séances sans toucher aux séances manuelles.

### 5.6 Régénération et suppression (F-86, F-87)
- Après une modification de la semaine type ou des réglages : les séances du plan **à partir du lundi suivant** sont supprimées (`PUT /athlete/{id}/events/bulk-delete`, par `external_id`), puis recréées. Les semaines passées et la semaine en cours ne bougent pas. La numérotation des semaines (blocs, affûtage) reste calée sur la date de début.
- « Supprimer le plan » : supprime les séances futures du plan et garde les semaines passées.
- Une séance du plan modifiée à la main dans Intervals.icu sera remplacée à la régénération ; l'aperçu le dit avant de valider.

## 6. Mes choix (à vérifier par Quentin à la lecture)

1. **Valeurs par défaut** : H = 8 points, N = 3 semaines, C = 70 %, affûtage 2 semaines à 70 % puis 50 % **de la dernière semaine avant l'affûtage**, plafond proposé = 1,5 fois le volume de la semaine type (arrondi à l'heure), date de début = lundi suivant.
2. **Semaines qui ne tombent pas juste** : les blocs sont posés depuis le début ; le dernier bloc avant l'affûtage est raccourci.
3. **Semaine de course** : aucune séance générée le jour de la course ni après ; la course elle-même est l'événement `RACE_A`.
4. **Arrondis** : durées des blocs continus à la minute (aux 5 minutes au-delà d'une heure) ; nombre de répétitions à l'entier le plus proche, au moins 1 ; distances aux 100 m en natation, aux 0,5 km ailleurs.
5. **Volume et plafond** : comptés sur les durées. Une étape en distance compte pour sa durée estimée avec l'allure seuil du sport (profil L5) ; sans allure seuil, elle ne compte pas, et l'aperçu le signale.
6. **Accès** : un écran « Objectif » (`#/objectif`), ouvert depuis le widget de l'accueil et depuis le Profil ; la semaine type, les réglages et l'aperçu sont des étapes de cet écran.
7. **Titres** des séances générées : titre de la séance type suivi de « S{n} » (ex. « Fractionné S5 »), pour s'y retrouver dans le calendrier.

## 7. Laissé à la construction

- Organisation des fichiers (probablement `logique/plan.js` pour le calcul pur, `api/objectif.js` et `api/semaine-type.js`, `ui/objectif.js`), découpage de l'éditeur L4 en composant réutilisable.
- Format exact de l'`external_id` (il doit contenir l'identifiant de l'objectif, la semaine et un index).
- Taille des lots d'envoi et retour visuel pendant l'envoi ; reprise propre après un échec partiel (une régénération supprime d'abord tout ce qui porte l'étiquette).
- **Vérifications obligatoires dans l'API avant de coder**, avec repli si un point échoue :
  - la création d'un dossier `FOLDER` et de séances de bibliothèque est **gratuite** (premier essai réel avec le compte de Quentin) ;
  - le sens du champ `day` d'une séance de bibliothèque (sinon : jour enregistré dans les étiquettes `tags`) ;
  - le champ `type` accepté pour un événement `RACE_A` de triathlon ;
  - le comportement de `external_id` et de `bulk-delete` avec une clé API (l'option `upsert` est réservée aux applications OAuth : ne pas s'en servir).
- Tests `node --test` du calcul de plan (blocs, reprise, plafond, affûtage, semaines qui ne tombent pas juste), de la règle mixte et des arrondis.
