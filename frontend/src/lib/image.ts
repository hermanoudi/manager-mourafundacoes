/** Limite de envio no aparelho (o servidor aceita mais; a foto reduzida fica bem abaixo disso). */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

async function encode(bitmap: ImageBitmap, w: number, h: number, quality: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Reduz a foto para JPEG com o lado maior ≤ `maxSide` (nunca amplia), aplicando a rotação do EXIF.
 * Se o navegador não decodificar o arquivo (ex.: HEIC no Chrome), devolve o original.
 */
export async function downscaleToJpeg(file: Blob, maxSide = 2000, quality = 0.8): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    return (await encode(bitmap, w, h, quality)) ?? file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
