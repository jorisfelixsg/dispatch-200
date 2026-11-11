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

## Présentation (2026-11-10)

- **Simulation** : l'écran E4 s'appelle « Simulation », porte l'étiquette « Démo », et est séparé des écrans du produit dans la navigation. L'horloge simulée est encadrée en pointillés, code visuel de tout ce qui n'existe que pour la démo.
- **Organisation** : l'écran E5 s'appelle « L'organisation » et commence par un tableau étapes × personnes (tâche majeure, priorités, charge et capacité du mois). C'est la réponse visuelle à « qui fait quoi ».
- **Audit de périmètre, recommandations non retenues** : tour de contrôle simplifiée, retrait de « Forcer l'ordre », retrait du Journal de la navigation, retrait du badge « majeure / secondaire ». Tout cela reste en place.

## « Mes tâches » v2 (2026-11-11)

- **Une seule carte** : le contributeur ne voit plus la liste, seulement sa première tâche (même moteur, même ordre R5 ; toute la liste reste réservée, donc pas de doublon). Une ligne annonce la suite. Le rang, la durée par tâche et le badge « majeure / secondaire » ne sont plus affichés.
- **Fiche d'exécution** : la carte donne les champs à copier dans le back-office pour l'étape (nom, catégorie, URL, description, image, logo ; liste de contrôle indicative pour S5) et dit pour qui la tâche compte (« Bob en a besoin pour ajouter le logo »). Pas de lien vers le back-office : la démo n'en a pas.
- **Annuler** : après « Fait », un bouton « Annuler » avec une barre de progression rouge reste 2 s. L'étape n'est envoyée au serveur qu'à la fin des 2 s : annuler n'enregistre donc rien. Valider la tâche suivante, quitter l'écran ou fermer la page envoie aussitôt l'étape en attente. Conséquence sur US-03 : le S4 apparaît chez Bob moins de 2 s après la fin du bouton, soit environ 4 s après le clic.
- **Mini-fenêtre** : « Ouvrir la mini-fenêtre » affiche la même carte en petit, au premier plan (Document Picture-in-Picture, Chrome et Edge). Le bouton n'apparaît pas sur les autres navigateurs.
- **Clavier** : Entrée = Fait, Ctrl+Z = Annuler.

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
