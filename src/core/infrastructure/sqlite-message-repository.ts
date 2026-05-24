/**
 * SQLite message repository — implements MessageRepository.
 */
import type { MessageRepository, SaveMessageParams } from '../app/interfaces';
import type { Message } from '../domain/types';
import { saveMessage, getMessageHistory, getAllMessages } from '../db/messages';

export function createMessageRepository(): MessageRepository {
  return {
    async save(params: SaveMessageParams): Promise<void> {
      await saveMessage(params);
    },
    async getHistory(limit: number = 20): Promise<Message[]> {
      const msgs = await getMessageHistory(limit);
      return msgs.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
        createdAt: m.createdAt,
      }));
    },
    async getAll(): Promise<Message[]> {
      const msgs = await getAllMessages();
      return msgs.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
        createdAt: m.createdAt,
      }));
    },
  };
}
