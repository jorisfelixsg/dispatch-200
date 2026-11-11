# Décisions du PM qui modifient ou précisent la spécification

Ces décisions ont été prises pendant la construction du MVP (2026-11-09 et 2026-11-10). Elles **priment sur [spec.md](spec.md)**. L'application au tag `v1.0-mvp` les applique toutes.

## Retraits de périmètre

| Élément de la spec | Décision | Conséquence |
|---|---|---|
| Action de rattrapage n° 3 « Former un remplaçant » (R11, US-10) | Retirée : Alice n'a jamais été formée sur S3 | Plus que 4 actions de rattrapage. L'exemple « remplaçant » de R9 et le critère d'US-10 qui s'appuie dessus ne s'appliquent plus |
| Section « Autres tâches possibles » (E1, US-13, R8) | Retirée | Pas de tâche hors priorités ; l'événement OUT_OF_PRIORITY n'est plus produit |
| Mode auto : « Jouer la journée en cours » et champ graine (E4) | Retirés | L'écran Simulation (ex-Horloge) ne propose que « Jouer jusqu'au début de Jx », avec la graine 42 fixe |
| Écran E3 « Suivi des offres » pour les contributeurs (section 4) | Retiré le 2026-11-10 : un contributeur ne voit plus que « Mes tâches » | E3 reste pour l'orchestrateur |
| Niveau global et profils « En ligne » dans la barre du haut des contributeurs (section 4, US-20) | Retirés le 2026-11-10 : ils ne peuvent pas agir dessus | Visibles par l'orchestrateur seulement |
| Actions de rattrapage « Forcer l'ordre » et « Prioriser les marchands importants » (R11) | Retirées le 2026-11-11, à la refonte de la Tour de contrôle | Plus que 2 actions proposées, dans l'ordre : Renfort S1, Heure exceptionnelle. Le moteur sait encore annuler ces actions si elles ont été appliquées avant (base partagée avec les anciennes versions) |

## Présentation (2026-11-10)

- **Simulation** : l'écran E4 s'appelle « Simulation », porte l'étiquette « Démo », et est séparé des écrans du produit dans la navigation. L'horloge simulée est encadrée en pointillés, code visuel de tout ce qui n'existe que pour la démo.
- **Organisation** : l'écran E5 s'appelle « L'organisation » et commence par un tableau étapes × personnes (tâche majeure, priorités, charge et capacité du mois). C'est la réponse visuelle à « qui fait quoi ».
- **Audit de périmètre, recommandations non retenues** : tour de contrôle simplifiée, retrait de « Forcer l'ordre », retrait du Journal de la navigation, retrait du badge « majeure / secondaire ». Tout cela reste en place. (La Tour de contrôle et « Forcer l'ordre » ont été revus le 2026-11-11, voir plus bas.)

## Tour de contrôle v2 (2026-11-11)

Objectif : une personne qui remplace l'orchestrateur comprend la situation en un coup d'œil et sait quoi faire, sans connaître les règles. Mêmes règles, même calcul, même mise à jour en direct (R6) ; seule la présentation change. Maquette validée : option mixte « bulletin + chaîne de production ».

- **Bandeau** : niveau (Vert, Orange, Rouge, inchangés), une phrase qui dit ce qui manque et où (pire contrôle de R9, en heures et avec le nom de l'étape), sa cause (qui peut faire l'étape, absences récentes ou à venir), offres publiées avec l'écart au plan (trajectoire de référence, à la fin de la veille), jours restants, prévision J22 (bouton, comme avant).
- **Que faire ?** : les actions proposées, toujours dans l'ordre de R11. Chacune dit en une phrase son effet sur le pire contrôle, calculé par l'aperçu d'impact (US-18), avec une étiquette « Règle le problème », « Améliore » ou « Ne règle pas le problème ». Une action qui aide est encadrée en vert ; l'ordre ne change pas. « Déjà en place » liste les actions actives, annulables sur place.
- **Schéma du parcours** : S1 à S5 avec leurs dépendances (R1) et le délai de 24 h (R2), qui fait chaque étape, étapes faites, offres prêtes qui attendent, avance ou manque de chaque contrôle. L'étape du pire contrôle est entourée.
- **L'équipe aujourd'hui** : minutes faites sur le budget du jour, absence, dernière étape faite. La personne dont tout dépend (seule compétente du pire contrôle) est mise en avant.
- **Le rythme** : courbe réel / plan en petit, avec l'écart écrit.
- **Détail des calculs** (replié) : l'ancien tableau des 5 contrôles en minutes, les seuils et la grande courbe.

## Tour de contrôle : moment de décision (2026-11-11)

Suite de la critique Impeccable (27/40, deux problèmes P1). Textes et présentation seulement : mêmes règles, même ordre R11, rien n'est choisi à la place de l'orchestrateur.

- **Plus de numéros** devant les actions (ils faisaient croire à une séquence). L'étiquette d'effet passe au-dessus du titre.
- **Heure exceptionnelle sans personne pré-remplie** (étape partagée, par exemple S5) : Alice, Bob et Charlie sont proposés chacun avec l'effet de son heure en plus (aperçu US-18), ou « absence ce jour-là ». Aucune personne n'est présélectionnée.
- **Prévenir la personne** : une fois la personne choisie, « Avant d'appliquer : demander son accord à Charlie pour le J7. L'application n'envoie aucun message. »
- **Après « Appliquer »** : une confirmation reste affichée en haut de « Que faire ? » (masquable), avec le niveau du moment expliqué en clair.
- **« Règle le problème » devient « Comble le manque »** : le niveau peut rester orange. Le texte d'effet explique désormais le niveau d'arrivée (orange : plus rien ne manque, mais au moins un point a 1 h d'avance ou moins ; rouge : un autre point manque encore de temps).
- **Prévision au J22 automatique** : finalement abandonnée (PM, 2026-11-11), le bouton « Calculer » reste.

## Tour de contrôle : retouches P2 (2026-11-11)

Plus petit changement à chaque fois (PM : pas de sur-ingénierie).

- **Contrastes** : vert `--ok` et orange `--warn` assombris (thème clair) pour passer le seuil AA sur fond blanc. Badge « Démo » de la barre du haut en 12 px au lieu de 10 px.
- **Pointillés réservés à la démo** : retirés de « Détail des calculs » et des états vides (Mes tâches, Suivi des offres, L'organisation, Journal). Restent l'horloge simulée, l'étiquette « Démo » et l'écran Simulation.
- **Mot « démo » hors de la démo** : la légende du rythme dit « plan calculé au début du mois ».
- **Accessibilité** : la phrase-verdict est un titre, annoncé quand il change ; la description du schéma pour lecteur d'écran donne aussi l'avance ou le retard de chaque étape et l'étape qui bloque.

## Tour de contrôle : cohérence bandeau / prévision (2026-11-11)

Texte et affichage seulement, aucune règle changée (l'échéance S4 reste J20).

- **Marge de sécurité** : quand le niveau est orange ou rouge sur un contrôle qui finit avant le J22 (S2 au J19, S4 au J20) et que la prévision atteint 200, une ligne sous la prévision explique que cette échéance est une marge de sécurité et que les offres peuvent quand même toutes sortir d'ici le J22.
- **Actions sans effet repliées** : les actions qui ne changent rien pour l'étape en manque sont cachées derrière « Voir les actions sans effet sur ce manque ». Si aucune action n'aide, le bloc le dit en une phrase et renvoie à la prévision. Une action dont on a changé la personne ou le jour reste affichée.

## « Mes tâches » v2 (2026-11-11)

- **Une seule carte** : le contributeur ne voit plus la liste, seulement sa première tâche (même moteur, même ordre R5 ; toute la liste reste réservée, donc pas de doublon). Une ligne annonce la suite. Le rang, la durée par tâche et le badge « majeure / secondaire » ne sont plus affichés.
- **Fiche d'exécution** : la carte donne les champs à copier dans le back-office pour l'étape (nom, catégorie, URL, description, image, logo ; liste de contrôle indicative pour S5) et dit pour qui la tâche compte (« Bob en a besoin pour ajouter le logo »). Pas de lien vers le back-office : la démo n'en a pas.
- **Annuler** : après « Fait », un bouton « Annuler » avec une barre de progression rouge reste 2 s. L'étape n'est envoyée au serveur qu'à la fin des 2 s : annuler n'enregistre donc rien. Quitter l'écran ou fermer la page envoie aussitôt l'étape en attente. Conséquence sur US-03 : le S4 apparaît chez Bob moins de 2 s après la fin du bouton, soit environ 4 s après le clic.
- **Pendant les 2 s (PM, 2026-11-11, après la mise en ligne)** : la carte de la tâche validée reste affichée, marquée « Faite », et « Annuler » prend la place de « Fait ». La tâche suivante n'apparaît qu'à la fin des 2 s, avec son bouton « Fait ». Entrée ne fait rien pendant ces 2 s. L'ancienne tâche ne réapparaît plus le temps que le serveur réponde.
- **Mini-fenêtre** et **clavier** (Entrée = Fait, Ctrl+Z = Annuler) : retirés le 2026-11-11, voir « Sobriété » ci-dessous.

## Sobriété (2026-11-11)

Le cas demande du pragmatisme, « without over-engineering ». Retiré parce que rien dans le brief ne le demande et que ça ne se voit pas ou ne sert pas pendant la démo :

- **Mini-fenêtre** de « Mes tâches » (Document Picture-in-Picture).
- **Raccourcis clavier** Entrée = Fait et Ctrl+Z = Annuler, et l'étiquette « Entrée » sur le bouton.
- **Profils « En ligne »** dans la barre de l'orchestrateur (US-20).
- **Export CSV** du suivi des offres (US-19).
- **Lettre d'importance** (A, B, C) dans le suivi des offres : elle ne servait qu'à l'action « Prioriser les marchands importants », déjà retirée. La donnée reste dans le jeu de données.
- **Ligne « Mode forcé »** dans L'organisation : reste de l'action « Forcer l'ordre », déjà retirée. Le moteur garde de quoi annuler d'anciennes actions de ce type.
- **Grande courbe** du « Détail des calculs » : doublon de « Le rythme ».

Laissés en l'état pour l'instant (à trancher) : fiche d'exécution, Journal, déclaration d'absence depuis L'organisation, boutons +1h et +2h de la Simulation.

## Précisions de règles

- **R5, parcours d'Alice** : un marchand reste dans son parcours tant que S2 **et** S1 ne sont pas faits. La lecture littérale (« marchand sans S2 ») faisait échouer le test des 50 graines vers 170 offres publiées ; la lecture retenue passe 50/50.
- **R5, tri des S5** : par heure de déblocage, soit le plus tardif entre la fin de S3 et la fin de S4 + 24h.
- **R12, absences détectées** : une personne dont toutes les étapes de ses compétences sont faites n'est jamais détectée absente. Lors d'un saut de plusieurs jours, seul le jour quitté est vérifié.
- **R14, heures de connexion du mode auto** : tirées uniformément entre max(08:00, heure actuelle) et 19:00 moins le budget restant (18:00 normalement), pour qu'une session finisse avant 19:00. Si cette fenêtre est vide, connexion à l'heure actuelle.
- **R11, heure exceptionnelle** : impossible un jour où la personne est déclarée absente.
- **Absences déclarées depuis E1** : avancées à l'étape 6 du plan pour pouvoir reproduire l'exemple de R9.

## Choix techniques validés

- Une étape non prête ou hors des compétences de la personne est refusée côté serveur.
- Un contrôle de capacité ne compte plus aucune capacité après son échéance.
- L'orchestrateur, sans budget propre, n'est jamais détecté absent.

## Après le MVP

- 2026-11-10 : version validée figée sous le tag `v1.0-mvp`. Les optimisations se font une par une, sur une branche `optim/<sujet>` avec son lien de test Vercel, et ne sont fusionnées dans `main` qu'après validation du PM.
