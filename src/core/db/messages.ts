/**
 * Message persistence — save and retrieve chat messages.
 */
import { eq, desc } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';

interface SaveMessageParams {
  id: string; role: string; content: string;
  toolCalls?: unknown[] | null; createdAt: number;
}

export async function saveMessage(params: SaveMessageParams) {
  await db.insert(schema.messages).values({
    id: params.id, role: params.role, content: params.content,
    toolCalls: params.toolCalls ? JSON.stringify(params.toolCalls) : null,
    createdAt: params.createdAt,
  });
}

export async function getMessageHistory(limit: number = 20) {
  const msgs = await db.select().from(schema.messages)
    .orderBy(desc(schema.messages.createdAt)).limit(limit);
  return msgs.reverse();
}

export async function getAllMessages() {
  return db.select().from(schema.messages).orderBy(schema.messages.createdAt);
}
