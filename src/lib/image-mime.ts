import { ALLOWED_IMAGE_MIME, type AllowedImageMime } from './constants';

/**
 * Αναγνώριση πραγματικού τύπου εικόνας από τα magic bytes.
 * ΔΕΝ εμπιστευόμαστε ποτέ το Content-Type ή την κατάληξη που στέλνει ο client.
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return 'image/png';

  // WebP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (riff.every((b, i) => bytes[i] === b) && webp.every((b, i) => bytes[8 + i] === b)) {
    return 'image/webp';
  }

  // HEIC/HEIF (iPhone): ISO-BMFF container με "ftyp" box στα bytes 4-7 και
  // major brand στα 8-11. Το sharp/libvips το αποκωδικοποιεί και το γεύμα
  // αποθηκεύεται πάντα σε WebP, οπότε δεν διαφοροποιούμε heic από heif.
  const ftyp = [0x66, 0x74, 0x79, 0x70];
  if (ftyp.every((b, i) => bytes[4 + i] === b)) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    const HEIF_BRANDS = new Set([
      'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1',
    ]);
    if (HEIF_BRANDS.has(brand)) return 'image/heic';
  }

  return null;
}

export function isAllowedImageMime(mime: string | null): mime is AllowedImageMime {
  return mime !== null && (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime);
}

/**
 * Εντοπίζει μοτίβα εκτελέσιμων/scripts που έχουν μετονομαστεί σε .jpg κ.λπ.
 * Δεύτερη γραμμή άμυνας μετά το magic-byte check.
 */
export function looksExecutable(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const head = Array.from(bytes.slice(0, 4));
  // ELF
  if (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) return true;
  // Windows PE / DOS MZ
  if (head[0] === 0x4d && head[1] === 0x5a) return true;
  // Shebang
  if (head[0] === 0x23 && head[1] === 0x21) return true;
  // ZIP / JAR / Office (PK\x03\x04)
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return true;
  return false;
}
