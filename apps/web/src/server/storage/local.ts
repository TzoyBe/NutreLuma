import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isSafeStorageKey, StorageError, type StorageDriver, type StoredObject } from './types';

/** Αποθήκευση στο τοπικό filesystem (persistent Docker volume). */
export class LocalDiskStorage implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Μετατρέπει το λογικό key σε απόλυτο path, μπλοκάροντας path traversal. */
  private resolveKey(key: string): string {
    if (!isSafeStorageKey(key)) {
      throw new StorageError('Μη έγκυρο κλειδί αρχείου.');
    }
    const target = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (!target.startsWith(rootWithSep)) {
      throw new StorageError('Το αρχείο βρίσκεται εκτός του επιτρεπόμενου καταλόγου.');
    }
    return target;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // "wx": αποτρέπει σιωπηλή αντικατάσταση υπάρχοντος αρχείου.
    await fs.writeFile(target, data, { flag: 'wx', mode: 0o640 });
    return { key, size: data.byteLength, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const target = this.resolveKey(key);
    try {
      return await fs.readFile(target);
    } catch {
      throw new StorageError('Το αρχείο δεν βρέθηκε.');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(key));
    } catch {
      // Ήδη διαγραμμένο ή μη έγκυρο key — δεν αποτελεί σφάλμα για τον caller.
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}
