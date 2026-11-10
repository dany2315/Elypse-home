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

## Colonnes → champs

Notation : `r.` = champ de la réservation, `f.` = champ de `/financeStandardField`.
Code : `src/lib/finances/mapping.ts` (testé dans `report.test.ts`).

| Colonne | Formule | Remarques |
| --- | --- | --- |
| **Revenus de location** | `r.totalPrice − taxe de séjour` | Montant payé par le voyageur, hors taxe de séjour. Comprend le ménage, la TVA Booking, les frais voyageur Airbnb et les résolutions Airbnb (voir plus bas). |
| **Commissions plateforme** | `f.hostChannelFee` (à défaut `r.channelCommissionAmount`, puis `r.airbnbListingHostFee`) `+ f.guestChannelFee` | `r.channelCommissionAmount` est souvent vide pour Booking (9 réservations sur 19 en octobre) : `f.hostChannelFee` est fiable. |
| **Frais de paiement** | `f.paymentServiceProcessingFees + f.bookingcomPaymentProcessingFee` | **Toujours vides sur ce compte** (0 réservation sur 750) → 0 €. Voir les questions ouvertes. |
| **Versement total** | `revenus − commissions − frais de paiement` | Avant impôts. Égal à `f.airbnbPayoutSum` pour 500 réservations Airbnb confirmées sur 537 ; les 37 autres ont une résolution Airbnb. |
| **Taxe de séjour** | `f.cityTax + f.airbnbTransientOccupancyTax + f.transientOccupancyTax + f.guestNightlyTax + f.guestStayTax + f.guestPerPersonPerNightTax` | Airbnb : `f.salesTax` reprend la même taxe que `f.airbnbTransientOccupancyTax` (non additionné). |
| **Ménage** | `f.cleaningFeeValue` (à défaut `r.cleaningFee`, puis `r.airbnbListingCleaningFee`) | Uniquement s'il a été facturé : 39 réservations sur 750. Sinon 0 €. Un frais par séjour, compté au mois d'arrivée. |
| Séjours / nuits | `r.nights` (à défaut départ − arrivée) | |
| Occupation | nuits occupées / nuits du calendrier × biens | Option (interrupteur « Occupation »). Les nuits bloquées ne sont pas déduites, car l'API calendrier n'est pas lue. |

### Par plateforme (constaté)

**Airbnb** (`airbnbOfficial`, canal 2018) — 670 réservations
- `totalPrice = f.baseRate + f.cleaningFeeValue + f.guestChannelFee + f.priceForExtraPerson + f.salesTax + résolutions`
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
2. **Résolutions Airbnb** (`f.airbnbClosedResolutionsSum` / `f.airbnbOpenResolutionsSum`) : −4 338,58 € sur
   les séjours confirmés d'octobre. Hostaway les déduit de `totalPrice`, donc de nos revenus et de notre
   versement, alors que `f.airbnbPayoutSum` ne les déduit pas (56 215,48 €). Sur tout l'historique,
   37 réservations sont concernées (−8 021,36 €).
3. **Frais voyageur Airbnb** (`f.guestChannelFee`) : comptés en commission. Si le rapport Hostaway les met
   dans les revenus sans les déduire, son versement est plus élevé.
4. **TVA Booking** : incluse dans les revenus. Un rapport « hors taxes » afficherait des revenus Booking plus
   bas (environ −908 € en octobre).
5. **Taxe de séjour Airbnb** : affichée dans la colonne taxe de séjour, alors qu'Airbnb la reverse lui-même.

Les montants du rapport Hostaway ne sont pas lisibles par l'API : à comparer colonne par colonne avec
l'export du rapport « Activité de location » (même mois, mêmes filtres de statut). Pour regénérer ces
chiffres : `pnpm tsx --env-file=.env scripts/finances-compare-month.ts 2026-10`.

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
