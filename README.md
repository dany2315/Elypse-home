# Elypse Home — Livrets d'accueil

Gestionnaire de livrets d'accueil Airbnb (Next.js 16 · Prisma 7 · Neon · Better Auth · Tailwind 4 · shadcn/ui).

- **`/login`** : connexion administrateur (inscription désactivée).
- **`/dashboard`** : liste des livrets (modifier, aperçu, lien, recos, équipements, transport, contacts, activer/désactiver).
- **`/dashboard/finances`** : récapitulatif financier mensuel / annuel par bien, alimenté par Hostaway (lecture seule).
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
| `pnpm google:enrich` | Relie les recommandations à Google Maps (rapport ; `--apply` pour enregistrer) |
| `pnpm hostaway:sync` | Synchro Hostaway (`--full` : tout le détail financier ; `--remap` : recalcul sans appel Hostaway) |
| `pnpm test` | Tests du calcul financier |

## Google Maps

Avec `GOOGLE_MAPS_API_KEY` (Places API (New)), chaque recommandation reliée à sa fiche Google affiche dans le livret sa photo principale (avec le crédit de l'auteur), sa note, ses horaires et « ouvert / fermé » (calculé à l'heure de Paris). Chaque fiche est demandée à Google au plus une fois par 24 h ; la route `/api/places/[id]` n'accepte que les fiches présentes dans les livrets. La clé reste côté serveur (variable secrète Vercel).

`pnpm google:enrich --apply` relie les recommandations à leur fiche et complète téléphone, site web et adresse vides.

## Finances (Hostaway)

Récapitulatif financier par bien, alimenté **uniquement** par l'API Hostaway en **lecture seule** (aucune écriture vers Hostaway). Mapping des champs, vérification d'octobre et questions ouvertes : [docs/finances-hostaway.md](docs/finances-hostaway.md).

- **`/dashboard/finances`** : un mois ou une année (détail mois par mois), un bien ou tous, avec une ligne Total. Colonnes : revenus de location, commissions, frais de paiement, versement total (avant impôts), taxe de séjour, ménage, séjours, nuits, occupation (en option). Répartition par plateforme. Trois modes de rattachement au mois : séjours du mois (prorata des nuits ; ménage au mois d'arrivée), arrivées du mois, réservations faites dans le mois. Filtre des annulations. Export CSV de la vue affichée. Calcul côté serveur depuis la base, sans appel à Hostaway.
- **`/dashboard/finances/biens`** : un bien regroupe un ou plusieurs listings Hostaway (ex. deux annonces Booking). Un bien est proposé automatiquement pour chaque nouveau listing ; on peut fusionner, séparer, renommer et relier un livret.

**Variables** : `HOSTAWAY_ACCOUNT_ID`, `HOSTAWAY_API_KEY` (Hostaway > Paramètres > Hostaway API) et `CRON_SECRET`. Le jeton OAuth Hostaway est stocké en base (table `hostaway_state`) et renouvelé automatiquement sur une réponse 401.

**Synchronisation** (idempotente, upsert) :

- première fois : `pnpm hostaway:sync --full` (tout l'historique et les réservations à venir, ≈ 2 min) ;
- bouton « Actualiser depuis Hostaway » sur la page Finances (incrémental) ;
- chaque nuit à 3 h UTC via la tâche planifiée Vercel (`vercel.json` → `crons`), qui appelle `/api/cron/hostaway` avec `Authorization: Bearer $CRON_SECRET`. Vercel ne lance les tâches planifiées que sur le **déploiement de production** : sur une preview (staging), utilisez le bouton.

**Schéma** : quatre tables (`bien`, `hostaway_listing`, `reservation`, `hostaway_state`), créées par `pnpm db:push`. Si le port 5432 est bloqué, appliquez le SQL `prisma/sql/2026-11-finances.sql` (créations uniquement) : `pnpm tsx --env-file=.env scripts/apply-sql.ts prisma/sql/2026-11-finances.sql <fragment-d-hôte-attendu>`.

## Déploiement (Vercel)

Variables à renseigner dans Vercel : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `GOOGLE_MAPS_API_KEY`, `HOSTAWAY_ACCOUNT_ID`, `HOSTAWAY_API_KEY`, `CRON_SECRET`. Les URLs Vercel (production et previews) sont reconnues automatiquement ; `BETTER_AUTH_URL` ne sert que pour un domaine personnalisé (ex. `https://livret.mondomaine.com`).
