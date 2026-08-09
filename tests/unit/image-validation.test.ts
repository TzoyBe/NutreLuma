import { describe, expect, it } from 'vitest';
import { isAllowedImageMime, looksExecutable, sniffImageMime } from '@/lib/image-mime';
import { isSafeStorageKey } from '@/server/storage/types';

function bytes(values: number[], padTo = 16): Uint8Array {
  const out = new Uint8Array(padTo);
  out.set(values.slice(0, padTo));
  return out;
}

describe('sniffImageMime', () => {
  it('αναγνωρίζει JPEG', () => {
    expect(sniffImageMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('αναγνωρίζει PNG', () => {
    expect(sniffImageMime(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
  });

  it('αναγνωρίζει WebP', () => {
    const webp = bytes([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageMime(webp)).toBe('image/webp');
  });

  it('αναγνωρίζει HEIC (φωτογραφία iPhone)', () => {
    // ftyp box (bytes 4-7) + brand "heic" (bytes 8-11)
    const heic = bytes([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    expect(sniffImageMime(heic)).toBe('image/heic');
  });

  it('αναγνωρίζει HEIF brand mif1', () => {
    const heif = bytes([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31,
    ]);
    expect(sniffImageMime(heif)).toBe('image/heic');
  });

  it('απορρίπτει ftyp box με άγνωστο brand (π.χ. MP4)', () => {
    // "ftyp" + "isom" -> βίντεο, όχι εικόνα
    const mp4 = bytes([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(sniffImageMime(mp4)).toBeNull();
  });

  it('απορρίπτει GIF (μη υποστηριζόμενο)', () => {
    expect(sniffImageMime(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull();
  });

  it('απορρίπτει κείμενο μεταμφιεσμένο σε εικόνα', () => {
    const text = new TextEncoder().encode('<?php system($_GET[1]); ?>');
    expect(sniffImageMime(text)).toBeNull();
  });

  it('απορρίπτει πολύ μικρά αρχεία', () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe('isAllowedImageMime', () => {
  it('δέχεται μόνο τους επιτρεπτούς τύπους', () => {
    expect(isAllowedImageMime('image/jpeg')).toBe(true);
    expect(isAllowedImageMime('image/heic')).toBe(true);
    expect(isAllowedImageMime('image/gif')).toBe(false);
    expect(isAllowedImageMime(null)).toBe(false);
  });
});

describe('looksExecutable', () => {
  it('εντοπίζει ELF', () => {
    expect(looksExecutable(bytes([0x7f, 0x45, 0x4c, 0x46]))).toBe(true);
  });

  it('εντοπίζει Windows PE', () => {
    expect(looksExecutable(bytes([0x4d, 0x5a, 0x90, 0x00]))).toBe(true);
  });

  it('εντοπίζει shell script', () => {
    expect(looksExecutable(new TextEncoder().encode('#!/bin/sh\nrm -rf /'))).toBe(true);
  });

  it('εντοπίζει ZIP/JAR', () => {
    expect(looksExecutable(bytes([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });

  it('δεν σημαίνει JPEG ως εκτελέσιμο', () => {
    expect(looksExecutable(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });
});

describe('isSafeStorageKey (path traversal)', () => {
  it('δέχεται κανονικό κλειδί', () => {
    expect(isSafeStorageKey('meals/user1/2026/08/abcd-full.webp')).toBe(true);
  });

  it('απορρίπτει ".."', () => {
    expect(isSafeStorageKey('meals/../../etc/passwd.webp')).toBe(false);
  });

  it('απορρίπτει απόλυτα paths', () => {
    expect(isSafeStorageKey('/etc/passwd.webp')).toBe(false);
  });

  it('απορρίπτει backslashes (Windows traversal)', () => {
    expect(isSafeStorageKey('meals\\..\\secret.webp')).toBe(false);
  });

  it('απορρίπτει μη επιτρεπτές καταλήξεις', () => {
    expect(isSafeStorageKey('meals/user1/evil.php')).toBe(false);
    expect(isSafeStorageKey('meals/user1/evil.webp.sh')).toBe(false);
  });
});
