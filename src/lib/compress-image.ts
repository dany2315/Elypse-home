"use client";

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Redimensionne (1800 px max) et compresse une photo dans le navigateur avant l'envoi
 * (une photo de téléphone de 5 Mo devient ~200-400 Ko).
 * WebP si le navigateur sait l'encoder, sinon JPEG (Safari ne sait pas produire de WebP).
 */
export async function compressImage(file: File, maxSize = 1800, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await toBlob(canvas, "image/webp", quality);
  // Navigateur sans encodeur WebP : il renvoie du PNG (très lourd) → on passe en JPEG.
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) return file;

  // On garde l'original seulement s'il est déjà petit et plus léger.
  if (scale === 1 && blob.size >= file.size) return file;

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], file.name.replace(/\.\w+$/, "") + `.${ext}`, { type: blob.type });
}
