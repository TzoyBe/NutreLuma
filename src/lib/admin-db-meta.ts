/**
 * Metadata & coercion για τον generic admin DB browser. Οδηγείται από το Prisma
 * DMMF, ώστε νέα models να καλύπτονται αυτόματα. Καθαρές συναρτήσεις (χωρίς DB) —
 * unit-testable.
 */
import { Prisma } from '@prisma/client';

/** Διαχειριζόμενα από το σύστημα — ποτέ επεξεργάσιμα από τον admin. */
export const READONLY_FIELDS = new Set(['id', 'createdAt', 'updatedAt']);
/** Ευαίσθητα: εμφανίζονται μασκαρισμένα και δεν επεξεργάζονται. */
export const SENSITIVE_FIELDS = new Set(['passwordHash', 'tokenHash']);
export const MASK = '••••';

export type FieldKind = 'scalar' | 'enum' | 'object';

export interface FieldMeta {
  name: string;
  kind: FieldKind;
  type: string;
  isList: boolean;
  isRequired: boolean;
  editable: boolean;
  sensitive: boolean;
  enumValues?: string[];
}

export interface ModelMeta {
  name: string;
  delegate: string;
  pkField: string | null;
  fields: FieldMeta[];
}

export function delegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function enumValuesByName(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of Prisma.dmmf.datamodel.enums) {
    map.set(e.name, e.values.map((v) => v.name));
  }
  return map;
}

export function listModelMeta(): ModelMeta[] {
  const enums = enumValuesByName();
  return Prisma.dmmf.datamodel.models.map((model) => {
    const pk = model.fields.find((f) => f.isId);
    const fields: FieldMeta[] = model.fields.map((f) => {
      const kind: FieldKind = f.kind === 'object' ? 'object' : f.kind === 'enum' ? 'enum' : 'scalar';
      const sensitive = SENSITIVE_FIELDS.has(f.name);
      const editable =
        kind !== 'object' &&
        !f.isList &&
        !f.isId &&
        !READONLY_FIELDS.has(f.name) &&
        !sensitive;
      return {
        name: f.name,
        kind,
        type: f.type,
        isList: Boolean(f.isList),
        isRequired: Boolean(f.isRequired),
        editable,
        sensitive,
        ...(kind === 'enum' ? { enumValues: enums.get(f.type) ?? [] } : {}),
      };
    });
    return { name: model.name, delegate: delegateName(model.name), pkField: pk?.name ?? null, fields };
  });
}

export function getModelMeta(name: string): ModelMeta | null {
  return listModelMeta().find((m) => m.name === name) ?? null;
}

/**
 * Μετατρέπει μια τιμή (συνήθως string από φόρμα) στον τύπο που περιμένει το
 * Prisma. Κενό/undefined → null (αν επιτρέπεται). Ρίχνει σε άκυρη τιμή.
 */
export function coerceValue(field: FieldMeta, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === '') {
    if (field.isRequired) throw new Error(`Field "${field.name}" is required.`);
    return null;
  }

  switch (field.type) {
    case 'Int':
    case 'BigInt': {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error(`Field "${field.name}" must be an integer.`);
      return field.type === 'BigInt' ? BigInt(n) : n;
    }
    case 'Float': {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Field "${field.name}" must be a number.`);
      return n;
    }
    case 'Decimal': {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Field "${field.name}" must be a number.`);
      return new Prisma.Decimal(n);
    }
    case 'Boolean':
      return raw === true || raw === 'true' || raw === '1';
    case 'DateTime': {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) throw new Error(`Field "${field.name}" must be a valid date.`);
      return d;
    }
    case 'Json':
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          throw new Error(`Field "${field.name}" must be valid JSON.`);
        }
      }
      return raw;
    default:
      if (field.kind === 'enum') {
        const value = String(raw);
        if (!field.enumValues?.includes(value)) {
          throw new Error(`Field "${field.name}" must be one of: ${field.enumValues?.join(', ')}.`);
        }
        return value;
      }
      return String(raw);
  }
}
