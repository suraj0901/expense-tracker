import type { EventRepository, InsertEventParams } from '../app/interfaces';
import type { AppEvent, EventType, EventStatus } from '../domain/types';
import { insertEvent, getRecentEvents, getAllEvents, updateEventStatus, dismissAllEvents } from '../db/events';

function mapRow(r: {
  id: string; type: string; title: string; body: string;
  data: string | null; status: string; createdAt: number; actedAt: number | null;
}): AppEvent {
  return {
    id: r.id,
    type: r.type as EventType,
    title: r.title,
    body: r.body,
    data: r.data ? JSON.parse(r.data) : null,
    status: r.status as EventStatus,
    createdAt: r.createdAt,
    actedAt: r.actedAt,
  };
}

export function createEventRepository(): EventRepository {
  return {
    async insert(params: InsertEventParams) {
      await insertEvent(params);
      return { success: true, id: params.id };
    },

    async getRecent(limit = 100) {
      const rows = await getRecentEvents(limit);
      return rows.reverse().map(mapRow);
    },

    async getAll() {
      const rows = await getAllEvents();
      return rows.map(mapRow);
    },

    async updateStatus(id, status) {
      await updateEventStatus(id, status);
    },

    async dismissAll(type) {
      await dismissAllEvents(type);
    },
  };
}
