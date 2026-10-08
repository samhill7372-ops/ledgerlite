/**
 * Browser-only: runs Tesseract.js in a Web Worker on a downscaled image.
 * Everything stays on the device. Kept separate so Zone 1 tests never import tesseract.
 */
import { createWorker } from 'tesseract.js';

export interface OcrProgress { status: string; progress: number }
export interface OcrResult { text: string; confidence: number }

/** Resize to maxWidth (receipts are tall and narrow; ~1200px is plenty) and re-encode as JPEG. */
export async function downscaleImage(file: Blob, maxWidth = 1200, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  if (scale === 1 && file.type === 'image/jpeg') return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality));
}

export async function recognize(image: Blob, onProgress?: (p: OcrProgress) => void, lang = 'eng'): Promise<OcrResult> {
  const worker = await createWorker(lang, 1, {
    // Self-host later: langPath: '/tessdata' (see public/tessdata in CLAUDE.md roadmap)
    logger: (m: { status?: string; progress?: number }) => onProgress?.({ status: m.status ?? '', progress: m.progress ?? 0 }),
  });
  try {
    const { data } = await worker.recognize(image);
    return { text: data.text ?? '', confidence: data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}
