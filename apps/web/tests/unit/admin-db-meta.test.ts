import { describe, expect, it } from 'vitest';
import {
  listModelMeta,
  getModelMeta,
  delegateName,
  coerceValue,
  type FieldMeta,
} from '@/lib/admin-db-meta';

const field = (over: Partial<FieldMeta>): FieldMeta => ({
  name: 'f',
  kind: 'scalar',
  type: 'String',
  isList: false,
  isRequired: false,
  editable: true,
  sensitive: false,
  ...over,
});

describe('listModelMeta (DMMF-driven)', () => {
  it('exposes known models with a camelCase delegate and id PK', () => {
    const user = getModelMeta('User');
    expect(user).not.toBeNull();
    expect(user!.delegate).toBe('user');
    expect(user!.pkField).toBe('id');
  });

  it('marks id, createdAt, updatedAt and relations as non-editable', () => {
    const user = getModelMeta('User')!;
    const byName = (n: string) => user.fields.find((f) => f.name === n);
    expect(byName('id')!.editable).toBe(false);
    expect(byName('createdAt')?.editable ?? false).toBe(false);
    const meals = byName('meals');
    if (meals) expect(meals.editable).toBe(false); // relation list
  });

  it('masks sensitive fields (passwordHash) as non-editable', () => {
    const user = getModelMeta('User')!;
    const pw = user.fields.find((f) => f.name === 'passwordHash');
    if (pw) {
      expect(pw.sensitive).toBe(true);
      expect(pw.editable).toBe(false);
    }
  });

  it('captures enum values (Role)', () => {
    const user = getModelMeta('User')!;
    const role = user.fields.find((f) => f.name === 'role')!;
    expect(role.kind).toBe('enum');
    expect(role.enumValues).toContain('ADMIN');
  });

  it('covers the new maintenance model', () => {
    expect(getModelMeta('MaintenanceProfile')).not.toBeNull();
  });
});

describe('delegateName', () => {
  it('lowercases the first letter only', () => {
    expect(delegateName('HealthProfile')).toBe('healthProfile');
    expect(delegateName('User')).toBe('user');
  });
});

describe('coerceValue', () => {
  it('coerces integers and rejects non-integers', () => {
    expect(coerceValue(field({ type: 'Int' }), '42')).toBe(42);
    expect(() => coerceValue(field({ type: 'Int' }), '4.2')).toThrow();
  });

  it('coerces Float and Decimal', () => {
    expect(coerceValue(field({ type: 'Float' }), '1.5')).toBe(1.5);
    expect(String(coerceValue(field({ type: 'Decimal' }), '2.25'))).toBe('2.25');
  });

  it('coerces booleans from strings', () => {
    expect(coerceValue(field({ type: 'Boolean' }), 'true')).toBe(true);
    expect(coerceValue(field({ type: 'Boolean' }), '0')).toBe(false);
  });

  it('parses DateTime and rejects invalid', () => {
    expect(coerceValue(field({ type: 'DateTime' }), '2026-08-09T00:00:00.000Z')).toBeInstanceOf(Date);
    expect(() => coerceValue(field({ type: 'DateTime' }), 'not-a-date')).toThrow();
  });

  it('parses Json and rejects invalid', () => {
    expect(coerceValue(field({ type: 'Json' }), '{"a":1}')).toEqual({ a: 1 });
    expect(() => coerceValue(field({ type: 'Json' }), '{bad')).toThrow();
  });

  it('validates enum membership', () => {
    const f = field({ kind: 'enum', type: 'Role', enumValues: ['USER', 'ADMIN'] });
    expect(coerceValue(f, 'ADMIN')).toBe('ADMIN');
    expect(() => coerceValue(f, 'ROOT')).toThrow();
  });

  it('empty → null when optional, throws when required', () => {
    expect(coerceValue(field({ isRequired: false }), '')).toBeNull();
    expect(() => coerceValue(field({ isRequired: true }), '')).toThrow();
  });
});
