# Spécification MVP — « Dispatch 200 offres » : répartir les tâches, pas planifier les heures

> Brief d'origine, recopié tel quel le 2026-11-10. Les décisions du PM prises pendant le développement, qui **priment sur ce texte**, sont listées dans [decisions-pm.md](decisions-pm.md). La version de l'application qui correspond à ce brief validé est le tag `v1.0-mvp`.

## 0. Consignes pour le développeur (humain ou agent IA)
- Construis l'application en suivant le plan de la section 9, une étape à la fois. À la fin de chaque étape, arrête-toi, résume ce qui est fait et liste ce que le PM doit vérifier. N'enchaîne pas sur l'étape suivante sans validation.
- N'invente aucune règle métier. Si une règle de la section 6 est ambiguë ou contradictoire, pose la question au lieu de choisir.
- Isole toute la logique métier (section 6) dans un module TypeScript pur, sans accès base de données ni UI, couvert par des tests unitaires.
- Interface en français. Code, noms de variables et commentaires en anglais.

## 1. Vision
- **Problème** : 200 nouveaux marchands doivent avoir leur offre publiée en 22 jours ouvrés. Chaque offre passe par 5 étapes (S1 à S5), avec des dépendances et un délai technique de 24h entre S4 et S5. 3 contributeurs (Alice, Bob, Charlie) donnent chacun 1h par jour, **au moment qu'ils choisissent**, et n'ont pas tous les mêmes compétences. Un planning horaire serait faux dès le premier jour.
- **Solution** : un outil de répartition dynamique (dispatching). À chaque connexion et après chaque étape déclarée faite, il recalcule pour chacun la liste des tâches les plus utiles à cet instant. Une tour de contrôle alerte dès que l'objectif devient impossible sans action, et propose des actions de rattrapage applicables en un clic.
- **Utilisateurs** : 3 contributeurs (Alice, Bob, Charlie) et 1 orchestrateur.
- **Résultat attendu** : une démo jouable en direct par 4 personnes simultanément, sur des données fictives, avec une horloge simulée partagée, un mode auto pour accélérer et un bouton Reset pour recommencer.

## 2. Périmètre MVP

### Inclus
- Sélection de profil sans mot de passe (4 profils).
- Écran « Mes tâches » par contributeur, recalculé en temps réel.
- Déclaration « Fait » par étape, avec horodatage simulé et décompte du budget de 60 min par jour.
- Horloge simulée partagée, pilotée par l'orchestrateur.
- Mode auto : joue automatiquement les sessions des contributeurs jusqu'à un jour choisi.
- Suivi des 200 offres (statut de chaque étape).
- Tour de contrôle : contrôles de capacité, niveau vert/orange/rouge, courbe réel vs référence.
- 5 actions de rattrapage applicables en un clic.
- Absences déclarées et absences détectées.
- Journal des événements.
- Bouton « Réinitialiser la démo ».

### Exclu (hors scope, ne pas implémenter)
- Authentification réelle, gestion de comptes, droits fins.
- Notifications externes (Slack, e-mail).
- Connexion au backend Joko ; création réelle de marchands ou d'offres.
- Rejet d'une offre en S5 et boucle de correction.
- Bouton « Valider toute ma liste » : chaque étape se valide une par une.
- Interface en anglais, multi-lots, modification des durées ou du nombre d'offres depuis l'UI (ce sont des constantes de configuration).
- Application mobile native.

## 3. User stories (MoSCoW) et critères d'acceptation

### MUST

**US-01 — Choisir un profil**
- Given l'écran d'accueil, When je clique sur « Bob », Then j'arrive sur « Mes tâches » de Bob et ce choix est mémorisé dans le navigateur (localStorage).
- Given je suis connecté en tant que Bob, When je clique sur « Changer de profil », Then je reviens à l'accueil.
- Given le profil « Orchestrateur », When je le choisis, Then j'arrive sur la Tour de contrôle et j'ai accès aux écrans E2 à E5.

**US-02 — Voir mes tâches**
- Given l'horloge à J2 10:00, les S2 des marchands de rang 1 à 12 faits, aucun S4 fait, et Bob avec 60 min de budget restant, When Bob ouvre « Mes tâches », Then la liste affiche d'abord les 12 S4 (rangs 1 à 12, triés par heure de fin du S2), puis des S1, pour un total de durées ≤ 60 min.
- Given une tâche dont l'étape ne fait pas partie des compétences de la personne, When la liste est calculée, Then cette tâche n'apparaît jamais.
- Given une tâche non prête (dépendances non satisfaites ou délai de 24h non écoulé), When la liste est calculée, Then elle n'apparaît pas.

**US-03 — Déclarer une étape faite, avec recalcul en direct**
- Given Alice voit « S2 — marchand rang 5 », When elle clique « Fait », Then l'étape est enregistrée avec son auteur et son heure simulée de fin, son budget baisse de 3 min, et sa liste se recalcule en moins de 1 s.
- Given Bob a « Mes tâches » ouvert dans un autre navigateur, When Alice valide le S2 du rang 5, Then le S4 du rang 5 apparaît dans la liste de Bob en moins de 2 s, sans rechargement manuel.
- Given Charlie et Bob voient tous deux un S5 pour le même marchand (cas limite), When Bob clique « Fait » puis Charlie clique « Fait », Then l'action de Charlie est refusée avec le message « Déjà faite par Bob » et sa liste se recalcule.

**US-04 — Règle des 24h**
- Given le S4 du rang 3 terminé à J2 10:03 (mardi), When l'horloge affiche J3 10:00, Then le S5 du rang 3 n'est proposé à personne, et le suivi affiche « S5 possible à partir de J3 10:03 ».
- Given le même cas, When l'horloge affiche J3 10:03 ou plus tard, Then le S5 est proposé (si S3 est fait).

**US-05 — Budget quotidien de 60 min**
- Given Bob a validé 20 S4 aujourd'hui (60 min), When sa liste se recalcule, Then elle est vide et affiche « Ton heure du jour est faite ».
- Given Charlie a 3 min de budget restant, un S3 prêt (6 min) et un S5 prêt (3 min), When sa liste se recalcule, Then le S3 n'est pas proposé et le S5 l'est.
- Given l'horloge passe au jour suivant, When Bob ouvre sa liste, Then son budget est revenu à 60 min.

**US-06 — Horloge simulée partagée**
- Given le profil Orchestrateur sur l'écran Horloge, When il clique « +1h » à J4 18:30, Then l'horloge passe à J5 08:00 (au-delà de 19:00, saut au jour ouvré suivant à 08:00).
- Given l'horloge à J5 (vendredi) 12:00, When l'orchestrateur clique « Jour suivant », Then l'horloge passe à J6 (lundi) 08:00.
- Given 4 navigateurs ouverts, When l'horloge change, Then tous affichent la nouvelle heure en moins de 2 s.
- L'horloge ne recule jamais, sauf par Reset.

**US-07 — Mode auto**
- Given l'état initial et la graine 42, When l'orchestrateur lance « Jouer jusqu'au début de J10 », Then les sessions de J1 à J9 sont jouées avec le même moteur de priorités, l'horloge affiche J10 08:00, et le journal contient une entrée par étape faite, marquée « auto ».
- Given la même graine et le même état de départ, When on rejoue le mode auto, Then on obtient exactement le même résultat (déterminisme).
- Given le mode auto en cours, When un contributeur clique « Fait », Then le bouton est désactivé et un bandeau affiche « Simulation en cours ».

**US-08 — Suivi des 200 offres**
- Given l'écran Suivi, When je l'ouvre, Then je vois 200 lignes. Chaque ligne affiche, pour S1 à S5 : fait ou non, par qui, à quelle heure simulée, et l'heure à partir de laquelle S5 est possible.
- Given le filtre « Bloquées en attente des 24h », When je l'active, Then je ne vois que les offres avec S3 et S4 faits, S5 non fait et le délai non écoulé.

**US-09 — Tour de contrôle**
- Given l'état initial (J1 08:00), When l'orchestrateur ouvre la Tour de contrôle, Then il voit 0/200 publiées, les 5 contrôles de la règle R9 avec leur marge en minutes et en jours, et le niveau global « Vert ».
- Given Charlie déclaré absent à J5 et J6, et l'état décrit dans l'exemple de R9, When la tour se recalcule, Then le contrôle S3 affiche une marge de −60 min et le niveau global passe à « Rouge ».

**US-10 — Actions de rattrapage en un clic**
- Given le niveau Orange ou Rouge, When l'orchestrateur ouvre la Tour de contrôle, Then il voit les 5 actions de R11, dans l'ordre, avec la personne ou l'étape concernée pré-remplie et un bouton « Appliquer ».
- Given l'action « Former un remplaçant : Alice sur S3 », When il clique « Appliquer », Then S3 est ajoutée aux compétences d'Alice, l'action est journalisée, les contrôles et toutes les listes « Mes tâches » se recalculent, et la marge S3 augmente du montant calculé en R9.
- Given une action appliquée, When l'orchestrateur clique « Annuler » sur cette action dans l'écran Paramètres, Then l'effet est retiré et tout se recalcule.

**US-11 — Réinitialiser la démo**
- Given n'importe quel état, When l'orchestrateur clique « Réinitialiser la démo » puis confirme, Then : les 200 offres repartent sans aucune étape faite, l'horloge revient à J1 08:00, les compétences et priorités reprennent leurs valeurs par défaut, et les absences, heures exceptionnelles, actions appliquées, réservations et le journal sont vidés. La trajectoire de référence est recalculée.
- Given 4 navigateurs ouverts, When le reset est fait, Then tous affichent l'état initial en moins de 3 s, et chaque utilisateur garde son profil.

**US-12 — Pas de doublon entre les listes**
- Given Bob et Charlie connectés à J1 08:00 sans aucune étape faite, When leurs deux listes sont calculées, Then aucune tâche S1 n'apparaît dans les deux listes à la fois.

### SHOULD

**US-13 — Faire une tâche hors priorités**
- Given Bob a une section repliée « Autres tâches possibles » (tâches prêtes, dans ses compétences, absentes de sa liste), When il valide une de ces tâches, Then elle est enregistrée, un incident « Tâche hors priorités » est journalisé, et toutes les listes se recalculent.

**US-14 — Absences**
- Given Charlie sur « Mes tâches », When il déclare une absence pour J7, Then son budget de J7 vaut 0, la tour de contrôle se recalcule et le journal contient « Absence déclarée ».
- Given Alice n'a rien validé à J3 sans avoir déclaré d'absence, When l'horloge passe à J4, Then le journal contient « Absence détectée — Alice — J3 ».

**US-15 — Courbe réel vs référence**
- Given la Tour de contrôle, When je l'ouvre, Then je vois une courbe des offres publiées cumulées par jour (réel jusqu'à aujourd'hui) superposée à la trajectoire de référence calculée au reset.

**US-16 — Journal**
- Given l'écran Journal, When je l'ouvre, Then je vois les événements du plus récent au plus ancien (type, personne, détail, heure simulée, heure réelle), filtrables par type.

### COULD
- **US-17 — Projection** : la tour affiche les offres publiées projetées à J22 (minimum et médiane sur 20 simulations du reste du mois en mode auto, sur une copie de l'état).
- **US-18 — Aperçu d'impact** : avant « Appliquer », afficher la marge du contrôle concerné après action.
- **US-19 — Export CSV** du suivi des offres.
- **US-20 — Qui est connecté** : pastilles des profils ayant une session active.

### WON'T (cette version)
Slack, authentification réelle, connexion au backend Joko, rejets S5, interface en anglais.

## 4. Parcours utilisateur et écrans

**Barre supérieure (tous les écrans)** : nom du profil, horloge simulée (format « J3 · mer. 10:03 »), niveau global (pastille verte, orange ou rouge), lien « Changer de profil ». Pour l'orchestrateur : onglets E2 à E6.

| Écran | Qui | Éléments clés |
|---|---|---|
| **E0 Accueil** | Tous | 4 cartes de profil (Alice, Bob, Charlie, Orchestrateur), horloge simulée actuelle |
| **E1 Mes tâches** | Contributeurs ; orchestrateur si l'action « Renfort S1 » est active | Budget du jour (« 42 / 60 min restantes »), liste ordonnée (étape, marchand + rang, durée, badge « majeure » ou « secondaire », raison courte comme « débloque le compteur 24h »), bouton « Fait » sur chaque ligne, section repliée « Autres tâches possibles », bouton « Déclarer une absence », message quand le budget est épuisé ou que rien n'est prêt |
| **E2 Tour de contrôle** | Orchestrateur | Indicateurs (publiées /200, nombre fait par étape, jour courant / 22), tableau des 5 contrôles (besoin, capacité, marge en min et en jours, niveau), niveau global, courbe réel vs référence, actions de rattrapage proposées avec bouton « Appliquer » |
| **E3 Suivi des offres** | Tous (lecture seule) | Tableau des 200 offres, filtres (étape en attente, bloquées 24h, publiées), recherche par nom |
| **E4 Horloge et simulation** | Orchestrateur | Boutons « +1h », « +2h », « Jour suivant », « Aller au début de Jx » ; mode auto (« Jouer la journée en cours », « Jouer jusqu'au début de Jx », champ graine) ; bouton « Réinitialiser la démo » avec confirmation |
| **E5 Équipe et paramètres** | Orchestrateur | Par personne : compétences, tâche majeure, ordre de priorité, mode forcé, absences, heures exceptionnelles ; renfort S1 ; liste des actions appliquées avec bouton « Annuler » |
| **E6 Journal** | Orchestrateur | Liste filtrable des événements |

**Navigation** : E0 → E1 (contributeur) ou E2 (orchestrateur). Un contributeur ne voit que E1 et E3. L'orchestrateur voit E2 à E6, et E1 quand le renfort S1 est actif.

## 5. Modèle de données

Temps simulé = **entier en minutes depuis le lundi 00:00 de la semaine 1** (J1 = lundi). Pas de fuseau horaire. 1 jour = 1 440 min. Les week-ends existent dans l'axe du temps (ils comptent pour les 24h) mais ne sont jamais jours ouvrés.

| Entité | Champs principaux | Relations |
|---|---|---|
| `offer` | `id`, `rank` (1–200, ordre de traitement), `merchant_name`, `importance` (A/B/C), `category`, `description`, `url`, `image_url`, `logo_url` | 1 offre = 1 marchand ; 0..5 `step_execution` |
| `step_execution` | `id`, `offer_id`, `step` (S1–S5), `done_by` (person_id), `done_at_sim` (min), `done_at_real` (timestamp), `in_priority` (bool), `source` (manual/auto) | **Unique (`offer_id`, `step`)** |
| `person` | `id`, `name`, `role` (contributor/orchestrator), `skills` (liste d'étapes), `major_step`, `priority_order` (liste ordonnée d'étapes), `forced_mode` (bool), `forced_sequence` (liste d'étapes), `daily_budget_min` (60 ; 0 pour l'orchestrateur) | 0..n `day_adjustment`, 0..1 `session` par jour |
| `day_adjustment` | `person_id`, `day_index` (1–22), `extra_min`, `absent_declared` (bool), `absent_detected` (bool) | |
| `session` | `person_id`, `day_index`, `cursor_sim` (min), `consumed_min`, `last_heartbeat_real` | Unique (`person_id`, `day_index`) |
| `reservation` | `person_id`, `offer_id`, `step`, `expires_at_real` | Tâches actuellement affichées dans la liste d'une personne |
| `sim_state` (singleton) | `now_sim`, `seed`, `auto_running` (bool), `reference_curve` (JSON : publiées cumulées en fin de J1…J22), `renfort_s1` (JSON : actif, budget/jour, depuis jour) | |
| `applied_action` | `id`, `type` (FORCE_ORDER, RENFORT_S1, TRAIN_BACKUP, EXTRA_HOUR, RERANK), `params` (JSON), `applied_at_sim`, `cancelled` (bool) | |
| `event` | `id`, `type` (STEP_DONE, OUT_OF_PRIORITY, ABSENCE_DECLARED, ABSENCE_DETECTED, ACTION_APPLIED, ACTION_CANCELLED, CLOCK_CHANGED, AUTO_RUN, RESET), `person_id`, `payload` (JSON), `at_sim`, `at_real` | |

**Constantes de configuration** (fichier unique) : `DURATIONS = {S1:3, S2:3, S3:6, S4:3, S5:3}`, `OFFER_COUNT = 200`, `BUSINESS_DAYS = 22`, `DAY_START = 08:00`, `DAY_END = 19:00`, `DELAY_S4_S5 = 1440`, `DAILY_BUDGET = 60`.

**Valeurs par défaut des personnes**

| Personne | Compétences | Tâche majeure | Ordre de priorité |
|---|---|---|---|
| Alice | S1, S2 | S2 | S2 puis S1 du même marchand |
| Bob | S1, S4, S5 | S4 | S4 > S5 > S1 |
| Charlie | S1, S3, S5 | S3 | S3 > S5 > S1 |
| Orchestrateur | aucune | aucune | — |

**Données fictives (seed déterministe)** : 200 marchands avec des noms français inventés, une catégorie, une description de 1 à 2 phrases et une URL `https://demo.invalid/m/<slug>`. Importance : 40 A, 80 B, 80 C. Les logos et images sont des SVG générés localement (initiales sur fond coloré) : aucune image externe. `rank` = ordre de l'id au départ.

## 6. Règles métier et logique de calcul

**R1 — Tâche prête (dépendances)**
- S1 et S2 : toujours prêtes si non faites.
- S3 : S1 et S2 faites.
- S4 : S2 faite.
- S5 : S3 et S4 faites, et R2 respectée.
- *Exemple* : marchand rang 7 avec S2 fait et S1 non fait → S4 prête, S3 non prête.

**R2 — Délai de 24h**
- S5 est prête si `now_sim ≥ S4.done_at_sim + 1440`. Les week-ends comptent.
- *Exemple 1* : S4 finie à J2 (mardi) 10:03 = 1×1440 + 603 = 2 043. S5 possible à partir de 3 483, soit J3 10:03.
- *Exemple 2* : S4 finie à J5 (vendredi) 17:00 = 6 780. À J6 (lundi) 08:00 = 10 560, 63h se sont écoulées : S5 prête.

**R3 — Horodatage de session**
- `done_at_sim` = heure de **fin** de l'étape, calculée par un curseur personnel.
- Au clic « Fait » : si la session du jour n'existe pas, ou si `cursor_sim < now_sim`, alors `cursor_sim = now_sim`. Ensuite `done_at_sim = cursor_sim + durée`, et `cursor_sim = done_at_sim`.
- *Exemple* : Bob ouvre sa session à J2 10:00 → 1er S4 fini à 10:03, 2e à 10:06, 20e à 11:00. Le S5 de la 20e offre sera possible à J3 11:00.

**R4 — Budget quotidien**
- Budget du jour = `daily_budget_min + extra_min`, ou 0 si `absent_declared`.
- Consommé = somme des durées des étapes validées ce jour-là par la personne. Le jour est celui de `now_sim` au moment du clic.
- Une tâche n'est proposée que si sa durée ≤ budget restant. Une tâche trop longue est sautée, et la suivante qui tient est proposée.
- *Exemple* : Charlie a consommé 57 min, il lui reste 3 min. Un S3 (6 min) est prêt, mais n'est pas proposé ; le S5 prêt (3 min) l'est.

**R5 — Ordre de la liste « Mes tâches »**
- Filtre : étapes dans les compétences de la personne, tâches prêtes (R1, R2), non réservées par une autre personne active (R7).
- Tri par rang d'étape dans `priority_order`, puis par ancienneté dans l'étape :
  - S4 : par `S2.done_at_sim` croissant ;
  - S3 : par max(`S1.done_at_sim`, `S2.done_at_sim`) croissant ;
  - S5 : par heure de déblocage croissante ;
  - S1 et S2 : par `rank` croissant.
  - Égalité : `rank` croissant.
- On ajoute les tâches dans cet ordre tant que le cumul des durées ≤ budget restant (R4).
- **Cas particulier d'Alice** : elle parcourt les marchands par `rank` croissant. Pour chaque marchand sans S2 : S2, puis S1 du même marchand si S1 n'est ni faite ni réservée. Quand tous les S2 sont faits : les S1 restants par `rank`.
- *Exemple Alice sans aide* : liste = S2 r1, S1 r1, S2 r2, S1 r2, …, S2 r10, S1 r10 (60 min, 10 marchands).
- *Exemple Alice avec aide* : les S1 des rangs 1 à 40 ont déjà été faits par Bob et Charlie à J1 → liste = S2 r1 … S2 r20 (60 min).
- *Exemple Bob à J2* : 12 S4 prêts, aucun S5 → 12 S4 (36 min) + 8 S1 (24 min).

**R6 — Recalcul en direct**
- Recalcule les listes de **toutes** les personnes connectées à chaque événement : étape faite, horloge modifiée, action appliquée ou annulée, absence, reset.
- Diffuse le changement aux clients (temps réel, ou polling toutes les 2 s en secours).

**R7 — Réservations (pas de doublon)**
- Les tâches affichées dans la liste d'une personne sont réservées pour elle (`expires_at_real` = maintenant + 60 s, prolongé par un heartbeat toutes les 20 s tant que l'écran est ouvert).
- Une tâche réservée par une autre personne active est exclue du calcul. À chaque recalcul, les réservations de la personne sont remplacées.
- Le clic « Fait » est atomique côté serveur (contrainte d'unicité). Si l'étape est déjà faite, refuse avec « Déjà faite par X ».
- *Exemple* : à J1 08:00, Bob reçoit les S1 des rangs 1 à 20 ; Charlie, qui se connecte ensuite, reçoit les rangs 21 à 40.

**R8 — Tâche hors priorités**
- Une étape validée depuis « Autres tâches possibles » est enregistrée avec `in_priority = false` et génère un événement OUT_OF_PRIORITY, puis R6 s'applique.

**R9 — Contrôles de capacité (tour de contrôle)**
- `capRest(p, jusqu'à Jd)` = budget restant aujourd'hui + budgets des jours ouvrés suivants jusqu'à Jd inclus. Un jour d'absence déclarée vaut 0 ; les `extra_min` s'ajoutent.
- Pour chaque étape contrôlée X, avec son échéance :
  - `besoin_X = restants_X × durée_X` ;
  - `capa_X = Σ capRest(p, échéance_X)` sur les personnes compétentes pour X, `− Σ engagement_p`, où `engagement_p` = charge restante des **autres** étapes dont p est le seul compétent ;
  - `marge_X = capa_X − besoin_X` (en min ; en jours = marge / 60).

| Contrôle | Échéance | Calcul à J1 08:00 (état initial) | Marge |
|---|---|---|---|
| S2 | J19 | 200×3 = 600 vs Alice 19×60 = 1 140 | +540 |
| S3 | J22 | 200×6 = 1 200 vs Charlie 22×60 = 1 320 | +120 |
| S4 | J20 | 200×3 = 600 vs Bob 20×60 = 1 200 | +600 |
| S5 | J22 | 600 vs (Bob 1 320 + Charlie 1 320) − (S4 600 + S3 1 200) = 840 | +240 |
| Global | J22 | 3 600 vs 3 960 (+ renfort S1 éventuel) | +360 |

- *Exemple de dégradation* : début de J5, 30 S3 faits. Besoin S3 = 170 × 6 = 1 020. Capacité de Charlie de J5 à J22 = 18 × 60 = 1 080, marge +60. Avec 1 jour d'absence déclarée : 1 020 vs 1 020, marge 0. Avec 2 jours : 960 vs 1 020, marge −60.
- *Exemple avec remplaçant* : Alice formée sur S3 à J5, avec 120 S2 restants. `capa_S3` = 1 080 (Charlie) + (Alice 1 080 − 120×3) = 1 800.
- Les contrôles se recalculent à chaque événement (R6). Un instantané est stocké à chaque changement de jour.

**R10 — Niveaux**
- Par contrôle : **Vert** si marge > 60 min ; **Orange** si 0 ≤ marge ≤ 60 ; **Rouge** si marge < 0.
- Niveau global = le pire des 5 contrôles.
- *Exemple* : marges +540, 0, +600, +240, +360 → global Orange.

**R11 — Actions de rattrapage**
- Elles sont proposées si le niveau global est Orange ou Rouge, toujours dans cet ordre.
- « Personne concernée » = le seul compétent du pire contrôle. Si ce contrôle est partagé ou global, l'orchestrateur choisit.
- Chaque action est applicable en un clic, journalisée et annulable.

| # | Action | Effet en un clic | Exemple chiffré |
|---|---|---|---|
| 1 | Forcer l'ordre | `forced_mode = true` pour la personne concernée : la liste ne montre qu'**une** tâche à la fois, uniquement dans `forced_sequence` (défaut = sa tâche majeure seule). L'étape suivante de la séquence n'est proposée que lorsqu'aucune tâche de l'étape précédente n'est prête. | Charlie, séquence [S3] : 1 seul S3 affiché ; jamais de S5 ni de S1. |
| 2 | Renfort externe sur S1 | Active `renfort_s1` : l'orchestrateur reçoit la compétence S1 et 60 min/jour à partir d'aujourd'hui ; le mode auto le joue aussi. | À J10, 13 jours restants → capacité globale +780 min. |
| 3 | Former un remplaçant | Ajoute l'étape bloquante aux compétences d'une personne (défaut : Alice sur S3), en dernière position de son `priority_order`. | Voir l'exemple « remplaçant » en R9 : `capa_S3` passe de 1 080 à 1 800. |
| 4 | Heure exceptionnelle | `extra_min += 60` pour une personne et un jour choisis (défaut : la personne concernée, aujourd'hui). | Charlie +60 aujourd'hui → marge S3 +60. |
| 5 | Prioriser les marchands importants | Recalcule `rank` : A d'abord, puis B, puis C, l'ordre d'id étant conservé dans chaque groupe. | Les 40 marchands A prennent les rangs 1 à 40. |

**R12 — Absences**
- *Déclarée* (par la personne ou l'orchestrateur, pour aujourd'hui ou un jour futur) : budget de ce jour = 0.
- *Détectée* : au passage au jour ouvré suivant, une personne sans aucune consommation ni absence déclarée génère ABSENCE_DETECTED. Pas d'effet rétroactif sur le budget.

**R13 — Horloge**
- Seul l'orchestrateur la modifie. « +1h » ou « +2h » : si le résultat dépasse 19:00, l'horloge passe au jour ouvré suivant à 08:00.
- « Jour suivant » : jour ouvré suivant, 08:00.
- J22 19:00 est la borne finale : au-delà, l'horloge reste à J22 19:00 et affiche « Fin du mois ».

**R14 — Mode auto**
- Utilise exactement les mêmes fonctions que R1 à R12.
- Pour chaque jour à jouer et chaque contributeur non absent avec du budget restant : tire une heure de connexion uniforme entre 08:00 et 18:00, avec un générateur pseudo-aléatoire graine-able (graine dans `sim_state`), sans dépasser `now_sim` pour le jour en cours.
- Traite les sessions par heure de connexion croissante. Pour chacune : positionne l'horloge à l'heure tirée, puis prend la 1re tâche de la liste, la valide (source = auto), recalcule, et recommence jusqu'à ce qu'aucune tâche ne tienne dans le budget.
- Le renfort S1, s'il est actif, est joué comme un 4e contributeur.
- En fin de jour : passage au jour suivant à 08:00, et R12 (absences détectées).
- Verrou : pendant l'exécution, `auto_running = true` et les clics « Fait » manuels sont refusés.
- *Test de référence* : depuis l'état initial, sans absence, pour 50 graines différentes, les 200 offres sont publiées au plus tard à J22 19:00. Si ce test échoue, **ne modifie pas les règles** : signale l'écart au PM avec les graines concernées.

**R15 — Trajectoire de référence**
- Au reset, exécute le mode auto sur une copie en mémoire, de J1 à J22, avec la graine 42.
- Stocke le nombre cumulé d'offres publiées en fin de chaque jour dans `reference_curve`.
- La courbe ne change plus avant le prochain reset.

**R16 — Reset**
- Transaction unique : vide `step_execution`, `session`, `reservation`, `day_adjustment`, `applied_action`, `event` ; restaure les valeurs par défaut des personnes et des rangs ; `now_sim` = J1 08:00 ; recalcule R15 ; journalise RESET ; diffuse.

## 7. Stack et contraintes techniques (proposition)
- **Framework** : Next.js (App Router) + TypeScript, Tailwind CSS, composants shadcn/ui, graphiques Recharts.
- **Base de données et temps réel** : Supabase (Postgres + Realtime), offre gratuite.
- **Hébergement** : Vercel (offre Hobby, gratuite), connecté au dépôt GitHub.
- **Architecture** :
  - `lib/engine/` : module pur (R1 à R15), sans dépendance à la base de données.
  - Les écritures passent par des routes serveur Next.js qui utilisent la clé service Supabase, jamais exposée au client.
  - Le clic « Fait » appelle une fonction Postgres (RPC) transactionnelle.
  - Les clients lisent via la clé anonyme, avec des politiques RLS en lecture seule, et s'abonnent au Realtime sur `step_execution`, `sim_state`, `person`, `applied_action` et `day_adjustment`.
- **Authentification** : aucune. Profil choisi stocké en localStorage. Accès optionnel par un code de démo (variable d'environnement `DEMO_ACCESS_CODE`, cookie après saisie) ; s'il n'est pas défini, l'accès est libre.
- **Données** : seed TypeScript déterministe (section 5). Aucune API externe.
- **Tests** : Vitest pour le moteur (chaque exemple chiffré de la section 6 devient un test) ; un test d'intégration du mode auto (R14).
- **Livrables** : README (installation locale, variables d'environnement, déploiement Vercel + Supabase, script de démo en 5 minutes).

## 8. Exigences non fonctionnelles
- **Performance** : recalcul d'une liste < 300 ms côté serveur ; propagation d'un changement aux autres navigateurs < 2 s ; reset < 3 s ; mode auto sur 22 jours < 10 s.
- **Concurrence** : 4 utilisateurs simultanés sans incohérence (aucune étape enregistrée deux fois, aucune tâche dans deux listes).
- **Sécurité et données personnelles** : uniquement des données fictives, aucune donnée personnelle réelle collectée ; clé service uniquement côté serveur ; validation des entrées côté serveur (étape autorisée pour la personne, tâche prête, budget suffisant).
- **Responsive** : E1 et E3 utilisables sur mobile (largeur ≥ 360 px, boutons ≥ 44 px) ; E2, E4 et E5 conçus pour le desktop (≥ 1 280 px) et lisibles sur tablette.
- **Robustesse** : un rechargement de page ne perd rien (tout l'état est en base) ; message clair si Supabase est injoignable.
- **Limite connue** : un projet Supabase gratuit se met en pause après une période d'inactivité. Le README doit expliquer comment le réactiver avant une démo.

## 9. Plan de construction itératif

| Étape | Livrable | Ce que le PM vérifie |
|---|---|---|
| 1. Squelette | Projet Next.js + Supabase, déployé sur Vercel ; écran E0 avec les 4 profils ; barre supérieure | L'URL publique s'ouvre ; je choisis un profil, je recharge la page, le profil est conservé |
| 2. Données | Schéma, seed de 200 offres + 4 personnes, écran E3 en lecture, bouton Reset (sans trajectoire de référence) | E3 affiche 200 lignes réalistes ; le Reset remet tout à l'état initial |
| 3. Moteur | Module `engine` (R1 à R13) + tests Vitest de tous les exemples chiffrés | `npm test` passe ; le rapport de tests liste un test par exemple de la section 6 |
| 4. Mes tâches en direct | E1, clic « Fait », budget, session (R3), réservations, temps réel, écran Horloge (sans mode auto) | Avec 3 navigateurs (Alice, Bob, Charlie) : Alice valide un S2 → le S4 apparaît chez Bob en < 2 s ; Bob épuise ses 60 min → message ; « Jour suivant » → budget rétabli ; S5 absent avant 24h |
| 5. Mode auto et référence | R14, R15, verrou, graine | « Jouer jusqu'au début de J23 » (fin du mois) → 200/200 publiées ; même graine = même résultat ; le test des 50 graines passe |
| 6. Tour de contrôle | E2 : indicateurs, 5 contrôles, niveaux, courbe réel vs référence | À l'état initial : marges +540 / +120 / +600 / +240 / +360, niveau Vert ; je reproduis l'exemple R9 (absence de Charlie 2 jours) → Rouge |
| 7. Rattrapage, absences, incidents | R8, R11, R12, E5, E6 | Chaque action appliquée change les listes et les marges comme dans les exemples, puis s'annule ; une absence est détectée au changement de jour ; une tâche hors priorités apparaît dans le journal |
| 8. Finitions | Responsive, états vides, libellés, README avec script de démo, COULD si le temps le permet | Démo complète en 5 min sur desktop + 1 mobile ; Reset puis rejouer sans erreur |

## 10. Definition of Done du MVP
- Toutes les user stories MUST passent leurs critères d'acceptation. Les SHOULD sont faites ou explicitement reportées par le PM.
- Chaque exemple chiffré de la section 6 est couvert par un test automatisé qui passe.
- Le test de référence du mode auto (50 graines, 200/200 publiées au plus tard à J22) passe.
- L'application est déployée sur une URL publique gratuite, et 4 navigateurs simultanés restent cohérents pendant une démo complète.
- Le Reset ramène l'état initial exact, et la démo peut être rejouée au moins 3 fois de suite sans erreur.
- Aucune erreur dans la console du navigateur pendant le script de démo ; aucune clé secrète côté client.
- Le README permet à un tiers d'installer, de déployer et de jouer la démo sans aide.

---

## Hypothèses fixées (à confirmer par le PM)
1. Une offre = un marchand ; 200 marchands fictifs avec une importance A/B/C (40/80/80).
2. J1 est un lundi. Les week-ends comptent pour le délai de 24h mais ne sont pas travaillés. Les sessions démarrent entre 08:00 et 18:00 (fin au plus tard à 19:00).
3. Le temps simulé est stocké en minutes depuis le lundi 00:00 de la semaine 1, sans fuseau horaire.
4. L'heure enregistrée d'une étape est son heure de fin, calculée par le curseur de session (R3), et non l'heure du clic.
5. Le budget de 60 min se décompte avec les durées théoriques du brief, pas avec le temps réel passé.
6. Une tâche trop longue pour le budget restant est sautée au profit de la suivante qui tient.
7. Les réservations expirent 60 s après la fermeture de l'écran (pas de verrou long).
8. Les seuils de niveau sont : Vert > 60 min de marge, Orange entre 0 et 60, Rouge < 0. Les échéances des contrôles sont J19 pour S2, J20 pour S4, J22 pour S3, S5 et le global.
9. La capacité d'un contrôle soustrait seulement la charge des étapes dont la personne est la seule compétente. La charge S1 n'est contrôlée que dans le contrôle global (approximation acceptée).
10. « Renégocier l'échéance » (action 5 du concept initial) est hors scope : seule la repriorisation des marchands est implémentée.
11. L'orchestrateur n'a aucune tâche par défaut. Il n'exécute des S1 que si le renfort S1 est actif.
12. Le mode auto traite les sessions d'une journée l'une après l'autre, par heure de connexion, sans chevauchement (approximation).
13. La trajectoire de référence est calculée au reset avec la graine 42 et ne change plus jusqu'au reset suivant.
14. Le résultat du concept (100 % de réussite sans absence) est repris comme test d'acceptation du moteur ; s'il échoue, l'écart remonte au PM au lieu d'ajuster les règles.
