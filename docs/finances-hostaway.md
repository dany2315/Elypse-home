# Finances — mapping Hostaway

Module « Finances » du dashboard : récapitulatif mensuel et annuel par bien, alimenté
**uniquement** par l'API Hostaway en **lecture seule** (aucune écriture, aucune annonce, aucune
messagerie, aucune saisie manuelle).

Mapping établi le 10/11/2026 sur les vraies réservations du compte (750 réservations, avril 2026 →
août 2027), avec les scripts `scripts/hostaway-explore*.ts`. Ces scripts n'affichent aucune donnée
personnelle.

## Sources Hostaway utilisées

| Endpoint | Usage |
| --- | --- |
| `POST /v1/accessTokens` | Jeton OAuth2 `client_credentials` (stocké en base, table `hostaway_state`, renouvelé sur 401) |
| `GET /v1/listings` | Listings (11) |
| `GET /v1/reservations` (paginé `limit`/`offset`) | Statut, dates, nuits, canal, `totalPrice`, champs Airbnb |
| `GET /v1/financeStandardField/reservation/{id}` | Détail financier : `baseRate`, `hostChannelFee`, `cityTax`, `cleaningFeeValue`… |

- `includeResources=1` renvoie un `financeField` **vide** sur ce compte, et `reservationFees` est vide
  aussi. Le détail financier exige donc un appel par réservation (≈ 0,3 s).
- Le détail n'est lu que pour les séjours (`new`, `modified`, et `cancelled` avec `totalPrice` ≠ 0),
  puis relu seulement quand `updatedOn` change. Synchro complète ≈ 2 min ; synchro nocturne ≈ 15 s.

## Filtres « Dans quel mois compter un séjour ? » et « Réservations annulées »

Chaque option affiche sous le filtre une phrase qui explique son effet (`MODES` et `CANCEL_FILTERS` dans `report.ts`) :

- **Nuits passées** (par défaut) : un séjour à cheval sur deux mois est partagé selon les nuits de chaque mois ; ménage au mois d'arrivée.
- **Date d'arrivée** : tout le séjour compte au mois d'arrivée (réglage « Arrivée » du rapport Hostaway, pour comparer).
- **Date de réservation** : tout le séjour compte au mois où il a été réservé (suivi des ventes).
- Annulations **Si elles rapportent** (par défaut) : comptées seulement si la plateforme verse quelque chose ; **Toutes** ; **Aucune**.

## Affichage par réservation

`report.reservations` (`ReservationLine`) : chaque réservation comptée, avec la part de ses montants qui tombe dans la période. En mode « nuits passées », un séjour à cheval affiche « 2 nuits sur 3 dans la période » et 2/3 des montants (le reste compte dans la période voisine). Le **nom du voyageur** (`reservation.guestName`, champ `guestName` de Hostaway, ou prénom + nom) est stocké en base et affiché uniquement dans le tableau de bord (accès admin) et l'export CSV ; il n'apparaît jamais dans les journaux ni dans `raw`. Airbnb efface le nom quelque temps après le séjour : les réservations Airbnb d'avant mi-septembre 2026 affichent « Nom effacé ». Colonne ajoutée par `prisma/sql/2026-11-finances-3.sql` (appliqué sur staging ; à appliquer en production). La référence est passée par `publicReference` : pour Airbnb, seul le code de confirmation est gardé (la référence Hostaway contient l'identifiant du voyageur).

## Colonnes → champs

Notation : `r.` = champ de la réservation, `f.` = champ de `/financeStandardField`.
Code : `src/lib/finances/mapping.ts` (testé dans `report.test.ts`).

Lecture de l'écran (demande d'Elypse, 16/11/2026) : **chiffre d'affaires** = tout ce que les voyageurs ont payé ; puis chaque montant qui en sort (commissions, frais de paiement, remboursements, taxe de séjour, TVA) ; **bénéfice** = ce qui reste réellement. Le ménage payé par les voyageurs est affiché à part (« dont ménage ») et reste dans le bénéfice. Occupation, séjours et nuitées sont toujours affichés.

| Colonne | Formule | Remarques |
| --- | --- | --- |
| **Chiffre d'affaires** (champ `gross`) | `CA hors taxes + taxe de séjour + TVA` = `r.totalPrice + remboursements` | Tout ce que les voyageurs ont payé = « Revenus de location » du rapport Hostaway (vérifié au centime : 28 362,43 € du 1er au 15/11, par arrivée). |
| CA hors taxes (champ `revenue`, calcul interne) | `r.totalPrice − taxe de séjour − TVA + remboursements` | Rental Revenue au sens Hostaway (Financial Reporting) : nuitées + ménage + frais de service voyageur + suppléments. Sert de base au prorata. |
| **Commissions plateforme** | `f.hostChannelFee` (à défaut `r.channelCommissionAmount`, puis `r.airbnbListingHostFee`) `+ f.guestChannelFee` | `r.channelCommissionAmount` est souvent vide pour Booking (9 réservations sur 19 en octobre) : `f.hostChannelFee` est fiable. |
| **Frais de paiement** | `f.paymentServiceProcessingFees + f.bookingcomPaymentProcessingFee`, à défaut **1,4 % du `totalPrice` pour Booking** | Les champs Hostaway sont toujours vides ; le taux de 1,4 % est le réglage « Frais de traitement du paiement OTA » du compte Hostaway, absent de l'API (vérifié au centime : 1 162,44 € → 16,27 €). Constante `BOOKING_PAYMENT_FEE_RATE` dans `mapping.ts`. |
| **Remboursements** | `−(f.airbnbClosedResolutionsSum + f.airbnbOpenResolutionsSum)` (séjours confirmés) | Résolutions Airbnb (remboursements aux voyageurs). Hostaway les retire de `totalPrice` : on les rajoute au CA puis on les déduit du revenu net. Pour une annulation, la résolution est le montant conservé et reste dans le CA. |
| **Net des plateformes** (champ `payout` ; « Net » par réservation, « Net avant charges » par plateforme) | `CA − commissions − frais de paiement − remboursements − taxe de séjour − TVA` | Ce qui est reçu des plateformes, taxes à reverser retirées. Égal à `f.airbnbPayoutSum` pour 500 séjours Airbnb confirmés sur 537 ; les 37 autres ont un remboursement qu'Airbnb n'a pas encore retenu sur son versement. |
| − Charges (`charges` = `chargesHT` + `chargesVat`) | charges saisies à la main (voir « Charges fixes par bien ») | Loyer, leasing mobilier, électricité… TVA comprise, comptées au jour près. |
| **Bénéfice** (champ `profit`) | `net des plateformes − charges TTC` | Ce qui reste réellement. |
| **Taxe de séjour** | `f.cityTax + f.airbnbTransientOccupancyTax + f.transientOccupancyTax + f.guestNightlyTax + f.guestStayTax + f.guestPerPersonPerNightTax` | Airbnb : `f.salesTax` reprend la même taxe que `f.airbnbTransientOccupancyTax` (non additionné). |
| **TVA** | `f.vat + f.otherTaxes + f.roomTax + f.lodgingTax + f.hotelTax` (+ `f.salesTax` hors Airbnb) | Collectée en plus du CA (Booking, 10 % sur certains listings). |
| **dont ménage** | `f.cleaningFeeValue` (à défaut `r.cleaningFee`, puis `r.airbnbListingCleaningFee`) | Inclus dans le CA. Uniquement s'il a été facturé : 39 réservations sur 750. Sinon 0 €. Un frais par séjour, compté au mois d'arrivée. |
| Séjours / nuits | `r.nights` (à défaut départ − arrivée) | |
| Occupation | nuits occupées / nuits du calendrier × biens | Toujours affichée. Les nuits bloquées ne sont pas déduites, car l'API calendrier n'est pas lue. Toute l'année compte, y compris les mois d'avant la mise en location (janvier-mars 2026) : l'occupation annuelle 2026 (35,9 %) est donc sous-estimée ; les taux mensuels sont fiables (octobre : 83,3 %). |

### Par plateforme (constaté)

**Airbnb** (`airbnbOfficial`, canal 2018) — 670 réservations
- `totalPrice = f.baseRate + f.cleaningFeeValue + f.guestChannelFee + f.priceForExtraPerson + f.salesTax + résolutions`
- Résolutions (`f.airbnbClosedResolutionsSum`, `f.airbnbOpenResolutionsSum`) : toujours négatives (remboursements / retenues au détriment de l'hôte). Non déduites des revenus d'un séjour confirmé, comme le rapport Hostaway ; pour une annulation, la résolution est le montant conservé et reste comptée.
- Commission = `f.hostChannelFee` (≈ 15,5 % du `baseRate`, identique à `r.airbnbListingHostFee`) + `f.guestChannelFee`
  (frais de service voyageur, présent sur 18 réservations : inclus dans `totalPrice` mais gardé par Airbnb).
- Taxe de séjour = `f.airbnbTransientOccupancyTax` (= `r.airbnbTransientOccupancyTaxPaidAmount`). Airbnb la reverse
  lui-même (`r.airbnbOccupancyTaxAmountPaidToHost` = 0) : elle n'est **pas** dans le versement.
- Contrôle : versement calculé = `f.airbnbPayoutSum` (= `r.airbnbExpectedPayoutAmount`).

**Booking.com** (`bookingcom`, canal 2005) — 79 réservations
- `totalPrice = f.baseRate + f.vat + f.cityTax (+ f.cleaningFeeValue)`
- Commission = `f.hostChannelFee`.
- Taxe de séjour = `f.cityTax`.
- TVA (`f.vat`, 10 %) : **conservée dans les revenus** (« avant taxes »). Elle est absente sur certains listings.
- Annulations : `r.totalPrice` = 0 alors que `f.baseRate` et `f.cityTax` gardent les montants initiaux → tout est mis à 0.

**Direct** (`direct`, canal 2000) — 1 réservation : `totalPrice = f.baseRate`, pas de commission.

### Statuts

- Comptés : `new`, `modified`.
- Annulations (`cancelled`) : par défaut, comptées seulement si le versement conservé est non nul (6 en
  octobre). Le filtre permet de toutes les inclure ou de toutes les exclure.
- Jamais comptés : `inquiry`, `inquiryPreapproved`, `inquiryNotPossible`, `expired`, `declined` (demandes et
  refus Airbnb).

### Doublons et biens à plusieurs listings

Un **bien** regroupe un ou plusieurs listings (`/dashboard/finances/biens`). Chaque réservation appartient à
un seul listing (`listingMapId`) et a un identifiant Hostaway unique : elle n'est donc comptée qu'une fois
dans son bien. Le calcul écarte aussi une réservation qui aurait la même référence plateforme
(`channelReservationId`) qu'une autre. Il n'y en a aucune aujourd'hui, et un avertissement s'affiche si cela
arrive. L'occupation d'un bien est calculée sur un seul calendrier, même avec deux listings.

## Données conservées

Table `reservation` : montants en centimes, dates, statut, canal, référence plateforme et `raw` =
`{ reservation, finance }`, limité aux **champs numériques et aux dates et statuts**. Aucun nom, e-mail,
téléphone, adresse, carte ou code d'accès n'est conservé (`sanitizeReservation`).
`pnpm hostaway:sync --remap` recalcule les montants depuis `raw`, sans appeler Hostaway, si le mapping change.

## Définitions Hostaway retenues (15/11/2026)

Source : réponse de Hostaway à Elypse (Financial Reporting → Financial Settings). **Rental Revenue** = tarif par nuitée + ménage + frais de service voyageur + suppléments, avant toute déduction. **Revenu net** = ce qui est reçu après commissions OTA, frais de paiement, taxes et remboursements.

Contrôle du 1er au 10/11/2026 (arrivées, 34 séjours) : CA 19 750,65 € + taxe de séjour 2 243,75 € + TVA 98,61 € = **22 093,01 €**, le chiffre du rapport Hostaway (taxes comprises). Commissions 2 853,00 € · remboursements 480,00 € · **revenu net 16 417,65 €**. Octobre (arrivées, 119 séjours) : CA 81 380,44 € · commissions 13 578,78 € · remboursements 4 338,58 € · revenu net 63 463,08 € · taxe de séjour 9 187,85 € · TVA 923,45 €. `scripts/finances-summary.ts` recalcule ces chiffres pour n'importe quelle période.

## Rapprochement du profit net Hostaway (15/11/2026)

Formules Hostaway (Rapports financiers → Paramètres financiers) : **Profit net = Versement total − Loyer** (loyer = 0).
Versement total Airbnb = somme des versements Airbnb + somme des résolutions fermées. Versement total Booking =
**Total payé** − frais de canal de l'hôte − frais de paiement − taxe de ville. Revenus de location = prix total du canal.

Rapport « Activité de location », 1er-15/11/2026, par arrivée (`scripts/finances-match-hostaway.ts`) :

- Revenus de location : **identiques au centime** sur les 10 biens (28 362,43 €).
- Profit net : **identique au centime** pour Le Vaneau, Le Bosquet, Le Amelot 62, Le Bartholdi et Saint martin.
- Écarts restants, tous expliqués :
  1. **TVA Booking** (Le Amelot 157 75,82 €, 101 rue Nollet 12,39 €, La Sourdière 42,48 €) : Hostaway ne la déduit pas.
     Le module la sort du bénéfice, car elle est due à l'État.
  2. **Le Toudic, 150 €** : double comptage dans la formule Hostaway. Pour la réservation #71026339, Airbnb a déjà
     retiré la résolution de 150 € de son versement (234,44 € → 84,44 €), et Hostaway la retire une deuxième fois.
     Le module retient 84,44 €, ce qu'Airbnb verse réellement.
  3. **Le Miromesnil, réservation Booking #66454347 (3 308,80 €)** : aucun paiement enregistré dans Hostaway (statut
     « Unknown ») et aucune commission. Le « Total payé » vaut 0, donc le profit Hostaway vaut 0. Le module compte la
     réservation (3 262,48 € après frais de paiement) mais sans commission Booking : **à corriger dans Hostaway**.

## Vérification — octobre 2026, « Arrivées du mois »

Rapport Hostaway « Activité de location » : ≈ 174 réservations à l'arrivée du 1er au 31 octobre.

| | Nombre |
| --- | --- |
| Réservations arrivant en octobre dans Hostaway, **tous statuts** | **174** ✓ (même total) |
| dont confirmées (`new` 102, `modified` 11) | 113 |
| dont annulées (Airbnb 21, Booking 12) | 33, dont 6 avec un versement conservé |
| dont demandes, refus, expirées (Airbnb) | 28 |
| **Séjours comptés par défaut** (confirmées + annulations avec versement) | **119** |

Montants (arrivées d'octobre, annulations avec versement) : revenus 77 965,31 € · commissions 13 578,78 € ·
frais de paiement 0 € · **versement 64 386,53 €** · taxe de séjour 9 187,85 € · ménage 800,00 € · 284 nuits.
Par plateforme : Airbnb 98 séjours (versement 54 175,69 €), Booking 20 (9 753,39 €), direct 1 (457,45 €).

Écarts possibles avec le rapport Hostaway, et leurs causes :

1. **Nombre de lignes** : 174 dans Hostaway contre 119 séjours ici. Le rapport Hostaway liste toutes les
   réservations, y compris les 28 demandes et refus et les 27 annulations sans versement ; le module ne
   compte que les séjours.
2. **Résolutions Airbnb** : corrigé. Calage au centime sur le rapport Hostaway du 1er au 10/11/2026 (arrivées) :
   **22 093,01 €** = somme des `totalPrice` des séjours confirmés **sans déduire les résolutions** (21 613,01 € +
   480,00 €), taxe de séjour comprise. Le module affiche 19 849,26 € de revenus + 2 243,75 € de taxe de séjour =
   22 093,01 €. Les résolutions ne sont donc plus déduites des séjours confirmés. Attention : Airbnb les retire
   bien de ses versements, déjà fait pour 51 séjours anciens (juillet-août) et apparemment plus tard pour les
   séjours récents. Au total, 89 séjours confirmés et −18 842,13 € de résolutions ne sont pas déduits.
   `scripts/finances-resolutions.ts` en donne le détail.
3. **Frais voyageur Airbnb** (`f.guestChannelFee`) : comptés en commission. Si le rapport Hostaway les met
   dans les revenus sans les déduire, son versement est plus élevé.
4. **TVA Booking** : incluse dans les revenus. Un rapport « hors taxes » afficherait des revenus Booking plus
   bas (environ −908 € en octobre).
5. **Taxe de séjour Airbnb** : affichée dans la colonne taxe de séjour, alors qu'Airbnb la reverse lui-même.

**Contrôle en direct** (`scripts/finances-verify-live.ts`, 10/11/2026) : les 174 réservations d'octobre sont
relues dans Hostaway. Résultat : 0 absente, 0 statut différent et 0 écart de montant entre la base et l'API.
Les écarts éventuels avec le rapport Hostaway tiennent donc aux **définitions** des colonnes, pas aux données.
Séjours confirmés d'octobre : `totalPrice` 84 446,90 € · `baseRate` 77 184,62 € · ménage 800 € · commission hôte
12 266,75 € · frais voyageur Airbnb 734,12 € · taxe de séjour 9 003,29 € · TVA Booking 923,45 € · résolutions
−4 338,58 € · versement calculé 62 442,74 € (66 426,32 € avec les versements Airbnb réels `airbnbPayoutSum`).

Les montants du rapport Hostaway ne sont pas lisibles par l'API : à comparer colonne par colonne avec
l'export du rapport « Activité de location » (même mois, mêmes filtres de statut). Pour regénérer ces
chiffres : `pnpm tsx --env-file=.env scripts/finances-compare-month.ts 2026-10`.

## Charges fixes par bien (19/11/2026)

Demande d'Elypse : saisir à la main les autres charges de chaque bien (loyer, leasing du mobilier, électricité…), avec la TVA de chaque charge, sans réécrire le passé quand un montant change. Page `/dashboard/finances/charges` (admin connecté), calcul dans `src/lib/finances/charges.ts` (module pur, testé par `charges.test.ts`).

- **Modèle** : `bien_charge` (bien, type, libellé) et `bien_charge_version` (à partir du, jusqu'au facultatif, montant mensuel HT en centimes, taux de TVA en points de base, note, date de saisie). Une version n'est jamais modifiée : « Modifier » crée une nouvelle version à partir d'une date choisie. Sur un même jour, la version saisie en dernier l'emporte ; une version avec une date de fin laisse reprendre la précédente après elle. « Arrêter la charge » = version à 0 €. Supprimer une saisie (erreur de frappe) recalcule sans elle ; la dernière saisie ne se supprime qu'avec la charge.
- **Calcul** : le montant mensuel est réparti au jour (montant × jours couverts / jours du mois) dans chaque tranche du rapport, quel que soit le mode de rattachement. Un mois entier compte le montant exact ; une année = somme de ses mois. TVA = HT × taux, arrondie par tranche. Les charges ne sont pas réparties par réservation ni par plateforme (tableau des plateformes : « Net avant charges »).
- **Bénéfice** = net des plateformes − charges **TTC** (ce qui sort réellement de la poche). Si la TVA des charges est récupérée, le choix inverse (déduire le HT) se fait dans `Acc.totals` (`report.ts`).
- **Export CSV** : colonnes Net avant charges, Charges HT, TVA sur charges, Charges TTC, Bénéfice, et une section « Charges de la période » par bien.

## Biens exclus des calculs (19/11/2026)

`bien.excludedFromReports` (interrupteur « Compté dans les finances » sur `/dashboard/finances/biens`) : les réservations, nuits disponibles et charges du bien sont ignorées dans le rapport de tous les biens (totaux, graphiques, plateformes, export). Le bien reste consultable seul en le choisissant dans le filtre « Bien » (bandeau d'avertissement), et sa carte de livret garde ses propres chiffres du mois. Tables et colonne créées par `prisma/sql/2026-11-finances-4.sql` (appliqué sur staging ; à appliquer en production).

## Coût du ménage (17/11/2026)

Demande : déduire du bénéfice le coût du ménage payé par Elypse. Recherche dans l'API Hostaway (lecture seule, `scripts/hostaway-explore-cleaning-cost.ts`) :

- `/expenses` (dépenses), `/tasks` (tâches de ménage), `/ownerStatements`, `/listingFeeSettings/{id}` : **vides** ;
- fiche des listings : seul `cleaningFee` existe, c'est le ménage **facturé au voyageur** (200 € sur Le Miromesnil, 0 ailleurs), pas un coût ;
- réservations et détail financier : aucun champ de coût de ménage.

Aucun coût de ménage n'est donc renseigné dans Hostaway à ce jour. Dès qu'il sera saisi comme dépense Hostaway (Dépenses et extras, y compris par règle automatique à chaque départ), il remontera par `/expenses` et pourra être déduit du bénéfice.

## Questions ouvertes pour l'équipe

- **Mode de rattachement par défaut** : « Séjours du mois » (actuel) ou « Arrivées du mois », comme le rapport Hostaway ?
- **Annulations** : garder par défaut « seulement si un versement est conservé » ?
- **Résolutions Airbnb** : les déduire des revenus (actuel, comme `totalPrice`) ou les montrer à part ?
- **TVA Booking** : la laisser dans les revenus (actuel) ou la sortir dans une colonne ?
- **Frais de paiement** : Hostaway ne les fournit pas (toujours vides). Faut-il les estimer (par exemple les
  frais Payments by Booking) ou les laisser à 0 € ?
- **Frais de gestion Elypse** : hors périmètre (aucune saisie manuelle) ; à définir s'il faut les calculer.
- **Biens à deux listings** : laquelle de ces paires est un même logement ? Un exemple probable :
  « Le Miromesnil » (#592514) et « Le Miromesnil x » (#617796, aucune réservation à ce jour). À fusionner
  dans `/dashboard/finances/biens`.
- **Accès** : le dashboard n'a qu'un compte admin (inscription désactivée). Faut-il des comptes en lecture
  pour d'autres personnes ?
