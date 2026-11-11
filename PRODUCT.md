# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Les décisions de design se prennent pour les utilisateurs de l'outil, comme s'il s'agissait d'un vrai outil interne. S'il fonctionne pour eux, il convainc l'évaluateur du cas pratique.

- **Contributeurs (Alice, Bob, Charlie)** : des collègues volontaires qui donnent 1 h par jour, au moment qu'ils choisissent, en plus de leur travail. Ils ouvrent « Mes tâches », exécutent la tâche affichée dans le back-office (en copiant les champs de la fiche), cliquent « Fait » et passent à la suivante. Ils ne veulent ni planning ni réflexion : savoir quoi faire maintenant, le faire vite, partir quand leur heure est faite. Compétences : tous font S1 ; Alice fait S2 ; Bob S4 et S5 ; Charlie S3 et S5.
- **Orchestrateur** : responsable de la publication des 200 offres. Il surveille la Tour de contrôle, comprend si l'objectif tient, et applique une action de rattrapage quand il ne tient plus.
- **Remplaçant de l'orchestrateur** : une personne sans formation ni connaissance des règles doit pouvoir reprendre la Tour de contrôle et savoir quoi faire (critère du PM : « ma mère pourrait prendre le relais »).
- **Public secondaire, l'évaluateur du cas pratique** : il voit l'application pendant le débrief, en partage d'écran.

## Product Purpose

Répartir dynamiquement le travail de création de 200 offres marchands à publier en 22 jours ouvrés, au lieu de le planifier à l'heure. Chaque offre passe par 5 étapes (S1 contenu de l'offre, S2 création du marchand, S3 création de l'offre, S4 logo, S5 contrôle qualité et publication) avec des dépendances et un délai technique de plus de 24 h entre S4 et S5.

À chaque connexion et après chaque étape faite, un moteur de règles recalcule pour chacun la tâche la plus utile à cet instant. La Tour de contrôle alerte dès que l'objectif devient impossible sans action et propose des actions de rattrapage applicables en un clic.

Succès : les 200 offres publiées avant la fin du mois, sans que personne n'ait à planifier ; et, côté cas pratique, une démo jouée en direct par 4 fenêtres qui rend la démarche évidente en 5 minutes.

## Positioning

« Répartir les tâches, pas planifier les heures. » Un planning horaire serait faux dès le premier jour, puisque chacun choisit quand il donne son heure. L'outil ne demande rien aux contributeurs (ni créneau, ni estimation) et s'adapte à ce qui a réellement été fait. Le moteur est déterministe et testé (même graine, même résultat ; 200/200 sur 50 graines sans absence), et chaque alerte de la tour est traduite en langage courant avec l'effet chiffré de l'action proposée.

## Operating Context

- Réponse du PM au cas pratique de recrutement Joko « Offer creation » : proposer une organisation de l'équipe et un outil avec son processus. L'énoncé n'est pas recopié dans ce dépôt public. L'évaluateur attend du pragmatisme, une présentation claire de la démarche, pas de sur-ingénierie, et une explication de l'usage de l'IA.
- Présentation : en visio, le PM partage son écran et pilote lui-même 4 fenêtres (l'orchestrateur et les 3 contributeurs). Le rendu passe par la compression vidéo et une taille d'affichage réduite. Le script de démo de 5 minutes est dans README.md.
- Usage visé d'un contributeur : sur ordinateur, la fiche à côté du back-office.
- Horloge simulée partagée (J1 à J22, 08:00 à 19:00, jours ouvrés), pilotée par l'orchestrateur depuis l'écran Simulation. Mode auto pour jouer des journées (graine 42), bouton de réinitialisation.
- Données fictives : 200 marchands générés par une graine déterministe. Pas de connexion au backend Joko.

## Capabilities and Constraints

- Écrans : E0 Accueil (choix du profil), E1 Mes tâches (une seule carte, fiche d'exécution, « Fait » puis « Annuler » pendant 2 s, déclaration d'absence), E2 Tour de contrôle (verdict, « Que faire ? », schéma du parcours d'une offre, équipe du jour, rythme), E3 Suivi des offres, E4 Simulation (démo), E5 L'organisation, E6 Journal. Un contributeur ne voit que « Mes tâches ».
- Actions de rattrapage proposées, dans cet ordre : Renfort S1, Heure exceptionnelle.
- Niveaux globaux : Vert, Orange, Rouge.
- Code visuel établi : tout ce qui n'existe que pour la démo (horloge simulée, écran Simulation) est signalé en pointillés et porte l'étiquette « Démo ».
- Interface en français ; code en anglais.
- Les règles métier (R1 à R16, spec et décisions du PM) ne changent jamais au détour d'un travail de design : toute modification de règle, de calcul ou d'ordre des actions passe par une décision explicite du PM. Une refonte d'écran change la présentation, pas le moteur.
- Mise à jour en direct : une étape validée apparaît chez les autres en environ 1 à 2 s (Supabase Realtime, resynchronisation toutes les 2 s en secours).
- Stack existante : Next.js 16 (App Router), TypeScript, Tailwind CSS 4, composants de style shadcn/ui écrits à la main, Recharts, Supabase, Vercel.
- Hors périmètre : authentification réelle, notifications externes, rejet d'une offre en S5, interface en anglais, application mobile native.
- Processus : une branche `optim/<sujet>` par optimisation, aperçu Vercel, validation du PM, puis fusion dans `main`. La base Supabase est partagée par la prod, les aperçus et le poste local.

## Evidence on Hand

- Spécification d'origine : [docs/spec.md](docs/spec.md) ; décisions du PM qui priment : [docs/decisions-pm.md](docs/decisions-pm.md).
- Script de démo vérifié et chiffres reproductibles (200/200 sans absence ; 190/200 avec l'absence de Charlie à J5 et J6 ; 200/200 avec Heure exceptionnelle et Renfort S1) : [README.md](README.md).
- Tests du moteur : `npm test` (un test par exemple chiffré de la spec, plus le test des 50 graines).
- Démo en ligne : https://dispatch-200.vercel.app (protégée par un code d'accès).
- Absences à ne pas combler par de l'invention : pas de vrais utilisateurs, pas de retours d'usage, pas de logo ni de charte Joko intégrés, pas de captures du vrai back-office.

## Product Principles

1. **Dire quoi faire, pas tout montrer.** Chaque écran répond d'abord à « que dois-je faire maintenant ? » ; le détail des calculs reste disponible mais replié.
2. **Lisible sans formation.** Un remplaçant qui ne connaît pas les règles comprend la situation et l'action utile en un coup d'œil, en langage courant.
3. **Respecter l'heure donnée.** Les contributeurs sont des volontaires : zéro friction, zéro décision à prendre, la tâche et ses champs sont prêts.
4. **Le moteur fait foi.** Ce qui est affiché est exactement ce que calculent les règles ; aucune présentation n'invente, n'arrondit à tort ou ne change l'ordre décidé.
5. **Pragmatique avant spectaculaire.** Pas de sur-ingénierie ; ce qui n'existe que pour la démo est visiblement marqué comme tel.
