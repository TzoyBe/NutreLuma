import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { logger } from '../logger';
import {
  coerceValue,
  getModelMeta,
  listModelMeta,
  MASK,
  type FieldMeta,
  type ModelMeta,
} from '@/lib/admin-db-meta';

interface Delegate {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  count: (args?: unknown) => Promise<number>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
  delete: (args: unknown) => Promise<Record<string, unknown>>;
}

function delegateFor(meta: ModelMeta): Delegate {
  const delegate = (prisma as unknown as Record<string, Delegate>)[meta.delegate];
  if (!delegate || typeof delegate.findMany !== 'function') {
    throw new ApiError('NOT_FOUND', 'Unknown model.');
  }
  return delegate;
}

/** Whitelist: μόνο ονόματα models που υπάρχουν στο DMMF γίνονται δεκτά. */
function requireModel(model: string): ModelMeta {
  const meta = getModelMeta(model);
  if (!meta) throw new ApiError('NOT_FOUND', 'Unknown model.');
  return meta;
}

function serializeValue(value: unknown, field?: FieldMeta): unknown {
  if (value === null || value === undefined) return null;
  if (field?.sensitive) return MASK;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function serializeRow(meta: ModelMeta, row: Record<string, unknown>): Record<string, unknown> {
  const byName = new Map(meta.fields.map((f) => [f.name, f]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = serializeValue(value, byName.get(key));
  }
  return out;
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new ApiError('NOT_FOUND', 'Record not found.');
    if (error.code === 'P2003') throw new ApiError('BAD_REQUEST', 'Related record constraint failed.');
    if (error.code === 'P2002') throw new ApiError('CONFLICT', 'A record with these values already exists.');
    throw new ApiError('BAD_REQUEST', `Database error (${error.code}).`);
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new ApiError('BAD_REQUEST', 'Invalid value for one or more fields.');
  }
  if (error instanceof ApiError) throw error;
  throw new ApiError('BAD_REQUEST', error instanceof Error ? error.message : 'Update failed.');
}

export interface ModelSummary {
  name: string;
  delegate: string;
  count: number;
  editable: boolean;
}

export async function listModels(): Promise<ModelSummary[]> {
  const metas = listModelMeta();
  const summaries = await Promise.all(
    metas.map(async (meta) => {
      let count = 0;
      try {
        count = await delegateFor(meta).count();
      } catch {
        count = 0;
      }
      return { name: meta.name, delegate: meta.delegate, count, editable: meta.pkField !== null };
    }),
  );
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export interface RowsResult {
  model: string;
  pkField: string | null;
  fields: FieldMeta[];
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

export async function listRows(
  model: string,
  options: { page: number; pageSize: number; search?: string },
): Promise<RowsResult> {
  const meta = requireModel(model);
  const delegate = delegateFor(meta);

  const stringFields = meta.fields.filter(
    (f) => f.kind === 'scalar' && f.type === 'String' && !f.sensitive && !f.isList,
  );
  const where =
    options.search && stringFields.length > 0
      ? { OR: stringFields.map((f) => ({ [f.name]: { contains: options.search, mode: 'insensitive' } })) }
      : {};

  const hasCreatedAt = meta.fields.some((f) => f.name === 'createdAt');
  const orderBy = hasCreatedAt
    ? { createdAt: 'desc' as const }
    : meta.pkField
      ? { [meta.pkField]: 'asc' as const }
      : undefined;

  const [rows, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy,
      take: options.pageSize,
      skip: (options.page - 1) * options.pageSize,
    }),
    delegate.count({ where }),
  ]);

  return {
    model: meta.name,
    pkField: meta.pkField,
    fields: meta.fields,
    rows: rows.map((row) => serializeRow(meta, row)),
    total,
    page: options.page,
    pageSize: options.pageSize,
  };
}

function buildUpdateData(meta: ModelMeta, data: Record<string, unknown>): Record<string, unknown> {
  const byName = new Map(meta.fields.map((f) => [f.name, f]));
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(data)) {
    const field = byName.get(key);
    // Άγνωστα ή μη-επεξεργάσιμα πεδία αγνοούνται σιωπηλά — δεν φτάνουν ποτέ στο Prisma.
    if (!field || !field.editable) continue;
    out[key] = coerceValue(field, raw);
  }
  return out;
}

export async function updateRow(
  model: string,
  id: string,
  data: Record<string, unknown>,
  adminId: string,
): Promise<Record<string, unknown>> {
  const meta = requireModel(model);
  if (!meta.pkField) throw new ApiError('BAD_REQUEST', 'This model has no single primary key and is read-only.');
  const delegate = delegateFor(meta);

  const updateData = buildUpdateData(meta, data);
  if (Object.keys(updateData).length === 0) {
    throw new ApiError('BAD_REQUEST', 'No editable fields provided.');
  }

  try {
    const row = await delegate.update({ where: { [meta.pkField]: id }, data: updateData });
    logger.info('admin_db_update', { model: meta.name, id, adminId, keys: Object.keys(updateData) });
    return serializeRow(meta, row);
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteRow(model: string, id: string, adminId: string): Promise<void> {
  const meta = requireModel(model);
  if (!meta.pkField) throw new ApiError('BAD_REQUEST', 'This model has no single primary key and is read-only.');
  const delegate = delegateFor(meta);

  try {
    await delegate.delete({ where: { [meta.pkField]: id } });
    logger.info('admin_db_delete', { model: meta.name, id, adminId });
  } catch (error) {
    mapPrismaError(error);
  }
}
