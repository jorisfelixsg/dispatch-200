# Dispatch 200 offres

Démo d'un outil de **répartition dynamique des tâches** : 200 offres marchands à publier en 22 jours ouvrés par
3 contributeurs (Alice, Bob, Charlie) et 1 orchestrateur. Pas de planning à l'heure : chacun ouvre « Mes tâches »
et fait sa liste, recalculée en direct par un moteur de règles. Données fictives, horloge simulée partagée.

Démo en ligne : https://dispatch-200.vercel.app

## Ce que montre la démo

| Écran | Qui | Contenu |
|---|---|---|
| E0 Accueil | Tous | Choix du profil (mémorisé dans le navigateur) |
| E1 Mes tâches | Contributeurs | Une seule carte à la fois : la prochaine tâche du plan et sa fiche (champs à copier), bouton « Fait » puis « Annuler » pendant 2 s, budget restant, déclaration d'absence |
| E2 Tour de contrôle | Orchestrateur | Lisible par un remplaçant : phrase-verdict et cause, retard sur le plan, « Que faire ? » (heure exceptionnelle et son effet en clair), schéma du parcours d'une offre et de l'étape qui bloque, l'équipe du jour, le rythme ; détail des 5 contrôles replié |
| E3 Suivi des offres | Orchestrateur | Les 200 offres, étape par étape, recherche, filtres |
| E4 Simulation (démo) | Orchestrateur | +1h, +2h, jour suivant, aller au début de Jx, mode auto, reset. N'existe que pour la démo, signalé en pointillés |
| E5 Organisation | Orchestrateur | Qui fait quoi (étapes × personnes, tâche majeure, priorités, charge et capacité du mois), absences, heures exceptionnelles, actions appliquées (annulables) |
| E6 Journal | Orchestrateur | Tous les événements, filtrables par type |

Un contributeur ne voit que « Mes tâches ». La barre du haut affiche l'horloge simulée (en pointillés : c'est la démo) et, pour l'orchestrateur seulement, le niveau global (vert, orange, rouge) et les profils en ligne.

## Script de démo en 5 minutes

Préparer 4 fenêtres : l'orchestrateur sur un ordinateur, Alice, Bob et Charlie dans d'autres navigateurs (ou une
fenêtre de navigation privée, ou un téléphone). Chaque fenêtre garde son propre profil.

| Temps | Qui | Action | Ce qu'on montre |
|---|---|---|---|
| 0:00 | Orchestrateur | **Simulation › Réinitialiser la démo**, puis **Tour de contrôle** | 0 / 200, marges +540 / +120 / +600 / +240 / +360, niveau Vert, courbe de référence |
| 0:30 | Alice, Bob, Charlie | Ouvrir **Mes tâches** | Trois cartes différentes, sans doublon (Bob et Charlie se partagent les S1), chacune avec les champs à copier |
| 1:00 | Alice | **Fait** sur un S2 | La carte reste, marquée « Faite », et un bouton rouge « Annuler » se vide en 2 s à la place de « Fait ». À la fin du bouton, l'étape part au serveur et la carte suivante arrive : le S4 du même marchand apparaît chez Bob dans les 2 s qui suivent, le budget d'Alice baisse de 3 min |
| 1:30 | Orchestrateur | **Simulation › Jour suivant** | Les budgets reviennent à 60 min, en direct, chez chacun |
| 2:00 | Orchestrateur | **Simulation › Réinitialiser la démo**, puis **Jouer jusqu'au début de J5** | Le mode auto joue J1 à J4 ; la tour montre 30 S3 faits, marge S3 +60, niveau Orange (l'exemple de la règle R9). Dans **Suivi des offres**, le filtre « Bloquées en attente des 24h » liste les offres dont le S4 date de moins de 24h (statut « Attente 24h ») : la règle des 24h après S4 |
| 2:45 | Charlie | **Déclarer une absence** pour J5, puis J6 | Marge S3 0, puis −60 ; S5 passe aussi en négatif : niveau **Rouge** dans la barre du haut de l'orchestrateur |
| 3:15 | Orchestrateur | **Tour de contrôle** : le bandeau dit ce qui manque et pourquoi | Le schéma entoure l'étape qui bloque |
| 3:30 | Orchestrateur | **Que faire ?** | L'heure exceptionnelle, avec son effet en une phrase pour chaque personne. Le pire contrôle (S5) est partagé : choisir **Charlie**. Appliquer **Heure exceptionnelle** (Charlie, J7) : S3 −60 → 0 |
| 4:00 | Orchestrateur | **Organisation**, puis **Journal** | Qui fait quoi et dans quel ordre, les absences, les actions actives (annulables d'un clic) ; le journal trace actions, absences, horloge et étapes |
| 4:30 | Orchestrateur | **Simulation › Jouer jusqu'au début de J23 (fin du mois)** | Avec l'heure exceptionnelle : **200 / 200** publiées (sans action : 190 / 200, l'absence de Charlie coûte 10 offres). Puis **Réinitialiser la démo** |

Le reset de 2:00 garantit un scénario reproductible : le mode auto utilise la graine 42, et même départ donne même
résultat (les clics manuels faits avant changeraient légèrement le résultat final). Depuis l'état initial, sans absence, la fin du
mois donne 200 / 200 avec une dernière publication à J21 12:51.

## Règles métier

Le moteur (`src/lib/engine/`) est un module TypeScript pur, sans base ni interface. Il applique les règles R1 à R16
de la spécification : dépendances entre étapes, délai de 24h entre S4 et S5 (week-ends compris), horodatage par
curseur de session, budget de 60 min par jour, ordre des listes, réservations, contrôles de capacité et niveaux,
actions de rattrapage, absences, horloge, mode auto et trajectoire de référence.

### Décisions du PM qui précisent ou modifient la spécification

- **Alice** : elle parcourt les marchands par rang, S2 puis S1 du même marchand ; un marchand reste dans son parcours
  tant que S2 **et** S1 ne sont pas faits (la lecture littérale faisait échouer le test des 50 graines).
- **Tri des S5** : par heure de déblocage, c'est-à-dire le plus tardif entre la fin de S3 et la fin de S4 + 24h.
- **Retirés** : l'action « Former un remplaçant », la section « Autres tâches possibles » et donc la règle R8
  (tâche hors priorités).
- **Mode auto** : connexions tirées entre l'heure actuelle (08:00 au plus tôt) et 19:00 moins le budget restant, pour
  qu'une session finisse avant 19:00. L'écran ne propose que « Jouer jusqu'au début de Jx », avec la graine 42.
- **Absences détectées** : personne n'est détecté absent quand toutes les étapes de ses compétences sont faites ;
  lors d'un saut de plusieurs jours, seul le jour quitté est vérifié.
- **Heure exceptionnelle** : impossible un jour où la personne est déclarée absente.
- **Choix techniques validés** : une étape non prête ou hors compétences est refusée ; un contrôle ne compte plus
  de capacité après son échéance ; l'orchestrateur sans budget n'est jamais détecté absent.

## Tests

```bash
npm test
```

Un test par exemple chiffré de la section 6 de la spécification, plus le test de référence du mode auto :
depuis l'état initial, sans absence, pour 50 graines, les 200 offres sont publiées au plus tard à J22 19:00.

## Stack et architecture

- Next.js 16 (App Router) + TypeScript, Tailwind CSS 4, composants de style shadcn/ui, Recharts
- Supabase (Postgres + Realtime), offre gratuite ; Vercel (offre Hobby), connecté au dépôt GitHub
- Les navigateurs lisent avec la clé `anon` (droits en lecture seule, RLS) et s'abonnent au temps réel.
  Toutes les écritures passent par des routes serveur avec la clé service, qui n'est jamais envoyée au navigateur.
- Le clic « Fait », les actions, l'horloge et le mode auto écrivent chacun en une seule transaction (fonctions SQL).
- Si le temps réel est indisponible, chaque écran se resynchronise toutes les 2 s.

```
src/
  app/                 écrans (E0 accueil, (app)/… écrans E1 à E6) et routes API
  app/api/             tasks, tasks/done, absence, clock, auto, control, actions, reset, health
  components/          barre supérieure, coque d'application, écrans, composants UI
  hooks/               profil, horloge, liste « Mes tâches », équipe, présence, rapport de la tour
  lib/engine/          logique métier pure, testée par Vitest
  lib/data/            lecture de l'état complet pour le moteur (serveur), instantanés quotidiens
  lib/live/            temps réel partagé (+ polling de secours), contrats d'API
  lib/seed/            200 marchands fictifs (graine déterministe)
  lib/supabase/        clients Supabase (navigateur en lecture, serveur avec clé service)
  proxy.ts             code d'accès optionnel (DEMO_ACCESS_CODE)
supabase/migrations/   scripts SQL 0001 à 0005, à exécuter dans l'ordre
```

## Installation locale

Prérequis : Node.js 20.9 ou plus récent, et un projet Supabase (voir « Déploiement »).

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000
npm test
```

Sans variables Supabase, l'application démarre et affiche « Base de données non configurée ».

**Plusieurs profils sur un seul poste** : le profil est mémorisé par adresse. Ouvrir http://localhost:3000,
http://bob.localhost:3000 et http://charlie.localhost:3000, ou utiliser plusieurs navigateurs.

**Réseau d'entreprise avec proxy HTTPS** : si « Base de données injoignable » s'affiche alors que Supabase est actif,
le proxy remplace probablement les certificats et Node.js ne lit pas le magasin Windows. Exporter les autorités
racine de l'entreprise dans un fichier PEM et le passer à Node (poste local uniquement, pas Vercel) :

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\Users\<toi>\.certs\corporate-roots.pem"
npm run dev
```

## Variables d'environnement

| Variable | Où la trouver | Exposée au navigateur |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API › Project URL | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase › Project Settings › API Keys › clé `anon` (ou `publishable`) | oui (lecture seule via RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API Keys › clé `service_role` (ou `secret`) | **non, serveur uniquement** |
| `DEMO_ACCESS_CODE` | Au choix. Vide = accès libre | non |

Ne jamais préfixer la clé service par `NEXT_PUBLIC_`.

Il n'y a pas d'authentification réelle (hors périmètre) : n'importe qui ayant l'URL peut agir sur la démo, reset
compris. Pour une démo publique, renseigner `DEMO_ACCESS_CODE` : un code est alors demandé à l'ouverture.

## Déploiement (Supabase + Vercel)

1. **Supabase** : créer un projet gratuit, puis copier l'URL et les deux clés (voir tableau). Dans
   **SQL Editor › New query**, coller puis exécuter (**Run**), dans l'ordre, les scripts de `supabase/migrations/` :
   `0001_init.sql`, `0002_live_tasks.sql`, `0003_auto_mode.sql`, `0004_control_snapshots.sql`, `0005_actions.sql`.
   Ils peuvent être relancés sans risque.
2. **GitHub** : créer un dépôt et y pousser ce dossier. Sur l'offre Vercel Hobby, un dépôt privé n'accepte que les
   commits du propriétaire du compte : rendre le dépôt public ou committer avec ce compte.
3. **Vercel** : « Add New › Project », importer le dépôt, renseigner les 4 variables d'environnement, puis
   « Deploy ». Vérifier que **Settings › Build and Deployment › Framework Preset** vaut **Next.js** (sinon : page
   404). Chaque push sur la branche principale redéploie.
4. **Première initialisation** : ouvrir l'application, profil Orchestrateur, écran **Simulation**, puis
   **Réinitialiser la démo**. Les 200 offres fictives sont créées (toujours les mêmes) et la trajectoire de
   référence est calculée.

## Avant une démo

- **Réactiver Supabase** : un projet gratuit se met en pause après une période d'inactivité. Si l'application affiche
  « Base de données injoignable », ouvrir le tableau de bord Supabase, choisir le projet, cliquer sur
  « Restore project » (quelques minutes), puis recharger.
- **Repartir de zéro** : **Simulation › Réinitialiser la démo**. Chaque navigateur garde son profil.
- **Préchauffer** : quelques minutes avant, ouvrir l'application et faire un tour des écrans (un « Fait », puis un
  reset). Le premier appel après une longue pause est plus lent ; ensuite, une étape validée apparaît chez les autres
  en environ 1 s.
