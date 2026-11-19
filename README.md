# Elypse Home — Livrets d'accueil

Gestionnaire de livrets d'accueil Airbnb (Next.js 16 · Prisma 7 · Neon · Better Auth · Tailwind 4 · shadcn/ui).

- **`/login`** : connexion administrateur (inscription désactivée).
- **`/dashboard`** : liste des livrets (modifier, aperçu, lien, recos, équipements, transport, contacts, activer/désactiver).
- **`/dashboard/finances`** : récapitulatif financier mensuel / annuel par bien, alimenté par Hostaway (lecture seule).
- **`/l/[jeton]`** : livret public voyageur, bilingue FR/EN, pensé pour mobile. Le jeton (48 caractères) est fixe : le lien voyageur ne change jamais (pas de régénération depuis le dashboard).

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

- **`/dashboard/finances`** : un mois, une année ou un intervalle de dates du … au … (bornes incluses ; détail mois par mois, mois coupés aux bornes), un bien ou tous, avec une ligne Total. Colonnes : chiffre d'affaires (tout ce que les voyageurs ont payé, = Revenus de location Hostaway ; dont ménage), puis ce qui en sort (commissions, frais de paiement, remboursements, taxe de séjour, TVA, vos charges TTC), puis le bénéfice (ce qui reste réellement) ; séjours, nuits, occupation. Graphiques : évolution sur 12 mois, bénéfice par bien, chiffre d'affaires par plateforme. Répartition par plateforme. Affichage **par bien** (récapitulatif) ou **par réservation** (chaque réservation de la période avec le nom du voyageur : recherche par voyageur, bien ou référence, filtre par plateforme et annulations, tri, détail dépliable du calcul du bénéfice ; la référence Airbnb est réduite au code de confirmation, sans identifiant voyageur). « Dans quel mois compter un séjour ? » : nuits passées (prorata ; ménage au mois d'arrivée), date d'arrivée, date de réservation. Filtre des annulations. Export CSV de la vue affichée. Calcul côté serveur depuis la base, sans appel à Hostaway.
- **`/dashboard/finances/biens`** : un bien regroupe un ou plusieurs listings Hostaway (ex. deux annonces Booking). Un bien est proposé automatiquement pour chaque nouveau listing ; on peut fusionner, séparer, renommer, relier un livret, et **retirer un bien des calculs** (interrupteur « Compté dans les finances », aussi disponible dans les filtres du rapport via « Biens comptés » ; le bien reste consultable seul).
- **`/dashboard/finances/charges`** : charges fixes mensuelles saisies à la main par bien (loyer, leasing mobilier, électricité, internet, assurance…), montant HT ou TTC et taux de TVA par charge. Chaque modification s'applique **à partir d'une date** (et jusqu'à une date facultative) sans changer les mois précédents ; l'historique des montants et des saisies reste visible. Les charges sont comptées au jour près et déduites du bénéfice.
- **Bien ↔ livret** : un bien relié à un livret affiche un bouton « Livret » dans le tableau par bien et « Voir le livret » dans le détail d'une réservation (aperçu du livret) ; sur `/dashboard`, chaque carte de livret montre le chiffre d'affaires, le bénéfice et l'occupation du mois en cours (nuits passées) et ouvre la page Finances du bien. Réservé à l'admin connecté : rien n'est ajouté au livret public `/l/[jeton]`.

**Variables** : `HOSTAWAY_ACCOUNT_ID`, `HOSTAWAY_API_KEY` (Hostaway > Paramètres > Hostaway API) et `CRON_SECRET`. Le jeton OAuth Hostaway est stocké en base (table `hostaway_state`) et renouvelé automatiquement sur une réponse 401.

**Synchronisation** (idempotente, upsert) :

- première fois : `pnpm hostaway:sync --full` (tout l'historique et les réservations à venir, ≈ 2 min) ;
- bouton « Actualiser depuis Hostaway » sur la page Finances (incrémental) ;
- chaque nuit à 3 h UTC via la tâche planifiée Vercel (`vercel.json` → `crons`), qui appelle `/api/cron/hostaway` avec `Authorization: Bearer $CRON_SECRET`. Vercel ne lance les tâches planifiées que sur le **déploiement de production** : sur une preview (staging), utilisez le bouton.

**Schéma** : six tables (`bien`, `hostaway_listing`, `reservation`, `hostaway_state`, `bien_charge`, `bien_charge_version`), créées par `pnpm db:push`. Si le port 5432 est bloqué, appliquez dans l'ordre `prisma/sql/2026-11-finances.sql`, `2026-11-finances-2.sql`, `2026-11-finances-3.sql` et `2026-11-finances-4.sql` (ajouts uniquement) : `pnpm tsx --env-file=.env scripts/apply-sql.ts prisma/sql/<fichier>.sql <fragment-d-hôte-attendu>`, puis `pnpm hostaway:sync` pour remplir les nouvelles colonnes.

## Déploiement (Vercel)

Variables à renseigner dans Vercel : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `GOOGLE_MAPS_API_KEY`, `HOSTAWAY_ACCOUNT_ID`, `HOSTAWAY_API_KEY`, `CRON_SECRET`. Les URLs Vercel (production et previews) sont reconnues automatiquement ; `BETTER_AUTH_URL` ne sert que pour un domaine personnalisé (ex. `https://livret.mondomaine.com`).
