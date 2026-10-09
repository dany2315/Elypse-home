/**
 * pnpm db:seed
 * - crée (ou met à jour) le compte administrateur défini dans .env
 * - ajoute deux livrets de démonstration si la base n'en contient aucun
 */
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/db";
import { generateLivretToken } from "../src/lib/token";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD manquants dans .env");

  const hash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });
  const userId = existing?.id ?? crypto.randomUUID();

  if (!existing) {
    await prisma.user.create({
      data: { id: userId, email, name: "Elypse Home", emailVerified: true },
    });
  }

  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });
  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { password: hash } });
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hash,
      },
    });
  }
  console.log(`✓ Administrateur prêt : ${email}`);
}

const L = (fr: string, en = "") => ({ fr, en });

async function seedDemoLivrets() {
  if ((await prisma.livret.count()) > 0) {
    console.log("• Des livrets existent déjà : pas de données de démonstration.");
    return;
  }

  const demos = [
    {
      name: "Démo Rivoli",
      title: "Appartement Rivoli — Louvre & Tuileries",
      address: "1 rue de Rivoli",
      wifi: ["ElypseRivoli", "Demo-1234"],
    },
    {
      name: "Démo Marais",
      title: "Loft du Marais — Place des Vosges",
      address: "10 rue des Francs-Bourgeois",
      wifi: ["ElypseMarais", "Demo-5678"],
    },
  ];

  for (const [i, d] of demos.entries()) {
    await prisma.livret.create({
      data: {
        name: d.name,
        title: d.title,
        address: d.address,
        city: "Paris",
        token: generateLivretToken(),
        sortOrder: i,
        buildingCode: "1234A",
        accessType: "boite-a-cle",
        keyboxCode: "0000",
        keyInstructions: L(
          "La boîte à clé se trouve à droite de la porte d'entrée.",
          "The key box is on the right of the front door.",
        ),
        parking: L(
          "Parking Indigo à 3 minutes à pied. Ouvert 24h/24.",
          "Indigo car park, 3 minutes on foot. Open 24/7.",
        ),
        wifiSsid: d.wifi[0],
        wifiPassword: d.wifi[1],
        rules: L(
          "🕐 Arrivée & départ\n- Arrivée : entre 16:00 et 21:00\n- Départ : avant 10:00\n👥 Pendant votre séjour\n- Calme entre 23:00 et 07:00\n- Pas de fête\n- Logement non-fumeur",
          "🕐 Arrival & departure\n- Check-in: 4:00 PM – 9:00 PM\n- Check-out: before 10:00 AM\n👥 During your stay\n- Quiet hours 11:00 PM – 7:00 AM\n- No parties\n- Non-smoking",
        ),
        essentials: L("Capsules de café, Shampoing, Gel douche", "Coffee capsules, Shampoo, Shower gel"),
        checkoutInstructions: L(
          "– Laisser le logement propre\n– Éteindre les lumières\n– Fermer les fenêtres\n– Déposer les clés dans la boîte à clé",
          "– Leave the apartment clean\n– Turn off the lights\n– Close the windows\n– Return the keys to the key box",
        ),
        contactPhone: "0600000000",
        contactEmail: "contact@example.com",
        recommendations: {
          create: [
            {
              name: "Le Bistrot Démo",
              category: "restaurant",
              address: "5 rue de Rivoli, 75001 Paris",
              description: L("Cuisine française de saison.", "Seasonal French cuisine."),
              travelTime: "3 min",
              travelMode: "pied",
              sortOrder: 0,
            },
            {
              name: "Boulangerie Démo",
              category: "boulangerie",
              address: "8 rue de Rivoli, 75001 Paris",
              description: L("Croissants et baguettes tradition.", "Croissants and traditional baguettes."),
              travelTime: "2 min",
              travelMode: "pied",
              sortOrder: 1,
            },
          ],
        },
        equipments: {
          create: [
            {
              name: L("Cafetière Nespresso", "Nespresso machine"),
              category: "cuisine",
              icon: "☕",
              instructions: L("Remplissez le réservoir et insérez une capsule.", "Fill the tank and insert a capsule."),
              sortOrder: 0,
            },
          ],
        },
        transports: {
          create: [
            {
              name: "Tuileries",
              type: "metro",
              line: "1",
              color: "#FFCD00",
              detail: L("2 min à pied.", "2 minutes on foot."),
              address: "Rue de Rivoli, 75001 Paris",
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }
  console.log(`✓ ${demos.length} livrets de démonstration créés`);
}

async function main() {
  await seedAdmin();
  await seedDemoLivrets();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
