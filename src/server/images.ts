import 'server-only';
import sharp from 'sharp';
import { IMAGE_MAX_DIMENSION, THUMB_MAX_DIMENSION } from '@/lib/constants';
import { isAllowedImageMime, looksExecutable, sniffImageMime } from '@/lib/image-mime';
import { maxUploadBytes } from './env';
import { ApiError } from './errors';

export interface ProcessedImage {
  /** Εικόνα για αποθήκευση & αποστολή στο AI (WebP, χωρίς EXIF). */
  full: Buffer;
  /** Μικρογραφία για λίστες. */
  thumb: Buffer;
  contentType: 'image/webp';
  originalMime: string;
  width: number;
  height: number;
}

/**
 * Επικυρώνει και κανονικοποιεί το αρχείο που ανέβασε ο χρήστης:
 * - έλεγχος μεγέθους
 * - έλεγχος πραγματικού MIME από magic bytes
 * - απόρριψη εκτελέσιμων
 * - resize + επανακωδικοποίηση σε WebP (αφαιρεί EXIF/GPS και τυχόν payloads)
 */
export async function processMealImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) {
    throw new ApiError('BAD_REQUEST', 'Το αρχείο είναι κενό.');
  }
  if (input.byteLength > maxUploadBytes) {
    throw new ApiError(
      'PAYLOAD_TOO_LARGE',
      `Το αρχείο ξεπερνά το όριο των ${Math.round(maxUploadBytes / (1024 * 1024))} MB.`,
    );
  }

  const bytes = new Uint8Array(input.buffer, input.byteOffset, Math.min(input.byteLength, 64));
  if (looksExecutable(bytes)) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 'Το αρχείο δεν είναι εικόνα.');
  }

  const mime = sniffImageMime(bytes);
  if (!isAllowedImageMime(mime)) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 'Επιτρέπονται μόνο JPEG, PNG, WebP και HEIC.');
  }

  try {
    // failOn: 'error' -> απορρίπτει κακοσχηματισμένα/κακόβουλα αρχεία εικόνας.
    const pipeline = sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 });
    const metadata = await pipeline.metadata();

    const full = await sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate() // εφαρμόζει τον EXIF προσανατολισμό πριν τον αφαιρέσουμε
      .resize({
        width: IMAGE_MAX_DIMENSION,
        height: IMAGE_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    const thumb = await sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({
        width: THUMB_MAX_DIMENSION,
        height: THUMB_MAX_DIMENSION,
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 70 })
      .toBuffer();

    return {
      full,
      thumb,
      contentType: 'image/webp',
      originalMime: mime,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 'Η εικόνα δεν μπόρεσε να επεξεργαστεί.');
  }
}
