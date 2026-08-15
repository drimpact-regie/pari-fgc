# Pari FGC

Application de paris amicaux entre un cercle fermé de parieurs sur les
matchs d'un event start.gg (tournois de jeux de combat). Permet de :

- parier sur les matchs à venir d'un event start.gg ;
- consulter les stats / le classement des joueurs de l'event ;
- consulter un classement des parieurs (points gagnés).

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io) + SQLite (facilement remplaçable par
  Postgres pour aller au-delà d'un petit cercle de parieurs)
- [NextAuth (Auth.js) v5](https://authjs.dev) pour l'authentification
- API GraphQL [start.gg](https://developer.start.gg/) pour les données de
  tournoi

La logique des requêtes GraphQL (`lib/startgg.ts`) reprend celle du fichier
`Bet Graph SQL Start GG.xlsx` (requêtes Power Query `Fn_AppelAPI`,
`Req_MatchsAVenir`, `Req_StatsJoueurs`), portée en TypeScript avec des
requêtes paramétrées.

## Changer de tournoi

**Ne jamais coder le slug d'un tournoi en dur dans le code.** Le tournoi
suivi est entièrement piloté par la variable d'environnement
`STARTGG_EVENT_SLUG` (voir `config/tournament.ts`), qui correspond à la
partie d'URL après `https://www.start.gg/` :

```
STARTGG_EVENT_SLUG=tournament/ceo-2026/event/marvel-tokon-fighting-souls
```

Pour passer à un nouveau tournoi, il suffit de changer cette variable
d'environnement (fichier `.env.local` en dev, variable d'environnement de
la plateforme d'hébergement en production) et de redémarrer l'app — aucun
changement de code n'est nécessaire.

## Configuration

Copier `.env.example` en `.env.local` et renseigner :

| Variable                  | Description                                                              |
| -------------------------- | ------------------------------------------------------------------------- |
| `STARTGG_TOKEN`             | Token d'API start.gg (jamais commité)                                     |
| `STARTGG_EVENT_SLUG`        | Slug de l'event start.gg suivi                                            |
| `STARTGG_CACHE_SECONDS`     | Durée de cache des appels API start.gg (secondes)                         |
| `MAX_USERS`                 | Nombre de comptes max (30 pour le cercle fermé de la phase 1)             |
| `INVITE_CODE`                | Code requis pour s'inscrire                                               |
| `POINTS_PER_CORRECT_BET`    | Points attribués par pari gagnant                                         |
| `ADMIN_SYNC_SECRET`          | Secret pour déclencher `/api/admin/sync-results` sans session (cron)      |
| `DATABASE_URL`               | Connexion base de données (`file:./dev.db` en local)                     |
| `AUTH_SECRET`                | Secret NextAuth (générer avec `npx auth secret`)                          |

## Démarrage

```bash
npm install
npx prisma migrate deploy   # ou `npm run db:push` en dev rapide
npm run dev
```

Le premier compte créé via `/register` devient automatiquement admin
(peut déclencher la synchronisation des résultats).

## Fonctionnement

- **`/matches`** : liste les sets à venir ou en cours de l'event
  (`sets(filters: { state: [1, 2] })`, comme `Req_MatchsAVenir`). Parier
  n'est possible que tant que le match n'a pas commencé (état 1).
- **`/players`** : classement (`standings`, comme `Req_StatsJoueurs`) et
  palmarès victoires/défaites calculé à partir des sets terminés.
- **`/leaderboard`** : classement des parieurs par points, agrégé depuis
  la table `Bet`.
- **`POST /api/admin/sync-results`** : à appeler régulièrement (bouton
  admin à ajouter dans l'UI, ou cron externe avec le header
  `x-admin-secret: <ADMIN_SYNC_SECRET>`) pour résoudre les paris en
  attente en interrogeant l'état réel des matchs sur start.gg et attribuer
  les points.

## Authentification — phase 1 (cercle de 30 personnes)

Inscription par nom d'utilisateur / mot de passe, protégée par un code
d'invitation partagé (`INVITE_CODE`) et plafonnée à `MAX_USERS` comptes.
Suffisant pour un petit cercle fermé et fonctionne sans dépendance externe.

## Authentification — évolutions futures (connecteur start.gg / Discord)

Le modèle de données (`prisma/schema.prisma`, table `User`) a déjà les
colonnes `discordId` et `startggId` prêtes pour lier des comptes à un
connecteur externe. Pour activer la connexion via Discord :

1. Créer une application sur https://discord.com/developers/applications
2. Ajouter `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` à l'environnement
3. Dans `lib/auth.ts`, ajouter `Discord` (`next-auth/providers/discord`)
   au tableau `providers`, et gérer le rattachement `discordId` → `User`
   dans le callback `signIn` (créer le compte ou refuser si non
   pré-inscrit, selon le mode d'ouverture souhaité).

Pour start.gg, il n'existe pas à ce jour de provider NextAuth officiel :
il faudrait déclarer un provider OAuth générique une fois l'app OAuth
enregistrée côté start.gg (cf. leur documentation développeur), sur le
même principe.

## Limite connue de cet environnement de build

Cet environnement d'exécution sandboxé n'a pas d'accès réseau sortant vers
`api.start.gg` (bloqué par la politique réseau du conteneur). Le code a
donc été écrit et testé (build, lint, flux d'inscription/connexion,
rendu des pages avec gestion d'erreur) sans pouvoir faire d'appel réel à
l'API start.gg. Un test de bout en bout avec de vraies données de
tournoi doit être fait après déploiement dans un environnement avec accès
réseau et un `STARTGG_TOKEN` valide.
