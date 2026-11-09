# Dispatch 200 offres

Démo d'un outil de répartition dynamique des tâches : 200 offres marchands à publier en 22 jours ouvrés
par 3 contributeurs (Alice, Bob, Charlie) et 1 orchestrateur, sur des données fictives et une horloge simulée partagée.

> État : **étape 6 (tour de contrôle)** du plan de construction. Le README complet (script de démo en 5 minutes)
> arrive à l'étape 8.

## Stack

- Next.js 16 (App Router) + TypeScript, Tailwind CSS 4, composants de style shadcn/ui
- Supabase (Postgres + Realtime), offre gratuite
- Vercel (offre Hobby), connecté au dépôt GitHub
- Vitest pour le moteur métier (`src/lib/engine/`, module pur sans base ni UI)

## Installation locale

Prérequis : Node.js 20.9 ou plus récent.

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000
npm test                     # tests du moteur
```

Sans variables Supabase, l'application démarre quand même et affiche un bandeau
« Base de données non configurée ».

### Tester plusieurs profils sur un seul poste

Le profil est mémorisé par adresse. Pour avoir Alice, Bob et Charlie côte à côte en local, ouvrir
http://localhost:3000, http://bob.localhost:3000 et http://charlie.localhost:3000 (ou utiliser plusieurs navigateurs).

### Réseau d'entreprise avec proxy HTTPS

Si le bandeau « Base de données injoignable » s'affiche alors que Supabase est actif, le proxy de
l'entreprise remplace probablement les certificats HTTPS, et Node.js ne lit pas le magasin de certificats
Windows. Il faut exporter les autorités racine de l'entreprise dans un fichier PEM, puis le passer à Node
au démarrage. Cela ne concerne que le poste local, pas Vercel.

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

## Déploiement (Supabase + Vercel)

1. **Supabase** : créer un projet gratuit sur supabase.com, puis copier l'URL et les deux clés (voir tableau).
   Ouvrir **SQL Editor › New query**, coller le contenu de `supabase/migrations/0001_init.sql` et cliquer sur
   **Run**, puis faire de même, dans l’ordre, avec `0002_live_tasks.sql`, `0003_auto_mode.sql` et `0004_control_snapshots.sql` (les scripts peuvent
   être relancés sans risque). Ils créent les tables, les droits en lecture seule pour les navigateurs, le temps réel,
   la fonction de reset et les fonctions transactionnelles « Fait », réservations, horloge et mode auto.
2. **GitHub** : créer un dépôt vide et y pousser ce dossier.
3. **Vercel** : « Add New › Project », importer le dépôt, laisser le preset Next.js, renseigner les 4 variables
   d'environnement, puis « Deploy ». Chaque push sur la branche principale redéploie.
   Vérifier que **Settings › Build and Deployment › Framework Preset** vaut **Next.js** (sinon : page 404).
   Sur l'offre Hobby avec un dépôt privé, Vercel refuse les commits d'un autre compte GitHub que le propriétaire.
4. **Première initialisation** : ouvrir l'application, choisir le profil Orchestrateur, écran **Horloge**,
   puis **Réinitialiser la démo**. Les 200 offres fictives sont créées (toujours les mêmes, seed déterministe).

## Avant une démo : réactiver Supabase

Un projet Supabase gratuit se met en pause après une période d'inactivité. Si l'application affiche
« Base de données injoignable », ouvrir le tableau de bord Supabase, sélectionner le projet et cliquer
sur « Restore project » (quelques minutes), puis recharger l'application.

## Structure

```
src/
  app/                 écrans (E0 accueil, (app)/… écrans E1 à E6) et routes API
  components/          barre supérieure, coque d'application, composants UI
  hooks/               profil (localStorage), horloge simulée, liste « Mes tâches », santé de la base
  lib/engine/          logique métier pure (R1 à R13), sans base ni UI, testée par Vitest :
                         listes « Mes tâches », budget, sessions, réservations, contrôles de
                         capacité, niveaux, actions de rattrapage, absences, horloge
  lib/data/            lecture de l’état complet pour le moteur (serveur), conversion des lignes SQL
  lib/live/            temps réel Supabase partagé (+ polling de secours toutes les 2 s), contrats d’API
  lib/supabase/        clients Supabase (navigateur en lecture, serveur avec clé service)
  app/api/             tasks (liste + réservations), tasks/done (« Fait »), absence, clock (horloge), auto (mode auto),
                       control (tour de contrôle), reset
  proxy.ts             code d'accès optionnel (DEMO_ACCESS_CODE)
```
