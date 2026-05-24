import { desc, asc, eq, and } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';

interface InsertEventParams {
  id: string; type: string; title: string; body: string;
  data?: Record<string, unknown> | null; status?: string;
  createdAt: number;
}

export async function insertEvent(params: InsertEventParams) {
  await db.insert(schema.events).values({
    id: params.id,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data ? JSON.stringify(params.data) : null,
    status: params.status ?? 'pending',
    createdAt: params.createdAt,
    actedAt: null,
  });
}

export async function getRecentEvents(limit: number = 100) {
  return db.select().from(schema.events)
    .orderBy(desc(schema.events.createdAt))
    .limit(limit);
}

export async function getAllEvents() {
  return db.select().from(schema.events)
    .orderBy(asc(schema.events.createdAt));
}

export async function updateEventStatus(id: string, status: string) {
  const actedAt = status === 'acted' ? Date.now() : null;
  await db.update(schema.events)
    .set({ status, actedAt })
    .where(eq(schema.events.id, id));
}

export async function dismissAllEvents(type?: string) {
  const whereClause = type
    ? and(eq(schema.events.status, 'pending'), eq(schema.events.type, type))
    : eq(schema.events.status, 'pending');
  await db.update(schema.events)
    .set({ status: 'dismissed' })
    .where(whereClause);
}
