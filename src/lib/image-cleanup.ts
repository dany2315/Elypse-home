import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Une image est « utilisée » si un livret, une recommandation ou un équipement y fait référence. */
const unused = Prisma.sql`
  NOT EXISTS (
    SELECT 1 FROM livret l
    WHERE l."coverImageId" = i.id
       OR i.id = ANY(l."facadeImageIds")
       OR l."videoUrl" = '/api/images/' || i.id
  )
  AND NOT EXISTS (SELECT 1 FROM recommendation r WHERE r."imageId" = i.id)
  AND NOT EXISTS (SELECT 1 FROM equipment e WHERE e."imageId" = i.id)`;

/**
 * Appelé après chaque enregistrement :
 * - supprime tout de suite les images remplacées ou retirées (`replaced`) qui ne servent plus nulle part ;
 * - supprime aussi les images envoyées mais jamais enregistrées (formulaire annulé) depuis plus de 24 h.
 * Un échec ici ne doit jamais faire échouer l'enregistrement.
 */
export async function cleanupImages(replaced: (string | null | undefined)[] = []) {
  const ids = [...new Set(replaced.filter((id): id is string => Boolean(id)))];
  try {
    if (ids.length) {
      await prisma.$executeRaw`DELETE FROM image i WHERE i.id IN (${Prisma.join(ids)}) AND ${unused}`;
    }
    await prisma.$executeRaw`DELETE FROM image i WHERE i."createdAt" < now() - interval '24 hours' AND ${unused}`;
  } catch (e) {
    console.error("Nettoyage des images impossible", e);
  }
}
