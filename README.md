# Elypse Home — Livrets d'accueil

Gestionnaire de livrets d'accueil Airbnb (Next.js 16 · Prisma 7 · Neon · Better Auth · Tailwind 4 · shadcn/ui).

- **`/login`** : connexion administrateur (inscription désactivée).
- **`/dashboard`** : liste des livrets (modifier, aperçu, lien, recos, équipements, transport, contacts, activer/désactiver).
- **`/l/[jeton]`** : livret public voyageur, bilingue FR/EN, pensé pour mobile. Le jeton (48 caractères) peut être régénéré depuis le dashboard : l'ancien lien cesse alors de fonctionner.

## Démarrage

```bash
pnpm install
cp .env.example .env   # puis remplir les valeurs
pnpm db:push           # crée les tables dans Neon
pnpm db:seed           # crée le compte admin (+ 2 livrets de démo si la base est vide)
pnpm dev
```

## Images

Les photos sont compressées en WebP dans le navigateur (≈ 200 Ko), stockées dans Postgres (table `image`) et servies par `/api/images/[id]` avec un cache d'un an. Aucun service externe (S3, Cloudinary…) n'est nécessaire.

## Scripts

| Commande | Rôle |
| --- | --- |
| `pnpm db:push` | Synchronise le schéma Prisma avec la base |
| `pnpm db:seed` | Crée / met à jour le compte admin |
| `pnpm db:studio` | Explorateur de base Prisma |
| `pnpm db:import` | Importe les livrets existants (methodeatlas) |

## Déploiement (Vercel)

Variables à renseigner dans Vercel : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`. Les URLs Vercel (production et previews) sont reconnues automatiquement ; `BETTER_AUTH_URL` ne sert que pour un domaine personnalisé (ex. `https://livret.mondomaine.com`).
